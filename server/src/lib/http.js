import { db } from '../db.js';

/** Wraps an async Express handler so rejections reach the error middleware. */
export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

/** Consistent error thrown inside routes; errorHandler maps it to a response. */
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function httpError(status, message) {
  return new HttpError(status, message);
}

/** Records an admin/staff action into the audit log. Never throws. */
export function audit(admin, action, entity = '', entityId = '', metadata = {}) {
  try {
    db.prepare(
      `INSERT INTO audit_log (admin_id, admin_email, action, entity, entity_id, metadata)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      admin?.id ?? null,
      admin?.email ?? '',
      action,
      String(entity),
      String(entityId ?? ''),
      typeof metadata === 'string' ? metadata : JSON.stringify(metadata)
    );
  } catch {
    /* audit failures must never break the main flow */
  }
}
