// Point d'entrée : `npm start`.
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { openDb } from './db.js';
import { createMockFetch } from './mock-wiki.js';
import { createPackFactory } from './packs.js';
import { createWiki } from './wiki.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const env = process.env;

const PORT = Number(env.PORT) || 3000;
const DATA_DIR = resolve(env.DATA_DIR || join(root, 'data'));
const WIKI_LANG = env.WIKI_LANG || 'fr';
const MOCK = env.WIKI_MOCK === '1';
const USER_AGENT =
  env.WIKI_USER_AGENT || 'WikiPacks/1.0 (jeu de cartes entre amis; https://github.com/antoine721/maquette-paris-gessur)';

mkdirSync(DATA_DIR, { recursive: true });
const db = openDb(join(DATA_DIR, 'wikipacks.db'));

const wiki = createWiki({
  lang: WIKI_LANG,
  userAgent: USER_AGENT,
  fetchImpl: MOCK ? createMockFetch() : globalThis.fetch,
});
const packs = createPackFactory({ wiki, store: db });

const server = createApp({
  db,
  packs,
  publicDir: join(root, 'public'),
  inviteCode: (env.INVITE_CODE || '').trim(),
  wikiLang: WIKI_LANG,
});

server.listen(PORT, () => {
  console.log(`WikiPacks est lancé sur http://localhost:${PORT}${MOCK ? ' (Wikipédia simulé)' : ''}`);
  console.log(`Données : ${DATA_DIR}`);
});

packs.warmUp().then(() => console.log('[packs] réserve prête', packs.stats()));
setInterval(() => packs.loadPool().catch(() => {}), 24 * 3600 * 1000).unref();

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    server.close();
    server.closeAllConnections?.();
    db.close();
    process.exit(0);
  });
}
