// Amis : classement, fil en direct et lien à partager.
import { api } from '../api.js';
import { feedItemHTML, openCardModal } from '../card.js';
import { icon } from '../icons.js';
import { $, RARITY, ago, avatar, esc, fmt, toast } from '../ui.js';

export function mountPlayers(root, ctx) {
  let alive = true;
  root.innerHTML = `
    <div class="page-head">
      <div>
        <h1 class="page-title">Amis</h1>
        <p class="page-sub">Qui a la plus belle collection ? Les belles prises s’affichent en direct.</p>
      </div>
    </div>
    <div class="friends">
      <section class="panel">
        <div class="panel-title">Classement <span style="font-family:var(--f-ui);font-weight:450;font-size:12.5px;color:var(--text-3)">score = cartes uniques pondérées par rareté</span></div>
        <ol class="board" data-board><li class="feed-empty">Chargement…</li></ol>
        <div class="invite" data-invite></div>
      </section>
      <section class="panel">
        <div class="panel-title">En direct <span class="live-dot" data-online>${ctx.online().length} en ligne</span></div>
        <ul class="feed" data-feed><li class="feed-empty">Chargement…</li></ul>
      </section>
    </div>`;

  const board = $('[data-board]', root);
  const feed = $('[data-feed]', root);

  function renderBoard(players, online) {
    board.innerHTML = players
      .map((p, i) => {
        const me = p.username === ctx.me.username;
        const rar = [4, 3, 2]
          .filter((r) => p.byRarity[r])
          .map((r) => `<span style="--c:${RARITY[r].color}" title="${RARITY[r].label}"><i></i>${p.byRarity[r]}</span>`)
          .join('');
        return `<li><a href="#/joueur/${encodeURIComponent(p.username)}" class="${me ? 'me' : ''}">
          <span class="rank">${i + 1}</span>
          ${avatar(p.username, { online: online.includes(p.username) })}
          <span class="who"><b>${esc(p.username)}${me ? ' <small>(toi)</small>' : ''}</b><small>${fmt(p.unique)} cartes · ${fmt(p.packs)} boosters</small>${rar ? `<span class="mini-rar">${rar}</span>` : ''}</span>
          <span class="score">${fmt(p.score)}<small>points</small></span>
        </a></li>`;
      })
      .join('');
  }

  async function load() {
    try {
      const [{ players, online }, { events }] = await Promise.all([api.players(), api.feed()]);
      if (!alive) return;
      renderBoard(players, online);
      feed.innerHTML = events.length ? events.map((e) => feedItemHTML(e)).join('') : '<li class="feed-empty">Rien pour l’instant.</li>';
    } catch (err) {
      board.innerHTML = `<li class="feed-empty">${esc(err.message)}</li>`;
    }
  }

  const link = location.origin;
  const invite = ctx.invite;
  $('[data-invite]', root).innerHTML = `
    <p>Invite tes amis : envoie-leur l’adresse du site${invite ? ' et le code d’invitation' : ''}. Chacun crée son compte et ouvre autant de boosters qu’il veut.</p>
    <div class="copy-row"><code>${esc(link)}</code><button class="btn btn-sm" type="button" data-copy="${esc(link)}">${icon('copy')}Copier</button></div>
    ${invite ? `<div class="copy-row"><code>${esc(invite)}</code><button class="btn btn-sm" type="button" data-copy="${esc(invite)}">${icon('copy')}Code</button></div>` : ''}`;
  root.querySelectorAll('[data-copy]').forEach((b) =>
    b.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(b.dataset.copy);
        toast('Copié !', { iconName: 'copy', duration: 2000 });
      } catch {
        toast(esc(b.dataset.copy), { iconName: 'copy' });
      }
    }),
  );

  feed.addEventListener('click', (e) => {
    const b = e.target.closest('.f-card');
    if (b) openCardModal(b.dataset.id, ctx);
  });

  const offFeed = ctx.on('feed', (events) => {
    feed.querySelector('.feed-empty')?.remove();
    for (const ev of events) feed.insertAdjacentHTML('afterbegin', feedItemHTML(ev, { fresh: true }));
    api.players().then(({ players, online }) => alive && renderBoard(players, online)).catch(() => {});
  });
  const offPresence = ctx.on('presence', (online) => {
    $('[data-online]', root).textContent = `${online.length} en ligne`;
    api.players().then(({ players }) => alive && renderBoard(players, online)).catch(() => {});
  });
  const clock = setInterval(() => {
    for (const t of feed.querySelectorAll('[data-ts]')) t.textContent = ago(Number(t.dataset.ts));
  }, 30000);

  load();
  return () => {
    alive = false;
    offFeed();
    offPresence();
    clearInterval(clock);
  };
}
