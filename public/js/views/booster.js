// Ouverture des boosters : secousse, déchirure, cartes qui sortent, révélation une à une.
import { api } from '../api.js';
import { attachTilt, cardButton, cardHTML, feedItemHTML, openCardModal } from '../card.js';
import { burst, confetti, flash, shake, sparkleAround } from '../fx.js';
import { icon } from '../icons.js';
import { sfx } from '../sound.js';
import { $, RARITY, ago, fmt, modalOpen, reducedMotion, toastError, wait } from '../ui.js';

const FAST_KEY = 'wp-fast';
const PALETTES = [
  ['#ffffff', '#c9d0dd'],
  ['#49d69b', '#a6f5d0', '#ffffff'],
  ['#4fa3ff', '#a8d4ff', '#ffffff'],
  ['#b57bff', '#e3c8ff', '#ff8be0', '#ffffff'],
  ['#ffc53d', '#ffe9a3', '#ff9f1c', '#ffffff', '#fff3c4'],
];

const PACK_HTML = `
  <button class="pack idle" type="button" aria-label="Ouvrir le booster" data-pack>
    <span class="pack-top-wrap" data-top><span class="pack-top"></span><span class="pack-strip"></span></span>
    <span class="pack-cut"></span>
    <span class="pack-body">
      <span class="pack-art">
        <span class="pack-emblem"><b>W</b></span>
        <span class="pack-name">WikiPacks</span>
        <span class="pack-sub">Wikipédia · FR</span>
        <span class="pack-count">5 CARTES</span>
      </span>
      <span class="pack-shine"></span>
    </span>
    <span class="pack-bottom"></span>
    <span class="pack-light" data-light></span>
  </button>`;

// Joue une animation puis fige son état final dans le style de l'élément.
async function play(elm, keyframes, opts) {
  const anim = elm.animate(keyframes, { fill: 'forwards', ...opts });
  try {
    await anim.finished;
    anim.commitStyles();
  } catch {}
  anim.cancel();
}

