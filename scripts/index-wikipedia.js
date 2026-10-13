// Indexe tout Wikipédia dans la base, sans lancer le site : `npm run index`.
// Reprend là où il s'était arrêté ; Ctrl+C pour mettre en pause.
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb } from '../server/db.js';
import { createIndexer } from '../server/indexer.js';
import { createMockFetch } from '../server/mock-wiki.js';
import { createWiki } from '../server/wiki.js';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const env = process.env;
const DATA_DIR = resolve(env.DATA_DIR || join(root, 'data'));
mkdirSync(DATA_DIR, { recursive: true });

const db = openDb(join(DATA_DIR, 'wikipacks.db'));
const wiki = createWiki({
  lang: env.WIKI_LANG || 'fr',
  userAgent: env.WIKI_USER_AGENT || 'WikiPacks/1.0 (jeu de cartes entre amis; https://github.com/antoine721/maquette-paris-gessur)',
  fetchImpl: env.WIKI_MOCK === '1' ? createMockFetch({ latencyMs: 0 }) : globalThis.fetch,
});
const indexer = createIndexer({ wiki, db, pauseMs: Number(env.WIKI_INDEX_PAUSE_MS) || 300 });
const expected = await wiki.articleCount().catch(() => null);
const nf = new Intl.NumberFormat('fr-FR');

let last = 0;
process.on('SIGINT', () => {
  console.log('\nPause. Relance `npm run index` pour reprendre.');
  db.close();
  process.exit(0);
});

console.log(`Indexation de ${expected ? nf.format(expected) : 'tous les'} articles de Wikipédia dans ${DATA_DIR}`);
await indexer.runToEnd({
  onProgress(s) {
    if (Date.now() - last < 5000) return;
    last = Date.now();
    const pct = expected ? ` (${((s.scanned / expected) * 100).toFixed(1)} %)` : '';
    console.log(`${nf.format(s.scanned)} articles parcourus${pct} · ${nf.format(s.illustrated)} cartes possibles`);
  },
});
const s = indexer.status();
console.log(`Terminé : ${nf.format(s.articles)} articles, dont ${nf.format(s.illustrated)} illustrés.`);
db.close();
