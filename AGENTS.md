# AGENTS.md

## Quick commands

```bash
npm run dev              # API :4000 + Vite :5173 concurrently
npm run dev:server       # API only (--watch for auto-reload)
npm run dev:client       # Vite only
npm run build            # production client build (client/dist)
npm start                # API only (no Vite)
```

Vite is hoisted to root `node_modules/vite` (not `client/node_modules`).
To run vite directly: `node C:\SUPERNOVA\node_modules\vite\bin\vite.js --host`
or from root: `cd /C/SUPERNOVA/client && npm run dev`

The Vite dev server proxies `/api` and `/uploads` to `:4000`.
Server auto-seeds 9 products + 2 accounts (admin/customer) on first boot.

## Architecture

Monorepo with npm workspaces: `server/` + `client/`.

**Server** (Express, ESM, Node built-in `node:sqlite`):
- `server/src/index.js` — app entry, CORS, static uploads, route mounts
- `server/src/db.js` — SQLite schema + row mappers (`mapProduct`, `mapOrder`, `mapUser`)
- `server/src/seed.js` — 9 products, admin + customer accounts
- `server/src/routes/custom.js` — one-off custom garment upload (separate from products CRUD)
- DB file: `server/data/supernova.db` (auto-created, gitignored)
- Uploads: `server/uploads/` (served via `/uploads` static + Vite proxy)
- Config: `server/.env` (PORT, CLIENT_ORIGIN, DB_PATH, MAX_UPLOAD_MB)

**Client** (React 18 + Vite + Tailwind):
- `client/src/components/hero/HeroBackground.jsx` — the hero's single cinematic
  background video + readability overlay (replaces the old WebGL aurora /
  StarField / GizaPyramids stack, all deleted)
- `client/src/components/hero/HeroVideo.jsx` — superhero character reel + flight sweep
- `client/src/config/hero.js` — `HERO_BACKGROUND_VIDEO` / `HERO_BACKGROUND_POSTER`
  (the ONLY place the background asset is referenced — never hard-code a path)
- `client/src/components/Hero.jsx` — hero wrapper (pointer parallax + motion entrance)
- `client/src/pages/Design.jsx` — Design Studio (R3F garment viewer, not in nav by default)
- `client/src/config/shopPrints.js` — per-shop-product print artworks (slug-keyed
  1024×1024 canvas draws) used by the product-photo pipeline so each shop image
  shows its product's designed print (not a blank garment). Add a product's
  design here when adding a shop product.
- `client/src/pages/RenderPage.jsx` — hidden render harness; `design=<slug>`
  renders that product's print onto the garment (see shopPrints.js), `model`,
  `hex`, `yaw`, `w`/`h`, `cols=` batch mode, `probe=1` tuning.
- `client/src/lib/api.js` — fetch wrapper with auth + cart headers, `formatMoney()`
- Custom Tailwind colors: `void`, `aurora-{300..700}` (see `tailwind.config.js`)

## Product schema gotcha

Custom products use `category: 'custom'` and are excluded from the public shop:
- `server/src/routes/products.js` — filters out `custom` category from listing + `/categories`
- `custom.js` route uses multer `upload.single('design')` (one file, not `upload.array()`)

Cart uses `x-cart-token` header (UUID generated client-side, stored in localStorage).

## Testing / QA

No formal test framework. QA is done via headless Edge + puppeteer-core:
- Scripts in `C:\Users\Moatasem\AppData\Local\Temp\opencode\` (gitignored)
- Uses `--enable-unsafe-swiftshader --use-angle=swiftshader` for WebGL on headless Edge
- `waitUntil: 'domcontentloaded'` only — `networkidle2` never fires with streaming video
- Production build is the main CI check: `npm run build` must pass

## Known gotchas

- esbuild binary may be flagged by Windows Defender — reinstall via `npm install --force` if it fails
- `node:sqlite` is a Node.js built-in (no native compilation needed), but requires Node ≥ 22
- `MountainRange.jsx` is still in the repo but unused. `AuroraCanvas.jsx`,
  `GizaPyramids.jsx`, `StarField.jsx` and `HeroScene.jsx` were **deleted** —
  the hero background is now the user-supplied video. Do not reintroduce a
  second procedural background system.
- Hero layer order is simple now: full-bleed background video → dark overlay
  → title/UI (z-20/30) → bottom depth fog (z-[45]). The former two-layer
  system (background video + separate luma-keyed character layer) was replaced
  by a single full-bleed scene — do not reintroduce a second hero video layer.
- `AuroraBackground.jsx` (site-wide, fixed `-z-10`, Canvas-2D) is a separate
  component rendered in `App.jsx` — it is NOT part of the hero and shows on
  non-hero pages. Its rAF loop is paused while the route is `/` (the hero's
  opaque `bg-void` section fully covers it) and while the tab is hidden, and
  resumes when neither is true. Leave it alone unless reworking the whole site.

## Hero video (implemented — full-bleed single scene)

The hero is ONE full-bleed 16:9 scene: the glowing-green-suit figure, centred
at full height against an atmospheric blur-fill of the same footage (sides
heavily blurred + darkened). Built from the original portrait clip
(`Figure_in_glowing_green_suit_202608281125.mp4`, 720×1280 h264 24fps 10s) via
ffmpeg into a 1280×720 h264 24fps 10s master (`hero-figure.mp4`, audio
stripped). Files: `client/public/video/hero-figure.mp4` + poster
`client/public/img/hero-figure-poster.jpg`. Referenced ONLY via
`client/src/config/hero.js` — never hard-code the path.

The old wordmark layer (`HeroVideo.jsx`) and its `.hero-flight` CSS were
**deleted**; the hero no longer uses luma-keyed superimposed characters.
No WebGL/procedural backgrounds.

## Hero background / single-scene implementation

`client/src/components/hero/HeroBackground.jsx` renders ONE full-bleed video
from `client/src/config/hero.js` (`HERO_BACKGROUND_VIDEO`). Current asset:
`client/public/video/hero-figure.mp4` (1280×720 h264, 24fps, 10s, audio
stripped) + poster `client/public/img/hero-figure-poster.jpg`. This same file
IS the whole hero scene (see "Hero video" above). To change it: drop a file
into `client/public/video/` and update the config var — never hard-code an
absolute machine path. Old assets `hero-background.mp4` / `hero-supernova.webm`
/ `supernova-hero.webm` / `hero-video-poster.jpg` remain in `public` as unused
backups only.

- Single `<video>`: absolute inset-0, `object-cover`, muted/autoplay/loop/
  playsInline, `preload="metadata"`, `pointer-events-none`, no controls.
- A static gradient readability overlay darkens the top (title zone), vignettes
  the edges and darkens the bottom (figure feet) — no animation.
- If the asset 404s/decodes (`onError`) it falls back to a static night
  gradient, and reduced-motion renders the poster image instead of playing.
- Perf: the old WebGL aurora shader (AuroraCanvas) was the heavy layer and is
  deleted; main JS chunk dropped from ~1044 kB to ~352 kB. Do not add WebGL or
  procedural backgrounds back to the hero.

QA: puppeteer drives Edge headless, then samples `video.currentTime` +
`getBoundingClientRect()` and a 16×9 luma grid of the raw frame to confirm:
exactly ONE hero video (no leftover canvas/character layer) on desktop/mobile,
zero in reduced mode, the video is full-bleed `object-cover` and playing, the
figure is centred with dark blended edges (left/right cols < ~40 lum, centre
col pops), and zero console/page errors.
