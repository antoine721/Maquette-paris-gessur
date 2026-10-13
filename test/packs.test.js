import assert from 'node:assert/strict';
import { test } from 'node:test';
import { seeded } from '../server/cards.js';
import { createMockFetch } from '../server/mock-wiki.js';
import { createPackFactory } from '../server/packs.js';
import { createWiki } from '../server/wiki.js';

const quiet = { info() {}, warn() {}, error() {} };

function memoryStore() {
  const cards = new Map();
  return {
    cards,
    getCards: (ids) => new Map(ids.filter((id) => cards.has(id)).map((id) => [id, cards.get(id)])),
    insertCard: (c) => c.image && cards.set(c.pageId, c),
  };
}

const wikiWith = (seed, wrap = (f) => f) => createWiki({ fetchImpl: wrap(createMockFetch({ latencyMs: 0, seed })), userAgent: 'test' });

test('le client lit les réponses de l’API et écarte les articles sans image ou d’homonymie', async () => {
  let raw = null;
  const wiki = wikiWith(1, (f) => async (url) => {
    const res = await f(url);
    if (String(url).includes('generator=random')) {
      const body = await res.json();
      raw = body.query.pages;
      return { ok: true, status: 200, json: async () => body };
    }
    return res;
  });
  const random = await wiki.randomMeasured(50);
  const kept = raw.filter((p) => p.thumbnail && !p.pageprops?.disambiguation).length;
  assert.equal(random.length, kept, 'seuls les articles illustrés, hors homonymie');
  assert.ok(random.length < raw.length);
  for (const p of random) {
    assert.ok(p.image, 'chaque carte a une image');
    assert.equal(p.daily.length, 30);
    assert.ok(Number.isInteger(p.views30));
  }
  const [napoleon] = await wiki.measureTitles(['Napoléon_Ier', 'Article qui n’existe pas']);
  assert.equal(napoleon.title, 'Napoléon Ier');
  assert.equal(napoleon.rarity, 5);
  assert.equal(napoleon.type, 'personnalite');
  assert.equal(napoleon.wikidata, `Q${napoleon.pageId}`);
  const d = (await wiki.details([napoleon.pageId])).get(napoleon.pageId);
  assert.match(d.extract, /Ajaccio/);
  assert.equal(d.langs, 190);
  assert.equal(d.quality, 'AdQ');
  const top = await wiki.topMonth(2026, 9);
  assert.ok(top.some((a) => a.title === 'Paris'));
});

test('sans langlinkscount, la DEF se rabat sur la qualité estimée', async () => {
  const wiki = wikiWith(2, (f) => async (url) => {
    const res = await f(url);
    if (!String(url).includes('langlinkscount')) return res;
    const body = await res.json();
    body.warnings = { main: { warnings: 'Unrecognized value for parameter "prop": langlinkscount.' } };
    return { ok: true, status: 200, json: async () => body };
  });
  assert.equal((await wiki.details([1000])).get(1000).langs, null);
});

test('un booster : 5 cartes distinctes et illustrées, la dernière au moins Rare', async () => {
  const packs = createPackFactory({ wiki: wikiWith(3), store: memoryStore(), rand: seeded(7), log: quiet });
  await packs.warmUp();
  let featuredRare = 0;
  const N = 60;
  for (let i = 0; i < N; i++) {
    const [pack] = await packs.generatePacks('encyclopedie', 1);
    assert.equal(pack.length, 5);
    assert.equal(new Set(pack.map((x) => x.card.pageId)).size, 5, 'pas de doublon dans un booster');
    for (const { card, shiny } of pack) {
      assert.ok(card.image, 'carte illustrée');
      assert.equal(typeof shiny, 'boolean');
    }
    if (pack[4].card.rarity >= 2) featuredRare++;
  }
  assert.ok(featuredRare >= N * 0.9, `carte vedette Rare+ dans ${featuredRare}/${N} boosters`);
});

test('×10 : dix boosters d’un coup', async () => {
  const packs = createPackFactory({ wiki: wikiWith(4), store: memoryStore(), rand: seeded(11), log: quiet });
  await packs.warmUp();
  const opened = await packs.generatePacks('encyclopedie', 10);
  assert.equal(opened.length, 10);
  assert.ok(opened.every((p) => p.length === 5));
});

test('un booster thématique : sa famille d’abord, et la carte vedette toujours Rare ou mieux', async () => {
  for (const [theme, family] of [['nature', 'nature'], ['monde', 'lieu']]) {
    const packs = createPackFactory({ wiki: wikiWith(5), store: memoryStore(), rand: seeded(3), log: quiet });
    await packs.warmUp();
    let off = 0;
    let total = 0;
    for (let i = 0; i < 20; i++) {
      const [pack] = await packs.generatePacks(theme, 1);
      assert.ok(pack[4].card.rarity >= 2, `${theme} : carte vedette ${pack[4].card.rarity}`);
      for (const { card } of pack.slice(0, 4)) {
        total++;
        if (card.type !== family) off++;
      }
    }
    assert.ok(off / total < 0.05, `${theme} : ${off}/${total} cartes ordinaires hors famille`);
  }
});

test('Wikipédia injoignable : erreur claire', async () => {
  const wiki = createWiki({ fetchImpl: async () => ({ ok: false, status: 503, json: async () => ({}) }), userAgent: 'test' });
  const packs = createPackFactory({ wiki, store: memoryStore(), log: quiet });
  await assert.rejects(packs.generatePacks('encyclopedie', 1), (err) => err.status === 503 && /Wikipédia/.test(err.message));
});
