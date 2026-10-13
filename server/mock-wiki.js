// Faux Wikipédia pour jouer et tester hors ligne (WIKI_MOCK=1).
// Il répond avec le même format JSON que les vraies API, pour exercer tout le code,
// et dessine lui-même les illustrations (servies par /mock-img/).
import { classifyType, seeded } from './cards.js';

// [titre, vues par jour, longueur, langues, description, extrait, label]
const FAMOUS = [
  ['Paris', 9800, 412000, 260, 'capitale de la France', 'Paris est la capitale de la France. Elle se situe au cœur d’un vaste bassin sédimentaire aux sols fertiles et au climat tempéré, le Bassin parisien, sur une boucle de la Seine.', 'AdQ'],
  ['Napoléon Ier', 7400, 389000, 190, 'empereur des Français', 'Napoléon Bonaparte, né le 15 août 1769 à Ajaccio et mort le 5 mai 1821 sur l’île de Sainte-Hélène, est un militaire et homme d’État français, premier empereur des Français.', 'AdQ'],
  ['Chat', 2300, 142000, 230, 'mammifère carnivore de la famille des félidés', 'Le chat domestique est la sous-espèce issue de la domestication du chat sauvage, mammifère carnivore de la famille des Félidés.', 'BA'],
  ['Pyramide de Khéops', 2100, 98000, 110, 'monument de l’Égypte antique', 'La pyramide de Khéops, ou grande pyramide de Gizeh, est un monument construit par les Égyptiens de l’Antiquité, formant une pyramide à base carrée.', 'AdQ'],
  ['Ada Lovelace', 1450, 61000, 120, 'mathématicienne britannique', 'Ada Lovelace, de son nom complet Augusta Ada King, comtesse de Lovelace, est une pionnière de la science informatique, connue pour avoir écrit le premier programme informatique.', 'BA'],
  ['Origami', 380, 38000, 90, 'art du pliage du papier', 'L’origami est l’art du pliage du papier. Il est originaire de Chine et du Japon.', null],
  ['Victor Hugo', 3900, 301000, 170, 'écrivain, poète et homme politique français', 'Victor Hugo est un poète, dramaturge, écrivain, romancier et dessinateur romantique français, né le 26 février 1802 à Besançon et mort le 22 mai 1885 à Paris.', 'AdQ'],
  ['Tour Eiffel', 4200, 156000, 180, 'tour de fer puddlé de 330 mètres à Paris', 'La tour Eiffel est une tour de fer puddlé de 330 mètres de hauteur située à Paris, à l’extrémité nord-ouest du parc du Champ-de-Mars en bordure de la Seine.', 'AdQ'],
  ['Marie Curie', 2600, 120000, 200, 'physicienne et chimiste', 'Marie Curie est une physicienne et chimiste polonaise, naturalisée française. Elle est la première femme à avoir reçu le prix Nobel et la seule à en avoir reçu deux dans deux domaines différents.', 'BA'],
  ['Trou noir', 1200, 175000, 95, 'objet céleste si compact que la lumière ne peut s’en échapper', 'En astrophysique, un trou noir est un objet céleste si compact que l’intensité de son champ gravitationnel empêche toute forme de matière ou de rayonnement de s’en échapper.', 'AdQ'],
  ['Baguette', 640, 29000, 60, 'pain de forme allongée', 'La baguette est une variété de pain, reconnaissable à sa forme allongée. Elle est inscrite au patrimoine culturel immatériel de l’humanité depuis 2022.', null],
  ['Mont Blanc', 1100, 64000, 85, 'point culminant de la chaîne des Alpes', 'Le mont Blanc est le point culminant de la chaîne des Alpes. Avec une altitude de 4 805,59 mètres, il est le plus haut sommet d’Europe occidentale.', 'BA'],
  ['Pokémon', 3100, 133000, 120, 'franchise de médias japonaise', 'Pokémon est une franchise de médias appartenant à la société The Pokémon Company, créée en 1996 par Satoshi Tajiri.', null],
  ['Léonard de Vinci', 3300, 158000, 210, 'peintre et inventeur italien', 'Léonard de Vinci est un peintre italien et un homme d’esprit universel, à la fois artiste, organisateur de spectacles et de fêtes, scientifique, ingénieur, inventeur, anatomiste.', 'AdQ'],
  ['Croissant (viennoiserie)', 520, 22000, 55, 'viennoiserie en forme de croissant', 'Le croissant est une viennoiserie à base de pâte levée feuilletée, composée de farine, d’eau, de sel, de levure, de sucre et de beurre.', null],
  ['Système solaire', 1700, 210000, 180, 'système planétaire du Soleil', 'Le Système solaire est le système planétaire composé du Soleil et des objets célestes gravitant autour de lui.', 'AdQ'],
  ['Kylian Mbappé', 6200, 140000, 140, 'footballeur international français', 'Kylian Mbappé Lottin, né le 20 décembre 1998 à Paris, est un footballeur international français qui évolue au poste d’attaquant.', null],
  ['Révolution française', 2900, 260000, 150, 'période de bouleversements politiques et sociaux', 'La Révolution française est une période de bouleversements politiques et sociaux en France, dans ses colonies et en Europe à la fin du XVIIIe siècle.', 'AdQ'],
  ['Escargot', 260, 19000, 70, 'mollusque gastéropode à coquille', 'Escargot est un nom vernaculaire qui désigne en français des mollusques gastéropodes à coquille, généralement terrestres.', null],
  ['Lune', 1900, 190000, 220, 'unique satellite naturel de la Terre', 'La Lune est l’unique satellite naturel permanent de la planète Terre. Il s’agit du cinquième plus grand satellite naturel du Système solaire.', 'AdQ'],
  ['Château de Versailles', 2200, 150000, 110, 'château et monument historique français', 'Le château de Versailles est un château et un monument historique français qui se situe à Versailles, dans les Yvelines.', 'BA'],
  ['Pierre-feuille-ciseaux', 140, 21000, 80, 'jeu de mains', 'Pierre-feuille-ciseaux est un jeu effectué avec les mains et opposant deux joueurs.', null],
  ['Albert Einstein', 3500, 170000, 240, 'physicien théoricien', 'Albert Einstein est un physicien théoricien qui fut successivement allemand, apatride, suisse, et de double nationalité helvético-américaine.', 'AdQ'],
  ['Paris Saint-Germain Football Club', 4100, 210000, 90, 'club de football français', 'Le Paris Saint-Germain Football Club est un club de football français fondé en 1970 et basé à Paris.', null],
  ['Tyrannosaurus', 900, 88000, 100, 'genre de dinosaures théropodes', 'Tyrannosaurus est un genre éteint de dinosaures théropodes ayant vécu à la fin du Crétacé supérieur.', 'BA'],
  ['Bataille de Waterloo', 1300, 120000, 80, 'bataille des guerres napoléoniennes', 'La bataille de Waterloo s’est déroulée le 18 juin 1815 et s’est terminée par la défaite de l’armée française.', 'AdQ'],
  ['Le Petit Prince', 1600, 70000, 100, 'œuvre d’Antoine de Saint-Exupéry', 'Le Petit Prince est une œuvre de langue française, la plus connue d’Antoine de Saint-Exupéry, publiée en 1943.', 'BA'],
  ['Tour de France', 2800, 160000, 75, 'course cycliste par étapes', 'Le Tour de France est une compétition cycliste par étapes créée en 1903 par Henri Desgrange et Géo Lefèvre.', null],
  ['Mona Lisa', 1100, 90000, 110, 'tableau de Léonard de Vinci', 'La Joconde est un tableau de Léonard de Vinci, réalisé entre 1503 et 1519, conservé au musée du Louvre.', 'AdQ'],
  ['Photosynthèse', 700, 60000, 120, 'processus biologique des plantes', 'La photosynthèse est le processus bioénergétique qui permet à des organismes de synthétiser de la matière organique en utilisant l’énergie lumineuse.', null],
  ['Abeille', 450, 52000, 110, 'insecte pollinisateur', 'Les abeilles forment un clade d’insectes hyménoptères, dont l’abeille domestique est l’espèce la plus connue.', null],
  ['Rome', 2700, 220000, 230, 'capitale de l’Italie', 'Rome est la capitale de l’Italie depuis 1871. Située au centre-ouest de la péninsule italienne, elle a été le centre de l’Empire romain.', 'BA'],
];

