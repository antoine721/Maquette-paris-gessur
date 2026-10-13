import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { seeded } from '../server/cards.js';
import { openDb } from '../server/db.js';
import { createIndexer } from '../server/indexer.js';
import { createMockFetch } from '../server/mock-wiki.js';
import { createPackFactory } from '../server/packs.js';
import { createWiki } from '../server/wiki.js';

const quiet = { info() {}, warn() {}, error() {} };
let dir;
let db;
let wiki;
let indexer;
let requests = 0;

before(() => {
  dir = mkdtempSync(join(tmpdir(), 'wikipacks-index-'));
  db = openDb(join(dir, 'index.db'));
  const mock = createMockFetch({ latencyMs: 0, seed: 21 });
  wiki = createWiki({
    userAgent: 'test',
    fetchImpl: (url, opts) => {
      requests++;
      return mock(url, opts);
    },
  });
  indexer = createIndexer({ wiki, db, log: quiet, pauseMs: 0 });
});

after(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

test('un lot fusionne les propriétés envoyées en plusieurs réponses', async () => {
  const before = requests;
  const { articles, scanned, next } = await wiki.allPagesBatch(null, 50);
  assert.equal(requests - before, 2, 'les vues arrivent dans une seconde réponse');
  assert.equal(scanned, 50);
  assert.ok(next?.gapcontinue, 'la suite du parcours est donnée');
  assert.ok(articles.every((a) => a.daily.length === 30), 'chaque article a ses 30 jours de vues');
  assert.ok(articles.some((a) => !a.image), 'les articles sans image sont aussi indexés');
});

test('indexation complète, reprise comprise', async () => {
  assert.equal(indexer.ready(), false);
  const step = await wiki.allPagesBatch(null, 50);
  db.upsertArticles(step.articles);
  db.setMeta('wiki-index', { pass: 1, cont: step.next, scanned: step.scanned, startedAt: Date.now(), finishedAt: null, completedPasses: 0 });
  // Un « redémarrage » : le nouvel indexeur repart de la sauvegarde.
  const resumed = createIndexer({ wiki, db, log: quiet, pauseMs: 0 });
  await resumed.runToEnd();
  const s = resumed.status();
  assert.equal(s.completedPasses, 1);
  assert.equal(s.scanned, 900, 'chaque article parcouru une seule fois');
  assert.ok(s.articles > 850 && s.articles < 900, 'les pages d’homonymie sont écartées');
  assert.ok(s.illustrated < s.articles);
  assert.equal(s.byRarity.reduce((a, b) => a + b, 0), s.illustrated);
  assert.equal(resumed.ready(), true);
  assert.equal(db.article(1001).title, 'Napoléon Ier');
  assert.equal(db.article(1001).quality, 'AdQ');
  assert.equal(db.article(1001).langs, 190);
});

test('tirage dans l’index : rareté, famille et exclusions respectées', () => {
  const rand = seeded(4);
  for (let r = 0; r <= 5; r++) {
    const a = db.drawArticle(r, null, new Set(), rand);
    if (a) {
      assert.equal(a.rarity, r);
      assert.ok(a.image);
    }
  }
  const legend = db.drawArticle(5, ['nature'], new Set(), rand);
  assert.equal(legend?.type, 'nature');
  const seen = new Set();
  for (let i = 0; i < 20; i++) {
    const a = db.drawArticle(0, null, seen, rand);
    if (!a) break;
    assert.ok(!seen.has(a.pageId));
    seen.add(a.pageId);
  }
});

test('les boosters se tirent dans l’index une fois le passage terminé', async () => {
  const before = requests;
  const packs = createPackFactory({ wiki, store: db, index: indexer, rand: seeded(9), log: quiet });
  assert.equal(packs.stats().source, 'index');
  await packs.warmUp();
  for (let i = 0; i < 15; i++) {
    const [pack] = await packs.generatePacks('encyclopedie', 1);
    assert.equal(pack.length, 5);
    assert.ok(pack[4].card.rarity >= 2);
    assert.ok(pack.every(({ card }) => card.image && card.extract), 'chaque carte a son image et son texte');
  }
  const [nature] = await packs.generatePacks('nature', 1);
  assert.ok(nature.slice(0, 4).every(({ card }) => card.type === 'nature'));
  assert.ok(requests - before <= 16, 'seul le texte des nouvelles cartes est demandé à Wikipédia');
});

test('parcourir tout Wikipédia et voir l’aperçu d’une carte jamais tirée', () => {
  const page = db.browseArticles({ limit: 10 });
  assert.equal(page.cards.length, 10);
  assert.equal(page.hasMore, true);
  assert.ok(page.cards[0].views30 >= page.cards[9].views30, 'les plus lus d’abord');
  const pa = db.browseArticles({ q: 'pa', sort: 'alpha' });
  assert.ok(pa.cards.length > 0 && pa.cards.every((c) => c.title.toLowerCase().startsWith('pa')));
  const undiscovered = page.cards.find((c) => !c.discovered);
  const preview = db.card(undiscovered.pageId, 0);
  assert.equal(preview.preview, true);
  assert.ok(Math.max(preview.atk, preview.def) >= 0);
});
