// Règles du jeu, calquées sur WikiMasters : raretés, statistiques, types et boosters.
// Tout est pur (aucun accès réseau ni base) pour rester testable.

// Rareté = vues de l'article sur les 30 derniers jours. Elle est figée au premier tirage.
// `share` : part du catalogue dans chaque rareté (règles officielles de WikiMasters).
// `stat` : fourchette de la meilleure des deux statistiques ; l'autre vaut au moins 50 % de celle-ci.
export const RARITIES = [
  { id: 0, key: 'commune', label: 'Commune', min: 0, stat: [0, 2000], share: 0.5025, points: 1 },
  { id: 1, key: 'peu-commune', label: 'Peu commune', min: 50, stat: [1500, 3500], share: 0.2, points: 3 },
  { id: 2, key: 'rare', label: 'Rare', min: 250, stat: [3000, 5500], share: 0.2, points: 10 },
  { id: 3, key: 'super-rare', label: 'Super rare', min: 1000, stat: [5000, 7500], share: 0.07, points: 30 },
  { id: 4, key: 'ultra-rare', label: 'Ultra rare', min: 5000, stat: [7000, 9000], share: 0.025, points: 100 },
  { id: 5, key: 'legendaire', label: 'Légendaire', min: 20000, stat: [8500, 10000], share: 0.0025, points: 400 },
];
export const MAX_RARITY = RARITIES.length - 1;

// Une carte sur 50 sort en version Shiny : reflets arc-en-ciel et statistiques au-delà de sa fourchette
// (pour une Légendaire, 10 001 à 15 000 comme dans WikiMasters).
export const SHINY_RATE = 1 / 50;

export const PACK_SIZE = 5;
export const MAX_PACKS_PER_OPEN = 10;

// Cartes 1 à 4 : mêmes proportions que le catalogue. Carte 5 (« vedette ») : Rare ou mieux.
export const SLOT_ODDS = RARITIES.map((r) => [r.id, r.share]);
export const FEATURED_ODDS = [
  [2, 0.7],
  [3, 0.22],
  [4, 0.07],
  [5, 0.01],
];

// Familles de cartes, devinées à partir de la description courte de l'article (Wikidata).
export const TYPES = [
  { key: 'personnalite', label: 'Personnalité' },
  { key: 'lieu', label: 'Lieu' },
  { key: 'nature', label: 'Nature' },
  { key: 'culture', label: 'Culture' },
  { key: 'sport', label: 'Sport' },
  { key: 'histoire', label: 'Histoire' },
  { key: 'sciences', label: 'Sciences' },
  { key: 'savoir', label: 'Savoir' },
];

// Les boosters thématiques ne contiennent que certaines familles.
export const PACKS = [
  { key: 'encyclopedie', label: 'Encyclopédie', tagline: 'Tout Wikipédia', types: null },
  { key: 'personnalites', label: 'Personnalités', tagline: 'Celles et ceux qui ont marqué', types: ['personnalite'] },
  { key: 'monde', label: 'Tour du monde', tagline: 'Villes, pays, monuments', types: ['lieu'] },
  { key: 'nature', label: 'Règne vivant', tagline: 'Animaux, plantes et merveilles', types: ['nature'] },
  { key: 'culture', label: 'Pop culture', tagline: 'Films, musique, sport', types: ['culture', 'sport'] },
  { key: 'savoirs', label: 'Savoirs', tagline: 'Sciences et histoire', types: ['sciences', 'histoire', 'savoir'] },
];
export const packByKey = (key) => PACKS.find((p) => p.key === key) ?? PACKS[0];

