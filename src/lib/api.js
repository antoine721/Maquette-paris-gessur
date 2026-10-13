// Appels à l'API du serveur.
export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => {
  onUnauthorized = fn;
};

async function request(method, path, body) {
  let res;
  try {
    res = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Connexion au serveur impossible.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && path !== '/api/login' && path !== '/api/me') onUnauthorized();
    throw new ApiError(res.status, data.error || `Erreur ${res.status}`);
  }
  return data;
}

const qs = (params) => {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') u.set(k, v);
  const s = u.toString();
  return s ? `?${s}` : '';
};

export const api = {
  config: () => request('GET', '/api/config'),
  me: () => request('GET', '/api/me'),
  login: (username, password) => request('POST', '/api/login', { username, password }),
  register: (username, password, invite) => request('POST', '/api/register', { username, password, invite }),
  logout: () => request('POST', '/api/logout'),
  openPacks: (theme, count = 1) => request('POST', '/api/packs/open', { theme, count }),
  collection: () => request('GET', '/api/collection'),
  players: () => request('GET', '/api/players'),
  player: (name) => request('GET', `/api/players/${encodeURIComponent(name)}`),
  card: (id) => request('GET', `/api/cards/${encodeURIComponent(id)}`),
  catalogue: (params) => request('GET', `/api/catalogue${qs(params)}`),
  search: (q) => request('GET', `/api/search${qs({ q })}`),
  feed: () => request('GET', '/api/feed'),
  gift: (to, copyId) => request('POST', '/api/gift', { to, copyId }),
  setShowcase: (copyIds) => request('PUT', '/api/showcase', { copyIds }),
};
