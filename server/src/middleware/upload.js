import multer from 'multer';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = resolve(__dirname, '../../uploads');
const MAX_MB = Number(process.env.MAX_UPLOAD_MB || 8);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.png';
    cb(null, `${Date.now()}-${randomBytes(6).toString('hex')}${ext}`);
  },
});

const allowed = /\.(png|jpe?g|webp|avif|gif|svg)$/i;

export const upload = multer({
  storage,
  limits: { fileSize: MAX_MB * 1024 * 1024, files: 8 },
  fileFilter: (_req, file, cb) =>
    allowed.test(file.originalname) ? cb(null, true) : cb(new Error('Image format not supported')),
});

export const uploadDir = UPLOAD_DIR;
