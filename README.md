# SUPERNOVA — Cosmic Apparel

A full-stack, dark-mode clothing brand storefront with a **live, animated Aurora Borealis**
canvas background on a `#050505` void backdrop. Built for creators: an admin **Creator
Studio** lets clients add garments and upload product photography directly to the store.

## Tech Stack

| Layer     | Technology                                                            |
| --------- | --------------------------------------------------------------------- |
| Frontend  | React 18 + Vite, Tailwind CSS, Framer Motion, React Router             |
| Backend   | Node.js + Express (ESM)                                                |
| Database  | SQLite via Node's built-in `node:sqlite` (zero-setup, embedded)        |
| Uploads   | Multer → `server/uploads`, served statically + proxied through Vite    |
| Auth      | Token sessions (bcryptjs-hashed passwords, no external store needed)   |

No external database server required — everything runs locally.

## Quick Start

```bash
# from repo root
npm install          # installs server + client + root tooling
npm run dev          # starts API (:4000) + Vite client (:5173) concurrently
```

Then open http://localhost:5173

Demo accounts (seeded automatically on first boot):

```
Admin     admin@supernova.io      / supernova123    → /studio (Creator Studio)
Customer  customer@supernova.io   / supernova123    → /account (order history)
```

Useful commands:

```bash
npm run dev:server   # API only (watch mode)
npm run dev:client   # Vite only
npm run build        # production client build
npm start            # serve API only (points at built client if you add static hosting)
```

## File Structure

```
SUPERNOVA/
├─ package.json                 # workspaces + concurrently orchestration
├─ README.md
├─ server/
│  ├─ package.json
│  ├─ .env                      # PORT, CLIENT_ORIGIN, DB_PATH, MAX_UPLOAD_MB
│  ├─ uploads/                  # uploaded product imagery (gitignored except .gitkeep)
│  └─ src/
│     ├─ index.js               # Express app entry, CORS, static uploads, mount routes
│     ├─ db.js                  # SQLite schema + row mappers (node:sqlite)
│     ├─ seed.js                # 9 products, admin + customer accounts
│     ├─ middleware/
│     │  ├─ auth.js             # requireAuth (Bearer token) + requireAdmin
│     │  ├─ upload.js           # multer config (8MB, images only, 8 files)
│     │  └─ error.js            # 404 + error handler
│     └─ routes/
│        ├─ auth.js             # register / login / me / logout
│        ├─ products.js         # CRUD + image upload + filters/sort
│        ├─ cart.js             # cart CRUD by anonymous x-cart-token
│        └─ orders.js           # checkout + order history
└─ client/
   ├─ package.json
   ├─ vite.config.js            # proxies /api and /uploads → :4000
   ├─ tailwind.config.js        # void/aurora palette, fonts, glow shadows
   ├─ index.html                # Space Grotesk + Space Mono fonts
   ├─ public/
   │  ├─ favicon.svg
   │  └─ img/                   # generated placeholder garment SVGs
   └─ src/
      ├─ main.jsx / App.jsx     # providers, routes, page transitions
      ├─ index.css              # Tailwind + aurora component classes
      ├─ lib/api.js             # fetch wrapper (auth + cart headers), formatMoney
      ├─ context/
      │  ├─ AuthContext.jsx     # login/register/logout, /auth/me restore
      │  └─ CartContext.jsx     # cart state, drawer control, add/update/remove
      ├─ components/
      │  ├─ AuroraBackground.jsx  ★ live aurora canvas + starfield
      │  ├─ Hero.jsx              ★ full-screen hero, glowing type, Explore Drop
      │  ├─ Manifesto.jsx         ★ brand storytelling chapters
      │  ├─ Navbar.jsx / Footer.jsx
      │  ├─ CartDrawer.jsx        ★ slide-in cart drawer
      │  ├─ ProductCard.jsx       ★ hover reveal quick-add
      │  ├─ SizeSelector.jsx / QuantityStepper.jsx
      │  └─ ToastHost.jsx
      └─ pages/
         ├─ Home.jsx              ★ Hero + featured constellation + CTA
         ├─ Shop.jsx              ★ filterable/sortable catalog
         ├─ ProductDetail.jsx     ★ gallery, size/qty, add to cart, related
         ├─ Checkout.jsx          ★ shipping form → order confirmation
         ├─ Auth.jsx              ★ sign in / register
         ├─ Account.jsx           ★ order history
         ├─ Studio.jsx            ★ admin Creator Studio (CRUD + uploads)
         └─ ManifestoPage.jsx
```

## Backend API Routes

Base URL `http://localhost:4000/api` (proxied from the Vite origin under `/api`).

