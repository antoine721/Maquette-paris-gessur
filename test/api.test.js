import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { after, before, test } from 'node:test';
import { createApp } from '../server/app.js';
import { buildCard } from '../server/cards.js';
import { openDb } from '../server/db.js';

const quiet = { info() {}, warn() {}, error() {} };
let dir;
let db;
let server;
let base;
let nextPack = null;

// Booster prévisible : on choisit les cartes renvoyées par la fabrique.
const card = (pageId, views, title = `Article ${pageId}`) =>
  buildCard({ pageId, title, length: 5000, views, langs: 3, description: 'test', extract: 'Texte.', image: null });
const defaultPack = () => [card(1, 1), card(2, 5), card(3, 30), card(4, 150), card(5, 3000, 'Paris')];

before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'wikipacks-'));
  db = openDb(join(dir, 'test.db'));
  const packs = {
    async generatePack() {
      const cards = nextPack ?? defaultPack();
      nextPack = null;
      for (const c of cards) db.insertCard(c);
      return [...db.getCards(cards.map((c) => c.pageId)).values()];
    },
  };
  server = createApp({ db, packs, publicDir: resolve('public'), inviteCode: 'potes', log: quiet });
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

test('inscription avec code d’invitation', async () => {
  const c = client();
  assert.equal((await c('GET', '/api/config')).body.inviteRequired, true);
  assert.equal((await c('POST', '/api/register', { username: 'Antoine', password: 'secret1', invite: 'faux' })).status, 403);
  assert.equal((await c('POST', '/api/register', { username: 'x', password: 'secret1', invite: 'potes' })).status, 400);
  assert.equal((await c('POST', '/api/register', { username: 'Antoine', password: '123', invite: 'potes' })).status, 400);
  const ok = await c('POST', '/api/register', { username: 'Antoine', password: 'secret1', invite: 'potes' });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.user.username, 'Antoine');
  assert.equal((await c('GET', '/api/me')).body.invite, 'potes');
  const dup = await client()('POST', '/api/register', { username: 'antoine', password: 'secret1', invite: 'potes' });
  assert.equal(dup.status, 409, 'pseudo insensible à la casse');
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

test('une requête non JSON est refusée', async () => {
  const res = await fetch(`${base}/api/login`, { method: 'POST', body: 'username=a&password=b' });
  assert.equal(res.status, 415);
});

test('ouvrir des boosters sans limite et retrouver sa collection', async () => {
  const c = client();
  await c('POST', '/api/login', { username: 'Antoine', password: 'secret1' });
  const first = await c('POST', '/api/packs/open');
  assert.equal(first.status, 200);
  assert.equal(first.body.cards.length, 5);
  assert.ok(first.body.cards.every((x) => x.isNew && x.count === 1));
  for (let i = 0; i < 25; i++) assert.equal((await c('POST', '/api/packs/open')).status, 200);
  const last = await c('POST', '/api/packs/open');
  assert.ok(last.body.cards.every((x) => !x.isNew && x.count === 27));
  assert.equal(last.body.stats.packs, 27);
  const col = await c('GET', '/api/collection');
  assert.equal(col.body.cards.length, 5);
  assert.equal(col.body.stats.unique, 5);
  assert.deepEqual(col.body.stats.byRarity, [2, 1, 1, 0, 1]);
  assert.equal(col.body.cards[0].extract, undefined, 'la liste ne transporte pas les textes');
  const detail = await c('GET', '/api/cards/5');
  assert.equal(detail.body.card.extract, 'Texte.');
  assert.equal(detail.body.card.count, 27);
});

test('une belle prise apparaît dans le fil d’activité', async () => {
  const c = client();
  await c('POST', '/api/login', { username: 'Antoine', password: 'secret1' });
  const { body } = await c('GET', '/api/feed');
  const pull = body.events.find((e) => e.type === 'pull');
  assert.equal(pull.user, 'Antoine');
  assert.equal(pull.card.title, 'Paris');
  assert.ok(!body.events.some((e) => e.type === 'pull' && e.card.rarity < 3), 'seules les Épiques et Légendaires');
});

test('offrir une carte à un ami', async () => {
  const lea = client();
  await lea('POST', '/api/register', { username: 'Léa', password: 'secret2', invite: 'potes' });
  const antoine = client();
  await antoine('POST', '/api/login', { username: 'Antoine', password: 'secret1' });
  assert.equal((await antoine('POST', '/api/gift', { to: 'Personne', pageId: 5 })).status, 404);
  assert.equal((await antoine('POST', '/api/gift', { to: 'Antoine', pageId: 5 })).status, 400);
  assert.equal((await antoine('POST', '/api/gift', { to: 'Léa', pageId: 999 })).status, 400);
  const gift = await antoine('POST', '/api/gift', { to: 'Léa', pageId: 5 });
  assert.equal(gift.status, 200);
  assert.equal(gift.body.remaining, 26);
  const leaCol = await lea('GET', '/api/collection');
  assert.deepEqual(leaCol.body.cards.map((x) => x.pageId), [5]);
  const profile = await lea('GET', `/api/players/${encodeURIComponent('Antoine')}`);
  assert.equal(profile.body.cards.find((x) => x.pageId === 5).count, 26);
  const players = await lea('GET', '/api/players');
  assert.deepEqual(players.body.players.map((p) => p.username), ['Antoine', 'Léa']);
});

test('donner son dernier exemplaire le retire de la collection', async () => {
  const lea = client();
  await lea('POST', '/api/login', { username: 'Léa', password: 'secret2' });
  assert.equal((await lea('POST', '/api/gift', { to: 'Antoine', pageId: 5 })).status, 200);
  assert.equal((await lea('GET', '/api/collection')).body.cards.length, 0);
  assert.equal((await lea('POST', '/api/gift', { to: 'Antoine', pageId: 5 })).status, 400);
});

test('fichiers statiques servis, chemins hors du dossier refusés', async () => {
  const page = await fetch(`${base}/`);
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-security-policy'), /default-src 'self'/);
  assert.match(await page.text(), /WikiPacks/);
  const css = await fetch(`${base}/css/app.css`);
  assert.equal(css.headers.get('content-type'), 'text/css; charset=utf-8');
  const evil = await fetch(`${base}/..%2fpackage.json`);
  assert.ok([403, 404].includes(evil.status));
});
