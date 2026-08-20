const TOKEN_KEY = 'supernova_token';
const CART_KEY = 'supernova_cart_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function getCartToken() {
  let token = localStorage.getItem(CART_KEY);
  if (!token) {
    token =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `cart-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(CART_KEY, token);
  }
  return token;
}
export function clearCartToken() {
  localStorage.removeItem(CART_KEY);
}

async function request(path, { method = 'GET', body, headers = {}, formData } = {}) {
  const h = {
    'x-cart-token': getCartToken(),
    ...headers,
  };
  const token = getToken();
  if (token) h.Authorization = `Bearer ${token}`;

  const opts = { method, headers: h };
  if (formData) {
    opts.body = formData;
  } else if (body !== undefined) {
    h['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }

  const res = await fetch(`/api${path}`, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  get: (path, opts) => request(path, { ...opts, method: 'GET' }),
  post: (path, body, opts) => request(path, { ...opts, method: 'POST', body }),
  patch: (path, body, opts) => request(path, { ...opts, method: 'PATCH', body }),
  put: (path, body, opts) => request(path, { ...opts, method: 'PUT', body }),
  del: (path, opts) => request(path, { ...opts, method: 'DELETE' }),
};

export function formatMoney(n) {
  return `$${Number(n || 0).toFixed(2)}`;
}
