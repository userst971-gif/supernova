import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { DecalGeometry } from 'three/examples/jsm/geometries/DecalGeometry.js';
import { useThree } from '@react-three/fiber';

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

function linePoints(a, b) {
  return [a.x, a.y, a.z, b.x, b.y, b.z];
}

/**
 * PrintOverlay — projects artwork onto the garment surface as an opaque
 * screen-print. Supports toolbar-driven move / scale / rotate modes with
 * 4 corner handles, a rotation arc handle, and a bounding box outline.
 */
export default function PrintOverlay({ target, texture, zone, placement, front = true, onPlacementChange, tool = 'move' }) {
  const invalidate = useThree((s) => s.invalidate);
  const controls = useThree((s) => s.controls);
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const [geometry, setGeometry] = useState(null);
  const [dragMode, setDragMode] = useState(null);
  const timer = useRef(null);
  const poseRef = useRef(null);
  const dragRef = useRef(null);
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

    const fit = fitSurface(target, placement.x, zone.y + placement.y, zoneW, zoneH, front);
    if (!fit) {
      setGeometry(null);
      invalidate();
      return;
    }
    const { center, normal } = fit;

    const up = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(up, normal);
    if (right.lengthSq() < 1e-8) right.set(1, 0, 0);
    right.normalize();
    const basisUp = new THREE.Vector3().crossVectors(normal, right).normalize();
    const orientation = new THREE.Matrix4().makeBasis(right, basisUp, normal);
    const euler = new THREE.Euler().setFromRotationMatrix(orientation);
    const quat = new THREE.Quaternion().setFromEuler(euler);

    let w = zoneW;
    let h = zoneH;
    const img = texture.image;
    if (img && img.width && img.height) {
      const aspect = img.width / img.height;
      if (aspect > w / h) h = w / aspect;
      else w = h * aspect;
    }
    const depth = Math.max(w, h) * 0.5 + 0.02;
    const size = new THREE.Vector3(w, h, depth);

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
        /* skip */
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

  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(rebuild, dragMode ? 8 : 80);
    return () => clearTimeout(timer.current);
  }, [rebuild, dragMode]);

  useEffect(() => {
    if (!texture) return;
    texture.center.set(0.5, 0.5);
    texture.rotation = (-placement.rotation * Math.PI) / 180;
    texture.needsUpdate = true;
    invalidate();
  }, [texture, placement.rotation, invalidate]);

  useEffect(() => {
    return () => {
      clearTimeout(timer.current);
      setGeometry((old) => {
        if (old) old.dispose();
        return null;
      });
      poseRef.current = null;
      dragRef.current = null;
    };
  }, []);

  const hovering = dragMode !== null;

  const onEnter = useCallback(() => {
    if (controls && !dragRef.current) controls.enabled = false;
  }, [controls]);

  const onLeave = useCallback(() => {
    if (controls && !dragRef.current) controls.enabled = true;
  }, [controls]);

  const handleDown = useCallback(
    (e, mode) => {
      const pose = poseRef.current;
      if (!editable || !pose || dragRef.current) return;
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
      } else if (mode === 'scale') {
        dragRef.current = {
          mode,
          plane,
          pivot,
          startScale: placement.scale,
          startDist: hit.distanceTo(pivot),
        };
      } else if (mode === 'rotate') {
        const local = hit.clone().sub(pivot).applyQuaternion(pose.quaternion.clone().invert());
        const startAngle = Math.atan2(local.y, local.x);
        dragRef.current = {
          mode,
          plane,
          pivot,
          startAngle,
          origRotation: placement.rotation,
          quatInv: pose.quaternion.clone().invert(),
        };
      }
      if (controls) controls.enabled = false;
      setDragMode(mode);
    },
    [editable, camera, controls, placement]
  );

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
      } else if (d.mode === 'scale') {
        const dist = hit.distanceTo(d.pivot);
        onChangeRef.current?.({ scale: clamp(d.startScale * (dist / d.startDist), SCALE_MIN, SCALE_MAX) });
      } else if (d.mode === 'rotate') {
        const local = hit.clone().sub(d.pivot).applyQuaternion(d.quatInv);
        const angle = Math.atan2(local.y, local.x);
        const delta = ((angle - d.startAngle) * 180) / Math.PI;
        let rot = d.origRotation + delta;
        rot = ((rot % 360) + 360) % 360;
        onChangeRef.current?.({ rotation: Math.round(rot) });
      }
    };
    const onUp = () => {
      dragRef.current = null;
      setDragMode(null);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
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

  useEffect(() => {
    const el = gl?.domElement;
    if (!el) return;
    if (dragMode === 'scale') el.style.cursor = 'nwse-resize';
    else if (dragMode === 'move') el.style.cursor = 'grabbing';
    else if (dragMode === 'rotate') el.style.cursor = 'crosshair';
    else if (editable) el.style.cursor = tool === 'scale' ? 'nwse-resize' : tool === 'rotate' ? 'crosshair' : 'grab';
    else el.style.cursor = '';
  }, [gl, dragMode, editable, tool]);

  const pose = poseRef.current;
  if (!geometry || !texture || !pose) return null;

  const hw = pose.size.w / 2;
  const hh = pose.size.h / 2;
  const hz = pose.handleZ ?? 0.016;
  const cornerOff = 0.02;
  const handleSz = 0.04;

  const corners = [
    [-hw + cornerOff, -hh + cornerOff],
    [hw - cornerOff, -hh + cornerOff],
    [hw - cornerOff, hh - cornerOff],
    [-hw + cornerOff, hh - cornerOff],
  ];

  const rotArcR = Math.max(hw, hh) * 0.6;

  const boxColor = dragMode ? '#21f59a' : 'rgba(255,255,255,0.35)';

  return (
    <group ref={groupRef} position={pose.position} quaternion={pose.quaternion}>
      <mesh
        geometry={geometry}
        onPointerDown={editable ? (e) => handleDown(e, tool) : undefined}
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
          {/* Bounding box outline */}
          <lineSegments renderOrder={3} frustumCulled={false}>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                count={8}
                array={new Float32Array([
                  ...linePoints(new THREE.Vector3(-hw, -hh, hz), new THREE.Vector3(hw, -hh, hz)),
                  ...linePoints(new THREE.Vector3(hw, -hh, hz), new THREE.Vector3(hw, hh, hz)),
                  ...linePoints(new THREE.Vector3(hw, hh, hz), new THREE.Vector3(-hw, hh, hz)),
                  ...linePoints(new THREE.Vector3(-hw, hh, hz), new THREE.Vector3(-hw, -hh, hz)),
                ])}
                itemSize={3}
              />
            </bufferGeometry>
            <lineBasicMaterial color={boxColor} transparent opacity={0.6} depthTest={false} />
          </lineSegments>

          {/* Scale handles — 4 corners */}
          {tool === 'scale' &&
            corners.map(([cx, cy], i) => (
              <mesh
                key={i}
                position={[cx, cy, hz + 0.005]}
                onPointerDown={(e) => handleDown(e, 'scale')}
                onPointerOver={onEnter}
                onPointerOut={onLeave}
                renderOrder={5}
                frustumCulled={false}
              >
                <planeGeometry args={[handleSz, handleSz]} />
                <meshBasicMaterial color="#21f59a" transparent opacity={0.9} depthTest={false} side={THREE.DoubleSide} />
              </mesh>
            ))}

          {/* Rotation handle — arc + dot */}
          {tool === 'rotate' && (
            <>
              <mesh
                position={[0, rotArcR, hz + 0.005]}
                onPointerDown={(e) => handleDown(e, 'rotate')}
                onPointerOver={onEnter}
                onPointerOut={onLeave}
                renderOrder={5}
                frustumCulled={false}
              >
                <circleGeometry args={[0.03, 16]} />
                <meshBasicMaterial color="#21f59a" transparent opacity={0.9} depthTest={false} side={THREE.DoubleSide} />
              </mesh>
              {/* Connecting line */}
              <lineSegments renderOrder={4} frustumCulled={false}>
                <bufferGeometry>
                  <bufferAttribute
                    attach="attributes-position"
                    count={2}
                    array={new Float32Array([0, 0, hz + 0.003, 0, rotArcR, hz + 0.003])}
                    itemSize={3}
                  />
                </bufferGeometry>
                <lineBasicMaterial color="#21f59a" transparent opacity={0.4} depthTest={false} />
              </lineSegments>
            </>
          )}

          {/* Move mode — center crosshair */}
          {tool === 'move' && !dragMode && (
            <>
              <lineSegments renderOrder={4} frustumCulled={false}>
                <bufferGeometry>
                  <bufferAttribute
                    attach="attributes-position"
                    count={4}
                    array={new Float32Array([
                      -0.02, 0, hz + 0.005, 0.02, 0, hz + 0.005,
                      0, -0.02, hz + 0.005, 0, 0.02, hz + 0.005,
                    ])}
                    itemSize={3}
                  />
                </bufferGeometry>
                <lineBasicMaterial color="#21f59a" transparent opacity={0.6} depthTest={false} />
              </lineSegments>
            </>
          )}
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
