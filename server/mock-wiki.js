// Faux Wikipédia pour jouer et tester hors ligne (WIKI_MOCK=1).
// Il répond avec le même format JSON que les vraies API, pour exercer tout le code.

const FAMOUS = [
  ['Paris', 9800, 412000, 260, 'capitale de la France', 'Paris est la capitale de la France. Elle se situe au cœur d’un vaste bassin sédimentaire aux sols fertiles et au climat tempéré, le Bassin parisien, sur une boucle de la Seine.'],
  ['Napoléon Ier', 7400, 389000, 190, 'empereur des Français', 'Napoléon Bonaparte, né le 15 août 1769 à Ajaccio et mort le 5 mai 1821 sur l’île de Sainte-Hélène, est un militaire et homme d’État français, premier empereur des Français.'],
  ['Chat', 2300, 142000, 230, 'mammifère carnivore de la famille des félidés', 'Le chat domestique est la sous-espèce issue de la domestication du chat sauvage, mammifère carnivore de la famille des Félidés.'],
  ['Pyramide de Khéops', 2100, 98000, 110, 'monument de l’Égypte antique', 'La pyramide de Khéops, ou grande pyramide de Gizeh, est un monument construit par les Égyptiens de l’Antiquité, formant une pyramide à base carrée.'],
  ['Ada Lovelace', 1450, 61000, 120, 'mathématicienne britannique', 'Ada Lovelace, de son nom complet Augusta Ada King, comtesse de Lovelace, est une pionnière de la science informatique, connue pour avoir écrit le premier programme informatique.'],
  ['Origami', 380, 38000, 90, 'art du pliage du papier', 'L’origami est l’art du pliage du papier. Il est originaire de Chine et du Japon.'],
  ['Victor Hugo', 3900, 301000, 170, 'écrivain, poète et homme politique français', 'Victor Hugo est un poète, dramaturge, écrivain, romancier et dessinateur romantique français, né le 26 février 1802 à Besançon et mort le 22 mai 1885 à Paris.'],
  ['Tour Eiffel', 4200, 156000, 180, 'tour de fer puddlé de 330 mètres à Paris', 'La tour Eiffel est une tour de fer puddlé de 330 mètres de hauteur située à Paris, à l’extrémité nord-ouest du parc du Champ-de-Mars en bordure de la Seine.'],
  ['Marie Curie', 2600, 120000, 200, 'physicienne et chimiste', 'Marie Curie est une physicienne et chimiste polonaise, naturalisée française. Elle est la première femme à avoir reçu le prix Nobel et la seule à en avoir reçu deux dans deux domaines différents.'],
  ['Trou noir', 1200, 175000, 95, 'objet céleste si compact que la lumière ne peut s’en échapper', 'En astrophysique, un trou noir est un objet céleste si compact que l’intensité de son champ gravitationnel empêche toute forme de matière ou de rayonnement de s’en échapper.'],
  ['Baguette', 640, 29000, 60, 'pain de forme allongée', 'La baguette est une variété de pain, reconnaissable à sa forme allongée. Elle est inscrite au patrimoine culturel immatériel de l’humanité depuis 2022.'],
  ['Mont Blanc', 1100, 64000, 85, 'point culminant de la chaîne des Alpes', 'Le mont Blanc est le point culminant de la chaîne des Alpes. Avec une altitude de 4 805,59 mètres, il est le plus haut sommet d’Europe occidentale.'],
  ['Pokémon', 3100, 133000, 120, 'franchise de médias japonaise', 'Pokémon est une franchise de médias appartenant à la société The Pokémon Company, créée en 1996 par Satoshi Tajiri.'],
  ['Léonard de Vinci', 3300, 158000, 210, 'peintre et inventeur italien', 'Léonard de Vinci est un peintre italien et un homme d’esprit universel, à la fois artiste, organisateur de spectacles et de fêtes, scientifique, ingénieur, inventeur, anatomiste.'],
  ['Wikipédia', 900, 182000, 300, 'encyclopédie universelle en ligne', 'Wikipédia est une encyclopédie universelle et multilingue créée par Jimmy Wales et Larry Sanger le 15 janvier 2001. Il s’agit d’une œuvre libre, gérée en wiki.'],
  ['Croissant (viennoiserie)', 520, 22000, 55, 'viennoiserie en forme de croissant', 'Le croissant est une viennoiserie à base de pâte levée feuilletée, spécifique, composée de farine, d’eau, de sel, de levure, de sucre et de beurre.'],
  ['Système solaire', 1700, 210000, 180, 'système planétaire du Soleil', 'Le Système solaire est le système planétaire composé du Soleil et des objets célestes gravitant autour de lui.'],
  ['Kylian Mbappé', 6200, 140000, 140, 'footballeur international français', 'Kylian Mbappé Lottin, né le 20 décembre 1998 à Paris, est un footballeur international français qui évolue au poste d’attaquant.'],
  ['Révolution française', 2900, 260000, 150, 'période de bouleversements politiques et sociaux en France', 'La Révolution française est une période de bouleversements politiques et sociaux en France, dans ses colonies et en Europe à la fin du XVIIIe siècle.'],
  ['Escargot', 260, 19000, 70, 'nom vernaculaire de mollusques gastéropodes', 'Escargot est un nom vernaculaire qui désigne en français des mollusques gastéropodes à coquille, généralement terrestres.'],
  ['Lune', 1900, 190000, 220, 'unique satellite naturel de la Terre', 'La Lune est l’unique satellite naturel permanent de la planète Terre. Il s’agit du cinquième plus grand satellite naturel du Système solaire.'],
  ['Château de Versailles', 2200, 150000, 110, 'château et monument historique français', 'Le château de Versailles est un château et un monument historique français qui se situe à Versailles, dans les Yvelines.'],
  ['Pierre-feuille-ciseaux', 140, 21000, 80, 'jeu de mains', 'Pierre-feuille-ciseaux est un jeu effectué avec les mains et opposant deux joueurs.'],
  ['Albert Einstein', 3500, 170000, 240, 'physicien théoricien', 'Albert Einstein est un physicien théoricien qui fut successivement allemand, apatride, suisse, et de double nationalité helvético-américaine.'],
];