// Les mots-clés sont cherchés comme mots entiers (accents compris : \b ne les reconnaît pas).
const TYPE_RULES = [
  ['sport', String.raw`club (de|omnisports)|équipe (de|nationale)|saison \d|championnat|coupe (du|de|d[’']\p{L}+)|tournoi|jeux olympiques|grand prix|stade|compétition|ligue|course cycliste|rallye`],
  ['personnalite', String.raw`né|née|footballeur|footballeuse|joueur|joueuse|acteur|actrice|chanteur|chanteuse|compositeur|compositrice|musicien|musicienne|rappeur|rappeuse|écrivain|écrivaine|romancier|romancière|poète|poétesse|peintre|sculpteur|sculptrice|photographe|réalisateur|réalisatrice|scénariste|homme politique|femme politique|personnalité|journaliste|animateur|animatrice|militaire|général|officier|cycliste|athlète|nageur|nageuse|boxeur|pilote|skieur|skieuse|tennisman|tenniswoman|handballeur|basketteur|rugbyman|entraîneur|philosophe|mathématicien|mathématicienne|physicien|physicienne|chimiste|biologiste|médecin|ingénieur|ingénieure|inventeur|architecte|historien|historienne|scientifique|astronome|économiste|sociologue|linguiste|théologien|religieux|religieuse|prêtre|évêque|archevêque|cardinal|pape|saint|sainte|roi|reine|empereur|impératrice|prince|princesse|duc|duchesse|comte|comtesse|seigneur|pharaon|sultan|chef d’état|président de|présidente de|ministre|député|députée|sénateur|sénatrice|maire|diplomate|résistant|résistante|aviateur|explorateur|navigateur|mannequin|youtubeur|influenceur|humoriste|danseur|danseuse|chef cuisinier|styliste|designer|homme d’affaires|femme d’affaires|entrepreneur|entrepreneuse|avocat|avocate|juriste|magistrat`],
  ['nature', String.raw`espèce|sous-espèce|genre (de|d[’']\p{L}+)|famille (de|d[’']\p{L}+)|ordre (de|d[’']\p{L}+)|taxon|plante|arbre|fleur|champignon|lichen|mousse|algue|bactérie|virus|animal|mammifère|oiseau|poisson|reptile|amphibien|insecte|coléoptère|papillon|lépidoptère|araignée|mollusque|crustacé|race (de|d[’']\p{L}+)|cépage|cultivar|minéral|roche`],
  ['lieu', String.raw`commune|ville|village|hameau|capitale|métropole|pays|état (de|du|d[’']\p{L}+)|région|province|département|canton|arrondissement|comté|district|municipalité|quartier|île|archipel|montagne|mont|sommet|massif|volcan|col|vallée|rivière|fleuve|lac|mer|océan|baie|golfe|cap|désert|forêt|parc|réserve naturelle|château|église|cathédrale|basilique|abbaye|chapelle|monastère|mosquée|temple|synagogue|monument|musée|pont|tour|gare|station|aéroport|port|rue|avenue|boulevard|place|stade|bâtiment|édifice|site archéologique|localité|ancienne commune|lieu-dit|territoire|colonie|oblast|voblast|powiat|gmina`],
  ['culture', String.raw`film|téléfilm|série|feuilleton|émission|album|single|chanson|ep|œuvre|roman|nouvelle|livre|recueil|poème|pièce de théâtre|opéra|ballet|tableau|peinture|sculpture|bande dessinée|manga|anime|dessin animé|jeu vidéo|jeu de société|personnage de fiction|groupe de musique|groupe de rock|groupe|festival|magazine|journal|revue|chaîne de télévision|station de radio|logiciel de jeu|franchise|saga|genre musical|style musical|mouvement artistique`],
  ['histoire', String.raw`bataille|guerre|siège|traité|révolution|révolte|insurrection|massacre|attentat|événement|élection|référendum|dynastie|empire|royaume|république|régime|parti politique|organisation|association|fondation|entreprise|société|institution|université|école|lycée|collège|ordre religieux|congrégation|armée|régiment|division|navire|cuirassé|sous-marin|monnaie|loi|constitution|accord|conférence|conflit|crise|épidémie`],
  ['sciences', String.raw`concept|théorie|théorème|équation|unité|constante|particule|élément chimique|composé chimique|molécule|protéine|gène|enzyme|maladie|syndrome|médicament|planète|exoplanète|étoile|galaxie|nébuleuse|astéroïde|comète|satellite|constellation|langage de programmation|logiciel|protocole|algorithme|format de fichier|système d’exploitation|technologie|technique|discipline|science|branche|méthode|matériau|alliage|appareil|instrument|outil|véhicule|automobile|avion|moteur|arme|fusil`],
].map(([type, words]) => [type, new RegExp(`(?<![\\p{L}\\p{N}])(?:${words})(?:s|x)?(?![\\p{L}\\p{N}])`, 'u')]);

