import * as THREE from 'three';

// Procedural PBR fabric textures (cotton knit for garments, coarse canvas for
// the tote). Generated once and cached as module singletons so materials are
// never recreated per frame. Each texture set is a small 512² canvas — cheap to
// generate and upload, plenty for a fabric weave.

const SIZE = 512;

function makeHeightCanvas(kind) {
  const c = document.createElement('canvas');
  c.width = SIZE;
  c.height = SIZE;
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, SIZE, SIZE);

  const coarse = kind === 'canvas';
  const thread = coarse ? 18 : 8; // thread pitch in px
  const amp = coarse ? 20 : 13; // weave relief amplitude

  // vertical threads
  for (let x = 0; x < SIZE; x += thread) {
    const shade = Math.sin((x / thread) * Math.PI) * amp;
    ctx.fillStyle = `rgb(${128 + shade},${128 + shade},${128 + shade * 0.5})`;
    ctx.fillRect(x, 0, thread - (coarse ? 3 : 2), SIZE);
  }
  // horizontal threads
  for (let y = 0; y < SIZE; y += thread) {
    const shade = Math.cos((y / thread) * Math.PI) * amp;
    ctx.fillStyle = `rgb(${128 + shade},${128 + shade},${128 + shade * 0.5})`;
    ctx.fillRect(0, y, SIZE, thread - (coarse ? 3 : 2));
  }

  // soft per-pixel fibre noise
  const img = ctx.getImageData(0, 0, SIZE, SIZE);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * (coarse ? 22 : 15);
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n * 0.8;
  }
  ctx.putImageData(img, 0, 0);
  return ctx.getImageData(0, 0, SIZE, SIZE);
}

function sobelNormals(height, out) {
  const w = height.width;
  const h = height.height;
  const d = height.data;
  const s = 2.4;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const l = d[(y * w + Math.max(0, x - 1)) * 4];
      const r = d[(y * w + Math.min(w - 1, x + 1)) * 4];
      const u = d[(Math.max(0, y - 1) * w + x) * 4];
      const b = d[(Math.min(h - 1, y + 1) * w + x) * 4];
      const dx = (l - r) / 255;
      const dy = (u - b) / 255;
      const nx = -dx * s;
      const ny = -dy * s;
      const inv = 1 / Math.sqrt(nx * nx + ny * ny + 1);
      const i = (y * w + x) * 4;
      out[i] = (nx * inv * 0.5 + 0.5) * 255;
      out[i + 1] = (ny * inv * 0.5 + 0.5) * 255;
      out[i + 2] = 255;
      out[i + 3] = 255;
    }
  }
}

