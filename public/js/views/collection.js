// Collection : la sienne ou celle d'un ami, avec filtres, recherche et tri.
import { api } from '../api.js';
import { cardButton, delegateTilt, openCardModal } from '../card.js';
import { icon } from '../icons.js';
import { $, RARITY, avatar, esc, fmt, fmtDate } from '../ui.js';

const CHUNK = 48;
const SORTS = {
  rarity: { label: 'Rareté', fn: (a, b) => b.rarity - a.rarity || b.views - a.views },
  recent: { label: 'Plus récentes', fn: (a, b) => b.lastAt - a.lastAt },
  alpha: { label: 'A → Z', fn: (a, b) => a.title.localeCompare(b.title, 'fr') },
  atk: { label: 'ATK', fn: (a, b) => b.atk - a.atk },
  def: { label: 'DEF', fn: (a, b) => b.def - a.def },
  views: { label: 'Popularité', fn: (a, b) => b.views - a.views },
  dup: { label: 'Doublons', fn: (a, b) => b.count - a.count || b.rarity - a.rarity },
};

export function rarityBar(stats) {
  const total = stats.unique || 1;
  return `<div class="rarity-bar" aria-hidden="true">${stats.byRarity
    .map((n, i) => (n ? `<span style="width:${(n / total) * 100}%;background:${RARITY[i].color}"></span>` : ''))
    .join('')}</div>`;
}

export function mountCollection(root, ctx, { player = null } = {}) {
  const own = !player || player.toLowerCase() === ctx.me.username.toLowerCase();
  let alive = true;
  let cards = [];
  let filtered = [];
  let shown = 0;
  let observer = null;
  const state = { rarity: -1, query: '', sort: 'rarity' };

  root.innerHTML = '<div class="empty" style="border:0">Chargement…</div>';

  async function load() {
    try {
      const data = own ? await api.collection() : await api.player(player);
      if (!alive) return;
      cards = data.cards;
      render(data);
    } catch (err) {
      if (!alive) return;
      root.innerHTML = `<div class="empty"><h2>Oups</h2><p>${esc(err.message)}</p><a class="btn" href="#/amis">Retour aux amis</a></div>`;
    }
  }

  function header(data) {
    const s = data.stats;
    if (own) {
      return `
        <div class="page-head">
          <div>
            <h1 class="page-title">Ma collection</h1>
            <p class="page-sub">${fmt(s.unique)} cartes uniques · ${fmt(s.total)} au total · score ${fmt(s.score)}</p>
            ${s.unique ? rarityBar(s) : ''}
          </div>
          <a class="btn btn-primary" href="#/booster">${icon('pack')}Ouvrir un booster</a>
        </div>`;
    }
    const online = ctx.online().includes(data.user.username);
    return `
      <a class="back-link" href="#/amis">${icon('back')}Amis</a>
      <div class="profile-head">
        ${avatar(data.user.username, { online, size: 'lg' })}
        <div>
          <h1 class="page-title">${esc(data.user.username)}</h1>
          <p class="page-sub">${fmt(s.unique)} cartes uniques · ${fmt(s.packs)} boosters · score ${fmt(s.score)} · depuis le ${fmtDate(data.user.joinedAt)}</p>
          ${s.unique ? rarityBar(s) : ''}
        </div>
      </div>`;
  }

  function render(data) {
    const counts = RARITY.map((_, i) => data.stats.byRarity[i] ?? 0);
    root.innerHTML = `
      ${header(data)}
      ${
        cards.length
          ? `<div class="toolbar">
              <div class="chips" role="group" aria-label="Filtrer par rareté">
                <button class="chip" type="button" data-r="-1" aria-pressed="true">Toutes <b>${fmt(cards.length)}</b></button>
                ${RARITY.map((r, i) => (counts[i] ? `<button class="chip" type="button" data-r="${i}" aria-pressed="false" style="--c:${r.color}"><i></i>${r.label} <b>${fmt(counts[i])}</b></button>` : '')).reverse().join('')}
              </div>
              <span class="spacer"></span>
              <label class="search">${icon('search')}<input class="field" type="search" placeholder="Chercher une carte" aria-label="Chercher une carte" data-q></label>
              <select class="field" aria-label="Trier" data-sort>${Object.entries(SORTS).map(([k, s]) => `<option value="${k}">${s.label}</option>`).join('')}</select>
            </div>
            <div class="grid-cards" data-grid></div>
            <div class="sentinel" data-sentinel></div>`
          : own
            ? `<div class="empty"><h2>Ta collection est vide</h2><p>Chaque article de Wikipédia est une carte. Ouvre ton premier booster !</p><a class="btn btn-primary btn-lg" href="#/booster">${icon('pack')}Ouvrir un booster</a></div>`
            : `<div class="empty"><h2>Pas encore de cartes</h2><p>${esc(data.user.username)} n’a pas encore ouvert de booster.</p></div>`
      }`;
    if (!cards.length) return;

    const grid = $('[data-grid]', root);
    delegateTilt(grid);
    grid.addEventListener('click', (e) => {
      const b = e.target.closest('.card-btn');
      if (b) openCardModal(b.dataset.id, { ...ctx, onCollectionChange: own ? load : null }, { owner: own ? null : data.user.username });
    });
    root.querySelectorAll('.chip').forEach((chip) =>
      chip.addEventListener('click', () => {
        state.rarity = Number(chip.dataset.r);
        root.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
        apply();
      }),
    );
    let t = 0;
    $('[data-q]', root).addEventListener('input', (e) => {
      clearTimeout(t);
      t = setTimeout(() => {
        state.query = e.target.value.trim().toLocaleLowerCase('fr');
        apply();
      }, 120);
    });
    const sortSel = $('[data-sort]', root);
    sortSel.value = state.sort;
    sortSel.addEventListener('change', () => {
      state.sort = sortSel.value;
      apply();
    });

    observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) more();
    }, { rootMargin: '600px' });
    observer.observe($('[data-sentinel]', root));
    apply();
  }

  function apply() {
    const norm = (s) => s.toLocaleLowerCase('fr').normalize('NFD').replace(/\p{M}/gu, '');
    const q = norm(state.query);
    filtered = cards
      .filter((c) => (state.rarity < 0 || c.rarity === state.rarity) && (!q || norm(c.title).includes(q) || norm(c.description || '').includes(q)))
      .sort(SORTS[state.sort].fn);
    const grid = $('[data-grid]', root);
    grid.innerHTML = filtered.length ? '' : '<p class="feed-empty">Aucune carte ne correspond.</p>';
    shown = 0;
    more();
  }

  function more() {
    const grid = $('[data-grid]', root);
    if (!grid || shown >= filtered.length) return;
    const next = filtered.slice(shown, shown + CHUNK);
    grid.insertAdjacentHTML(
      'beforeend',
      next.map((c) => cardButton(c, { badge: c.count > 1 ? `<span class="card-badge dup">×${c.count}</span>` : '' })).join(''),
    );
    const added = [...grid.children].slice(shown);
    added.forEach((b, i) => (b.style.animationDelay = `${Math.min(i, 16) * 25}ms`));
    shown += next.length;
  }

  load();
  const offStats = own ? ctx.on('collection-changed', load) : () => {};
  return () => {
    alive = false;
    observer?.disconnect();
    offStats();
  };
}
