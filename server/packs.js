// Fabrique de boosters.
// Pour qu'un booster s'ouvre sans attendre, on garde en réserve des articles déjà mesurés :
// - une file d'articles tirés au hasard (cartes 1 à 4) ;
// - des réserves par rareté pour la carte vedette, alimentées par les articles les plus lus.
import { PACK_SIZE, buildCard, isArticleTitle, rarityFromViews, rollFeatured } from './cards.js';

const QUEUE_LOW = 40;
const QUEUE_MAX = 200;
const BUCKET_LOW = 6;
const BUCKET_MAX = 30;
const FEATURED_TIERS = [2, 3, 4];

export function createPackFactory({ wiki, store, rand = Math.random, log = console, poolMonths = 12 }) {
  let pool = [];
  const queue = [];
  const buckets = { 2: [], 3: [], 4: [] };
  let refilling = null;
  let poolLoading = null;
  let poolTriedAt = 0;

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
        // Un pic d'il y a six mois est probablement retombé depuis.
        const decay = i < 2 ? 1 : i < 6 ? 0.5 : 0.25;
        for (const a of r.value) {
          if (!isArticleTitle(a.title)) continue;
          const est = (a.views / days) * decay;
          if ((estimates.get(a.title) ?? 0) < est) estimates.set(a.title, est);
        }
      });
      if (estimates.size) {
        pool = [...estimates].map(([title, est]) => ({ title, tier: rarityFromViews(est) }));
        log.info?.(`[packs] réserve d'articles populaires : ${pool.length} articles`);
      } else {
        log.warn?.('[packs] impossible de charger les articles populaires, la carte vedette viendra du hasard');
      }
    })().finally(() => {
      poolLoading = null;
    });
    return poolLoading;
  }

  // Les articles tirés au hasard peuvent aller partout ; ceux des classements ne servent
  // qu'à la carte vedette, sinon les premières cartes seraient bien trop souvent rares.
  function stash(pages, fromPool = false) {
    const known = new Set([...queue, ...buckets[2], ...buckets[3], ...buckets[4]].map((p) => p.pageId));
    for (const p of pages) {
      if (known.has(p.pageId)) continue;
      known.add(p.pageId);
      const bucket = buckets[p.rarity];
      if (bucket && bucket.length < BUCKET_MAX && (fromPool || p.rarity > 2 || bucket.length < BUCKET_LOW * 2)) bucket.push(p);
      else if (!fromPool && queue.length < QUEUE_MAX) queue.push(p);
    }
  }

  async function fillBuckets() {
    const lacking = FEATURED_TIERS.filter((t) => buckets[t].length < BUCKET_LOW);
    if (!lacking.length || !pool.length) return;
    const titles = [];
    for (const t of lacking) {
      const sameTier = pool.filter((p) => p.tier === t);
      titles.push(...sample(sameTier.length ? sameTier : pool, Math.floor(48 / lacking.length)).map((p) => p.title));
    }
    stash(await wiki.measureTitles([...new Set(titles)]), true);
  }

  function refill() {
    if (refilling) return refilling;
    // Si les classements n'ont pas pu être chargés (Wikipédia injoignable au démarrage), on retente.
    if (!pool.length && !poolLoading && Date.now() - poolTriedAt > 10 * 60 * 1000) loadPool().catch(() => {});
    refilling = (async () => {
      const jobs = [];
      if (queue.length < QUEUE_LOW) jobs.push(wiki.randomMeasured(40).then((pages) => stash(pages)));
      jobs.push(fillBuckets());
      const results = await Promise.allSettled(jobs);
      for (const r of results) if (r.status === 'rejected') log.warn?.(`[packs] réapprovisionnement : ${r.reason?.message}`);
    })().finally(() => {
      refilling = null;
    });
    return refilling;
  }

  function take(arr, used, pred = () => true) {
    const i = arr.findIndex((p) => !used.has(p.pageId) && pred(p));
    if (i < 0) return null;
    const [p] = arr.splice(i, 1);
    used.add(p.pageId);
    return p;
  }

  async function pickPages() {
    for (let attempt = 0; queue.length < PACK_SIZE && attempt < 3; attempt++) await refill();
    if (queue.length < PACK_SIZE - 1) throw Object.assign(new Error('Wikipédia ne répond pas, réessaie dans un instant.'), { status: 503 });

    const used = new Set();
    const picked = [];
    for (let i = 0; i < PACK_SIZE - 2; i++) picked.push(take(queue, used));
    picked.push(take(queue, used, (p) => p.rarity >= 1) ?? take(queue, used));

    const target = rollFeatured(rand);
    if (!buckets[target].length && pool.length) await fillBuckets().catch(() => {});
    let featured = null;
    for (let t = target; t >= 2 && !featured; t--) featured = take(buckets[t], used);
    if (!featured) {
      const best = queue.filter((p) => !used.has(p.pageId)).sort((a, b) => b.views - a.views)[0];
      if (best) featured = take(queue, used, (p) => p === best);
    }
    picked.push(featured);
    return picked.filter(Boolean);
  }

  async function materialize(pages) {
    const ids = pages.map((p) => p.pageId);
    const existing = store.getCards(ids);
    const missing = ids.filter((id) => !existing.has(id));
    const details = missing.length ? await wiki.details(missing) : new Map();
    const cards = [];
    for (const p of pages) {
      let card = existing.get(p.pageId);
      if (!card) {
        const d = details.get(p.pageId);
        if (!d) continue;
        card = buildCard({ ...d, pageId: p.pageId, length: d.length || p.length, views: p.views });
        store.insertCard(card);
      }
      cards.push(card);
    }
    return cards;
  }

  async function generatePack() {
    const pages = await pickPages();
    const cards = await materialize(pages);
    refill().catch(() => {});
    if (cards.length < 3) throw Object.assign(new Error('Booster incomplet, réessaie.'), { status: 503 });
    return cards;
  }

  async function warmUp() {
    await loadPool().catch((e) => log.warn?.(`[packs] ${e.message}`));
    await refill();
  }

  return {
    generatePack,
    warmUp,
    loadPool,
    refill,
    stats: () => ({ pool: pool.length, queue: queue.length, rare: buckets[2].length, epique: buckets[3].length, legendaire: buckets[4].length }),
  };
}
