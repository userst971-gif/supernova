# AURORA Design Studio — 3D asset provenance & licensing

The studio renders garments from GLB/GLTF models placed in `client/public/models/`
(or built procedurally). `client/src/config/design.js` points each product at its
model via the `model` field — to swap in a licensed model, replace the file (or
update the path) and the viewer, print placement and material pipeline adapt
automatically.

## Current models — DEVELOPMENT STAND-INS (do not ship as-is)

Downloaded from the GitHub repo `criticberlin/3D_Clothes_Project`
(`https://github.com/criticberlin/3D_Clothes_Project`).

| File | Source | License | Notes |
| --- | --- | --- | --- |
| `client/public/models/hoodie.glb` | `3D_Clothes_Project/models/hoodie.glb` | **None declared — all rights reserved, unlicensed** | 375k tris, no textures (flat material), 4 meshes sharing one material. Used only to develop/QA the configurator. |
| `client/public/models/tshirt.glb` | `3D_Clothes_Project/models/tshirt.glb` | **None declared — all rights reserved, unlicensed** | 19.5k tris, lambert1 material. Same interim status. |

These files must be **replaced before production**. Remove them from any
deployment; their licensing is unclear.

## Licensed replacement models (recommended)

Free, CC Attribution downloads on Sketchfab — you must create a free account and
download the GLB manually, then drop it into `client/public/models/`:

| Garment | Model | Link | Tris | Notes |
| --- | --- | --- | --- | --- |
| Hoodie | "Premium Eco Hoodie" by lekuns | `https://sketchfab.com/3d-models/premium-eco-hoodie-e1d8b7ad9a0b4f3bba883ec3c02e4f08` | 31.4k | Listed "glb model for 3d configurator" — ideal target. CC-BY (attribution required). |
| T-Shirt | "T Shirt" by funlab117 | `https://sketchfab.com/3d-models/t-shirt-c1a3e5eb9b5445f4b7d4be82f1127eba` | — | CC-BY (attribution required). |
| Canvas Bag | "Canvas Bag" by RatATatKat | `https://sketchfab.com/3d-models/canvas-bag-3316c1f3fc4e4f95adf05b1ee5478813` | — | CC-BY (attribution required). |

After adding each, update `model` in `client/src/config/design.js` and re-verify
the print zone (`print.y` / `print.size`) for that garment in the QA harness —
the zone is in normalized units (model height = 1, bbox centered on the origin).

Attribution for CC-BY models must appear in the product page / credits. Note that
CC-BY does **not** grant exclusive use — for a truly exclusive garment model,
license or commission one.

## Canvas tote (no external asset yet)

`client/src/components/studio/Tote.jsx` is a **procedural** canvas tote (real
canvas-fabric PBR, tapered gussets, webbing handles) used because no free tote
GLB with a clear license was found. `config/design.js` points the bag at
`model: null`, which selects the procedural build. To replace: add a licensed
GLB and set `model: '/models/tote.glb'` — nothing else needs to change.
