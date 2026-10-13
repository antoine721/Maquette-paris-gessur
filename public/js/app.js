// Démarrage, navigation et liaison en direct avec le serveur.
import { api, setUnauthorizedHandler } from './api.js';
import { icon } from './icons.js';
import { setSound, soundOn } from './sound.js';
import { RARITY, avatar, closeModal, esc, toast } from './ui.js';
import { mountAuth } from './views/auth.js';
import { mountBooster } from './views/booster.js';
import { mountCollection } from './views/collection.js';
import { mountPlayers } from './views/players.js';

const app = document.getElementById('app');
let unmount = null;
let source = null;
let online = [];
const listeners = new Map();

function on(event, fn) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(fn);
  return () => listeners.get(event)?.delete(fn);
}
function emit(event, data) {
  for (const fn of listeners.get(event) ?? []) fn(data);
}

const ctx = {
  config: null,
  me: null,
  stats: null,
  invite: null,
  on,
  online: () => online,
  setStats(stats) {
    ctx.stats = stats;
    emit('stats', stats);
  },
};

const ROUTES = [
  { re: /^#\/booster$/, nav: 'booster', mount: (el) => mountBooster(el, ctx) },
  { re: /^#\/collection$/, nav: 'collection', mount: (el) => mountCollection(el, ctx) },
  { re: /^#\/amis$/, nav: 'amis', mount: (el) => mountPlayers(el, ctx) },
  { re: /^#\/joueur\/(.+)$/, nav: 'amis', mount: (el, m) => mountCollection(el, ctx, { player: decodeURIComponent(m[1]) }) },
];

function renderShell() {
  app.innerHTML = `
    <header class="header">
      <a class="logo" href="#/booster"><span class="logo-mark">W</span>WikiPacks</a>
      <nav class="nav" aria-label="Navigation principale">
        <a href="#/booster" data-nav="booster">${icon('pack')}<span>Booster</span></a>
        <a href="#/collection" data-nav="collection">${icon('cards')}<span>Collection</span></a>
        <a href="#/amis" data-nav="amis">${icon('users')}<span>Amis</span></a>
      </nav>
      <div class="header-right">
        <button class="btn btn-icon" type="button" data-sound aria-label="Son"></button>
        <a class="me-chip" href="#/joueur/${encodeURIComponent(ctx.me.username)}" title="Mon profil">${avatar(ctx.me.username)}<span>${esc(ctx.me.username)}</span></a>
        <button class="btn btn-icon" type="button" data-logout aria-label="Se déconnecter" title="Se déconnecter">${icon('logout')}</button>
      </div>
    </header>
    <main class="main" id="view"></main>`;

  const soundBtn = app.querySelector('[data-sound]');
  const paintSound = () => {
    soundBtn.innerHTML = icon(soundOn() ? 'soundOn' : 'soundOff');
    soundBtn.title = soundOn() ? 'Couper le son' : 'Activer le son';
    soundBtn.setAttribute('aria-pressed', String(soundOn()));
  };
  paintSound();
  soundBtn.addEventListener('click', () => {
    setSound(!soundOn());
    paintSound();
  });
  app.querySelector('[data-logout]').addEventListener('click', async () => {
    try {
      await api.logout();
    } catch {}
    signedOut();
  });
}

function route() {
  if (!ctx.me) return;
  const hash = location.hash || '#/booster';
  let found = null;
  let match = null;
  for (const r of ROUTES) {
    match = hash.match(r.re);
    if (match) {
      found = r;
      break;
    }
  }
  if (!found) {
    location.replace('#/booster');
    return;
  }
  closeModal();
  unmount?.();
  const view = document.getElementById('view');
  view.innerHTML = '';
  app.querySelectorAll('[data-nav]').forEach((a) => {
    if (a.dataset.nav === found.nav) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  unmount = found.mount(view, match) || null;
  window.scrollTo({ top: 0 });
}

function connectLive() {
  source?.close();
  source = new EventSource('/api/live');
  source.addEventListener('feed', (e) => {
    const events = JSON.parse(e.data);
    emit('feed', events);
    for (const ev of events) {
      if (ev.user === ctx.me?.username) continue;
      const r = ev.card ? RARITY[ev.card.rarity] : null;
      if (ev.type === 'pull') {
        toast(`<b>${esc(ev.user)}</b> vient d’obtenir <b>${esc(ev.card.title)}</b> · ${r.label} !`, { color: r.color, iconName: 'sparkles' });
      } else if (ev.type === 'gift' && ev.target === ctx.me?.username) {
        toast(`<b>${esc(ev.user)}</b> t’a offert <b>${esc(ev.card.title)}</b> !`, { color: r.color, iconName: 'gift', duration: 7000 });
        api.me().then((d) => ctx.setStats(d.stats)).catch(() => {});
        emit('collection-changed');
      } else if (ev.type === 'join') {
        toast(`<b>${esc(ev.user)}</b> a rejoint la partie.`, { iconName: 'user' });
      }
    }
  });
  source.addEventListener('presence', (e) => {
    online = JSON.parse(e.data).online;
    emit('presence', online);
  });
}

function signedIn(data) {
  ctx.me = data.user;
  ctx.stats = data.stats;
  ctx.invite = data.invite ?? ctx.invite;
  renderShell();
  connectLive();
  if (!location.hash || location.hash === '#/') location.replace('#/booster');
  route();
}

function signedOut() {
  unmount?.();
  unmount = null;
  source?.close();
  source = null;
  ctx.me = null;
  closeModal();
  mountAuth(app, {
    config: ctx.config,
    onLoggedIn: async () => {
      const me = await api.me();
      signedIn(me);
    },
  });
}

setUnauthorizedHandler(() => {
  if (ctx.me) signedOut();
});
addEventListener('hashchange', route);

(async function boot() {
  try {
    ctx.config = await api.config();
  } catch {
    app.innerHTML = '<div class="boot"><p>Le serveur ne répond pas. Recharge la page dans un instant.</p></div>';
    return;
  }
  try {
    signedIn(await api.me());
  } catch {
    signedOut();
  }
})();
