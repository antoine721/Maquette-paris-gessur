// Indexation de tout Wikipédia : on parcourt chaque article par ordre alphabétique, 50 à la fois,
// et on enregistre ce qu'il faut pour en faire une carte (sans le texte, chargé au premier tirage).
// Une requête à la fois, avec une pause : c'est la façon polie de lire l'API de Wikimedia.
// L'avancement est sauvegardé après chaque lot : un redémarrage reprend là où on s'était arrêté.

const KEY = 'wiki-index';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function createIndexer({ wiki, db, log = console, pauseMs = 300, refreshDays = 30, batchSize = 50 }) {
  let running = false;
  let stopping = false;
  let lastError = null;
  let expected = null;
  let recent = [];
  let stats = null;
  let statsAt = 0;

  const state = () =>
    db.meta(KEY) ?? { pass: 1, cont: null, scanned: 0, startedAt: Date.now(), finishedAt: null, completedPasses: 0 };

  function articleStats() {
    if (!stats || Date.now() - statsAt > 30000) {
      stats = db.articleStats();
      statsAt = Date.now();
    }
    return stats;
  }

  async function step() {
    const s = state();
    if (s.finishedAt) {
      // Un passage complet tous les `refreshDays` jours, pour rafraîchir la popularité.
      if (Date.now() - s.finishedAt < refreshDays * 86400000) return false;
      Object.assign(s, { pass: s.pass + 1, cont: null, scanned: 0, startedAt: Date.now(), finishedAt: null });
    }
    const t0 = Date.now();
    const { articles, scanned, next } = await wiki.allPagesBatch(s.cont, batchSize);
    db.upsertArticles(articles);
    s.scanned += scanned;
    s.cont = next;
    if (!next) {
      s.finishedAt = Date.now();
      s.completedPasses += 1;
      stats = null;
      log.info?.(`[index] passage ${s.pass} terminé : ${s.scanned} articles parcourus`);
    }
    db.setMeta(KEY, s);
    recent = [...recent.slice(-19), { at: Date.now(), n: scanned, ms: Date.now() - t0 }];
    return true;
  }

  async function loop() {
    let backoff = 0;
    while (!stopping) {
      try {
        const worked = await step();
        lastError = null;
        backoff = 0;
        await sleep(worked ? pauseMs : 60 * 60 * 1000);
      } catch (e) {
        lastError = e.message;
        backoff = Math.min(backoff ? backoff * 2 : 5000, 10 * 60 * 1000);
        log.warn?.(`[index] ${e.message} (nouvel essai dans ${Math.round((e.retryAfter ? e.retryAfter * 1000 : backoff) / 1000)} s)`);
        await sleep(e.retryAfter ? e.retryAfter * 1000 : backoff);
      }
    }
    running = false;
  }

  return {
    start() {
      if (running) return;
      running = true;
      stopping = false;
      wiki
        .articleCount()
        .then((n) => {
          expected = n;
        })
        .catch(() => {});
      loop();
    },
    stop() {
      stopping = true;
    },
    // Un passage complet suffit pour tirer les boosters dans l'index.
    ready: () => state().completedPasses > 0,
    // Pour les tests et l'outil en ligne de commande : avance jusqu'à la fin du passage en cours.
    async runToEnd({ onProgress } = {}) {
      while (!state().finishedAt) {
        await step();
        onProgress?.(this.status());
        if (pauseMs) await sleep(pauseMs);
      }
    },
    status() {
      const s = state();
      const a = articleStats();
      const window = recent.filter((r) => Date.now() - r.at < 5 * 60 * 1000);
      const perMinute = window.length > 1 ? Math.round((window.reduce((n, r) => n + r.n, 0) / (Date.now() - window[0].at)) * 60000) : null;
      return {
        running,
        pass: s.pass,
        completedPasses: s.completedPasses,
        scanned: s.scanned,
        expected,
        startedAt: s.startedAt,
        finishedAt: s.finishedAt,
        articles: a.total,
        illustrated: a.illustrated,
        byRarity: a.byRarity,
        perMinute,
        lastError,
      };
    },
  };
}
