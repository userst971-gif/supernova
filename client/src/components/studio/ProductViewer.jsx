import { useCallback, useEffect, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, ContactShadows } from '@react-three/drei';
import ApparelModel from './ApparelModel';
import StudioLight from './StudioLight';
import { onStudioDragging } from './dragState';

let studioBackdrop = null;

export default function ProductViewer({ product, color, texture, placement, tool, face, resetRef, onReady, frameloop = 'demand', diagnose, onPlacementChange }) {
  const [frame, setFrame] = useState(null);
  const [studioDragging, setStudioDragging] = useState(false);

  useEffect(() => onStudioDragging(setStudioDragging), []);

  const handleReady = useCallback(() => onReady?.(), [onReady]);

  return (
    <Canvas
      frameloop={frameloop}
      dpr={studioDragging ? [1, 1] : [1, 1.75]}
      gl={{ antialias: !studioDragging, powerPreference: 'high-performance' }}
      camera={{ fov: product.camera?.fov ?? 34, position: [0, 0.1, 3], near: 0.05, far: 100 }}
      shadows={!studioDragging}
    >
      <StudioLight />
      {!studioDragging && studioBackdrop && <primitive object={studioBackdrop} attach="background" />}
      <ApparelModel
        product={product}
        color={color}
        texture={texture}
        placement={placement}
        tool={tool}
        face={face}
        onReady={handleReady}
        onFrame={setFrame}
        diagnose={diagnose}
        onPlacementChange={onPlacementChange}
      />
      {!studioDragging && (
        <ContactShadows position={[0, -0.58, 0]} opacity={0.55} scale={9} blur={2.8} far={2.6} />
      )}
      <ViewRig frame={frame} product={product} resetRef={resetRef} />
      <Controls frame={frame} />
    </Canvas>
  );
}

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
