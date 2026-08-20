import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db, mapUser } from '../db.js';
import { requireAuth, createSession } from '../middleware/auth.js';

const router = Router();

router.post('/register', (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name?.trim() || !email?.trim() || !password) {
    return res.status(400).json({ error: 'Name, email and password are required' });
  }
  const normalized = String(email).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    return res.status(400).json({ error: 'Please provide a valid email address' });
  }
  if (String(password).length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }
  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(normalized);
  if (exists) {
    return res.status(409).json({ error: 'An account with that email already exists' });
  }
  const hash = bcrypt.hashSync(String(password), 10);
  const info = db
    .prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)')
    .run(String(name).trim(), normalized, hash);
  const user = mapUser(
    db.prepare('SELECT * FROM users WHERE id = ?').get(Number(info.lastInsertRowid))
  );
  const token = createSession(user.id);
  res.status(201).json({ token, user });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  const row = db
    .prepare('SELECT * FROM users WHERE email = ?')
    .get(String(email).trim().toLowerCase());
  if (!row || !bcrypt.compareSync(String(password), row.password_hash)) {
    return res.status(401).json({ error: 'Incorrect email or password' });
  }
  if (row.active === 0) {
    return res.status(403).json({ error: 'This account has been suspended. Contact support.' });
  }
  const user = mapUser(row);
  const token = createSession(user.id);
  res.json({ token, user });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

router.post('/logout', requireAuth, (req, res) => {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(req.sessionToken);
  res.json({ ok: true });
});

export default router;