const FIRST = ['Jean', 'Marie', 'Lucien', 'Odette', 'Henri', 'Gisèle', 'Armand', 'Yvonne', 'Rémi', 'Clémence', 'Gaston', 'Solange'];
const LAST = ['Durand', 'Lefèvre', 'Moreau', 'Carpentier', 'Vasseur', 'Bonnet', 'Guérin', 'Marchal', 'Perrot', 'Lemaire'];
const JOBS = ['footballeur français', 'homme politique français', 'peintre française', 'cycliste français', 'actrice française', 'mathématicien français', 'chanteuse française'];
const PLACE = ['Saint-Aubin', 'Villeneuve', 'Montigny', 'Beaulieu', 'Fontaine', 'Rochefort', 'Brienne', 'Clairefont'];
const RIVER = ['Loire', 'Marne', 'Dordogne', 'Sarthe', 'Vienne', 'Oise', 'Charente', 'Meuse'];
const GENUS = ['Xylotrechus', 'Agrilus', 'Carabus', 'Lepturobosca', 'Bembidion', 'Philonthus', 'Stenus', 'Cryptocephalus'];
const SPECIES = ['rusticus', 'viridis', 'auratus', 'minor', 'alpinus', 'gallicus', 'obscurus', 'fasciatus'];
const ADJ = ['Les Ombres', 'Le Dernier', 'La Grande', 'Un Été', 'Le Secret', 'Les Nuits'];
const NOUN = ['de Montmartre', 'Voyage', 'Évasion', 'à Biarritz', 'du Phare', 'blanches'];
const CONCEPTS = ['Théorème de', 'Équation de', 'Effet', 'Constante de', 'Loi de'];

