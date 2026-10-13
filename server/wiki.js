// Client minimal pour l'API de Wikipédia et les statistiques de Wikimedia.
import { averageViews, rarityFromViews } from './cards.js';

const MEASURE = {
  prop: 'info|pageviews|pageprops',
  ppprop: 'disambiguation',
  pvipdays: '30',
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

  // Popularité et longueur, sans le texte : sert à trier les candidats par rareté.
  function parseMeasured(data) {
    const pages = data?.query?.pages ?? [];
    return pages
      .filter((p) => !p.missing && !p.invalid && p.ns === 0 && !(p.pageprops && 'disambiguation' in p.pageprops))
      .map((p) => {
        const views = averageViews(p.pageviews);
        return { pageId: p.pageid, title: p.title, length: p.length ?? 0, views, rarity: rarityFromViews(views) };
      });
  }

  async function randomMeasured(limit = 40) {
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

  // Texte, image, description et nombre de langues des articles retenus.
  async function details(pageIds) {
    const result = new Map();
    if (!pageIds.length) return result;
    const data = await query({
      pageids: pageIds.join('|'),
      prop: 'extracts|pageimages|description|langlinkscount|info',
      exintro: '1',
      explaintext: '1',
      exsentences: '3',
      exlimit: '20',
      piprop: 'thumbnail',
      pithumbsize: '640',
      pilimit: '20',
      pilicense: 'any',
    });
    const langsKnown = !JSON.stringify(data?.warnings ?? '').includes('langlinkscount');
    for (const p of data?.query?.pages ?? []) {
      if (p.missing || p.invalid) continue;
      result.set(p.pageid, {
        pageId: p.pageid,
        title: p.title,
        length: p.length ?? 0,
        description: p.description ?? '',
        extract: p.extract ?? '',
        image: p.thumbnail?.source ?? null,
        langs: langsKnown ? (p.langlinkscount ?? 0) : null,
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
