import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { createApp } from '../server/app.js';
import { buildCard } from '../server/cards.js';
import { openDb } from '../server/db.js';

const quiet = { info() {}, warn() {}, error() {} };
let dir;
let db;
let server;
let base;
let nextShiny = [];

// Booster prévisible : toujours les mêmes cinq articles, un par rareté de Commune à Légendaire (+ une Ultra rare).
const card = (pageId, views30, title = `Article ${pageId}`) =>
  buildCard({
    pageId,
    title,
    length: 5000,
    views30,
    daily: [1, 2, 3],
    langs: 3,
    description: 'commune française',
    extract: 'Texte.',
    image: `https://upload.wikimedia.org/${pageId}.jpg`,
  });
const POOL = [card(1, 10), card(2, 80), card(3, 400), card(4, 8000), card(5, 30000, 'Paris')];

before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'wikipacks-'));
  const pub = join(dir, 'public');
  mkdirSync(join(pub, 'assets'), { recursive: true });
  writeFileSync(join(pub, 'index.html'), '<!doctype html><title>WikiPacks</title>');
  writeFileSync(join(pub, 'assets', 'app-abc123.js'), 'console.log(1)');
  db = openDb(join(dir, 'test.db'));
  const packs = {
    async generatePacks(theme, count) {
      for (const c of POOL) db.insertCard(c);
      const stored = db.getCards(POOL.map((c) => c.pageId));
      return Array.from({ length: count }, () => POOL.map((c, i) => ({ card: stored.get(c.pageId), shiny: Boolean(nextShiny[i]) })));
    },
  };
  server = createApp({ db, packs, publicDir: pub, inviteCode: 'potes', log: quiet });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server.closeAllConnections();
  server.close();
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

