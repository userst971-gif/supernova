import * as THREE from 'three';
import { getKnitNormalMap } from './fabricTextures';

/**
 * Tinting a model's OWN baked base-color texture with a colorway.
 *
 * The hoodie GLB ships a real fabric scan: a near-white cloth silhouette with
 * baked fold shading and no artwork baked in. Multiplying that texture by the
 * chosen color gives EXACT colorways (black reads black) while preserving the
 * garment's folds and seams — far more realistic than the old procedural
 * weave replacement. The model's baked normal/roughness maps are kept as-is.
 *
 * Shading is preserved proportionally: a fabric pixel of luminance L maps to
 * color * (L / refWhite), where refWhite is the brightest pixel in the source.
 * A fold at 40% brightness renders at 40% of the colorway's brightness rather
 * than being crushed to black (pure multiply) or staying grey (no tint).
 *
 * Tinted textures are cached per (source image, color) so recoloring never
 * re-runs a 1M-pixel pass; the cache is bounded and evicted oldest-first.
 */

const tintCache = new Map();
const MAX_TINT_ENTRIES = 14;

const refWhiteCache = new WeakMap();

function brightestLuminance(image) {
  if (refWhiteCache.has(image)) return refWhiteCache.get(image);
  let max = 1;
  try {
    const c = document.createElement('canvas');
    c.width = image.width;
    c.height = image.height;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(image, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    for (let i = 0; i < d.length; i += 4) {
      const l = d[i] * 0.2126 + d[i + 1] * 0.7152 + d[i + 2] * 0.0722;
      if (l > max) max = l;
    }
  } catch {
    /* fall back to 255 */
  }
  refWhiteCache.set(image, max);
  return max;
}

/**
 * Returns a CanvasTexture of the source base map tinted with `hex` (the GLB
 * cache texture itself is never mutated). Cached per (image, hex); the caller
 * must NOT dispose the returned texture (the cache owns it).
 */
export function tintedBaseMap(srcMap, hex) {
  const image = srcMap.image;
  const key = `${srcMap.source?.uuid || '?'}|${hex}`;
  const hit = tintCache.get(key);
  if (hit) return hit;

  const color = new THREE.Color(hex);
  const refWhite = brightestLuminance(image);

  const canvas = document.createElement('canvas');
  canvas.width = image.width || 1024;
  canvas.height = image.height || 1024;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, 0, 0);
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const l = d[i] * 0.2126 + d[i + 1] * 0.7152 + d[i + 2] * 0.0722;
    const s = Math.min(1, l / refWhite);
    d[i] = 255 * Math.min(1, color.r * s);
    d[i + 1] = 255 * Math.min(1, color.g * s);
    d[i + 2] = 255 * Math.min(1, color.b * s);
    // alpha preserved
  }
  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  // Carry over the source texture's sampling setup so the tinted map samples
  // exactly where the original did.
  tex.flipY = srcMap.flipY;
  tex.wrapS = srcMap.wrapS;
  tex.wrapT = srcMap.wrapT;
  tex.repeat.copy(srcMap.repeat);
  tex.offset.copy(srcMap.offset);
  tex.rotation = srcMap.rotation;
  tex.needsUpdate = true;

  tintCache.set(key, tex);
  while (tintCache.size > MAX_TINT_ENTRIES) {
    const oldestKey = tintCache.keys().next().value;
    tintCache.get(oldestKey).dispose();
    tintCache.delete(oldestKey);
  }
  return tex;
}

/** True when a baked texture's image actually decoded (GLTFLoader leaves the
 * image null / unloaded when an embedded buffer is corrupt — e.g. the tee GLB
 * ships a truncated normal JPEG and an empty occlusion map). */
export function textureImageLoaded(tex) {
  if (!tex || !tex.image) return false;
  const img = tex.image;
  if (typeof img.naturalWidth === 'number') return img.naturalWidth > 0;
  return !!img.width || !!img.height;
}

/**
 * Clones the material (the drei GLTF cache owns the originals) and applies the
 * colorway: tint the baked base map when present (exact color + preserved fold
 * shading), otherwise color the material directly. Baked normal/roughness/
 * occlusion maps are carried over untouched. Returns the clone for disposal.
 */
export function tintMaterial(material, hex) {
  const mat = material.clone();
  if (mat.map) {
    mat.map = tintedBaseMap(mat.map, hex);
    mat.color.set('#ffffff'); // the tint lives in the texture
  } else {
    mat.color.set(hex);
  }
  // Maps that never decoded would render as nothing — fall back to the
  // procedural knit normal so fabric still reads as fabric, and drop broken
  // occlusion maps.
  if (mat.normalMap && !textureImageLoaded(mat.normalMap)) {
    mat.normalMap = getKnitNormalMap();
    if (mat.normalScale) mat.normalScale.set(1, 1);
  }
  if (mat.occlusionMap && !textureImageLoaded(mat.occlusionMap)) {
    mat.occlusionMap = null;
  }
  return mat;
}
