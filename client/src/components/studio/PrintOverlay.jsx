import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { DecalGeometry } from 'three/examples/jsm/geometries/DecalGeometry.js';
import { useThree } from '@react-three/fiber';

// Placement bounds — must match the sliders in Design.jsx so direct
// manipulation and the panel can never disagree.
const PLACEMENT_MIN = -0.4;
const PLACEMENT_MAX = 0.4;
const SCALE_MIN = 0.5;
const SCALE_MAX = 2.5;

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

function ndcFromEvent(e, gl) {
  const rect = gl.domElement.getBoundingClientRect();
  return new THREE.Vector2(
    ((e.clientX - rect.left) / rect.width) * 2 - 1,
    -((e.clientY - rect.top) / rect.height) * 2 + 1
  );
}

function rayFromNDC(ndc, camera) {
  const v = new THREE.Vector3(ndc.x, ndc.y, 0.5).unproject(camera);
  return new THREE.Ray(camera.position, v.sub(camera.position).normalize());
}

/**
 * PrintOverlay — projects the customer's artwork onto the garment's actual
 * surface as an OPAQUE screen-print.
 *
 * The projector is fitted to the real surface, not the garment's axis-aligned
 * box: a raycast grid over the print footprint samples the fabric and the
 * projector plane (position + outward normal) is derived from those hits. The
 * decal then hugs the chest even on models whose node transform carries a
 * baked tilt (the current hoodie GLB) — the print never floats or skews, and
 * the clip footprint follows the chest band the user actually sees.
 *
 * Each garment mesh is clipped with DecalGeometry (proper edge-clipping, so
 * fan-triangulated panels like the tote's ShapeGeometry still print). All
 * fragments share the projector's local frame, so they merge into ONE opaque
 * mesh — no whole-garment bleed, no transparent material over the fabric.
 * The art is rotated by rotating its texture, so it stays surface-conforming.
 *
 * Slider controls fire on every input, so geometry is rebuilt on a debounced
 * trailing timer (~80ms) — dragging placement re-prints at most ~12x/sec.
 * While a pointer interaction is active the debounce drops to ~8ms so the
 * print tracks the cursor.
 *
 * Direct manipulation (only when onPlacementChange is provided, i.e. the
 * studio — RenderPage renders passive renders):
 *  - drag the print body → raycast to a camera-facing plane through the
 *    print centre; the screen delta is converted into the print's local frame
 *    (local X/Y == placement x/y because the garment is normalized to height
 *    1 and the projector's basis is derived from world-up), clamped to the
 *    slider bounds.
 *  - drag the corner handle → the handle's screen distance from the print
 *    centre is ratio-scaled against its distance at pointer-down.
 * OrbitControls are disabled while hovering the print or during a drag so
 * dragging on the print moves it instead of orbiting the camera.
 *
 * Props:
 *  target            — garment root (THREE.Object3D) to print onto (null until ready)
 *  texture           — CanvasTexture carrying the artwork (square, transparent bg)
 *  zone              — { y, size:[w,h] } print footprint (normalized, model height 1)
 *  placement         — { x, y, scale, rotation } user placement
 *  front             — true for front prints (camera at +Z)
 *  onPlacementChange — (patch) => void; enables drag-to-move/resize
 */
