let _dragging = false;
let _listeners = [];

export function setStudioDragging(v) {
  if (_dragging === v) return;
  _dragging = v;
  for (const fn of _listeners) fn(v);
}

export function onStudioDragging(fn) {
  _listeners.push(fn);
  return () => { _listeners = _listeners.filter((f) => f !== fn); };
}

export function getStudioDragging() {
  return _dragging;
}
