import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { db } from './db.js';
import seed from './seed.js';
import authRoutes from './routes/auth.js';
import productRoutes from './routes/products.js';
import cartRoutes from './routes/cart.js';
import orderRoutes from './routes/orders.js';
import customRoutes from './routes/custom.js';
import designRoutes from './routes/designs.js';
import variantRoutes from './routes/variants.js';
import adminRoutes from './routes/admin.js';
import { notFound, errorHandler } from './middleware/error.js';
import { uploadDir } from './middleware/upload.js';

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 4000);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

mkdirSync(uploadDir, { recursive: true });

const count = db.prepare('SELECT COUNT(*) AS count FROM products').get().count;
if (count === 0) seed();

const app = express();

app.use(
  cors({
    origin: [CLIENT_ORIGIN, 'http://127.0.0.1:5173', /^http:\/\/localhost:\d+$/],
    credentials: true,
  })
);
app.use(express.json({ limit: '2mb' }));
app.use('/uploads', express.static(uploadDir, { maxAge: '1d' }));

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'supernova-api' }));

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/custom', customRoutes);
app.use('/api/designs', designRoutes);
app.use('/api/variants', variantRoutes);
app.use('/api/admin', adminRoutes);

const clientDist = resolve(__dirname, '../../client/dist');
app.use(express.static(clientDist, { maxAge: '1h', index: false }));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) return next();
  res.sendFile(resolve(clientDist, 'index.html'), (err) => { if (err) next(); });
});

app.use(notFound);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`AURORA API listening on http://localhost:${PORT}`);
  console.log(`Uploads served from ${resolve(uploadDir)}`);
});