export function classifyType(description = '', title = '') {
  const text = `${description}`.toLocaleLowerCase('fr');
  for (const [type, re] of TYPE_RULES) if (re.test(text)) return type;
  const t = title.toLocaleLowerCase('fr');
  if (/\(film|\(série|\(album|\(chanson|\(roman|\(jeu vidéo/.test(t)) return 'culture';
  if (/^(bataille|siège|traité|guerre) /.test(t)) return 'histoire';
  return 'savoir';
}

export function rarityFromViews(views30) {
  for (let i = MAX_RARITY; i > 0; i--) if (views30 >= RARITIES[i].min) return i;
  return 0;
}

// Vues sur 30 jours. Les jours sans donnée sont comblés par la moyenne des autres.
export function views30From(pageviews) {
  if (!pageviews || typeof pageviews !== 'object') return { views30: 0, daily: [] };
  const entries = Object.entries(pageviews).sort(([a], [b]) => (a < b ? -1 : 1)).slice(-30);
  const known = entries.map(([, v]) => v).filter((v) => typeof v === 'number');
  if (!known.length) return { views30: 0, daily: [] };
  const avg = known.reduce((a, b) => a + b, 0) / known.length;
  return { views30: Math.round(avg * 30), daily: entries.map(([, v]) => (typeof v === 'number' ? v : null)) };
}

export function roll(odds, rand = Math.random) {
  const total = odds.reduce((s, [, p]) => s + p, 0);
  let r = rand() * total;
  for (const [tier, p] of odds) {
    if (r < p) return tier;
    r -= p;
  }
  return odds[odds.length - 1][0];
}

// Générateur pseudo-aléatoire déterministe : une même page donne toujours les mêmes statistiques.
export function seeded(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp01 = (x) => Math.min(1, Math.max(0, x));

// La longueur de l'article nourrit l'attaque, sa qualité (langues, label) la défense :
// le côté le plus fort de la carte suit le point fort de l'article.
// Si le nombre de langues est inconnu, la popularité sert d'indice de qualité.
export function statsFor({ pageId, rarity, length = 0, langs = null, quality = null, views30 = 0 }) {
  const rng = seeded(Math.imul(pageId, 2654435761));
  const [lo, hi] = RARITIES[rarity].stat;
  const best = Math.round(lo + rng() * (hi - lo));
  const other = Math.round(best * (0.5 + rng() * 0.5));
  const lengthScore = clamp01((Math.log10(Math.max(length, 1)) - 2.7) / 2.7);
  const reach = langs == null ? Math.log10(views30 + 1) / Math.log10(600000) : Math.log10(langs + 1) / Math.log10(250);
  const qualityScore = clamp01(reach) + (quality === 'AdQ' ? 0.35 : quality === 'BA' ? 0.2 : 0);
  return lengthScore >= qualityScore ? { atk: best, def: other } : { atk: other, def: best };
}

// Statistiques d'un exemplaire Shiny : la meilleure passe au-dessus de la fourchette (jusqu'à +50 %).
export function shinyStats({ atk, def }, rarity) {
  const [lo, hi] = RARITIES[rarity].stat;
  const best = Math.max(atk, def, 1);
  const t = clamp01((best - lo) / (hi - lo || 1));
  const shinyBest = Math.round(hi + 1 + t * (hi * 0.5 - 1));
  const ratio = shinyBest / best;
  return { atk: Math.round(atk * ratio), def: Math.round(def * ratio) };
}

const IMAGE_PREFIXES = ['https://upload.wikimedia.org/', '/mock-img/'];
export function cleanImage(url) {
  if (typeof url !== 'string') return null;
  return IMAGE_PREFIXES.some((p) => url.startsWith(p)) ? url : null;
}

export const cleanDescription = (text) => cleanText(text, 140);

export function cleanText(text, max) {
  if (typeof text !== 'string') return '';
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max - 20))}…`;
}

// Une carte complète, prête à être enregistrée, à partir des données de Wikipédia.
export function buildCard(d) {
  const rarity = rarityFromViews(d.views30 ?? 0);
  const description = cleanDescription(d.description);
  const base = {
    pageId: d.pageId,
    title: d.title,
    description,
    extract: cleanText(d.extract, 900),
    image: cleanImage(d.image),
    imageWidth: d.imageWidth ?? null,
    imageHeight: d.imageHeight ?? null,
    wikidata: typeof d.wikidata === 'string' && /^Q\d+$/.test(d.wikidata) ? d.wikidata : null,
    length: d.length ?? 0,
    langs: Number.isInteger(d.langs) ? d.langs : null,
    quality: d.quality === 'AdQ' || d.quality === 'BA' ? d.quality : null,
    views30: Math.round(d.views30 ?? 0),
    daily: Array.isArray(d.daily) ? d.daily.slice(-30) : [],
    type: classifyType(description, d.title),
    rarity,
  };
  return { ...base, ...statsFor(base) };
}

// Score de collection : chaque carte unique rapporte selon sa rareté, chaque Shiny unique compte double.
export function scoreOf(byRarity, shinyByRarity = []) {
  return byRarity.reduce((sum, n, i) => sum + (n + (shinyByRarity[i] ?? 0)) * RARITIES[i].points, 0);
}

// Pages des classements Wikimedia qui ne sont pas des articles encyclopédiques.
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

// Ce que le navigateur a besoin de connaître des règles.
export function publicRules() {
  return {
    rarities: RARITIES.map(({ id, key, label, min, stat, share, points }) => ({ id, key, label, min, stat, share, points })),
    types: TYPES,
    packs: PACKS.map(({ key, label, tagline, types }) => ({ key, label, tagline, types })),
    packSize: PACK_SIZE,
    maxPacksPerOpen: MAX_PACKS_PER_OPEN,
    shinyRate: SHINY_RATE,
    slotOdds: SLOT_ODDS,
    featuredOdds: FEATURED_ODDS,
  };
}
