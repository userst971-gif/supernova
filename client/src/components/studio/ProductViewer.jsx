import { useCallback, useEffect, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, ContactShadows } from '@react-three/drei';
import ApparelModel from './ApparelModel';
import StudioLight from './StudioLight';

/**
 * Studio vignette backdrop — a faintly-lit centre that fades to void at the
 * edges. A pure-black garment is (0,0,0); against a #050606 background it is
 * literally invisible, so the backdrop centre is lifted a few steps so dark
 * silhouettes read (the "black must read black" requirement), while the edges
 * stay deep so the studio never turns grey.
 */
const studioBackdrop = (() => {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(256, 300, 60, 256, 256, 380);
  g.addColorStop(0, '#1b1f24');
  g.addColorStop(0.5, '#101317');
  g.addColorStop(0.8, '#080a0c');
  g.addColorStop(1, '#050606');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 512);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
})();

/**
 * ProductViewer — the Design Studio's garment stage: one Canvas hosting the
 * garment (normalized + tinted), the surface-conforming print overlay, a dark
 * premium studio light rig, dynamic per-product camera framing and orbit
 * controls. GarmentStage is now a thin wrapper around this component so both
 * Design.jsx and RenderPage.jsx keep their existing contracts.
 */
export default function ProductViewer({ product, color, texture, placement, resetRef, onReady, frameloop = 'demand', diagnose, onPlacementChange }) {
  const [frame, setFrame] = useState(null);

  const handleReady = useCallback(() => onReady?.(), [onReady]);

  return (
    <Canvas
      frameloop={frameloop}
      dpr={[1, 1.75]}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      camera={{ fov: product.camera?.fov ?? 34, position: [0, 0.1, 3], near: 0.05, far: 100 }}
      shadows
    >
      <StudioLight />
      {studioBackdrop && <primitive object={studioBackdrop} attach="background" />}
      <ApparelModel
        product={product}
        color={color}
        texture={texture}
        placement={placement}
        onReady={handleReady}
        onFrame={setFrame}
        diagnose={diagnose}
        onPlacementChange={onPlacementChange}
      />
      <ContactShadows position={[0, -0.58, 0]} opacity={0.55} scale={9} blur={2.8} far={2.6} />
      <ViewRig frame={frame} product={product} resetRef={resetRef} />
      <Controls frame={frame} />
    </Canvas>
  );
}

/** Moves the camera to the product's framing and saves it as the reset state. */
function ViewRig({ frame, product, resetRef }) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls);
  const invalidate = useThree((s) => s.invalidate);
  const id = product.id;

  useEffect(() => {
    if (!frame) return;
    const yaw = product.camera?.yaw ?? frame.yaw ?? 0;
    camera.position.set(Math.sin(yaw) * frame.dist, frame.y, Math.cos(yaw) * frame.dist);
    camera.lookAt(0, 0, 0);
    controls?.update();
    controls?.saveState();
    invalidate();
  }, [id, frame, product, camera, controls, invalidate]);

  useEffect(() => {
    resetRef.current = () => {
      controls?.reset();
      invalidate();
    };
    return () => {
      resetRef.current = null;
    };
  }, [controls, resetRef, invalidate]);

  return null;
}

function Controls({ frame }) {
  const invalidate = useThree((s) => s.invalidate);
  return (
    <OrbitControls
      makeDefault
      enablePan={false}
      minDistance={frame?.min ?? 1.6}
      maxDistance={frame?.max ?? 6}
      minPolarAngle={0.12}
      maxPolarAngle={1.5}
      target={[0, 0, 0]}
      onChange={() => invalidate()}
    />
  );
}