const FIRST = ['Jean', 'Marie', 'Lucien', 'Odette', 'Henri', 'Gisèle', 'Armand', 'Yvonne', 'Rémi', 'Clémence', 'Gaston', 'Solange'];
const LAST = ['Durand', 'Lefèvre', 'Moreau', 'Carpentier', 'Vasseur', 'Bonnet', 'Guérin', 'Marchal', 'Perrot', 'Lemaire'];
const PLACE = ['Saint-Aubin', 'Villeneuve', 'Montigny', 'Beaulieu', 'Fontaine', 'Rochefort', 'Brienne', 'Clairefont'];
const RIVER = ['Loire', 'Marne', 'Dordogne', 'Sarthe', 'Vienne', 'Oise', 'Charente', 'Meuse'];
const GENUS = ['Xylotrechus', 'Agrilus', 'Carabus', 'Lepturobosca', 'Bembidion', 'Philonthus', 'Stenus', 'Cryptocephalus'];
const SPECIES = ['rusticus', 'viridis', 'auratus', 'minor', 'alpinus', 'gallicus', 'obscurus', 'fasciatus'];
const ADJ = ['Les Ombres', 'Le Dernier', 'La Grande', 'Un Été', 'Le Secret', 'Les Nuits'];
const NOUN = ['de Montmartre', 'Voyage', 'Évasion', 'à Biarritz', 'du Phare', 'blanches'];

function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildDataset() {
  const rng = makeRng(42);
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];
  const pages = [];
  FAMOUS.forEach(([title, views, length, langs, description, extract], i) => {
    pages.push({
      pageid: 1000 + i,
      title,
      views,
      length,
      langs,
      description,
      extract,
      image: i % 3 === 2 ? null : `https://upload.wikimedia.org/mock/${encodeURIComponent(title)}.svg`,
      famous: true,
    });
  });
  const seen = new Set(pages.map((p) => p.title));
  for (let i = 0; pages.length < 700 && i < 5000; i++) {
    const kind = Math.floor(rng() * 5);
    const year = 1900 + Math.floor(rng() * 120);
    let title;
    let description;
    let extract;
    if (kind === 0) {
      title = `${pick(PLACE)}-sur-${pick(RIVER)}`;
      description = 'commune française';
      extract = `${title} est une commune française. Ses habitants sont appelés les ${pick(['Aubinois', 'Riverains', 'Montignais'])}.`;
    } else if (kind === 1) {
      title = `${pick(GENUS)} ${pick(SPECIES)}`;
      description = 'espèce d’insectes';
      extract = `${title} est une espèce d’insectes coléoptères décrite en ${year}.`;
    } else if (kind === 2) {
      title = `${pick(FIRST)} ${pick(LAST)}`;
      description = pick(['footballeur français', 'homme politique français', 'peintre française', 'cycliste français']);
      extract = `${title}, né en ${year}, est un ${description}.`;
    } else if (kind === 3) {
      title = `${pick(ADJ)} ${pick(NOUN)} (film, ${year})`;
      description = `film sorti en ${year}`;
      extract = `${title.replace(/ \(.*\)/, '')} est un film réalisé en ${year}.`;
    } else {
      title = `Église Saint-${pick(['Martin', 'Pierre', 'Éloi', 'Rémi'])} de ${pick(PLACE)}`;
      description = 'église située en France';
      extract = `L’${title.slice(1)} est une église catholique.`;
    }
    if (seen.has(title)) continue;
    seen.add(title);
    // Vues quotidiennes : loi log-normale (médiane ~3/jour), comme les articles pris au hasard.
    const u1 = Math.max(rng(), 1e-9);
    const gauss = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * rng());
    const views = Math.max(0, Math.round(Math.exp(1.1 + 1.7 * gauss) * 10) / 10);
    pages.push({
      pageid: 200000 + i,
      title,
      views,
      length: Math.round(800 + rng() * rng() * 30000),
      langs: Math.floor(rng() * rng() * 12),
      description,
      extract,
      image: rng() < 0.25 ? `https://upload.wikimedia.org/mock/${encodeURIComponent(title)}.svg` : null,
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
  const rng = makeRng(seed);

  const json = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });

  function measured(p, params) {
    const out = { pageid: p.pageid, ns: 0, title: p.title, length: p.length };
    const props = String(params.get('prop') || '').split('|');
    if (props.includes('pageviews')) out.pageviews = daily(p.views, Number(params.get('pvipdays') || 30), rng);
    if (props.includes('pageprops') && p.disambiguation) out.pageprops = { disambiguation: '' };
    if (props.includes('extracts')) out.extract = p.extract;
    if (props.includes('description')) {
      out.description = p.description;
      out.descriptionsource = 'central';
    }
    if (props.includes('pageimages') && p.image) {
      out.thumbnail = { source: p.image, width: 640, height: 480 };
      out.pageimage = 'Mock.svg';
    }
    if (props.includes('langlinkscount') && p.langs) out.langlinkscount = p.langs;
    return out;
  }

  return async function mockFetch(input) {
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
    const out = selected.map((p) => (p.missing ? { ns: 0, title: p.title, missing: true } : measured(p, params)));
    return json({ batchcomplete: true, query: { pages: out } });
  };
}
