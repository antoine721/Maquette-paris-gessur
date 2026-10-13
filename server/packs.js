// Fabrique de boosters.
// Chaque carte tire d'abord sa rareté (proportions du catalogue WikiMasters, carte 5 au moins Rare),
// puis un article de cette rareté :
// - dans l'index de tout Wikipédia dès qu'un passage complet est fait (voir indexer.js) ;
// - sinon dans une réserve d'articles mesurés à la volée : tirés au hasard pour les raretés
//   courantes, parmi les plus lus des derniers mois pour les Super rares, Ultra rares et Légendaires.
import {
  FEATURED_ODDS,
  MAX_RARITY,
  PACK_SIZE,
  SHINY_RATE,
  SLOT_ODDS,
  buildCard,
  isArticleTitle,
  packByKey,
  rarityFromViews,
  roll,
} from './cards.js';

const LOW = [40, 25, 25, 12, 8, 5];
const CAP = [200, 120, 120, 80, 60, 40];
const DETAILS_CHUNK = 20;

const unavailable = (msg) => Object.assign(new Error(msg), { status: 503 });

export function createPackFactory({ wiki, store, index = null, rand = Math.random, log = console, poolMonths = 12 }) {
  let pool = [];
  let poolLoading = null;
  let poolTriedAt = 0;
  let refilling = null;
  const buffers = Array.from({ length: MAX_RARITY + 1 }, () => []);

  const sample = (arr, n) => {
    const copy = arr.slice();
    const out = [];
    while (copy.length && out.length < n) out.push(copy.splice(Math.floor(rand() * copy.length), 1)[0]);
    return out;
  };

  function loadPool() {
    if (poolLoading) return poolLoading;
    poolTriedAt = Date.now();
    poolLoading = (async () => {
      const now = new Date();
      const months = [];
      for (let i = 1; i <= poolMonths; i++) {
        const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
        months.push([d.getUTCFullYear(), d.getUTCMonth() + 1]);
      }
      const results = await Promise.allSettled(months.map(([y, m]) => wiki.topMonth(y, m)));
      const estimates = new Map();
      results.forEach((r, i) => {
        if (r.status !== 'fulfilled') return;
        const [y, m] = months[i];
        const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
        // Un pic d'il y a six mois est sans doute retombé depuis.
        const decay = i < 2 ? 1 : i < 6 ? 0.5 : 0.25;
        for (const a of r.value) {
          if (!isArticleTitle(a.title)) continue;
          const est = (a.views / days) * 30 * decay;
          if ((estimates.get(a.title) ?? 0) < est) estimates.set(a.title, est);
        }
      });
      if (estimates.size) {
        pool = [...estimates].map(([title, est]) => ({ title, tier: rarityFromViews(est) }));
        log.info?.(`[packs] ${pool.length} articles populaires en réserve`);
      } else {
        log.warn?.('[packs] classements Wikimedia indisponibles, les grandes raretés viendront du hasard');
      }
    })().finally(() => {
      poolLoading = null;
    });
    return poolLoading;
  }

  // Réserve pleine : les plus anciens articles sortent, pour que chaque famille garde des candidats frais.
  function stash(pages) {
    const known = new Set(buffers.flat().map((p) => p.pageId));
    for (const p of pages) {
      if (known.has(p.pageId)) continue;
      known.add(p.pageId);
      const bucket = buffers[p.rarity];
      if (bucket.length >= CAP[p.rarity]) bucket.shift();
      bucket.push(p);
    }
  }

  async function fromPool() {
    const lacking = [3, 4, 5].filter((t) => buffers[t].length < LOW[t]);
    if (!lacking.length || !pool.length) return;
    const titles = new Set();
    for (const t of lacking) {
      const same = pool.filter((p) => p.tier >= t);
      for (const p of sample(same.length ? same : pool, Math.floor(48 / lacking.length))) titles.add(p.title);
    }
    stash(await wiki.measureTitles([...titles].slice(0, 50)));
  }

  function refill({ extraRandom = 0 } = {}) {
    if (refilling) return refilling;
    if (!pool.length && !poolLoading && Date.now() - poolTriedAt > 10 * 60 * 1000) loadPool().catch(() => {});
    refilling = (async () => {
      const jobs = [];
      const randomCalls = (buffers.slice(0, 4).some((b, t) => b.length < LOW[t]) ? 1 : 0) + extraRandom;
      for (let i = 0; i < Math.min(randomCalls, 3); i++) jobs.push(wiki.randomMeasured(50).then(stash));
      jobs.push(fromPool());
      for (const r of await Promise.allSettled(jobs)) {
        if (r.status === 'rejected') log.warn?.(`[packs] réapprovisionnement : ${r.reason?.message}`);
      }
    })().finally(() => {
      refilling = null;
    });
    return refilling;
  }

  // Un article de la rareté voulue (ou en dessous, sans passer sous `floor`), dans les familles demandées.
  function take(tier, types, used, floor = 0) {
    const fits = (p) => !used.has(p.pageId) && (!types || types.includes(p.type));
    for (let t = tier; t >= floor; t--) {
      const i = buffers[t].findIndex(fits);
      if (i >= 0) {
        const [p] = buffers[t].splice(i, 1);
        used.add(p.pageId);
        return p;
      }
    }
    return null;
  }

  const stock = () => buffers.reduce((n, b) => n + b.length, 0);
  const fromIndex = () => Boolean(index?.ready() && store.drawArticle);

  // Tirage dans l'index : la rareté voulue (ou en dessous, sans passer sous `floor`).
  function takeIndexed(tier, types, used, floor = 0) {
    for (let t = tier; t >= floor; t--) {
      const a = store.drawArticle(t, types, used, rand);
      if (a) {
        used.add(a.pageId);
        return a;
      }
    }
    return null;
  }

  async function pickPack(theme) {
    const { types } = packByKey(theme);
    const featuredFloor = Math.min(...FEATURED_ODDS.map(([t]) => t));
    const slots = [
      ...Array.from({ length: PACK_SIZE - 1 }, () => ({ tier: roll(SLOT_ODDS, rand), floor: 0 })),
      { tier: roll(FEATURED_ODDS, rand), floor: featuredFloor },
    ];
    const used = new Set();
    const picks = [];
    if (fromIndex()) {
      for (const { tier, floor } of slots) {
        const p =
          takeIndexed(tier, types, used, floor) ??
          takeIndexed(tier, null, used, floor) ??
          takeIndexed(tier, types, used) ??
          takeIndexed(tier, null, used);
        if (p) picks.push(p);
      }
      return picks;
    }
    for (const { tier, floor } of slots) {
      let p = take(tier, types, used, floor);
      for (let attempt = 0; !p && types && attempt < 2; attempt++) {
        await refill({ extraRandom: 2 });
        p = take(tier, types, used, floor);
      }
      // Famille introuvable : la carte vedette garde sa rareté (Rare ou mieux) quitte à changer de famille ;
      // en dernier recours, n'importe quelle carte plutôt qu'un trou.
      p ??= take(tier, null, used, floor) ?? take(tier, types, used) ?? take(tier, null, used);
      if (p) picks.push(p);
    }
    return picks;
  }

  async function materialize(pages) {
    const ids = [...new Set(pages.map((p) => p.pageId))];
    const byId = store.getCards(ids);
    const missing = ids.filter((id) => !byId.has(id));
    const chunks = [];
    for (let i = 0; i < missing.length; i += DETAILS_CHUNK) chunks.push(missing.slice(i, i + DETAILS_CHUNK));
    const details = new Map();
    for (const part of await Promise.all(chunks.map((c) => wiki.details(c)))) for (const [k, v] of part) details.set(k, v);
    for (const p of pages) {
      // Une carte est figée pour toujours : sans ses détails (page supprimée entre-temps), on ne la crée pas.
      if (byId.has(p.pageId) || !details.has(p.pageId)) continue;
      store.insertCard(buildCard({ ...p, ...details.get(p.pageId) }));
      const saved = store.getCards([p.pageId]).get(p.pageId);
      if (saved) byId.set(p.pageId, saved);
    }
    return byId;
  }

  // Ouvre `count` boosters d'un coup : renvoie, par booster, les cartes et leur éventuel Shiny.
  async function generatePacks(theme = 'encyclopedie', count = 1) {
    const indexed = fromIndex();
    if (!indexed) {
      for (let attempt = 0; stock() < PACK_SIZE * 2 && attempt < 3; attempt++) await refill({ extraRandom: 1 });
      if (stock() < PACK_SIZE) throw unavailable('Wikipédia ne répond pas, réessaie dans un instant.');
    }

    const picked = [];
    for (let i = 0; i < count; i++) {
      if (!indexed && stock() < PACK_SIZE * 2) await refill({ extraRandom: 1 });
      picked.push(await pickPack(theme));
    }
    const cards = await materialize(picked.flat());
    if (!indexed) refill().catch(() => {});
    const packs = picked
      .map((pages) => pages.map((p) => ({ card: cards.get(p.pageId), shiny: rand() < SHINY_RATE })).filter((x) => x.card))
      .filter((p) => p.length >= 3);
    if (!packs.length) throw unavailable('Booster incomplet, réessaie.');
    return packs;
  }

  async function warmUp() {
    if (fromIndex()) return;
    await loadPool().catch((e) => log.warn?.(`[packs] ${e.message}`));
    await refill({ extraRandom: 1 });
  }

  return {
    generatePacks,
    warmUp,
    loadPool,
    refill,
    stats: () => ({ source: fromIndex() ? 'index' : 'réserve', pool: pool.length, buffers: buffers.map((b) => b.length) }),
  };
}
