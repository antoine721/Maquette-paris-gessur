import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  FEATURED_ODDS,
  RARITIES,
  SLOT_ODDS,
  buildCard,
  classifyType,
  cleanImage,
  isArticleTitle,
  rarityFromViews,
  roll,
  scoreOf,
  seeded,
  shinyStats,
  statsFor,
  views30From,
} from '../server/cards.js';

test('six raretés, mêmes seuils que WikiMasters (vues sur 30 jours)', () => {
  assert.deepEqual(
    RARITIES.map((r) => r.label),
    ['Commune', 'Peu commune', 'Rare', 'Super rare', 'Ultra rare', 'Légendaire'],
  );
  const cases = [
    [0, 0], [49, 0], [50, 1], [249, 1], [250, 2], [999, 2], [1000, 3], [4999, 3], [5000, 4], [19999, 4], [20000, 5], [5e6, 5],
  ];
  for (const [views, rarity] of cases) assert.equal(rarityFromViews(views), rarity, `${views} vues`);
  assert.ok(Math.abs(RARITIES.reduce((s, r) => s + r.share, 0) - 1) < 1e-9, 'les parts du catalogue font 100 %');
});

test('vues sur 30 jours : les jours sans donnée sont comblés par la moyenne', () => {
  const { views30, daily } = views30From({ '2026-10-01': 10, '2026-10-02': null, '2026-10-03': 20 });
  assert.equal(views30, 450);
  assert.deepEqual(daily, [10, null, 20]);
  assert.deepEqual(views30From(undefined), { views30: 0, daily: [] });
});

test('statistiques : la meilleure dans la fourchette de la rareté, l’autre au moins à 50 %', () => {
  for (let r = 0; r < RARITIES.length; r++) {
    for (let pageId = 1; pageId < 400; pageId += 7) {
      const { atk, def } = statsFor({ pageId, rarity: r, length: 5000 + pageId * 50, langs: pageId % 40 });
      const best = Math.max(atk, def);
      const other = Math.min(atk, def);
      const [lo, hi] = RARITIES[r].stat;
      assert.ok(best >= lo && best <= hi, `${RARITIES[r].label} : ${best} hors [${lo}, ${hi}]`);
      assert.ok(other >= Math.floor(best * 0.5), 'l’autre stat vaut au moins la moitié');
    }
  }
});

test('statistiques figées : la même page donne toujours les mêmes valeurs', () => {
  const a = statsFor({ pageId: 4242, rarity: 3, length: 12000, langs: 10 });
  const b = statsFor({ pageId: 4242, rarity: 3, length: 12000, langs: 10 });
  assert.deepEqual(a, b);
});

test('la longueur nourrit l’attaque, la qualité la défense', () => {
  const long = statsFor({ pageId: 7, rarity: 2, length: 250000, langs: 2 });
  const quality = statsFor({ pageId: 7, rarity: 2, length: 900, langs: 200, quality: 'AdQ' });
  assert.ok(long.atk > long.def);
  assert.ok(quality.def > quality.atk);
});

test('Shiny : au-dessus de la fourchette, jusqu’à 15 000 pour une Légendaire', () => {
  for (let pageId = 1; pageId < 200; pageId += 3) {
    const base = statsFor({ pageId, rarity: 5, length: 40000, langs: 100 });
    const s = shinyStats(base, 5);
    const best = Math.max(s.atk, s.def);
    assert.ok(best >= 10001 && best <= 15000, `shiny ${best}`);
  }
  const com = shinyStats({ atk: 2000, def: 1000 }, 0);
  assert.ok(Math.max(com.atk, com.def) > 2000);
});

test('tirage des raretés : proportions respectées', () => {
  const rand = seeded(99);
  const counts = RARITIES.map(() => 0);
  const N = 200000;
  for (let i = 0; i < N; i++) counts[roll(SLOT_ODDS, rand)]++;
  RARITIES.forEach((r, i) => assert.ok(Math.abs(counts[i] / N - r.share) < 0.006, `${r.label} : ${counts[i] / N}`));
  for (let i = 0; i < 2000; i++) assert.ok(roll(FEATURED_ODDS, rand) >= 2, 'la carte vedette est au moins Rare');
});

test('familles devinées depuis la description', () => {
  const cases = [
    ['écrivain français', 'personnalite'],
    ['commune française', 'lieu'],
    ['église située en France', 'lieu'],
    ['espèce d’insectes', 'nature'],
    ['genre d\'insectes', 'nature'],
    ['film sorti en 1999', 'culture'],
    ['personnage de fiction', 'culture'],
    ['club de football français', 'sport'],
    ['élément chimique', 'sciences'],
    ['bataille de la guerre de Cent Ans', 'histoire'],
    ['mot', 'savoir'],
  ];
  for (const [d, t] of cases) assert.equal(classifyType(d), t, d);
  assert.equal(classifyType('', 'Les Misérables (film, 1958)'), 'culture');
});

test('seules les images de Wikimedia sont acceptées', () => {
  assert.equal(cleanImage('https://upload.wikimedia.org/a.jpg'), 'https://upload.wikimedia.org/a.jpg');
  assert.equal(cleanImage('javascript:alert(1)'), null);
  assert.equal(cleanImage('https://evil.example/a.jpg'), null);
});

test('construction d’une carte complète', () => {
  const card = buildCard({
    pageId: 1,
    title: 'Chat',
    length: 140000,
    views30: 69000,
    daily: [1, 2, 3],
    langs: 230,
    quality: 'BA',
    description: ' mammifère  carnivore ',
    extract: 'Le  chat.',
    image: 'https://upload.wikimedia.org/chat.jpg',
    wikidata: 'Q146',
  });
  assert.equal(card.rarity, 5);
  assert.equal(card.type, 'nature');
  assert.equal(card.description, 'mammifère carnivore');
  assert.equal(card.extract, 'Le chat.');
  assert.equal(card.wikidata, 'Q146');
  assert.ok(Math.max(card.atk, card.def) >= 8500);
  assert.equal(buildCard({ pageId: 2, title: 'X', wikidata: 'pas un id' }).wikidata, null);
});

test('les pages techniques ne sont pas des articles', () => {
  assert.equal(isArticleTitle('Spécial:Recherche'), false);
  assert.equal(isArticleTitle('Wikipédia:Accueil_principal'), false);
  assert.equal(isArticleTitle('Discussion_utilisateur:Toto'), false);
  assert.equal(isArticleTitle('-'), false);
  assert.equal(isArticleTitle('Napoléon_Ier'), true);
  assert.equal(isArticleTitle('Star_Wars_:_Épisode_IV'), true);
});

test('score : points par carte unique, un Shiny unique compte double', () => {
  assert.equal(scoreOf([1, 1, 1, 1, 1, 1]), 1 + 3 + 10 + 30 + 100 + 400);
  assert.equal(scoreOf([0, 0, 0, 0, 0, 1], [0, 0, 0, 0, 0, 1]), 800);
});
