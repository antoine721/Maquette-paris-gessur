// Client minimal pour l'API de Wikipédia et les statistiques de Wikimedia.
import { classifyType, cleanImage, rarityFromViews, views30From } from './cards.js';

const THUMB = 800;
const QUALITY = { 'Catégorie:Article de qualité': 'AdQ', 'Catégorie:Bon article': 'BA' };

// Mesure d'un lot d'articles : popularité, image, description. Pas encore le texte.
const MEASURE = {
  prop: 'info|pageviews|pageprops|pageimages|description',
  ppprop: 'disambiguation|wikibase_item',
  pvipdays: '30',
  piprop: 'thumbnail',
  pithumbsize: String(THUMB),
  pilimit: '50',
  pilicense: 'any',
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
      throw err;
    }
    return res.json();
  }

  function query(params) {
    const url = new URL(apiUrl);
    const all = { action: 'query', format: 'json', formatversion: '2', ...params };
    for (const [k, v] of Object.entries(all)) url.searchParams.set(k, String(v));
    return getJson(url);
  }

  // Seuls les vrais articles illustrés deviennent des cartes.
  function parseMeasured(data) {
    const pages = data?.query?.pages ?? [];
    const out = [];
    for (const p of pages) {
      if (p.missing || p.invalid || p.ns !== 0) continue;
      if (p.pageprops && 'disambiguation' in p.pageprops) continue;
      const image = cleanImage(p.thumbnail?.source);
      if (!image) continue;
      const { views30, daily } = views30From(p.pageviews);
      const description = p.description ?? '';
      out.push({
        pageId: p.pageid,
        title: p.title,
        length: p.length ?? 0,
        views30,
        daily,
        rarity: rarityFromViews(views30),
        description,
        type: classifyType(description, p.title),
        image,
        imageWidth: p.thumbnail?.width ?? null,
        imageHeight: p.thumbnail?.height ?? null,
        wikidata: p.pageprops?.wikibase_item ?? null,
      });
    }
    return out;
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
      prop: 'extracts|langlinkscount|categories',
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
      result.set(p.pageid, {
        extract: p.extract ?? '',
        langs: langsKnown ? (p.langlinkscount ?? 0) : null,
        quality: cat,
      });
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

  return { randomMeasured, measureTitles, details, topMonth, lang };
}