function client() {
  let cookie = '';
  return async (method, path, body) => {
    const res = await fetch(base + path, {
      method,
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    return { status: res.status, body: await res.json().catch(() => null) };
  };
}

const antoine = client();
const lea = client();

test('règles publiées et inscription avec code d’invitation', async () => {
  const cfg = (await antoine('GET', '/api/config')).body;
  assert.equal(cfg.inviteRequired, true);
  assert.equal(cfg.rules.rarities.length, 6);
  assert.equal(cfg.rules.packs.length, 6);
  assert.equal((await antoine('POST', '/api/register', { username: 'Antoine', password: 'secret1', invite: 'faux' })).status, 403);
  assert.equal((await antoine('POST', '/api/register', { username: 'x', password: 'secret1', invite: 'potes' })).status, 400);
  assert.equal((await antoine('POST', '/api/register', { username: 'Antoine', password: '123', invite: 'potes' })).status, 400);
  const ok = await antoine('POST', '/api/register', { username: 'Antoine', password: 'secret1', invite: 'potes' });
  assert.equal(ok.status, 200);
  assert.equal((await antoine('GET', '/api/me')).body.invite, 'potes');
  assert.equal((await client()('POST', '/api/register', { username: 'antoine', password: 'secret1', invite: 'potes' })).status, 409);
  assert.equal((await lea('POST', '/api/register', { username: 'Léa', password: 'secret2', invite: 'potes' })).status, 200);
});

test('connexion, déconnexion et routes protégées', async () => {
  const c = client();
  assert.equal((await c('GET', '/api/collection')).status, 401);
  assert.equal((await c('POST', '/api/login', { username: 'Antoine', password: 'mauvais' })).status, 401);
  assert.equal((await c('POST', '/api/login', { username: 'Antoine', password: 'secret1' })).status, 200);
  assert.equal((await c('GET', '/api/collection')).status, 200);
  await c('POST', '/api/logout');
  assert.equal((await c('GET', '/api/collection')).status, 401);
});

test('écritures : JSON strict et même origine', async () => {
  const res = await fetch(`${base}/api/login`, { method: 'POST', body: 'username=a&password=b' });
  assert.equal(res.status, 415);
  const sneaky = await fetch(`${base}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain; x=application/json' },
    body: JSON.stringify({ username: 'Antoine', password: 'secret1' }),
  });
  assert.equal(sneaky.status, 415);
  const foreign = await fetch(`${base}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://evil.example' },
    body: JSON.stringify({ username: 'Antoine', password: 'secret1' }),
  });
  assert.equal(foreign.status, 403);
  const same = await fetch(`${base}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: base },
    body: JSON.stringify({ username: 'Antoine', password: 'secret1' }),
  });
  assert.equal(same.status, 200);
});

test('boosters sans limite : exemplaires numérotés et collection regroupée', async () => {
  nextShiny = [false, false, false, false, true];
  const first = await antoine('POST', '/api/packs/open', { theme: 'encyclopedie', count: 1 });
  assert.equal(first.status, 200);
  const [pack] = first.body.packs;
  assert.equal(pack.length, 5);
  assert.ok(pack.every((c) => c.isNew && c.serial === 1 && c.copyId));
  const paris = pack.find((c) => c.pageId === 5);
  assert.equal(paris.shiny, true);
  assert.ok(Math.max(paris.atk, paris.def) > 10000, 'un Shiny Légendaire dépasse 10 000');
  nextShiny = [];

  const ten = await antoine('POST', '/api/packs/open', { theme: 'nature', count: 10 });
  assert.equal(ten.body.packs.length, 10);
  assert.equal(ten.body.stats.packs, 11);
  const again = await antoine('POST', '/api/packs/open', { count: 99 });
  assert.equal(again.body.packs.length, 10, 'au plus 10 boosters par ouverture');
  assert.ok(again.body.packs.flat().every((c) => !c.isNew));

  const col = (await antoine('GET', '/api/collection')).body;
  assert.equal(col.cards.length, 5);
  assert.equal(col.stats.unique, 5);
  assert.equal(col.stats.total, 105);
  assert.deepEqual(col.stats.byRarity, [1, 1, 1, 0, 1, 1]);
  assert.deepEqual(col.stats.shinyByRarity, [0, 0, 0, 0, 0, 1]);
  assert.equal(col.stats.score, 1 + 3 + 10 + 100 + 400 * 2);
  const parisEntry = col.cards.find((c) => c.pageId === 5);
  assert.equal(parisEntry.count, 21);
  assert.equal(parisEntry.shiny, true);
  assert.ok(parisEntry.bestCopyId);
  assert.equal(col.cards[0].extract, undefined, 'la liste ne transporte pas les textes');
});

test('fiche carte : exemplaires, propriétaires et courbe des vues', async () => {
  const { body } = await antoine('GET', '/api/cards/5');
  assert.equal(body.card.extract, 'Texte.');
  assert.deepEqual(body.card.daily, [1, 2, 3]);
  assert.equal(body.card.totalCopies, 21);
  assert.equal(body.card.myCopies.length, 21);
  assert.equal(body.card.myCopies[0].shiny, true, 'le Shiny d’abord');
  assert.deepEqual(body.card.owners, [{ username: 'Antoine', count: 21, shinies: 1 }]);
  assert.equal((await antoine('GET', '/api/cards/999')).status, 404);
});

test('les cartes sont figées dès le premier tirage', async () => {
  const before = (await antoine('GET', '/api/cards/1')).body.card;
  db.insertCard({ ...card(1, 999999, 'Autre titre'), atk: 1, def: 1 });
  const after = (await antoine('GET', '/api/cards/1')).body.card;
  assert.deepEqual([after.title, after.rarity, after.atk], [before.title, before.rarity, before.atk]);
});

test('vitrine : 5 exemplaires maximum, uniquement les siens', async () => {
  const mine = (await antoine('GET', '/api/cards/5')).body.card.myCopies;
  assert.equal((await antoine('PUT', '/api/showcase', { copyIds: mine.slice(0, 6).map((c) => c.copyId) })).status, 400);
  const ok = await antoine('PUT', '/api/showcase', { copyIds: [mine[0].copyId, mine[1].copyId] });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.showcase.length, 2);
  assert.equal(ok.body.showcase[0].shiny, true);
  assert.equal((await lea('PUT', '/api/showcase', { copyIds: [mine[2].copyId] })).status, 400);
});

test('offrir un exemplaire précis à un ami', async () => {
  const shinyCopy = (await antoine('GET', '/api/cards/5')).body.card.myCopies[0];
  assert.equal((await antoine('POST', '/api/gift', { to: 'Personne', copyId: shinyCopy.copyId })).status, 404);
  assert.equal((await antoine('POST', '/api/gift', { to: 'Antoine', copyId: shinyCopy.copyId })).status, 400);
  assert.equal((await lea('POST', '/api/gift', { to: 'Antoine', copyId: shinyCopy.copyId })).status, 400);
  const gift = await antoine('POST', '/api/gift', { to: 'Léa', copyId: shinyCopy.copyId });
  assert.equal(gift.status, 200);
  assert.equal(gift.body.showcase.length, 1, 'l’exemplaire offert quitte la vitrine');
  const leaCard = (await lea('GET', '/api/cards/5')).body.card;
  assert.equal(leaCard.myCopies.length, 1);
  assert.equal(leaCard.myCopies[0].giftedBy, 'Antoine');
  assert.equal(leaCard.myCopies[0].serial, shinyCopy.serial, 'le numéro de série suit l’exemplaire');
  const feed = (await lea('GET', '/api/feed')).body.events;
  assert.equal(feed[0].type, 'gift');
  assert.equal(feed[0].target, 'Léa');
});

test('classement, profils, catalogue et recherche', async () => {
  // Léa a reçu le Paris Shiny : il compte double, elle passe devant.
  const players = (await lea('GET', '/api/players')).body.players;
  assert.deepEqual(players.map((p) => [p.username, p.score]), [['Léa', 800], ['Antoine', 514]]);
  assert.equal(players[0].bestCard.pageId, 5);
  assert.equal(players[0].bestCard.shiny, true);
  assert.equal((await lea('GET', `/api/players/${encodeURIComponent('Antoine')}`)).body.showcase.length, 1);
  assert.equal((await lea('GET', '/api/players/Inconnu')).status, 404);

  const all = (await lea('GET', '/api/catalogue')).body;
  assert.equal(all.total, 5);
  assert.equal(all.cards[0].rarity, 5, 'tri par rareté par défaut');
  assert.equal((await lea('GET', '/api/catalogue?mine=1')).body.total, 1);
  assert.equal((await lea('GET', '/api/catalogue?mine=0')).body.total, 4);
  assert.equal((await lea('GET', '/api/catalogue?rarity=4')).body.total, 1);
  assert.equal((await lea('GET', '/api/catalogue?q=par')).body.cards[0].title, 'Paris');
  assert.equal((await lea('GET', '/api/catalogue?q=%25')).body.total, 0, 'les jokers SQL sont échappés');

  const search = (await lea('GET', '/api/search?q=Pa')).body;
  assert.equal(search.cards[0].title, 'Paris');
});

test('le fil ne garde que les belles prises', async () => {
  const events = (await antoine('GET', '/api/feed')).body.events;
  const pulls = events.filter((e) => e.type === 'pull');
  assert.ok(pulls.length > 0);
  assert.ok(pulls.every((e) => e.card.rarity >= 3 || e.shiny));
});

test('catalogue : paramètres bornés et validés', async () => {
  for (const q of ['limit=-1', 'limit=1.5', 'sort=constructor', 'offset=-5', 'sort=__proto__']) {
    const res = await lea('GET', `/api/catalogue?${q}`);
    assert.equal(res.status, 200, q);
    assert.ok(res.body.cards.length <= 120, q);
  }
});

test('fichiers statiques : page, cache des assets, chemins refusés', async () => {
  assert.equal((await fetch(`${base}/joueur/jean.dupont`)).status, 200, 'un point dans l’adresse reste une page du front');
  assert.equal((await fetch(`${base}/assets/absent.js`)).status, 404);
  const page = await fetch(`${base}/collection`);
  assert.equal(page.status, 200, 'les routes du front renvoient la page');
  assert.match(page.headers.get('content-security-policy'), /default-src 'self'/);
  const asset = await fetch(`${base}/assets/app-abc123.js`);
  assert.match(asset.headers.get('cache-control'), /immutable/);
  const evil = await fetch(`${base}/..%2fpackage.json`);
  assert.ok([400, 403, 404].includes(evil.status));
});
