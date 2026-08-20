export function notFound(req, _res, next) {
  const err = new Error(`Not found: ${req.method} ${req.originalUrl}`);
  err.status = 404;
  next(err);
}

export function errorHandler(err, _req, res, _next) {
  const status = err.status || 500;
  const message = status >= 500 ? 'Something went wrong' : err.message;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: message });
}
