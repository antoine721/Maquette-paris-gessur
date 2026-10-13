import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createMockFetch } from '../server/mock-wiki.js';
import { createPackFactory } from '../server/packs.js';
import { createWiki } from '../server/wiki.js';

const quiet = { info() {}, warn() {}, error() {} };

function memoryStore() {
  const cards = new Map();
  return {
    cards,
    getCards: (ids) => new Map(ids.filter((id) => cards.has(id)).map((id) => [id, cards.get(id)])),
    insertCard: (c) => cards.set(c.pageId, c),
  };
}

function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

test('le client Wikipédia lit les réponses de l’API', async () => {
  const wiki = createWiki({ fetchImpl: createMockFetch({ latencyMs: 0, seed: 1 }), userAgent: 'test' });
  const random = await wiki.randomMeasured(30);
  assert.ok(random.length > 20, 'des articles au hasard');
  for (const p of random) {
    assert.equal(typeof p.pageId, 'number');
    assert.ok(p.views >= 0);
  }
  const measured = await wiki.measureTitles(['Napoléon_Ier', 'Article qui n’existe pas']);
  assert.equal(measured.length, 1);
  assert.equal(measured[0].title, 'Napoléon Ier');
  assert.equal(measured[0].rarity, 4);
  const details = await wiki.details([measured[0].pageId]);
  const d = details.get(measured[0].pageId);
  assert.match(d.extract, /Ajaccio/);
  assert.equal(d.langs, 190);
  assert.ok(d.image.startsWith('https://upload.wikimedia.org/'));
  const top = await wiki.topMonth(2026, 9);
  assert.ok(top.some((a) => a.title === 'Paris'));
});

test('sans langlinkscount, la DEF se rabat sur la popularité', async () => {
  const base = createMockFetch({ latencyMs: 0, seed: 2 });
  const fetchImpl = async (url) => {
    const res = await base(url);
    if (!String(url).includes('langlinkscount')) return res;
    const body = await res.json();
    body.warnings = { main: { warnings: 'Unrecognized value for parameter "prop": langlinkscount.' } };
    return { ok: true, status: 200, json: async () => body };
  };
  const wiki = createWiki({ fetchImpl, userAgent: 'test' });
  const details = await wiki.details([1000]);
  assert.equal(details.get(1000).langs, null);
});

test('un booster contient 5 cartes distinctes, la dernière au moins Rare', async () => {
  const wiki = createWiki({ fetchImpl: createMockFetch({ latencyMs: 0, seed: 3 }), userAgent: 'test' });
  const store = memoryStore();
  const packs = createPackFactory({ wiki, store, rand: seeded(7), log: quiet });
  await packs.warmUp();
  let featuredHigh = 0;
  const N = 40;
  for (let i = 0; i < N; i++) {
    const cards = await packs.generatePack();
    assert.equal(cards.length, 5);
    assert.equal(new Set(cards.map((c) => c.pageId)).size, 5, 'pas de doublon dans un booster');
    if (cards[4].rarity >= 2) featuredHigh++;
    for (const c of cards) assert.ok(c.title && c.atk >= 100 && c.def >= 100);
  }
  assert.ok(featuredHigh >= N * 0.9, `carte vedette Rare+ dans ${featuredHigh}/${N} boosters`);
});

test('les articles populaires ne remplissent pas les cartes ordinaires', async () => {
  const wiki = createWiki({ fetchImpl: createMockFetch({ latencyMs: 0, seed: 4 }), userAgent: 'test' });
  const store = memoryStore();
  const packs = createPackFactory({ wiki, store, rand: seeded(11), log: quiet });
  await packs.warmUp();
  let legendaryInFirstSlots = 0;
  for (let i = 0; i < 30; i++) {
    const cards = await packs.generatePack();
    legendaryInFirstSlots += cards.slice(0, 4).filter((c) => c.rarity === 4).length;
  }
  assert.ok(legendaryInFirstSlots <= 2, `${legendaryInFirstSlots} légendaires hors carte vedette`);
});

test('Wikipédia injoignable : erreur claire', async () => {
  const wiki = createWiki({
    fetchImpl: async () => ({ ok: false, status: 503, json: async () => ({}) }),
    userAgent: 'test',
  });
  const packs = createPackFactory({ wiki, store: memoryStore(), log: quiet });
  await assert.rejects(packs.generatePack(), (err) => err.status === 503 && /Wikipédia/.test(err.message));
});
