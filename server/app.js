// Serveur HTTP : API JSON, flux en direct et fichiers statiques.
import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, sep } from 'node:path';
import {
  PASSWORD_MIN,
  SESSION_DAYS,
  USERNAME_RE,
  createLoginLimiter,
  hashPassword,
  hashToken,
  newToken,
  parseCookies,
  sessionCookie,
  verifyPassword,
} from './auth.js';
import { MAX_PACKS_PER_OPEN, PACKS, TYPES, publicRules } from './cards.js';
import { createLive } from './live.js';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.webmanifest': 'application/manifest+json',
};

const CSP = [
  "default-src 'self'",
  "img-src 'self' data: https://upload.wikimedia.org",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "script-src 'self'",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function createApp({ db, packs, publicDir, inviteCode = '', wikiLang = 'fr', mockImage = null, log = console }) {
  const live = createLive();
  const limiter = createLoginLimiter();
  const opening = new Set();
  const routes = [];
  const route = (method, path, handler, { auth = true } = {}) => {
    const keys = [];
    const re = new RegExp(`^${path.replace(/:(\w+)/g, (_, k) => (keys.push(k), '([^/]+)'))}$`);
    routes.push({ method, re, keys, handler, auth });
  };

  const isSecure = (req) => req.headers['x-forwarded-proto'] === 'https' || req.socket.encrypted;
  const clientIp = (req) => String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim() || req.socket.remoteAddress;

  function send(res, status, body, headers = {}) {
    const data = body === undefined ? '' : JSON.stringify(body);
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
    res.end(data);
  }

  async function readJson(req) {
    if (!String(req.headers['content-type'] ?? '').includes('application/json')) {
      throw new HttpError(415, 'Requête JSON attendue.');
    }
    let size = 0;
    const chunks = [];
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 16 * 1024) throw new HttpError(413, 'Requête trop lourde.');
      chunks.push(chunk);
    }
    try {
      return chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
    } catch {
      throw new HttpError(400, 'JSON invalide.');
    }
  }

  function startSession(req, res, user) {
    const token = newToken();
    const maxAgeSec = SESSION_DAYS * 24 * 3600;
    db.createSession(hashToken(token), user.id, Date.now() + maxAgeSec * 1000);
    res.setHeader('Set-Cookie', sessionCookie(token, { secure: isSecure(req), maxAgeSec }));
  }

  const publicUser = (u) => ({ username: u.username, joinedAt: u.created_at });

  // ---------- Comptes ----------

  route('GET', '/api/config', () => ({
    appName: 'WikiPacks',
    inviteRequired: Boolean(inviteCode),
    wikiLang,
    rules: publicRules(),
  }), { auth: false });

  route('POST', '/api/register', async ({ req, res }) => {
    const { username = '', password = '', invite = '' } = await readJson(req);
    const name = String(username).trim();
    if (!USERNAME_RE.test(name)) throw new HttpError(400, 'Pseudo : 3 à 20 caractères (lettres, chiffres, . _ -).');
    if (String(password).length < PASSWORD_MIN) throw new HttpError(400, `Mot de passe : ${PASSWORD_MIN} caractères minimum.`);
    if (String(password).length > 200) throw new HttpError(400, 'Mot de passe trop long.');
    if (inviteCode && String(invite).trim() !== inviteCode) throw new HttpError(403, "Code d'invitation incorrect.");
    if (db.userByName(name)) throw new HttpError(409, 'Ce pseudo est déjà pris.');
    let user;
    try {
      user = db.createUser(name, await hashPassword(String(password)));
    } catch (e) {
      if (String(e.message).includes('UNIQUE')) throw new HttpError(409, 'Ce pseudo est déjà pris.');
      throw e;
    }
    startSession(req, res, user);
    const eventId = db.addEvent('join', user.id);
    live.broadcast('feed', db.feedSince(eventId - 1));
    return { user: publicUser(user), stats: db.stats(user.id), showcase: [] };
  }, { auth: false });

  route('POST', '/api/login', async ({ req, res }) => {
    const { username = '', password = '' } = await readJson(req);
    const ip = clientIp(req);
    if (limiter.blocked(ip)) throw new HttpError(429, 'Trop d’essais. Réessaie dans quelques minutes.');
    const user = db.userByName(String(username).trim());
    const ok = user && (await verifyPassword(String(password), user.password_hash));
    if (!ok) {
      limiter.fail(ip);
      throw new HttpError(401, 'Pseudo ou mot de passe incorrect.');
    }
    limiter.reset(ip);
    startSession(req, res, user);
    return { user: publicUser(user), stats: db.stats(user.id), showcase: db.showcase(user.id) };
  }, { auth: false });

  route('POST', '/api/logout', ({ req, res, token }) => {
    if (token) db.deleteSession(hashToken(token));
    res.setHeader('Set-Cookie', sessionCookie('', { secure: isSecure(req), maxAgeSec: 0 }));
    return { ok: true };
  }, { auth: false });

  route('GET', '/api/me', ({ user }) => ({
    user: publicUser(user),
    stats: db.stats(user.id),
    showcase: db.showcase(user.id),
    invite: inviteCode || null,
  }));

  // ---------- Boosters ----------

  route('POST', '/api/packs/open', async ({ req, user }) => {
    const body = await readJson(req);
    const theme = PACKS.some((p) => p.key === body.theme) ? body.theme : PACKS[0].key;
    const count = Math.min(Math.max(Math.trunc(Number(body.count) || 1), 1), MAX_PACKS_PER_OPEN);
    if (opening.has(user.id)) throw new HttpError(429, 'Un booster est déjà en cours d’ouverture.');
    opening.add(user.id);
    try {
      const generated = await packs.generatePacks(theme, count);
      const before = db.lastEventId();
      const opened = db.recordPacks(user.id, theme, generated);
      const events = db.feedSince(before);
      if (events.length) live.broadcast('feed', events);
      return { theme, packs: opened, stats: db.stats(user.id) };
    } finally {
      opening.delete(user.id);
    }
  });

  // ---------- Collections, catalogue et amis ----------

  route('GET', '/api/collection', ({ user }) => ({
    user: publicUser(user),
    stats: db.stats(user.id),
    showcase: db.showcase(user.id),
    cards: db.collection(user.id),
  }));

  route('GET', '/api/players', ({ user }) => ({
    me: user.username,
    online: live.online(),
    players: db.players(),
  }));

  route('GET', '/api/players/:name', ({ params }) => {
    const target = db.userByName(params.name);
    if (!target) throw new HttpError(404, 'Joueur introuvable.');
    return {
      user: publicUser(target),
      stats: db.stats(target.id),
      showcase: db.showcase(target.id),
      cards: db.collection(target.id),
    };
  });

  route('GET', '/api/cards/:id', ({ user, params }) => {
    const card = db.card(Number(params.id), user.id);
    if (!card) throw new HttpError(404, 'Carte introuvable.');
    return { card };
  });

  route('GET', '/api/catalogue', ({ url, user }) => {
    const p = url.searchParams;
    const rarity = p.has('rarity') && p.get('rarity') !== '' ? Number(p.get('rarity')) : null;
    const type = TYPES.some((t) => t.key === p.get('type')) ? p.get('type') : null;
    const mine = p.get('mine') === '1' ? true : p.get('mine') === '0' ? false : null;
    return db.catalogue({
      q: String(p.get('q') ?? '').trim().slice(0, 80),
      rarity: Number.isInteger(rarity) ? rarity : null,
      type,
      mine,
      sort: p.get('sort') ?? 'rarity',
      limit: Number(p.get('limit')) || 60,
      offset: Number(p.get('offset')) || 0,
      viewerId: user.id,
    });
  });

  route('GET', '/api/search', ({ url }) => {
    const text = String(url.searchParams.get('q') ?? '').trim().slice(0, 80);
    return text ? db.search(text) : { cards: [], players: [] };
  });

  route('GET', '/api/feed', ({ url }) => {
    const before = Number(url.searchParams.get('before')) || Number.MAX_SAFE_INTEGER;
    return { events: db.feed(30, before) };
  });

  route('POST', '/api/gift', async ({ req, user }) => {
    const { to = '', copyId } = await readJson(req);
    const target = db.userByName(String(to));
    if (!target) throw new HttpError(404, 'Joueur introuvable.');
    if (target.id === user.id) throw new HttpError(400, 'Tu ne peux pas t’offrir une carte à toi-même.');
    const result = db.gift(user.id, target.id, Number(copyId));
    if (!result) throw new HttpError(400, 'Cet exemplaire ne t’appartient pas.');
    live.broadcast('feed', db.feedSince(result.eventId - 1));
    return { stats: db.stats(user.id), showcase: db.showcase(user.id) };
  });

  route('PUT', '/api/showcase', async ({ req, user }) => {
    const { copyIds } = await readJson(req);
    const ids = Array.isArray(copyIds) ? [...new Set(copyIds.map(Number).filter(Number.isInteger))] : null;
    if (!ids || ids.length > 5) throw new HttpError(400, 'La vitrine contient 5 cartes au maximum.');
    if (!db.setShowcase(user.id, ids)) throw new HttpError(400, 'Une de ces cartes ne t’appartient pas.');
    return { showcase: db.showcase(user.id) };
  });

  route('GET', '/api/live', ({ req, res, user }) => {
    live.connect(req, res, user);
    return undefined;
  });

  // ---------- Fichiers statiques ----------

  function serveStatic(req, res, pathname) {
    let rel;
    try {
      rel = decodeURIComponent(pathname);
    } catch {
      return send(res, 400, { error: 'Adresse invalide.' });
    }
    if (mockImage && rel.startsWith('/mock-img/')) {
      res.writeHead(200, { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=86400' });
      return res.end(mockImage(rel.slice('/mock-img/'.length)));
    }
    if (rel === '/') rel = '/index.html';
    let file = normalize(join(publicDir, rel));
    if (!file.startsWith(publicDir + sep)) return send(res, 403, { error: 'Interdit.' });
    let stat = null;
    try {
      stat = statSync(file);
      if (!stat.isFile()) stat = null;
    } catch {
      stat = null;
    }
    // Toute adresse inconnue hors /assets est une page du front (ex. /joueur/jean.dupont).
    if (!stat && !rel.startsWith('/assets/')) {
      rel = '/index.html';
      file = join(publicDir, rel);
      try {
        stat = statSync(file);
      } catch {
        stat = null;
      }
    }
    if (!stat) return send(res, 404, { error: 'Introuvable.' });
    const etag = `"${stat.size.toString(36)}-${stat.mtimeMs.toString(36)}"`;
    const headers = {
      'Content-Type': MIME[extname(file)] ?? 'application/octet-stream',
      // Les fichiers de /assets portent une empreinte dans leur nom : ils ne changent jamais.
      'Cache-Control': rel.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
      ETag: etag,
    };
    if (extname(file) === '.html') headers['Content-Security-Policy'] = CSP;
    if (req.headers['if-none-match'] === etag) {
      res.writeHead(304, headers);
      return res.end();
    }
    res.writeHead(200, { ...headers, 'Content-Length': stat.size });
    if (req.method === 'HEAD') return res.end();
    createReadStream(file).pipe(res);
  }

  // ---------- Aiguillage ----------

  async function handle(req, res) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    const url = new URL(req.url, 'http://localhost');
    if (!url.pathname.startsWith('/api/')) {
      if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error: 'Méthode non permise.' });
      return serveStatic(req, res, url.pathname);
    }
    const found = routes.find((r) => r.method === req.method && r.re.test(url.pathname));
    if (!found) return send(res, 404, { error: 'Route inconnue.' });
    const m = url.pathname.match(found.re);
    const params = Object.fromEntries(found.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
    const token = parseCookies(req.headers.cookie).sid || null;
    const user = token ? db.sessionUser(hashToken(token)) : null;
    if (found.auth && !user) return send(res, 401, { error: 'Connecte-toi pour continuer.' });
    const body = await found.handler({ req, res, url, params, user, token });
    if (body !== undefined && !res.headersSent) send(res, 200, body);
  }

  const server = createServer((req, res) => {
    handle(req, res).catch((err) => {
      const status = err.status ?? 500;
      if (!err.status) log.error?.(`[http] ${req.method} ${req.url} → ${err.stack ?? err}`);
      else if (status >= 500) log.warn?.(`[http] ${req.method} ${req.url} → ${err.message}`);
      if (!res.headersSent) send(res, status, { error: status >= 500 && !err.status ? 'Erreur du serveur.' : err.message });
      else res.end();
    });
  });

  const purge = setInterval(() => db.purgeSessions(), 6 * 3600 * 1000);
  purge.unref();
  server.on('close', () => {
    clearInterval(purge);
    live.close();
  });

  return server;
}