export default function PrintOverlay({ target, texture, zone, placement, front = true, onPlacementChange }) {
  const invalidate = useThree((s) => s.invalidate);
  const controls = useThree((s) => s.controls);
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const [geometry, setGeometry] = useState(null);
  const [dragMode, setDragMode] = useState(null); // null | 'move' | 'scale'
  const [hovering, setHovering] = useState(false);
  const timer = useRef(null);
  const poseRef = useRef(null);
  const dragRef = useRef(null);
  const hoverRef = useRef(false);
  const onChangeRef = useRef(onPlacementChange);
  const groupRef = useRef(null);

  useEffect(() => {
    onChangeRef.current = onPlacementChange;
  }, [onPlacementChange]);

  const editable = !!onPlacementChange;

  const rebuild = useCallback(() => {
    if (!target || !texture) {
      setGeometry(null);
      invalidate();
      return;
    }
    target.updateWorldMatrix(true, true);

    const zoneW = zone.size[0] * placement.scale;
    const zoneH = zone.size[1] * placement.scale;

    // Fit the projector to the surface under the print footprint.
    const fit = fitSurface(target, placement.x, zone.y + placement.y, zoneW, zoneH, front);
    if (!fit) {
      setGeometry(null);
      invalidate();
      return;
    }
    const { center, normal } = fit;

    // Projector basis: +Z = surface normal, right stays horizontal so the art
    // never looks rotated when the garment tilts.
    const up = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(up, normal);
    if (right.lengthSq() < 1e-8) right.set(1, 0, 0);
    right.normalize();
    const basisUp = new THREE.Vector3().crossVectors(normal, right).normalize();
    const orientation = new THREE.Matrix4().makeBasis(right, basisUp, normal);
    const euler = new THREE.Euler().setFromRotationMatrix(orientation);
    const quat = new THREE.Quaternion().setFromEuler(euler);

    // Aspect-fit the artwork inside the footprint so it is never distorted.
    let w = zoneW;
    let h = zoneH;
    const img = texture.image;
    if (img && img.width && img.height) {
      const aspect = img.width / img.height;
      if (aspect > w / h) h = w / aspect;
      else w = h * aspect;
    }
    // Clip depth covers the fabric shell inside the footprint (chest is thin;
    // a padded slab never slices interior surfaces on a clean single mesh).
    const depth = Math.max(w, h) * 0.5 + 0.02;
    const size = new THREE.Vector3(w, h, depth);

    // Clip every mesh inside the print box; fragments live in the projector's
    // local frame, so all parts share coordinates and merge cleanly.
    const meshes = [];
    target.traverse((o) => {
      if (o.isMesh) meshes.push(o);
    });
    const parts = [];
    let totalVerts = 0;
    for (const mesh of meshes) {
      try {
        const g = new DecalGeometry(mesh, center, euler, size);
        if (g.attributes.position.count === 0) {
          g.dispose();
          continue;
        }
        parts.push(g);
        totalVerts += g.attributes.position.count;
      } catch {
        /* non-printable shell — skip */
      }
    }
    if (!parts.length) {
      setGeometry(null);
      invalidate();
      return;
    }

    const merged = new THREE.BufferGeometry();
    const positions = new Float32Array(totalVerts * 3);
    const normals = new Float32Array(totalVerts * 3);
    const uvs = new Float32Array(totalVerts * 2);
    let off = 0;
    for (const g of parts) {
      positions.set(g.attributes.position.array, off * 3);
      normals.set(g.attributes.normal.array, off * 3);
      uvs.set(g.attributes.uv.array, off * 2);
      off += g.attributes.position.count;
      g.dispose();
    }
    // DecalGeometry outputs vertices in WORLD space (line 134 of Three.js
    // DecalGeometry transforms back via projectorMatrix). The <group> applies
    // position + quaternion on top, which would double-transform. Transform
    // the merged geometry back to projector-local space so the group
    // correctly places the print on the surface.
    const groupPos = center.clone().addScaledVector(normal, 0.0002);
    const invProjector = new THREE.Matrix4()
      .makeRotationFromQuaternion(quat)
      .setPosition(groupPos)
      .invert();
    const quatInv = quat.clone().conjugate();
    for (let i = 0; i < positions.length; i += 3) {
      const v = new THREE.Vector3(positions[i], positions[i + 1], positions[i + 2]);
      v.applyMatrix4(invProjector);
      positions[i] = v.x;
      positions[i + 1] = v.y;
      positions[i + 2] = v.z;
      const n = new THREE.Vector3(normals[i], normals[i + 1], normals[i + 2]);
      n.applyQuaternion(quatInv);
      normals[i] = n.x;
      normals[i + 1] = n.y;
      normals[i + 2] = n.z;
    }
    merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    merged.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    merged.computeBoundingSphere();
    merged.computeBoundingBox();

    setGeometry((old) => {
      if (old && old !== merged) old.dispose();
      return merged;
    });
    // Lift the whole mesh a hair along its normal so the opaque print always
    // clears the fabric in the depth buffer. size is the aspect-fit footprint
    // used by the resize handle's corner placement.
    // Seat the resize handle just above the ACTUAL surface at the print's
    // corner: the chest is convex, so the fabric at the corner can bulge
    // toward the camera past a flat fixed offset — the handle would render on
    // top (depthTest=false) but raycasts would hit the print body first and
    // the corner drag would never start a resize.
    let handleZ = 0.016;
    if (onChangeRef.current) {
      const corner = new THREE.Vector3(w / 2 - 0.02, h / 2 - 0.02, 10);
      corner.applyQuaternion(quat).add(center);
      const probe = new THREE.Raycaster(
        corner,
        new THREE.Vector3(0, 0, -1).applyQuaternion(quat)
      );
      const hits = probe.intersectObject(target, true);
      if (hits.length) {
        const local = hits[0].point.clone().sub(center).applyQuaternion(quat.clone().invert());
        handleZ = Math.max(0.008, local.z + 0.01);
      }
    }
    poseRef.current = {
      position: center.clone().addScaledVector(normal, 0.0002),
      quaternion: quat.clone(),
      size: { w, h },
      handleZ,
    };
    invalidate();
  }, [target, texture, zone, placement.scale, placement.x, placement.y, front, invalidate]);

  // Debounced rebuild — placement emits per-input. Pointer drags use the fast
  // debounce so the print tracks the cursor smoothly.
  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(rebuild, dragMode ? 8 : 80);
    return () => clearTimeout(timer.current);
  }, [rebuild, dragMode]);

  // Rotation is applied to the texture so the art stays surface-conforming.
  useEffect(() => {
    if (!texture) return;
    texture.center.set(0.5, 0.5);
    texture.rotation = (-placement.rotation * Math.PI) / 180;
    texture.needsUpdate = true;
    invalidate();
  }, [texture, placement.rotation, invalidate]);

  useEffect(() => {
    return () => {
      poseRef.current = null;
      dragRef.current = null;
      setGeometry((old) => {
        if (old) old.dispose();
        return null;
      });
    };
  }, []);

  // Lock orbit while the pointer hovers the print or a drag is active.
  useEffect(() => {
    if (controls) controls.enabled = !hovering && !dragMode;
  }, [controls, hovering, dragMode]);

  // Cursor feedback: move over the print, grab while moving it, resize handle.
  useEffect(() => {
    const el = gl?.domElement;
    if (!el) return;
    if (dragMode === 'scale') el.style.cursor = 'nwse-resize';
    else if (dragMode === 'move') el.style.cursor = 'grabbing';
    else if (hovering && editable) el.style.cursor = 'move';
    else el.style.cursor = '';
  }, [gl, hovering, dragMode, editable]);

  const onEnter = useCallback(() => {
    hoverRef.current = true;
    setHovering(true);
    if (controls && !dragRef.current) controls.enabled = false;
  }, [controls]);

  const onLeave = useCallback(() => {
    hoverRef.current = false;
    setHovering(false);
    if (controls && !dragRef.current) controls.enabled = true;
  }, [controls]);

  const handleDown = useCallback(
    (e, mode) => {
      const pose = poseRef.current;
      if (!editable || !pose || dragRef.current) return;
      // R3F dispatches onPointerDown to every hit object with a handler, in
      // distance order. The handle planes normally sort ahead of the print
      // body, but during a geometry rebuild the group's matrixWorld can be a
      // frame stale, so the handle sometimes LOSES the ordering and the print
      // body's 'move' handler runs alone. Re-test the event ray against the
      // handle meshes explicitly: whenever the pointer is actually on the
      // corner handle, it must resize — never move the print.
      const g = groupRef.current;
      if (g && mode === 'move') {
        const test = new THREE.Raycaster();
        test.ray.copy(e.ray);
        const first = test.intersectObjects(g.children, false).find((hh) => hh.object !== g.children[0]);
        if (first) mode = 'scale';
      }
      e.stopPropagation();
      const pivot = pose.position.clone();
      const dir = pivot.clone().sub(camera.position).normalize();
      const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(dir, pivot);
      const hit = new THREE.Vector3();
      if (!e.ray.intersectPlane(plane, hit)) return;
      if (mode === 'move') {
        dragRef.current = {
          mode,
          plane,
          startPoint: hit.clone(),
          startX: placement.x,
          startY: placement.y,
          quatInv: pose.quaternion.clone().invert(),
        };
      } else {
        dragRef.current = {
          mode,
          plane,
          pivot,
          startScale: placement.scale,
          startDist: hit.distanceTo(pivot),
        };
      }
      if (controls) controls.enabled = false;
      setDragMode(mode);
    },
    [editable, camera, controls, placement.x, placement.y, placement.scale]
  );

  // Window-level drag driver: pointermove can leave the canvas without losing
  // the drag, and pointerup anywhere ends it reliably.
  useEffect(() => {
    if (!dragMode) return undefined;
    const onMove = (e) => {
      const d = dragRef.current;
      if (!d) return;
      const hit = new THREE.Vector3();
      if (!rayFromNDC(ndcFromEvent(e, gl), camera).intersectPlane(d.plane, hit)) return;
      if (d.mode === 'move') {
        const local = hit.sub(d.startPoint).applyQuaternion(d.quatInv);
        onChangeRef.current?.({
          x: clamp(d.startX + local.x, PLACEMENT_MIN, PLACEMENT_MAX),
          y: clamp(d.startY + local.y, PLACEMENT_MIN, PLACEMENT_MAX),
        });
      } else {
        const dist = hit.distanceTo(d.pivot);
        onChangeRef.current?.({ scale: clamp(d.startScale * (dist / d.startDist), SCALE_MIN, SCALE_MAX) });
      }
    };
    const onUp = () => {
      dragRef.current = null;
      setDragMode(null);
      if (controls) controls.enabled = !hoverRef.current;
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [dragMode, gl, camera, controls]);

  const pose = poseRef.current;
  if (!geometry || !texture || !pose) return null;

  const hx = pose.size.w / 2 - 0.02;
  const hy = pose.size.h / 2 - 0.02;
  const hz = pose.handleZ ?? 0.016;

  return (
    <group ref={groupRef} position={pose.position} quaternion={pose.quaternion}>
      <mesh
        geometry={geometry}
        onPointerDown={editable ? (e) => handleDown(e, 'move') : undefined}
        onPointerOver={editable ? onEnter : undefined}
        onPointerOut={editable ? onLeave : undefined}
        renderOrder={2}
      >
        <meshStandardMaterial
          map={texture}
          transparent={false}
          depthWrite
          depthTest
          polygonOffset
          polygonOffsetFactor={-0.4}
          polygonOffsetUnits={-0.4}
          roughness={0.95}
          metalness={0}
          side={THREE.FrontSide}
        />
      </mesh>
      {editable && (
        <>
          <mesh
            position={[hx, hy, hz]}
            onPointerDown={(e) => handleDown(e, 'scale')}
            onPointerOver={onEnter}
            onPointerOut={onLeave}
            renderOrder={4}
            frustumCulled={false}
          >
            <planeGeometry args={[0.14, 0.14]} />
            <meshBasicMaterial color="#0a2b1d" transparent={false} depthTest={false} side={THREE.DoubleSide} />
          </mesh>
          <mesh
            position={[hx, hy, hz + 0.004]}
            onPointerDown={(e) => handleDown(e, 'scale')}
            onPointerOver={onEnter}
            onPointerOut={onLeave}
            renderOrder={5}
            frustumCulled={false}
          >
            <planeGeometry args={[0.08, 0.08]} />
            <meshBasicMaterial color="#21f59a" depthTest={false} side={THREE.DoubleSide} />
          </mesh>
        </>
      )}
    </group>
  );
}

function fitSurface(target, cx, cy, w, h, front) {
  const raycaster = new THREE.Raycaster();
  const dir = new THREE.Vector3(0, 0, front ? -1 : 1);
  const origin = new THREE.Vector3();
  const step = 8;
  const points = [];
  const normals = [];
  for (let ix = 0; ix <= step; ix++) {
    for (let iy = 0; iy <= step; iy++) {
      origin.set(cx + (ix / step - 0.5) * w, cy + (iy / step - 0.5) * h, front ? 10 : -10);
      raycaster.set(origin, dir);
      const hits = raycaster.intersectObject(target, true);
      if (!hits.length) continue;
      points.push(hits[0].point);
      normals.push(hits[0].face.normal.clone().transformDirection(hits[0].object.matrixWorld));
    }
  }
  if (!points.length) return null;

  const center = new THREE.Vector3();
  for (const p of points) center.add(p);
  center.divideScalar(points.length);

  const normal = new THREE.Vector3();
  for (const n of normals) normal.add(n);
  if (normal.lengthSq() < 1e-6) normal.set(0, 0, front ? 1 : -1);
  normal.normalize();
  if (front && normal.z < 0) normal.negate();
  if (!front && normal.z > 0) normal.negate();
  return { center, normal };
}
