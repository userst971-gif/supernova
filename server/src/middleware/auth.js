import { randomBytes } from 'node:crypto';
import { db, mapUser } from '../db.js';

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function readBearer(req) {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}

export function requireAuth(req, res, next) {
  const token = readBearer(req);
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const session = db.prepare('SELECT * FROM sessions WHERE token = ?').get(token);
  if (!session) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
  if (new Date(session.expires_at).getTime() < Date.now()) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
  const user = mapUser(db.prepare('SELECT * FROM users WHERE id = ?').get(session.user_id));
  if (!user) {
    return res.status(401).json({ error: 'Account not found' });
  }
  if (user.active === 0) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return res.status(403).json({ error: 'This account has been suspended.' });
  }
  req.user = user;
  req.sessionToken = token;
  next();
}

const STAFF_ROLES = ['admin', 'staff'];

export function requireStaff(req, res, next) {
  if (!req.user || !STAFF_ROLES.includes(req.user.role)) {
    return res.status(403).json({ error: 'Staff or admin access required' });
  }
  next();
}

export function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

export function optionalAuth(req, _res, next) {
  const token = readBearer(req);
  if (token) {
    const session = db.prepare('SELECT * FROM sessions WHERE token = ?').get(token);
    if (session && new Date(session.expires_at).getTime() >= Date.now()) {
      const user = mapUser(
        db.prepare('SELECT * FROM users WHERE id = ?').get(session.user_id)
      );
      if (user) req.user = user;
    }
  }
  next();
}

export function createSession(userId) {
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, userId, expiresAt);
  return token;
}