function textureFromImageData(img, { srgb, anisotropy = 8 }) {
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = anisotropy;
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const cache = {};

/**
 * Returns { map, normalMap, roughnessMap } for a fabric kind.
 * kind: 'knit' (cotton garments) | 'canvas' (tote).
 */
export function getFabricTextures(kind = 'knit') {
  if (cache[kind]) return cache[kind];

  const height = makeHeightCanvas(kind);

  // Base color — near-white with the weave relief shaded in, so tinting with
  // material.color keeps fabric detail visible even for black garments.
  const base = document.createElement('canvas');
  base.width = SIZE;
  base.height = SIZE;
  const bctx = base.getContext('2d');
  bctx.fillStyle = kind === 'canvas' ? '#e7e2d5' : '#f4f3ee';
  bctx.fillRect(0, 0, SIZE, SIZE);
  const bd = bctx.getImageData(0, 0, SIZE, SIZE).data;
  const hd = height.data;
  for (let i = 0; i < bd.length; i += 4) {
    const lift = (hd[i] - 128) * 0.5; // weave highlights/shadows
    bd[i] += lift;
    bd[i + 1] += lift;
    bd[i + 2] += lift;
    bd[i + 3] = 255;
  }
  bctx.putImageData(new ImageData(bd, SIZE, SIZE), 0, 0);
  const map = new THREE.CanvasTexture(base);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;

  const normalImg = bctx.getImageData(0, 0, SIZE, SIZE);
  sobelNormals(height, normalImg.data);
  const normalMap = textureFromImageData(normalImg, { srgb: false });

  // Roughness — fabric is matte with slight variation from the weave.
  const rough = bctx.createImageData(SIZE, SIZE);
  const rd = rough.data;
  for (let i = 0; i < rd.length; i += 4) {
    const lift = (hd[i] - 128) / 128; // -1..1
    const v = Math.round(255 * Math.min(0.98, Math.max(0.82, 0.9 + lift * 0.06)));
    rd[i] = rd[i + 1] = rd[i + 2] = v;
    rd[i + 3] = 255;
  }
  const roughnessMap = textureFromImageData(rough, { srgb: false });

  cache[kind] = { map, normalMap, roughnessMap };
  return cache[kind];
}

/**
 * Creates a per-mesh PBR fabric material: base map (weave-shaded for tinting),
 * tangent-space normal map and roughness map, cloned from the shared module
 * cache so each material owns its repeat/rotation state. The returned object
 * exposes dispose() — call it when the material (or its cloned textures) is no
 * longer needed (garment switch / unmount).
 *
 * kind   — 'knit' | 'canvas'
 * color  — hex garment tint (never pure black, so the weave stays visible)
 * repeat — texture repeat per fabric quad
 * normal — set false when the model's UVs are fragmented/negative (a
 *          tangent-space normal map then distorts lighting and darkens the
 *          fabric — e.g. the interim hoodie GLB)
 */
export function createFabricMaterial(kind, color, { repeat = 1, normal = true } = {}) {
  const src = getFabricTextures(kind);
  const map = src.map.clone();
  const roughnessMap = src.roughnessMap.clone();
  map.repeat.set(repeat, repeat);
  roughnessMap.repeat.set(repeat, repeat);

  // Exact tint — black reads black. The weave relief is baked into the map's
  // own luminance variation and the normal map supplies surface detail, so a
  // near-black garment still reads as fabric, never a flat silhouette.
  const tint = new THREE.Color(color);

  const material = new THREE.MeshStandardMaterial({
    map,
    roughnessMap,
    roughness: 1, // roughness map drives per-texel variation
    metalness: 0,
    color: tint,
    side: THREE.DoubleSide,
  });

  if (normal) {
    const normalMap = src.normalMap.clone();
    normalMap.repeat.set(repeat, repeat);
    material.normalMap = normalMap;
  }

  return {
    material,
    dispose() {
      material.dispose();
      map.dispose();
      if (material.normalMap) material.normalMap.dispose();
      roughnessMap.dispose();
    },
  };
}

/** True when a mesh's UVs stay inside the standard 0..1 range (safe for a
 * tangent-space normal map). Negative or >1 UVs indicate fragmented islands. */
export function hasCleanUvs(mesh) {  const uv = mesh?.geometry?.attributes?.uv;
  if (!uv) return true;
  let minU = 1e9;
  let maxU = -1e9;
  let minV = 1e9;
  let maxV = -1e9;
  for (let i = 0; i < uv.count; i++) {
    const u = uv.getX(i);
    const v = uv.getY(i);
    if (u < minU) minU = u;
    if (u > maxU) maxU = u;
    if (v < minV) minV = v;
    if (v > maxV) maxV = v;
  }
  return minU >= -0.05 && maxU <= 1.05 && minV >= -0.05 && maxV <= 1.05;
}

/**
 * A garment-scale clone of the shared knit normal map, used as a fallback when
 * a model's baked normal map fails to decode (the tee GLB ships a truncated
 * normal JPEG). The clone is owned by the caller's material and disposed with
 * it.
 */
export function getKnitNormalMap() {
  const src = getFabricTextures('knit');
  const n = src.normalMap.clone();
  n.repeat.set(1.2, 1.2);
  return n;
}
