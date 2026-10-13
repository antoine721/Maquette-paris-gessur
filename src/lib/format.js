// Formats français : espace fine pour les milliers, dates longues, temps relatif.
const nf = new Intl.NumberFormat('fr-FR');
export const fmt = (n) => nf.format(Math.round(n ?? 0));

export function fmtCompact(n) {
  if (n >= 1e6) return `${(n / 1e6).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} M`;
  if (n >= 1e4) return `${Math.round(n / 1e3).toLocaleString('fr-FR')} k`;
  return fmt(n);
}

export function fmtBytes(n) {
  if (n >= 1000) return `${fmt(n / 1000)} ko`;
  return `${fmt(n)} o`;
}

const rtf = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' });
export function ago(ts) {
  const s = Math.round((ts - Date.now()) / 1000);
  const abs = Math.abs(s);
  if (abs < 45) return 'à l’instant';
  if (abs < 3600) return rtf.format(Math.round(s / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(s / 3600), 'hour');
  if (abs < 86400 * 30) return rtf.format(Math.round(s / 86400), 'day');
  return fmtDate(ts);
}

export const fmtDate = (ts) => new Date(ts).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
export const fmtPct = (p) => `${(p * 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} %`;

export const wikiUrl = (lang, pageId) => `https://${lang}.wikipedia.org/?curid=${encodeURIComponent(pageId)}`;

export function hueOf(text) {
  let h = 0;
  for (const ch of String(text)) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return h % 360;
}