const KINDS = [
  (pick, year) => {
    const title = `${pick(PLACE)}-sur-${pick(RIVER)}`;
    return [title, 'commune française', `${title} est une commune française située au bord de la rivière.`, 'lieu'];
  },
  (pick, year) => {
    const title = `${pick(GENUS)} ${pick(SPECIES)}`;
    return [title, 'espèce d’insectes coléoptères', `${title} est une espèce d’insectes coléoptères décrite en ${year}.`, 'nature'];
  },
  (pick, year) => {
    const title = `${pick(FIRST)} ${pick(LAST)}`;
    const job = pick(JOBS);
    return [title, job, `${title}, né en ${year}, est un ${job}.`, 'personnalite'];
  },
  (pick, year) => {
    const title = `${pick(ADJ)} ${pick(NOUN)} (film, ${year})`;
    return [title, `film sorti en ${year}`, `${title.replace(/ \(.*\)/, '')} est un film réalisé en ${year}.`, 'culture'];
  },
  (pick) => {
    const title = `Église Saint-${pick(['Martin', 'Pierre', 'Éloi', 'Rémi'])} de ${pick(PLACE)}`;
    return [title, 'église située en France', `L’${title.slice(1)} est une église catholique.`, 'lieu'];
  },
  (pick, year) => {
    const title = `${pick(['Union sportive', 'Stade', 'Olympique', 'Racing club'])} de ${pick(PLACE)}`;
    return [title, 'club de football français', `Le club a été fondé en ${year}.`, 'sport'];
  },
  (pick, year) => {
    const title = `Bataille de ${pick(PLACE)} (${year - 300})`;
    return [title, 'bataille de la guerre de Cent Ans', `La bataille oppose deux armées en ${year - 300}.`, 'histoire'];
  },
  (pick) => {
    const title = `${pick(CONCEPTS)} ${pick(LAST)}`;
    return [title, 'théorème de mathématiques', `${title} est un résultat classique de l’analyse.`, 'sciences'];
  },
];

function buildDataset() {
  const rng = seeded(42);
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];
  const pages = FAMOUS.map(([title, views, length, langs, description, extract, quality], i) => ({
    pageid: 1000 + i,
    title,
    views,
    length,
    langs,
    description,
    extract,
    quality,
    hasImage: true,
    famous: true,
  }));
  const seen = new Set(pages.map((p) => p.title));
  for (let i = 0; pages.length < 900 && i < 8000; i++) {
    const year = 1900 + Math.floor(rng() * 120);
    const [title, description, extract] = KINDS[Math.floor(rng() * KINDS.length)](pick, year);
    if (seen.has(title)) continue;
    seen.add(title);
    // Vues quotidiennes : loi log-normale, médiane ~1,6 par jour (≈ 50 par mois) comme un article pris au hasard.
    const u1 = Math.max(rng(), 1e-9);
    const gauss = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * rng());
    pages.push({
      pageid: 200000 + i,
      title,
      views: Math.max(0, Math.exp(0.47 + 1.75 * gauss)),
      length: Math.round(800 + rng() * rng() * 30000),
      langs: Math.floor(rng() * rng() * 12),
      description,
      extract,
      quality: null,
      hasImage: rng() < 0.6,
      disambiguation: rng() < 0.03,
    });
  }
  return pages;
}