export function mountBooster(root, ctx) {
  root.innerHTML = `
    <div class="booster">
      <section>
        <div class="booster-bar">
          <div class="pills" data-pills></div>
          <label class="switch" title="Saute la révélation carte par carte"><input type="checkbox" data-fast>Ouverture rapide</label>
        </div>
        <div class="stage" data-stage>
          <div class="stage-glow" data-glow></div>
          <div class="rays" data-rays></div>
          <div class="stage-content" data-content></div>
        </div>
      </section>
      <aside class="side">
        <div class="panel">
          <div class="panel-title">En direct <span class="live-dot">${ctx.online().length} en ligne</span></div>
          <ul class="feed" data-feed><li class="feed-empty">Chargement…</li></ul>
        </div>
      </aside>
    </div>`;

  const stage = $('[data-stage]', root);
  const content = $('[data-content]', root);
  const rays = $('[data-rays]', root);
  const glow = $('[data-glow]', root);
  const fastBox = $('[data-fast]', root);
  const feedList = $('[data-feed]', root);
  let alive = true;
  let phase = 'idle';
  let advanceResolve = null;
  let advanceQueued = false;
  let skip = false;

  try {
    fastBox.checked = localStorage.getItem(FAST_KEY) === '1';
  } catch {}
  fastBox.addEventListener('change', () => {
    try {
      localStorage.setItem(FAST_KEY, fastBox.checked ? '1' : '0');
    } catch {}
  });
  // Après un clic sur l'interrupteur, Espace doit de nouveau ouvrir un booster.
  fastBox.closest('label').addEventListener('pointerup', () => setTimeout(() => fastBox.blur(), 0));

  function renderPills(stats) {
    $('[data-pills]', root).innerHTML = `
      <span class="pill">Boosters <b>${fmt(stats.packs)}</b></span>
      <span class="pill">Cartes <b>${fmt(stats.total)}</b></span>
      <span class="pill">Uniques <b>${fmt(stats.unique)}</b></span>
      <span class="pill">Score <b>${fmt(stats.score)}</b></span>`;
  }
  renderPills(ctx.stats);

  function setMood(rarity) {
    const hex = rarity == null ? 'rgba(120,100,255,.5)' : `${PALETTES[rarity][0]}88`;
    glow.style.setProperty('--c', hex);
    rays.style.setProperty('--c', rarity == null ? '' : `${PALETTES[rarity][0]}40`);
    rays.classList.toggle('on', rarity != null && rarity >= 3);
  }

  // ---------- Étape 1 : le booster attend ----------
  function renderIdle({ autoOpen = false } = {}) {
    phase = 'idle';
    skip = false;
    setMood(null);
    stage.classList.remove('dim');
    content.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;gap:30px;padding:40px 0">
        <div class="pack-wrap">${PACK_HTML}</div>
        <button class="btn btn-primary btn-lg" type="button" data-open>${icon('pack')}Ouvrir le booster <span class="kbd">Espace</span></button>
      </div>
      <p class="stage-hint">Illimité : ouvre-en autant que tu veux.</p>`;
    const pack = $('[data-pack]', content);
    pack.addEventListener('click', openPack);
    $('[data-open]', content).addEventListener('click', openPack);
    if (autoOpen) {
      pack.classList.remove('idle');
      play(pack, [{ transform: 'translateY(-60px) scale(.85)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 320, easing: 'cubic-bezier(.34,1.56,.64,1)' }).then(() => {
        if (alive && phase === 'idle') openPack();
      });
    }
  }

  // ---------- Étape 2 : secouer, déchirer, attendre les cartes ----------
  async function openPack() {
    if (phase !== 'idle') return;
    phase = 'opening';
    const fast = fastBox.checked || reducedMotion();
    const request = api.openPack();
    request.catch(() => {});

    const pack = $('[data-pack]', content);
    const btn = $('[data-open]', content);
    if (btn) {
      btn.disabled = true;
      btn.style.opacity = '0';
    }
    content.querySelector('.stage-hint')?.remove();
    pack.classList.remove('idle');
    pack.disabled = true;

    if (!fast) {
      sfx.shake();
      await pack.animate(
        [
          { transform: 'none' },
          { transform: 'rotate(-4deg) translateX(-6px)' },
          { transform: 'rotate(4deg) translateX(6px)' },
          { transform: 'rotate(-5deg) translateX(-7px) scale(1.02)' },
          { transform: 'rotate(5deg) translateX(7px) scale(1.03)' },
          { transform: 'rotate(-3deg) scale(1.04)' },
          { transform: 'scale(1.05)' },
        ],
        { duration: 620, easing: 'ease-in-out', fill: 'forwards' },
      ).finished;
    }

    sfx.tear();
    const top = $('[data-top]', pack);
    const light = $('[data-light]', pack);
    light.animate([{ opacity: 0, transform: 'scaleX(.1)' }, { opacity: 1, transform: 'scaleX(1)' }], { duration: 260, fill: 'forwards', easing: 'ease-out' });
    await top.animate(
      [
        { transform: 'none', opacity: 1 },
        { transform: 'translate(30px,-14px) rotate(-10deg)', opacity: 1, offset: 0.35 },
        { transform: 'translate(190px,-170px) rotate(-48deg)', opacity: 0 },
      ],
      { duration: fast ? 380 : 700, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' },
    ).finished;

    pack.classList.add('waiting');
    let data;
    try {
      data = await request;
    } catch (err) {
      if (!alive) return;
      toastError(err);
      renderIdle();
      return;
    }
    if (!alive) return;
    pack.classList.remove('waiting');
    ctx.setStats(data.stats);
    const cards = [...data.cards].sort((a, b) => a.rarity - b.rarity);
    if (fast) return showSummary(cards, { animateFlip: true });
    await deal(cards, pack);
  }

  // ---------- Étape 3 : les cartes jaillissent du booster ----------
  async function deal(cards, pack) {
    phase = 'reveal';
    const deck = document.createElement('div');
    deck.className = 'deck';
    deck.innerHTML = cards
      .map((c, i) => `<div class="slot" style="grid-area:1/1;z-index:${20 - i}">${cardHTML(c, { back: true })}</div>`)
      .join('');
    deck.style.cssText = 'position:absolute;inset:0 0 84px 0;display:grid;place-items:center;';
    content.append(deck);
    const slots = [...deck.children];
    for (const s of slots) s.style.opacity = '0';

    sfx.whoosh();
    play(pack, [{ transform: 'scale(1.05)', opacity: 1 }, { transform: 'translateY(70%) scale(.9) rotate(4deg)', opacity: 0 }], { duration: 650, easing: 'cubic-bezier(.5,0,.75,0)' });
    await Promise.all(
      slots.map((s, i) =>
        wait(i * 70).then(() =>
          play(
            s,
            [
              { transform: 'translateY(120px) scale(.55)', opacity: 0 },
              { transform: `translateY(-40px) scale(1.02) rotate(${(i - 2) * 3}deg)`, opacity: 1, offset: 0.6 },
              { transform: `translate(${(i - 2) * 2}px, ${-i * 2}px) rotate(${(i - 2) * 1.2}deg)`, opacity: 1 },
            ],
            { duration: 720, easing: 'cubic-bezier(.2,.8,.2,1)' },
          ),
        ),
      ),
    );
    content.querySelector('.pack-wrap')?.parentElement?.remove();
    if (!alive) return;

    const info = document.createElement('div');
    info.className = 'reveal-info';
    content.append(info);
    const skipBtn = document.createElement('button');
    skipBtn.className = 'btn btn-sm stage-skip';
    skipBtn.type = 'button';
    skipBtn.innerHTML = `${icon('bolt')}Tout révéler`;
    skipBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      skip = true;
      advance();
    });
    content.append(skipBtn);

    const done = [];
    for (let i = 0; i < cards.length && alive && !skip; i++) {
      const slot = slots[i];
      const cardEl = slot.querySelector('.card');
      const card = cards[i];
      slot.classList.add('top');
      cardEl.classList.add('top');
      if (card.rarity >= 2) cardEl.classList.add('aura');
      renderInfo(info, cards, done, i, null);
      await play(slot, [{}, { transform: 'none' }], { duration: 260, easing: 'ease-out' });
      await waitAdvance();
      if (!alive || skip) break;
      await reveal(slot, cardEl, card);
      done.push(card);
      renderInfo(info, cards, done, i, card);
      // Un clic donné pendant l'animation ne doit pas faire passer la carte qu'on vient de découvrir.
      advanceQueued = false;
      await waitAdvance();
      if (!alive || skip) break;
      if (i < cards.length - 1) {
        sfx.whoosh();
        rays.classList.remove('on');
        setMood(null);
        stage.classList.remove('dim');
        await play(slot, [{}, { transform: 'translate(-60vw, -40px) rotate(-28deg)', opacity: 0 }], { duration: 420, easing: 'cubic-bezier(.5,0,.75,0)' });
        slot.remove();
      }
    }
    if (alive) showSummary(cards, { animateFlip: false, revealed: done.length });
  }

  function renderInfo(info, cards, done, index, card) {
    const dots = cards
      .map((c, i) => {
        const cls = i < done.length ? 'done' : i === index ? 'current' : '';
        return `<span class="${cls}" style="--c:${i < done.length ? PALETTES[c.rarity][0] : ''}"></span>`;
      })
      .join('');
    let tag = `<p class="stage-hint" style="position:static">Touche la carte pour la retourner</p>`;
    if (card) {
      const r = RARITY[card.rarity];
      const extra = card.isNew ? 'Nouvelle !' : `Doublon · ×${card.count}`;
      tag = `<span class="rarity-tag" style="--c:${r.color}"><i></i>${r.label}<span class="extra">· ${extra}</span></span>`;
    }
    info.innerHTML = `${tag}<div class="progress-dots">${dots}</div>`;
  }

  // Un clic arrivé pendant une transition est gardé pour l'étape suivante.
  function waitAdvance() {
    if (skip || !alive) return Promise.resolve();
    if (advanceQueued) {
      advanceQueued = false;
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      advanceResolve = resolve;
    });
  }
  function advance() {
    const r = advanceResolve;
    advanceResolve = null;
    if (r) r();
    else if (phase === 'reveal') advanceQueued = true;
  }

  // ---------- Étape 4 : retourner une carte ----------
  async function reveal(slot, cardEl, card) {
    const r = card.rarity;
    if (r >= 3 && !reducedMotion()) {
      sfx.tease(r);
      stage.classList.add('dim');
      const long = r >= 4;
      await slot.animate(
        [
          { scale: 1, rotate: '0deg' },
          { scale: 1.03, rotate: '-2deg' },
          { scale: 1.05, rotate: '2deg' },
          { scale: 1.06, rotate: '-3deg' },
          { scale: 1.08, rotate: '3deg' },
          { scale: long ? 1.1 : 1.08, rotate: '0deg' },
        ],
        { duration: long ? 1150 : 700, easing: 'ease-in' },
      ).finished;
    }
    sfx.flip();
    cardEl.classList.remove('aura');
    cardEl.classList.add('flipped');
    await wait(reducedMotion() ? 0 : 300);
    if (!alive) return;

    const rect = cardEl.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const colors = PALETTES[r];
    sfx.reveal(r);
    setMood(r);
    slot.animate([{ scale: r >= 3 ? 1.1 : 1 }, { scale: 1.07 }, { scale: 1 }], { duration: 520, easing: 'cubic-bezier(.34,1.56,.64,1)' });
    if (r >= 1) burst(cx, cy, { colors, count: [0, 26, 50, 90, 170][r], speed: [0, 6, 8, 11, 15][r], stars: r >= 2 ? 0.35 : 0.1 });
    if (r >= 2) sparkleAround(rect, { colors, count: r * 6 });
    if (r >= 3) {
      flash(`${colors[0]}66`);
      shake(stage, r >= 4 ? 10 : 5);
    }
    if (r >= 4) {
      confetti({ colors });
      banner('Légendaire !', '#fff3c4', '#ffb224', 'rgba(255,180,40,.7)');
    } else if (r === 3) {
      banner('Épique !', '#f1e2ff', '#b57bff', 'rgba(181,123,255,.7)');
    }
    stage.classList.remove('dim');
    attachTilt(cardEl, { max: 16, scale: 1.02 });
    await wait(reducedMotion() ? 0 : 350);
  }

  function banner(text, c1, c2, glowColor) {
    if (reducedMotion()) return;
    const b = document.createElement('div');
    b.className = 'banner';
    b.append(Object.assign(document.createElement('span'), { textContent: text }));
    b.style.setProperty('--c1', c1);
    b.style.setProperty('--c2', c2);
    b.style.setProperty('--glow', glowColor);
    stage.append(b);
    b.addEventListener('animationend', (e) => e.animationName === 'banner' && b.remove());
  }

  // ---------- Étape 5 : le récapitulatif ----------
  function showSummary(cards, { animateFlip }) {
    phase = 'summary';
    advanceResolve = null;
    advanceQueued = false;
    stage.classList.remove('dim');
    const best = Math.max(...cards.map((c) => c.rarity));
    const fresh = cards.filter((c) => c.isNew).length;
    const dup = cards.length - fresh;
    const titles = ['Booster ouvert', 'Booster ouvert', 'Joli booster !', 'Superbe booster !', 'Un Légendaire !'];
    const parts = [`${fresh} nouvelle${fresh > 1 ? 's' : ''} carte${fresh > 1 ? 's' : ''}`];
    if (dup) parts.push(`${dup} doublon${dup > 1 ? 's' : ''}`);
    setMood(best >= 3 ? best : null);
    content.innerHTML = `
      <div class="summary">
        <h2 class="summary-title">${titles[best]}<small>${parts.join(' · ')}</small></h2>
        <div class="summary-cards">
          ${cards
            .map((c, i) => {
              const badge = c.isNew ? '<span class="card-badge new">NOUVELLE</span>' : `<span class="card-badge dup">×${c.count}</span>`;
              return cardButton(c, { badge, back: animateFlip });
            })
            .join('')}
        </div>
        <div class="summary-actions">
          <button class="btn btn-primary btn-lg" type="button" data-again>${icon('pack')}Ouvrir un autre booster <span class="kbd">Espace</span></button>
          <a class="btn btn-lg" href="#/collection">${icon('cards')}Ma collection</a>
        </div>
      </div>`;
    const buttons = [...content.querySelectorAll('.summary-cards .card-btn')];
    buttons.forEach((b, i) => {
      b.style.animationDelay = `${i * 70}ms`;
      b.addEventListener('click', () => openCardModal(b.dataset.id, ctx));
      attachTilt(b.querySelector('.card'), { max: 18, scale: 1.05 });
    });
    $('[data-again]', content).addEventListener('click', () => renderIdle({ autoOpen: true }));

    if (animateFlip) {
      buttons.forEach((b, i) => {
        const c = cards[i];
        setTimeout(() => {
          if (!alive) return;
          b.querySelector('.card').classList.add('flipped');
          sfx.flip();
          if (c.rarity >= 2) {
            const rect = b.getBoundingClientRect();
            burst(rect.left + rect.width / 2, rect.top + rect.height / 2, { colors: PALETTES[c.rarity], count: [0, 0, 30, 60, 110][c.rarity], speed: 8 });
          }
          if (i === cards.length - 1 && best >= 3) {
            sfx.reveal(best);
            flash(`${PALETTES[best][0]}55`);
            if (best >= 4) confetti({ colors: PALETTES[4] });
          }
        }, 350 + i * 140);
      });
    }
  }

  // ---------- Clavier et clics ----------
  stage.addEventListener('click', (e) => {
    if (phase !== 'reveal' || e.target.closest('button')) return;
    advance();
  });
  const onKey = (e) => {
    if (e.key !== ' ' && e.key !== 'Enter') return;
    if (modalOpen() || e.target.closest?.('input, select, textarea, a, button')) return;
    e.preventDefault();
    if (phase === 'idle') openPack();
    else if (phase === 'reveal') advance();
    else if (phase === 'summary') renderIdle({ autoOpen: true });
  };
  document.addEventListener('keydown', onKey);

  // ---------- Fil en direct ----------
  async function loadFeed() {
    try {
      const { events } = await api.feed();
      if (!alive) return;
      feedList.innerHTML = events.length ? events.map((e) => feedItemHTML(e)).join('') : '<li class="feed-empty">Rien pour l’instant. Les belles prises de tes amis apparaîtront ici.</li>';
    } catch {
      feedList.innerHTML = '<li class="feed-empty">Fil indisponible.</li>';
    }
  }
  feedList.addEventListener('click', (e) => {
    const b = e.target.closest('.f-card');
    if (b) openCardModal(b.dataset.id, ctx);
  });
  loadFeed();

  const offFeed = ctx.on('feed', (events) => {
    feedList.querySelector('.feed-empty')?.remove();
    for (const ev of events) feedList.insertAdjacentHTML('afterbegin', feedItemHTML(ev, { fresh: true }));
    while (feedList.children.length > 30) feedList.lastElementChild.remove();
  });
  const offStats = ctx.on('stats', renderPills);
  const offPresence = ctx.on('presence', (online) => {
    const dot = root.querySelector('.live-dot');
    if (dot) dot.textContent = `${online.length} en ligne`;
  });
  const clock = setInterval(() => {
    for (const t of feedList.querySelectorAll('[data-ts]')) t.textContent = ago(Number(t.dataset.ts));
  }, 30000);

  renderIdle();

  return () => {
    alive = false;
    advance();
    document.removeEventListener('keydown', onKey);
    offFeed();
    offStats();
    offPresence();
    clearInterval(clock);
  };
}

