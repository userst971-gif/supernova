import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useGLTF } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import PrintOverlay from './PrintOverlay';
import Tote from './Tote';
import { tintMaterial } from './materialTint';

// Every garment (GLB or procedural) is scaled so its bounding height == 1 and
// its bbox center sits on the origin. Print zones and placement offsets in
// config/design.js are expressed in those normalized units, so placement maths
// is identical across products.
const NORM_H = 1;

function GltfContent({ model, groupRef }) {
  const { scene } = useGLTF(model);
  // Clone isolates material swaps (tint, decal) from the drei GLTF cache. The
  // clone shares geometry + baked maps; only per-mount material clones and the
  // print mesh are owned here.
  const clone = useMemo(() => scene.clone(true), [scene]);
  return <group ref={groupRef}><primitive object={clone} /></group>;
}

/**
 * Normalizes the garment to unit height centred on the origin. Idempotent: the
 * transforms are reset before re-deriving, so repeated runs never inflate the
 * measured box.
 */
function normalize(group) {
  group.scale.set(1, 1, 1);
  group.position.set(0, 0, 0);
  group.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(group);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const s = NORM_H / size.y;
  group.scale.setScalar(s);
  group.position.set(-center.x * s, -center.y * s, -center.z * s);
  group.updateMatrixWorld(true);
  return { size: size.multiplyScalar(s), box };
}

/**
 * ApparelModel — mounts the garment (GLB or procedural tote), normalizes it,
 * tints it with the exact colorway (see materialTint.js), frames the camera
 * dynamically from the actual bounding box, and renders the print overlay.
 */
export default function ApparelModel({ product, color, texture, placement, tool, face, onReady, onFrame, diagnose, onPlacementChange }) {
  const [group, setGroup] = useState(null);
  const disposer = useRef([]);
  const lastFrameKey = useRef('');
  const invalidate = useThree((s) => s.invalidate);
  const isTote = !product.model;
  const front = (product.print || {}).front !== false;
  const zone = product.print || { y: 0, size: [0.3, 0.2] };

  const attach = useCallback((g) => setGroup(g), []);

  useLayoutEffect(() => {
    if (!group) return;
    const { size } = normalize(group);

    // Tint the garment with the exact colorway (GLB only; the tote builds its
    // own fabric material in Tote.jsx).
    if (!isTote) {
      const disposables = [];
      group.traverse((o) => {
        if (!o.isMesh) return;
        o.castShadow = true;
        o.receiveShadow = true;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) {
          if (!m) continue;
          const mat = tintMaterial(m, color);
          o.material = mat;
          disposables.push(mat);
        }
      });
      disposer.current.forEach((d) => d.dispose());
      disposer.current = disposables;
    }

    // Dynamic camera framing from the real bbox: keep the widest dimension
    // (height for tee/tote, depth for the roomy hoodie) inside the vertical
    // frustum at any orbit angle. Only reframe when the geometry actually
    // changes — recoloring must NOT snap the camera.
    const dim = Math.max(size.x, size.y, size.z);
    const fov = product.camera?.fov ?? 34;
    const dist = dim / 2 / Math.tan(THREE.MathUtils.degToRad(fov) / 2) / 0.58;
    const key = `${product.id}|${dim.toFixed(4)}|${fov}`;
    if (key !== lastFrameKey.current) {
      lastFrameKey.current = key;
      onFrame?.({
        dist,
        y: product.camera?.y ?? 0.1,
        yaw: product.camera?.yaw ?? 0,
        min: dist * 0.72,
        max: dist * 1.9,
      });
    }

    // Tuning probe — exposes the front-face profile so the print zone and
    // framing can be verified/tuned from data (RenderPage ?probe=1).
    const materials = [];
    group.traverse((o) => {
      if (!o.isMesh) return;
      const m = Array.isArray(o.material) ? o.material[0] : o.material;
      if (!m) return;
      materials.push({
        name: o.name || 'mesh',
        color: `#${m.color ? m.color.getHexString() : '??'}`,
        hasMap: !!m.map,
        mapImage: !!m.map?.image,
        normalLoaded: !m.normalMap || !!m.normalMap.image,
        occlusion: !!m.occlusionMap,
      });
    });
    diagnose?.({
      model: product.model,
      bbox: { w: size.x, h: size.y, d: size.z },
      dist,
      materials,
      bands: probeFront(group, front),
    });

    onReady?.();
    invalidate();
  }, [group, product, color, isTote, front, onFrame, onReady, diagnose, invalidate]);

  useEffect(() => () => disposer.current.forEach((d) => d.dispose()), []);

  return (
    <>
      {isTote ? (
        <Tote color={color} groupRef={attach} />
      ) : (
        <Suspense fallback={null}>
          <GltfContent key={product.model} model={product.model} groupRef={attach} />
        </Suspense>
      )}
      <PrintOverlay target={group} texture={texture} zone={zone} placement={placement} front={front} onPlacementChange={onPlacementChange} tool={tool} face={face} />
    </>
  );
}

/**
 * Front-face height profile for tuning: for each y band across the garment
 * width, the fraction of rays that hit fabric and the front-surface z-range
 * (flat bands = chest; huge z-ranges = sleeves/limbs jutting forward).
 */
function probeFront(group, front) {
  const raycaster = new THREE.Raycaster();
  const dir = new THREE.Vector3(0, 0, front ? -1 : 1);
  const origin = new THREE.Vector3();
  const cols = 20;
  const width = 0.95;
  const bands = [];
  for (let y = -0.5; y <= 0.5; y += 0.05) {
    let hits = 0;
    let zMin = Infinity;
    let zMax = -Infinity;
    for (let ix = 0; ix <= cols; ix++) {
      origin.set((ix / cols - 0.5) * width, y, front ? 10 : -10);
      raycaster.set(origin, dir);
      const hs = raycaster.intersectObject(group, true);
      if (!hs.length) continue;
      hits++;
      if (hs[0].point.z < zMin) zMin = hs[0].point.z;
      if (hs[0].point.z > zMax) zMax = hs[0].point.z;
    }
    bands.push({ y: Math.round(y * 100) / 100, hits, zRange: zMax === -Infinity ? 0 : Math.round((zMax - zMin) * 1000) / 1000 });
  }
  return bands;
}
