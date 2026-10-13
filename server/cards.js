// Règles du jeu : rareté, statistiques et composition d'un booster.
// Tout est pur (aucun accès réseau ni base) pour rester testable.

// La rareté d'une carte vient de la fréquentation de l'article :
// moyenne des vues quotidiennes sur les 30 derniers jours.
export const RARITIES = [
  { id: 0, key: 'commune', label: 'Commune', minViews: 0, points: 1 },
  { id: 1, key: 'peu-commune', label: 'Peu commune', minViews: 20, points: 3 },
  { id: 2, key: 'rare', label: 'Rare', minViews: 100, points: 10 },
  { id: 3, key: 'epique', label: 'Épique', minViews: 500, points: 40 },
  { id: 4, key: 'legendaire', label: 'Légendaire', minViews: 2000, points: 150 },
];

export const PACK_SIZE = 5;

// Dernière carte du booster (« carte vedette ») : au moins Rare.
export const FEATURED_ODDS = [
  [4, 0.04],
  [3, 0.18],
  [2, 0.78],
];

export function rarityFromViews(views) {
  for (let i = RARITIES.length - 1; i > 0; i--) {
    if (views >= RARITIES[i].minViews) return i;
  }
  return 0;
}

export function averageViews(pageviews) {
  if (!pageviews || typeof pageviews !== 'object') return 0;
  const values = Object.values(pageviews).filter((v) => typeof v === 'number');
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function rollFeatured(rand = Math.random) {
  let r = rand();
  for (const [tier, p] of FEATURED_ODDS) {
    if (r < p) return tier;
    r -= p;
  }
  return FEATURED_ODDS[FEATURED_ODDS.length - 1][0];
}

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const round50 = (n) => Math.round(n / 50) * 50;

// ATK : longueur de l'article (500 o → 100, 250 Ko → 4000).
export function atkFromLength(bytes) {
  const t = clamp01((Math.log10(Math.max(bytes, 1)) - 2.7) / (5.4 - 2.7));
  return round50(100 + t * 3900);
}

// DEF : nombre de langues dans lesquelles l'article existe (0 → 100, 250+ → 4000).
export function defFromLangs(langs) {
  const t = clamp01(Math.log10(Math.max(langs, 0) + 1) / Math.log10(250));
  return round50(100 + t * 3900);
}

// Repli si Wikipédia ne donne pas le nombre de langues.
export function defFromViews(views) {
  const t = clamp01(Math.log10(Math.max(views, 0) + 1) / Math.log10(20000));
  return round50(100 + t * 3900);
}

export function cleanImage(url) {
  if (typeof url !== 'string') return null;
  return url.startsWith('https://upload.wikimedia.org/') ? url : null;
}

export function cleanText(text, max) {
  if (typeof text !== 'string') return '';
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  return cut.slice(0, Math.max(cut.lastIndexOf(' '), max - 20)) + '…';
}

export function buildCard({ pageId, title, length, views, langs, description, extract, image }) {
  const v = Math.round((views || 0) * 10) / 10;
  return {
    pageId,
    title,
    description: cleanText(description, 140),
    extract: cleanText(extract, 700),
    image: cleanImage(image),
    length: length || 0,
    views: v,
    langs: langs ?? null,
    rarity: rarityFromViews(v),
    atk: atkFromLength(length || 0),
    def: langs == null ? defFromViews(v) : defFromLangs(langs),
  };
}

// Score de collection : chaque carte unique rapporte selon sa rareté.
export function scoreOf(byRarity) {
  return byRarity.reduce((sum, n, i) => sum + n * RARITIES[i].points, 0);
}

// Articles des classements Wikimedia qui ne sont pas des articles encyclopédiques.
const NAMESPACES = new Set([
  'spécial', 'special', 'wikipédia', 'wikipedia', 'fichier', 'file', 'image', 'catégorie', 'category',
  'portail', 'portal', 'projet', 'aide', 'help', 'modèle', 'template', 'utilisateur', 'utilisatrice',
  'user', 'discussion', 'talk', 'référence', 'mediawiki', 'module', 'sujet', 'média', 'media',
  'brouillon', 'draft', 'topic',
]);

export function isArticleTitle(title) {
  if (typeof title !== 'string' || !title || title === '-') return false;
  const m = title.match(/^([^:]+):/);
  if (m && NAMESPACES.has(m[1].split(/[_ ]/)[0].toLowerCase())) return false;
  return true;
}
