// Client minimal pour l'API de Wikipédia et les statistiques de Wikimedia.
import { classifyType, cleanDescription, cleanImage, rarityFromViews, views30From } from './cards.js';

const THUMB = 800;
const QUALITY = { 'Catégorie:Article de qualité': 'AdQ', 'Catégorie:Bon article': 'BA' };

// Mesure d'un lot d'articles : popularité, image, description. Pas encore le texte.
export const MEASURE = {
  prop: 'info|pageviews|pageprops|pageimages|description',
  ppprop: 'disambiguation|wikibase_item',
  pvipdays: '30',
  piprop: 'thumbnail',
  pithumbsize: String(THUMB),
  pilimit: '50',
  pilicense: 'any',
};

// Indexation de tout Wikipédia : la même mesure, plus les langues et le label de qualité.
const INDEX = {
  ...MEASURE,
  prop: `${MEASURE.prop}|langlinkscount|categories`,
  clcategories: Object.keys(QUALITY).join('|'),
  cllimit: 'max',
};

export function createWiki({ lang = 'fr', fetchImpl = globalThis.fetch, userAgent, timeoutMs = 12000 } = {}) {
  const apiUrl = `https://${lang}.wikipedia.org/w/api.php`;
  const project = `${lang}.wikipedia.org`;

  async function getJson(url) {
    const res = await fetchImpl(String(url), {
      headers: { 'User-Agent': userAgent, 'Api-User-Agent': userAgent, Accept: 'application/json' },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      const err = new Error(`Wikipédia a répondu ${res.status}`);
      err.status = res.status;
      err.retryAfter = Number(res.headers?.get?.('retry-after')) || null;
      throw err;
    }
    return res.json();
  }

  // maxlag : Wikipédia nous demande de patienter quand ses serveurs sont chargés.
  async function query(params, { maxlag = false } = {}) {
    const url = new URL(apiUrl);
    const all = { action: 'query', format: 'json', formatversion: '2', ...(maxlag ? { maxlag: '5' } : {}), ...params };
    for (const [k, v] of Object.entries(all)) url.searchParams.set(k, String(v));
    const data = await getJson(url);
    if (data?.error) {
      const err = new Error(`Wikipédia : ${data.error.info ?? data.error.code}`);
      err.code = data.error.code;
      err.retryAfter = data.error.code === 'maxlag' ? 5 : null;
      throw err;
    }
    return data;
  }

  function toArticle(p, langsKnown) {
    if (p.missing || p.invalid || p.ns !== 0) return null;
    if (p.pageprops && 'disambiguation' in p.pageprops) return null;
    const { views30, daily } = views30From(p.pageviews);
    const description = cleanDescription(p.description ?? '');
    return {
      pageId: p.pageid,
      title: p.title,
      length: p.length ?? 0,
      views30,
      daily,
      rarity: rarityFromViews(views30),
      description,
      type: classifyType(description, p.title),
      image: cleanImage(p.thumbnail?.source),
      imageWidth: p.thumbnail?.width ?? null,
      imageHeight: p.thumbnail?.height ?? null,
      wikidata: p.pageprops?.wikibase_item ?? null,
      langs: langsKnown ? (p.langlinkscount ?? 0) : null,
      quality: (p.categories ?? []).map((c) => QUALITY[c.title]).find(Boolean) ?? null,
    };
  }

  // Seuls les vrais articles illustrés deviennent des cartes.
  function parseMeasured(data) {
    return (data?.query?.pages ?? []).map((p) => toArticle(p, false)).filter((a) => a && a.image);
  }

  // Un lot de 50 articles dans l'ordre alphabétique, avec toutes leurs propriétés.
  // L'API peut répartir les propriétés sur plusieurs réponses : on fusionne jusqu'à batchcomplete.
  async function allPagesBatch(cont = null, limit = 50) {
    const base = { generator: 'allpages', gapnamespace: '0', gapfilterredir: 'nonredirects', gaplimit: String(limit), ...INDEX };
    const pages = new Map();
    let langsKnown = true;
    let next = cont ?? { continue: '' };
    for (let round = 0; round < 25; round++) {
      const data = await query({ ...base, ...next }, { maxlag: true });
      if (JSON.stringify(data?.warnings ?? '').includes('langlinkscount')) langsKnown = false;
      for (const p of data?.query?.pages ?? []) {
        const key = p.pageid ?? p.title;
        const prev = pages.get(key);
        pages.set(key, prev ? mergePage(prev, p) : p);
      }
      if (data.batchcomplete || !data.continue) {
        const articles = [...pages.values()].map((p) => toArticle(p, langsKnown)).filter(Boolean);
        return { articles, scanned: pages.size, next: data.continue ?? null };
      }
      next = data.continue;
    }
    throw new Error('Continuation de l’API sans fin');
  }

  // Nombre d'articles annoncé par Wikipédia, pour afficher la progression.
  async function articleCount() {
    const data = await query({ meta: 'siteinfo', siprop: 'statistics' });
    return data?.query?.statistics?.articles ?? null;
  }

  async function randomMeasured(limit = 50) {
    const data = await query({
      generator: 'random',
      grnnamespace: '0',
      grnfilterredir: 'nonredirects',
      grnlimit: String(limit),
      ...MEASURE,
    });
    return parseMeasured(data);
  }

  async function measureTitles(titles) {
    if (!titles.length) return [];
    const data = await query({ titles: titles.slice(0, 50).join('|'), redirects: '1', ...MEASURE });
    return parseMeasured(data);
  }

  // Texte d'introduction, nombre de langues et label de qualité des articles retenus.
  async function details(pageIds) {
    const result = new Map();
    if (!pageIds.length) return result;
    const data = await query({
      pageids: pageIds.join('|'),
      prop: 'extracts|langlinkscount|categories|pageviews',
      pvipdays: '30',
      exintro: '1',
      explaintext: '1',
      exsentences: '4',
      exlimit: '20',
      clcategories: Object.keys(QUALITY).join('|'),
      cllimit: 'max',
    });
    const langsKnown = !JSON.stringify(data?.warnings ?? '').includes('langlinkscount');
    for (const p of data?.query?.pages ?? []) {
      if (p.missing || p.invalid) continue;
      const cat = (p.categories ?? []).map((c) => QUALITY[c.title]).find(Boolean) ?? null;
      const entry = { extract: p.extract ?? '', langs: langsKnown ? (p.langlinkscount ?? 0) : null, quality: cat };
      if (p.pageviews) entry.daily = views30From(p.pageviews).daily;
      result.set(p.pageid, entry);
    }
    return result;
  }

  // Les 1000 articles les plus lus d'un mois donné.
  async function topMonth(year, month) {
    const mm = String(month).padStart(2, '0');
    const data = await getJson(
      `https://wikimedia.org/api/rest_v1/metrics/pageviews/top/${project}/all-access/${year}/${mm}/all-days`,
    );
    return (data?.items?.[0]?.articles ?? []).map((a) => ({ title: a.article, views: a.views }));
  }

  return { randomMeasured, measureTitles, details, topMonth, allPagesBatch, articleCount, lang };
}

// Fusion de deux morceaux d'une même page renvoyés par des continuations successives.
function mergePage(a, b) {
  const out = { ...a, ...b };
  if (a.pageviews || b.pageviews) out.pageviews = { ...(a.pageviews ?? {}), ...(b.pageviews ?? {}) };
  if (a.categories || b.categories) out.categories = [...(a.categories ?? []), ...(b.categories ?? [])];
  if (a.pageprops || b.pageprops) out.pageprops = { ...(a.pageprops ?? {}), ...(b.pageprops ?? {}) };
  return out;
}