function daily(views, days, rng) {
  const out = {};
  const now = Date.now();
  for (let d = days; d >= 1; d--) {
    const date = new Date(now - d * 86400000).toISOString().slice(0, 10);
    out[date] = d === 1 ? null : Math.max(0, Math.round(views * (0.6 + rng() * 0.8)));
  }
  return out;
}

export function createMockFetch({ latencyMs = 120, seed = Date.now() } = {}) {
  const pages = buildDataset();
  const byTitle = new Map(pages.map((p) => [p.title, p]));
  const byId = new Map(pages.map((p) => [p.pageid, p]));
  const obscure = pages.filter((p) => !p.famous);
  const alphabetical = [...pages].sort((a, b) => (a.title < b.title ? -1 : a.title > b.title ? 1 : 0));
  const rng = seeded(seed);

  const json = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });

  function page(p, params) {
    const out = { pageid: p.pageid, ns: 0, title: p.title, length: p.length };
    const props = String(params.get('prop') || '').split('|');
    if (props.includes('pageviews')) out.pageviews = daily(p.views, Number(params.get('pvipdays') || 30), rng);
    if (props.includes('pageprops')) {
      out.pageprops = { wikibase_item: `Q${p.pageid}` };
      if (p.disambiguation) out.pageprops.disambiguation = '';
    }
    if (props.includes('pageimages') && p.hasImage) {
      out.thumbnail = { source: `/mock-img/${p.pageid}.svg`, width: 800, height: 600 };
      out.pageimage = 'Mock.svg';
    }
    if (props.includes('description')) {
      out.description = p.description;
      out.descriptionsource = 'central';
    }
    if (props.includes('extracts')) out.extract = p.extract;
    if (props.includes('langlinkscount') && p.langs) out.langlinkscount = p.langs;
    if (props.includes('categories') && p.quality) {
      out.categories = [{ ns: 14, title: p.quality === 'AdQ' ? 'Catégorie:Article de qualité' : 'Catégorie:Bon article' }];
    }
    return out;
  }

  const fetchImpl = async function mockFetch(input) {
    await new Promise((r) => setTimeout(r, latencyMs));
    const url = new URL(String(input));
    if (url.hostname === 'wikimedia.org') {
      const m = url.pathname.match(/\/top\/[^/]+\/[^/]+\/(\d{4})\/(\d{2})\/all-days$/);
      if (!m) return json({ title: 'Not found.' }, 404);
      const articles = [
        { article: 'Wikipédia:Accueil_principal', views: 25000000, rank: 1 },
        { article: 'Spécial:Recherche', views: 9000000, rank: 2 },
        ...pages
          .filter((p) => p.famous)
          .map((p) => ({ article: p.title.replace(/ /g, '_'), views: Math.round(p.views * 30 * (0.7 + rng() * 0.6)) })),
      ];
      return json({ items: [{ project: 'fr.wikipedia', access: 'all-access', year: m[1], month: m[2], day: 'all-days', articles }] });
    }
    const params = url.searchParams;
    if (params.get('meta') === 'siteinfo') return json({ batchcomplete: true, query: { statistics: { articles: pages.length } } });
    // Parcours alphabétique : comme la vraie API, les vues arrivent en deux réponses au-delà de 25 pages.
    if (params.get('generator') === 'allpages') {
      const from = params.get('gapcontinue') ?? '';
      const n = Math.min(Number(params.get('gaplimit') || 10), 500);
      const start = alphabetical.findIndex((p) => p.title >= from);
      const slice = start < 0 ? [] : alphabetical.slice(start, start + n);
      const after = start < 0 ? null : alphabetical[start + n];
      const split = slice.length > 25;
      const nextBatch = after ? { gapcontinue: after.title, continue: 'gapcontinue||' } : null;
      if (split && !params.has('pvipcontinue')) {
        const out = slice.map((p, i) => {
          const full = page(p, params);
          if (i >= 25) delete full.pageviews;
          return full;
        });
        return json({ continue: { pvipcontinue: '25', gapcontinue: from, continue: 'gapcontinue||' }, query: { pages: out } });
      }
      if (split) {
        const out = slice.map((p, i) => (i >= 25 ? { pageid: p.pageid, ns: 0, title: p.title, pageviews: daily(p.views, 30, rng) } : { pageid: p.pageid, ns: 0, title: p.title }));
        return json({ batchcomplete: true, ...(nextBatch ? { continue: nextBatch } : {}), query: { pages: out } });
      }
      return json({ batchcomplete: true, ...(nextBatch ? { continue: nextBatch } : {}), query: { pages: slice.map((p) => page(p, params)) } });
    }
    let selected = [];
    if (params.get('generator') === 'random') {
      const n = Math.min(Number(params.get('grnlimit') || 1), 500);
      for (let i = 0; i < n; i++) selected.push(obscure[Math.floor(rng() * obscure.length)]);
      selected = [...new Set(selected)];
    } else if (params.has('titles')) {
      selected = params
        .get('titles')
        .split('|')
        .map((t) => byTitle.get(t.replace(/_/g, ' ')) ?? { missing: true, title: t });
    } else if (params.has('pageids')) {
      selected = params
        .get('pageids')
        .split('|')
        .map((id) => byId.get(Number(id)) ?? { missing: true, pageid: Number(id) });
    }
    const out = selected.map((p) => (p.missing ? { ns: 0, title: p.title, missing: true } : page(p, params)));
    return json({ batchcomplete: true, query: { pages: out } });
  };
  fetchImpl.image = (name) => mockImage(name, byId);
  return fetchImpl;
}

