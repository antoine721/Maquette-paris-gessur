import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  atkFromLength,
  averageViews,
  buildCard,
  cleanImage,
  defFromLangs,
  isArticleTitle,
  rarityFromViews,
  rollFeatured,
  scoreOf,
} from '../server/cards.js';

test('la rareté suit la fréquentation', () => {
  assert.equal(rarityFromViews(0), 0);
  assert.equal(rarityFromViews(19.9), 0);
  assert.equal(rarityFromViews(20), 1);
  assert.equal(rarityFromViews(100), 2);
  assert.equal(rarityFromViews(499), 2);
  assert.equal(rarityFromViews(500), 3);
  assert.equal(rarityFromViews(2000), 4);
  assert.equal(rarityFromViews(1e6), 4);
});

test('moyenne des vues en ignorant les jours sans donnée', () => {
  assert.equal(averageViews({ a: 10, b: null, c: 20 }), 15);
  assert.equal(averageViews({}), 0);
  assert.equal(averageViews(undefined), 0);
});

test('ATK et DEF restent dans leurs bornes', () => {
  assert.equal(atkFromLength(0), 100);
  assert.equal(atkFromLength(500), 100);
  assert.equal(atkFromLength(10_000_000), 4000);
  assert.ok(atkFromLength(20_000) > atkFromLength(2_000));
  assert.equal(defFromLangs(0), 100);
  assert.equal(defFromLangs(400), 4000);
  for (const n of [0, 3, 40, 120]) assert.equal(defFromLangs(n) % 50, 0);
});

test('la carte vedette tombe sur les bonnes raretés', () => {
  assert.equal(rollFeatured(() => 0), 4);
  assert.equal(rollFeatured(() => 0.05), 3);
  assert.equal(rollFeatured(() => 0.5), 2);
  assert.equal(rollFeatured(() => 0.9999), 2);
});

test('seules les images de Wikimedia sont acceptées', () => {
  assert.equal(cleanImage('https://upload.wikimedia.org/a.jpg'), 'https://upload.wikimedia.org/a.jpg');
  assert.equal(cleanImage('javascript:alert(1)'), null);
  assert.equal(cleanImage('https://evil.example/a.jpg'), null);
});

test('construction d’une carte', () => {
  const card = buildCard({ pageId: 1, title: 'Chat', length: 140000, views: 2300.04, langs: 230, description: ' animal ', extract: 'Le  chat.' });
  assert.equal(card.rarity, 4);
  assert.equal(card.views, 2300);
  assert.equal(card.description, 'animal');
  assert.equal(card.extract, 'Le chat.');
  const noLangs = buildCard({ pageId: 2, title: 'X', length: 1000, views: 5, langs: null });
  assert.equal(noLangs.langs, null);
  assert.ok(noLangs.def >= 100);
});

test('les pages techniques ne sont pas des articles', () => {
  assert.equal(isArticleTitle('Spécial:Recherche'), false);
  assert.equal(isArticleTitle('Wikipédia:Accueil_principal'), false);
  assert.equal(isArticleTitle('Discussion_utilisateur:Toto'), false);
  assert.equal(isArticleTitle('-'), false);
  assert.equal(isArticleTitle('Napoléon_Ier'), true);
  assert.equal(isArticleTitle('Star_Wars_:_Épisode_IV'), true);
});

test('score de collection', () => {
  assert.equal(scoreOf([1, 1, 1, 1, 1]), 1 + 3 + 10 + 40 + 150);
});
