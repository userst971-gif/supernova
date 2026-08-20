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
- `ModelStage` was removed (replaced by the superhero video). `hero-model.jpg`
  still exists in `client/public/img` but is no longer referenced by the hero
- `MountainRange.jsx` is still in the repo but unused. `AuroraCanvas.jsx`,
  `GizaPyramids.jsx`, `StarField.jsx` and `HeroScene.jsx` were **deleted** —
  the hero background is now the user-supplied video. Do not reintroduce a
  second procedural background system.
- Hero layer order is fixed: background video → dark overlay → title/UI (z-20/30)
  → character (z-40) → bottom depth fog (z-[45]). The character layer sits
  above the title/UI so site text never overlays him.
- `AuroraBackground.jsx` (site-wide, fixed `-z-10`, Canvas-2D) is a separate
  component rendered in `App.jsx` — it is NOT part of the hero and shows on
  non-hero pages. Its rAF loop is paused while the route is `/` (the hero's
  opaque `bg-void` section fully covers it) and while the tab is hidden, and
  resumes when neither is true. Leave it alone unless reworking the whole site.

## Hero video animation (implemented)

The hero video is a 1280×720 VP9 10s clip on a near-black background — a
centred, glowing SUPERNOVA wordmark (brightest around 30–40% height). Files:
`client/public/video/hero-supernova.webm` + poster `client/public/img/hero-video-poster.jpg`.
The old `supernova-hero.webm` superhero reel is still in `public/video` but
unused (kept as backup). No `.mp4` is shipped for the hero video.

Implementation (`client/src/components/hero/HeroVideo.jsx` + `.hero-flight` in
`client/src/index.css`):
- `mix-blend-screen` keys the dark background out over the scene. The webm has
  NO alpha channel, so blend is still required. Video is `loop`ed (10s),
  muted/autoplay/playsInline, `preload="metadata"`, `poster` removed (the
  poster was a rectangle source).
- `.hero-flight` sweeps the element with `translate3d` keyframes driven by the
  Web Animations API. The animation is `pause()`d and its `currentTime` is set
  to `(video.currentTime % 10) * 1000` on every `requestAnimationFrame`, so the
  sweep is frame-locked to the playhead and can never drift. This is the ONLY
  animation loop on the hero.
- The video sits in a `aspect-[16/9] h-[42/48/54vh]` box with `object-cover` —
  DO NOT set `w-auto` directly on the video or it collapses to a squashed 4:3
  box (Vite/block layout quirk). Stage wrapper is `absolute left-1/2 top-[54%]
  -translate-x-1/2 -translate-y-1/2`.
- **No visible video rectangle — this was the recurring bug.** A lone radial
  mask cannot hide the box: with its centre at 46% height, the top (46%) and
  bottom (54%) edges of the box land inside the opaque stops, so the rim glow
  paints bright bars along the top/bottom once the background is
  bright. The fix is **nested masks** (they multiply; `mask-composite` was
  unreliable):
  1. a wrapper div gets `VERTICAL_FADE_MASK` — one `linear-gradient(to bottom,
     transparent 0%, black 18%, black 87%, transparent 100%)` that fades the
     top 0–18% and bottom 87–100% (VP9 edge noise, glow falloff) to fully
     transparent,
  2. the video + rim keep `SIDE_MASK` — `radial-gradient(ellipse 80% 100% at
     50% 46%, black 38%, rgba(0,0,0,0.9) 50%, transparent 62%)` for the sides
     and corners.
  `VIDEO_FILTER` = `brightness(1.14) contrast(1.3) saturate(0.9)` — a luma
  key that pushes VP9's dark-grey "black" (~16–25) below black (order matters:
  brightness BEFORE contrast; too much contrast e.g. 2.4 crushes the logo).
- **Integration:** a dark `mix-blend-multiply` pool sits UNDER the video and
  deepens the night scene behind the wordmark so its glow pops; an emerald rim
  overlay (`RIM_GRADIENT`) catches the aurora on the logo's edges. (The old
  character-specific ground shadow, floor-light pool and cool haze were
  removed — a centered logo has no feet.) A bottom depth fog (z-[45]) sits over
  everything.
- **Stacking gotcha:** the video must be `position: relative` (not static) —
  the absolutely-positioned dark pool would otherwise paint ABOVE a static
  video and multiply the logo itself dim.
- `prefers-reduced-motion` shows a static centred poster (same
  SIDE_MASK + rim + pool at `top-[54%]`, no `.hero-flight` wrapper) and the
  background renders its poster image — no video, no animation at all.

## Hero background (implemented)

`client/src/components/hero/HeroBackground.jsx` renders ONE full-bleed video
from `client/src/config/hero.js` (`HERO_BACKGROUND_VIDEO`). Current asset:
`client/public/video/hero-background.mp4` (1280×720 h264, 10s, audio stripped)
+ poster `client/public/img/hero-background-poster.jpg`. To change the
background: drop a file into `client/public/video/` and update the config var —
never hard-code an absolute machine path.

- Single `<video>`: absolute inset-0, `object-cover`, muted/autoplay/loop/
  playsInline, `preload="metadata"`, `pointer-events-none`, no controls.
- A static gradient readability overlay darkens the top (title zone), vignettes
  the edges and darkens the bottom (character feet) — no animation.
- If the asset 404s/decodes (`onError`) it falls back to a static night
  gradient, and reduced-motion renders the poster image instead of playing.
- Perf: the old WebGL aurora shader (AuroraCanvas) was the heavy layer and is
  deleted; main JS chunk dropped from ~1044 kB to ~352 kB. Do not add WebGL or
  procedural backgrounds back to the hero.

QA: puppeteer drives Edge headless, then samples `video.currentTime` + mover
`getBoundingClientRect()` at pose and screenshots + luminance maps to confirm:
exactly 2 videos (bg + character) on desktop/mobile, zero in reduced mode, the
character is centred at pose, background is full-bleed `object-cover` and
playing, the four box edges are continuous (avg step < ~4 lum, seam-style),
the head pops against the background, and zero console/page errors.
