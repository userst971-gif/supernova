// AURORA Design Studio — product model + customization config.
//
// The `model` field points at a GLB/GLTF garment. Models live in
// client/public/models. When a higher-quality licensed model is dropped in
// (see ASSETS.md), just replace the file (or update the path) — the viewer,
// print placement and material pipeline adapt automatically.

export const PRODUCTS = [
  {
    id: 'tee',
    label: 'T-Shirt',
    price: 89,
    model: '/models/tshirt.glb',
    // Tint the model's OWN PBR (baseColor factor/texture) with the chosen
    // colorway — exact colors (black reads black) with the baked fold/normal
    // detail preserved. No procedural texture replacement.
    tint: true,
    fabric: 'knit',
    // Chest print zone, in normalized units (model height = 1, bbox centered
    // on origin).
    print: {
      y: 0.15, // centre of the chest band
      size: [0.34, 0.26], // print footprint [w, h]
      front: true, // project onto the +Z (front) face
    },
    camera: { fov: 34, y: 0.08, yaw: 0, min: 2.0, max: 5.0 },
    blurb: 'Crew-neck cotton tee, regular fit.',
  },
  {
    id: 'hoodie',
    label: 'Hoodie',
    price: 129,
    model: '/models/hoodie.glb',
    tint: true,
    fabric: 'knit',
    print: {
      y: 0.0, // hood offsets the bbox upward → chest band sits at bbox centre, not above it
      size: [0.3, 0.22],
      front: true,
    },
    camera: { fov: 34, y: 0.14, yaw: 0, min: 2.4, max: 5.6 },
    blurb: 'Heavyweight fleece hoodie with drawstring hood.',
  },
  {
    id: 'bag',
    label: 'Canvas Tote',
    price: 69,
    model: null, // no external asset yet → procedural canvas tote (see Tote.jsx, ASSETS.md)
    tint: false,
    fabric: 'canvas',
    print: {
      y: 0.0,
      size: [0.42, 0.42],
      front: true,
    },
    camera: { fov: 36, y: 0.05, yaw: 0, min: 1.7, max: 4.2 },
    blurb: '12 oz canvas tote, natural cotton webbing handles.',
  },
];

// Palette: the studio essentials plus every colorway the store sells, so the
// studio shows the full brand range. Tones are never pure black — the fabric
// weave stays visible.
export const COLORS = [
  { id: 'black', name: 'Black', hex: '#16181b' },
  { id: 'void-black', name: 'Void Black', hex: '#16181c' },
  { id: 'graphite', name: 'Dark Grey', hex: '#3b3e43' },
  { id: 'navy', name: 'Navy', hex: '#1d2b45' },
  { id: 'white', name: 'White', hex: '#f2f1ec' },
  { id: 'moon-white', name: 'Moon White', hex: '#f1f0ea' },
  { id: 'cream', name: 'Cream', hex: '#e5ddc8' },
  { id: 'aurora-green', name: 'Aurora Green', hex: '#21f59a' },
  { id: 'emerald', name: 'Emerald Dust', hex: '#4d7a64' },
  { id: 'nebula', name: 'Nebula', hex: '#6d5bd0' },
];

export const SIZES = ['S', 'M', 'L', 'XL', 'XXL'];

export const PRINT_DEFAULT = { x: 0, y: 0, scale: 1, rotation: 0 };

export function productById(id) {
  return PRODUCTS.find((p) => p.id === id) || PRODUCTS[1];
}

export function colorById(id) {
  return COLORS.find((c) => c.id === id) || COLORS[0];
}
