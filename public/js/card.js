// Rendu d'une carte, effet 3D au survol et fiche détaillée.
import { api } from './api.js';
import { icon } from './icons.js';
import { sfx } from './sound.js';
import { RARITY, ago, el, esc, fmt, fmtBytes, fmtDate, hueOf, openModal, closeModal, toast, toastError, wikiUrl } from './ui.js';

function art(card) {
  if (card.image) {
    return `<div class="cf-art" style="--h:${hueOf(card.title)}"><img src="${esc(card.image)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer"></div>`;
  }
  const initial = [...card.title.replace(/^(L’|L'|Le |La |Les )/i, '')][0] ?? '?';
  return `<div class="cf-art gen" style="--h:${hueOf(card.title)}"><span>${esc(initial.toUpperCase())}</span></div>`;
}

export function frontHTML(card) {
  return `
    <div class="card-face card-front">
      <div class="cf-panel">
        <div class="cf-head"><h3 class="cf-title">${esc(card.title)}</h3><span class="cf-gem" title="${RARITY[card.rarity].label}"></span></div>
        <div class="cf-rule"></div>
        ${art(card)}
        <div class="cf-type">${esc(card.description || 'article de Wikipédia')}</div>
        ${card.extract ? `<p class="cf-text">${esc(card.extract)}</p>` : ''}
        <div class="cf-foot">
          <span class="cf-no">n° ${esc(card.pageId)}</span>
          <span class="cf-stats"><span><small>ATK</small>${card.atk}</span><span><small>DEF</small>${card.def}</span></span>
        </div>
      </div>
      <div class="cf-rarity">${RARITY[card.rarity].label}</div>
      <div class="cf-holo"></div>
    </div>`;
}

export const BACK_HTML = `
  <div class="card-face card-back">
    <div class="cb-inner">
      <span class="cb-name top">ENCYCLOPÉDIE</span>
      <div class="cb-emblem"><b>W</b></div>
      <span class="cb-name">WIKIPACKS</span>
    </div>
  </div>`;

export function cardHTML(card, { back = false, flipped = false, extraClass = '' } = {}) {
  const cls = ['card', `r-${card.rarity}`, back ? 'has-back' : '', flipped ? 'flipped' : '', extraClass].filter(Boolean).join(' ');
  return `<div class="${cls}" data-id="${esc(card.pageId)}"><div class="card-inner">${back ? BACK_HTML : ''}${frontHTML(card)}</div></div>`;
}

export function cardButton(card, { badge = '', back = false } = {}) {
  const label = `${card.title}, ${RARITY[card.rarity].label}${card.count > 1 ? `, ${card.count} exemplaires` : ''}`;
  return `<button class="card-btn" type="button" data-id="${esc(card.pageId)}" aria-label="${esc(label)}">${badge}${cardHTML(card, { back })}</button>`;
}

// Une image Wikimedia qui ne se charge pas laisse place à l'illustration générée.
document.addEventListener(
  'error',
  (e) => {
    const img = e.target;
    if (!(img instanceof HTMLImageElement) || !img.parentElement?.classList.contains('cf-art')) return;
    const box = img.parentElement;
    const title = box.closest('.card')?.querySelector('.cf-title')?.textContent ?? '?';
    box.classList.add('gen');
    box.innerHTML = `<span>${esc(([...title][0] ?? '?').toUpperCase())}</span>`;
  },
  true,
);

// Inclinaison 3D et reflet qui suit le pointeur.
export function attachTilt(cardEl, { max = 14, scale = 1.04 } = {}) {
  if (!cardEl || matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {};
  const target = cardEl;
  let frame = 0;
  const move = (e) => {
    const r = target.getBoundingClientRect();
    const px = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const py = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      target.classList.add('tilting');
      target.style.setProperty('--rx', `${(0.5 - py) * max}deg`);
      target.style.setProperty('--ry', `${(px - 0.5) * max * 1.2}deg`);
      target.style.setProperty('--mx', `${px * 100}%`);
      target.style.setProperty('--my', `${py * 100}%`);
      target.style.setProperty('--tilt-scale', scale);
    });
  };
  const leave = () => {
    cancelAnimationFrame(frame);
    target.classList.remove('tilting');
    for (const p of ['--rx', '--ry', '--mx', '--my', '--tilt-scale']) target.style.removeProperty(p);
  };
  target.addEventListener('pointermove', move);
  target.addEventListener('pointerleave', leave);
  target.addEventListener('pointercancel', leave);
  return () => {
    leave();
    target.removeEventListener('pointermove', move);
    target.removeEventListener('pointerleave', leave);
    target.removeEventListener('pointercancel', leave);
  };
}

// Inclinaison déléguée pour les grilles (une seule écoute pour toutes les cartes).
export function delegateTilt(container) {
  let current = null;
  let detach = null;
  container.addEventListener('pointerover', (e) => {
    const card = e.target.closest?.('.card');
    if (!card || card === current || !container.contains(card)) return;
    detach?.();
    current = card;
    detach = attachTilt(card, { max: 16, scale: 1.05 });
    card.addEventListener(
      'pointerleave',
      () => {
        if (current === card) {
          detach?.();
          detach = null;
          current = null;
        }
      },
      { once: true },
    );
  });
}

// ---------- Fiche détaillée ----------
export async function openCardModal(pageId, ctx, { owner = null } = {}) {
  let card;
  try {
    ({ card } = await api.card(pageId));
  } catch (err) {
    toastError(err);
    return;
  }
  const r = RARITY[card.rarity];
  const mine = card.count > 0;
  const others = (card.owners ?? []).filter((o) => o.username !== ctx.me.username);
  const box = el(`
    <div class="modal-box">
      <button class="btn btn-icon modal-close" type="button" aria-label="Fermer">${icon('close')}</button>
      <div class="modal-card">${cardHTML(card)}</div>
      <div class="modal-info">
        <div><span class="rarity-tag" style="--c:${r.color}"><i></i>${r.label}</span></div>
        <h2>${esc(card.title)}</h2>
        ${card.description ? `<p class="desc">${esc(card.description)}</p>` : ''}
        ${card.extract ? `<p class="extract">${esc(card.extract)}</p>` : ''}
        <div class="stat-grid">
          <div class="stat"><small>POPULARITÉ</small><b>${fmt(card.views)}</b><span>vues / jour</span></div>
          <div class="stat"><small>ATK</small><b>${card.atk}</b><span>${fmtBytes(card.length)} de texte</span></div>
          <div class="stat"><small>DEF</small><b>${card.def}</b><span>${card.langs == null ? 'selon la popularité' : `${fmt(card.langs)} langue${card.langs > 1 ? 's' : ''}`}</span></div>
        </div>
        <p class="owned-line">${
          mine
            ? `Tu l’as en <b>${card.count}</b> exemplaire${card.count > 1 ? 's' : ''} · obtenue ${card.firstAt ? `le ${fmtDate(card.firstAt)}` : ''}`
            : owner
              ? `Dans la collection de <b>${esc(owner)}</b>. Tu ne l’as pas encore.`
              : 'Tu ne l’as pas (ou plus) dans ta collection.'
        }${others.length ? `<br>Aussi chez ${others.map((o) => `<b>${esc(o.username)}</b>${o.count > 1 ? ` ×${o.count}` : ''}`).join(', ')}` : ''}</p>
        <div class="modal-actions">
          <a class="btn btn-sm" href="${wikiUrl(ctx.config.wikiLang, card.pageId)}" target="_blank" rel="noopener noreferrer">${icon('external')}Lire sur Wikipédia</a>
        </div>
        ${mine ? `<div class="gift-row"><select class="field" aria-label="Choisir un ami"><option value="">Offrir à un ami…</option></select><button class="btn btn-sm" type="button" data-gift disabled>${icon('gift')}Offrir</button></div>` : ''}
      </div>
    </div>`);
  box.querySelector('.modal-close').addEventListener('click', closeModal);
  openModal(box);
  attachTilt(box.querySelector('.card'), { max: 18, scale: 1.03 });

  if (!mine) return;
  const select = box.querySelector('.gift-row select');
  const giftBtn = box.querySelector('[data-gift]');
  try {
    const { players } = await api.players();
    for (const p of players) {
      if (p.username === ctx.me.username) continue;
      select.append(new Option(p.username, p.username));
    }
    if (select.options.length === 1) select.options[0].textContent = 'Aucun ami inscrit pour l’instant';
  } catch {}
  select.addEventListener('change', () => (giftBtn.disabled = !select.value));
  giftBtn.addEventListener('click', async () => {
    const to = select.value;
    if (!to) return;
    const last = card.count === 1 ? ' C’est ton dernier exemplaire.' : '';
    if (!confirm(`Offrir « ${card.title} » à ${to} ?${last}`)) return;
    giftBtn.disabled = true;
    try {
      const res = await api.gift(to, card.pageId);
      sfx.pop();
      ctx.setStats(res.stats);
      toast(`Tu as offert <b>${esc(card.title)}</b> à ${esc(to)}.`, { color: r.color, iconName: 'gift' });
      closeModal();
      ctx.onCollectionChange?.();
    } catch (err) {
      toastError(err);
      giftBtn.disabled = false;
    }
  });
}

export function feedItemHTML(e, { fresh = false } = {}) {
  const c = e.card ? RARITY[e.card.rarity] : null;
  const cardLink = e.card ? `<button class="f-card" type="button" data-id="${esc(e.card.pageId)}" style="--c:${c.color}">${esc(e.card.title)}</button>` : '';
  let text;
  if (e.type === 'pull') text = `<b>${esc(e.user)}</b> a obtenu ${cardLink} <span style="color:${c.color}">· ${c.label}</span>`;
  else if (e.type === 'gift') text = `<b>${esc(e.user)}</b> a offert ${cardLink} à <b>${esc(e.target)}</b>`;
  else text = `<b>${esc(e.user)}</b> a rejoint la partie`;
  return `<li class="${fresh ? 'fresh' : ''}" data-event="${e.id}"><a href="#/joueur/${encodeURIComponent(e.user)}" aria-label="Profil de ${esc(e.user)}">${avatarSmall(e.user)}</a><div>${text}<span class="f-time" data-ts="${e.at}">${ago(e.at)}</span></div></li>`;
}

function avatarSmall(name) {
  return `<span class="avatar" style="--h:${hueOf(name)}">${esc(([...name][0] ?? '?').toUpperCase())}</span>`;
}
