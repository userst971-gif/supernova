import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { createFabricMaterial } from './fabricTextures';

// Procedural canvas tote — used while no licensed tote GLB is available
// (see ASSETS.md). Real canvas-fabric PBR, tapered gusseted body, rounded
// bottom corners and webbing handles. The front panel is named 'tote-front'
// so the viewer can target it for the print decal.

const W_TOP = 0.43; // half width at the rim
const W_BOT = 0.36; // half width at the base (taper)
const Y_TOP = 0.39; // rim height
const Y_BOT = -0.39; // base height
const D = 0.09; // half depth
const R = 0.075; // bottom corner radius

function buildGeometries() {
  const geos = [];

  // Front panel (faces +Z) and back panel (rotated so it faces -Z).
  const shape = new THREE.Shape();
  shape.moveTo(-W_TOP, Y_TOP);
  shape.lineTo(W_TOP, Y_TOP);
  shape.lineTo(W_BOT, Y_BOT + R);
  shape.quadraticCurveTo(W_BOT, Y_BOT, W_BOT - R, Y_BOT);
  shape.lineTo(-W_BOT + R, Y_BOT);
  shape.quadraticCurveTo(-W_BOT, Y_BOT, -W_BOT, Y_BOT + R);
  shape.closePath();
  const front = new THREE.ShapeGeometry(shape);
  const back = new THREE.ShapeGeometry(shape);
  back.rotateY(Math.PI);
  geos.push(front, back);

  // Side gussets (trapezoids connecting the panel edges).
  const side = (sx) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      'position',
      new THREE.BufferAttribute(
        new Float32Array([
          sx * W_TOP, Y_TOP, D,
          sx * W_BOT, Y_BOT, D,
          sx * W_TOP, Y_TOP, -D,
          sx * W_TOP, Y_TOP, -D,
          sx * W_BOT, Y_BOT, D,
          sx * W_BOT, Y_BOT, -D,
        ]),
        3
      )
    );
    g.computeVertexNormals();
    geos.push(g);
  };
  side(1);
  side(-1);

  // Bottom panel.
  const bottom = new THREE.BufferGeometry();
  bottom.setAttribute(
    'position',
    new THREE.BufferAttribute(
      new Float32Array([
        -W_BOT, Y_BOT, D,
        W_BOT, Y_BOT, D,
        -W_BOT, Y_BOT, -D,
        -W_BOT, Y_BOT, -D,
        W_BOT, Y_BOT, D,
        W_BOT, Y_BOT, -D,
      ]),
      3
    )
  );
  bottom.computeVertexNormals();
  geos.push(bottom);

  // Webbing handles — closed tubes arched over the rim.
  const handle = (hx) => {
    const pts = [
      new THREE.Vector3(hx, Y_TOP + 0.02, D * 0.5),
      new THREE.Vector3(hx, Y_TOP + 0.12, D * 0.5),
      new THREE.Vector3(hx, Y_TOP + 0.19, D * 0.16),
      new THREE.Vector3(hx, Y_TOP + 0.23, 0),
      new THREE.Vector3(hx, Y_TOP + 0.19, -D * 0.16),
      new THREE.Vector3(hx, Y_TOP + 0.12, -D * 0.5),
      new THREE.Vector3(hx, Y_TOP + 0.02, -D * 0.5),
    ];
    const curve = new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.5);
    const g = new THREE.TubeGeometry(curve, 48, 0.02, 10, true);
    geos.push(g);
  };
  handle(-0.25);
  handle(0.25);

  return geos;
}

export default function Tote({ color, groupRef }) {
  const geometries = useMemo(() => buildGeometries(), []);

  // Material is built synchronously (fabric texture source is cached, so this
  // is just a few texture clones) and cached per color — no extra render pass.
  const matRef = useRef(null);
  if (!matRef.current || matRef.current.colorKey !== color) {
    if (matRef.current) matRef.current.dispose();
    matRef.current = createFabricMaterial('canvas', color, { repeat: 1.2 });
    matRef.current.colorKey = color;
  }
  const material = matRef.current.material;

  useEffect(() => {
    return () => {
      geometries.forEach((g) => g.dispose());
      if (matRef.current) matRef.current.dispose();
    };
  }, [geometries]);

  return (
    <group ref={groupRef} name="tote-root">
      <mesh name="tote-front" geometry={geometries[0]} material={material} castShadow receiveShadow />
      <mesh geometry={geometries[1]} material={material} castShadow receiveShadow />
      <mesh geometry={geometries[2]} material={material} castShadow receiveShadow />
      <mesh geometry={geometries[3]} material={material} castShadow receiveShadow />
      <mesh geometry={geometries[4]} material={material} castShadow receiveShadow />
      <mesh geometry={geometries[5]} material={material} castShadow receiveShadow />
      <mesh geometry={geometries[6]} material={material} castShadow receiveShadow />
    </group>
  );
}