### Auth — `/auth`
| Method | Route      | Body                                  | Notes                        |
| ------ | ---------- | ------------------------------------- | ---------------------------- |
| POST   | `/register`| `{ name, email, password }`           | Returns `{ token, user }`    |
| POST   | `/login`   | `{ email, password }`                 | Returns `{ token, user }`    |
| GET    | `/me`      | —                                     | `Authorization: Bearer <t>`  |
| POST   | `/logout`  | —                                     | Invalidates the session      |

### Products — `/products`
| Method | Route      | Body / Params                                   | Notes                          |
| ------ | ---------- | ----------------------------------------------- | ------------------------------ |
| GET    | `/`        | `?category=hoodies&featured=true&search=&sort=` | sort: `new\|price_asc\|price_desc\|name` |
| GET    | `/featured`| —                                               | Featured garments              |
| GET    | `/categories` | —                                           | Distinct categories            |
| GET    | `/:id`     | id or slug                                     | Full product                   |
| POST   | `/`        | multipart (`images` files + fields)            | **admin** — create + upload    |
| PUT    | `/:id`     | multipart + `keepImages[]`                     | **admin** — update + upload    |
| DELETE | `/:id`     | —                                              | **admin** — removes uploaded files |

`POST/PUT` multipart fields: `name, category, price, compare_at_price, stock, featured,
images` (JSON array of existing URLs), repeated `sizes[]`, `colors[]`, and repeated `images`
files. `sizes`/`colors` accept JSON arrays or comma-separated strings.

### Cart — `/cart`
Send `x-cart-token` header (a UUID the client generates once and stores in localStorage).
| Method | Route          | Body                       | Notes                    |
| ------ | -------------- | -------------------------- | ------------------------ |
| GET    | `/`            | —                          | Items + subtotal + count |
| POST   | `/items`       | `{ product_id, size, qty }`| Adds or merges line      |
| PATCH  | `/items/:id`   | `{ qty }`                  | Clamps to stock          |
| DELETE | `/items/:id`   | —                          | Remove line              |
| DELETE | `/`            | —                          | Empty the cart           |

### Orders — `/orders`
| Method | Route | Body (shipping)                | Notes                          |
| ------ | ----- | ----------------------------- | ------------------------------ |
| POST   | `/`   | `{ name, email, address, city, zip, country }` | Requires `x-cart-token`; creates order, decrements stock, clears cart. Free shipping ≥ $150, else flat $9. |
| GET    | `/`   | —                             | **auth required** — order history |

## Database Models (SQLite)

```sql
users(id, name, email UNIQUE, password_hash, role, created_at)
sessions(token PK, user_id → users, created_at)
products(id, name, slug UNIQUE, category, description, price, compare_at_price,
         sizes JSON, colors JSON, images JSON, stock, featured, created_at)
carts(token PK, user_id?, updated_at)
cart_items(id, cart_token → carts, product_id → products, size, qty,
           created_at, UNIQUE(cart_token, product_id, size))
orders(id, order_ref UNIQUE, user_id?, name, email, address, city, zip, country,
       items JSON, subtotal, shipping, total, status, created_at)
```

`node:sqlite` means the DB is a single file (`server/data/supernova.db`) with zero native
compilation and no external process.

## The Aurora Background

`client/src/components/AuroraBackground.jsx` is a fixed full-viewport `<canvas>`:

- **Starfield** — a seeded array of twinkling stars sized to the viewport.
- **Three aurora curtains** — each drawn column-by-column with vertical gradients and
  `globalCompositeOperation: 'lighter'`, animated by layered sine waves (wavelength +
  amplitude + drift + phase) so the light flows and breathes continuously.
- **Color shifting** — ribbon colors interpolate between green → teal → violet over time.
- **Vignette + horizon falloff** — gradients darken toward the bottom so content stays legible.
- **Performance guardrails** — devicePixelRatio capped at 1.5, column step optimized,
  single canvas, `prefers-reduced-motion` respected (renders one static frame).

## Creator Studio

Sign in as `admin@supernova.io` and open **/studio** (or the footer link) to:

- Publish new garments with pricing, sale price, sizes, colorways, stock, and a featured flag.
- Upload multiple photos (PNG/JPG/WebP/AVIF/GIF/SVG, ≤8MB each) — files land in
  `server/uploads/` and are served instantly.
- Edit or delete existing products; deleting a product also removes its uploaded files.

## Notes

- `client/dist` is a production build you can host with any static server; remember to
  point `/api` and `/uploads` at the running API.
- The storefront is a demo — checkout records orders and decrements real inventory but
  processes no actual payment.