// ---------- Illustrations dessinées pour le mode hors ligne ----------
const PALETTES = [
  ['#1b3a5c', '#3f7cac', '#f3c969'],
  ['#2d1e4f', '#7b4fa8', '#ffb36b'],
  ['#0f3d3a', '#2f8f83', '#f6e7b4'],
  ['#4a1c1c', '#c0573e', '#ffd9a0'],
  ['#1f2a44', '#e06c75', '#ffe3c2'],
  ['#163020', '#4f9d69', '#e8f5c8'],
];

function motif(type, c, r) {
  switch (type) {
    case 'personnalite':
      return `<circle cx="400" cy="250" r="${90 + r * 20}" fill="${c[2]}" opacity=".95"/><path d="M190 600 C220 410 580 410 610 600 Z" fill="${c[2]}" opacity=".9"/>`;
    case 'nature':
      return `<path d="M400 120 C560 200 580 420 400 520 C220 420 240 200 400 120 Z" fill="${c[2]}" opacity=".9"/><path d="M400 150 L400 510" stroke="${c[0]}" stroke-width="10"/>`;
    case 'culture':
      return `<rect x="170" y="170" width="460" height="260" rx="18" fill="${c[2]}" opacity=".92"/><path d="M360 240 L470 300 L360 360 Z" fill="${c[0]}"/>`;
    case 'sport':
      return `<circle cx="400" cy="300" r="170" fill="${c[2]}"/><path d="M400 180 L470 240 L445 330 L355 330 L330 240 Z" fill="${c[0]}"/>`;
    case 'histoire':
      return `<path d="M210 520 L210 270 L260 270 L260 230 L300 230 L300 270 L360 270 L360 200 L440 200 L440 270 L500 270 L500 230 L540 230 L540 270 L590 270 L590 520 Z" fill="${c[2]}" opacity=".92"/>`;
    case 'sciences':
      return `<g fill="none" stroke="${c[2]}" stroke-width="14"><ellipse cx="400" cy="300" rx="210" ry="80"/><ellipse cx="400" cy="300" rx="210" ry="80" transform="rotate(60 400 300)"/><ellipse cx="400" cy="300" rx="210" ry="80" transform="rotate(-60 400 300)"/></g><circle cx="400" cy="300" r="34" fill="${c[2]}"/>`;
    case 'lieu':
      return `<circle cx="590" cy="170" r="70" fill="${c[2]}"/><path d="M0 470 L170 300 L320 430 L470 280 L800 500 L800 600 L0 600 Z" fill="${c[0]}" opacity=".85"/>`;
    default:
      return `<rect x="240" y="170" width="320" height="260" rx="12" fill="${c[2]}"/><path d="M400 170 L400 430" stroke="${c[0]}" stroke-width="10"/>`;
  }
}

function mockImage(name, byId) {
  const id = Number(String(name).replace(/\.svg$/, ''));
  const p = byId.get(id);
  return drawArt(id, p ? classifyType(p.description, p.title) : 'savoir');
}

// Illustration simple et déterministe : un motif selon la famille sur un dégradé.
export function drawArt(id, type) {
  const rng = seeded(id || 7);
  const c = PALETTES[Math.floor(rng() * PALETTES.length)];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c[1]}"/><stop offset="1" stop-color="${c[0]}"/></linearGradient>
  <radialGradient id="l" cx=".3" cy=".25" r=".8"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>
  <rect width="800" height="600" fill="url(#g)"/><rect width="800" height="600" fill="url(#l)"/>
  ${motif(type, c, rng())}
</svg>`;
}
