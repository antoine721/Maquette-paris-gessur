// Petits outils d'interface partagés.
import { icon } from './icons.js';

export const RARITY = [
  { key: 'commune', label: 'Commune', color: 'var(--r0)', hex: '#a7b0c2' },
  { key: 'peu-commune', label: 'Peu commune', color: 'var(--r1)', hex: '#49d69b' },
  { key: 'rare', label: 'Rare', color: 'var(--r2)', hex: '#4fa3ff' },
  { key: 'epique', label: 'Épique', color: 'var(--r3)', hex: '#b57bff' },
  { key: 'legendaire', label: 'Légendaire', color: 'var(--r4)', hex: '#ffc53d' },
];

export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

export function html(strings, ...values) {
  return strings.reduce((out, s, i) => out + s + (i < values.length ? values[i] : ''), '');
}

export function el(markup) {
  const t = document.createElement('template');
  t.innerHTML = markup.trim();
  return t.content.firstElementChild;
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const wait = (ms) => new Promise((r) => setTimeout(r, ms));
export const nextFrame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

export function hueOf(text) {
  let h = 0;
  for (const ch of String(text)) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return h % 360;
}

export function avatar(name, { online = false, size = '' } = {}) {
  const initial = [...String(name)][0] ?? '?';
  return `<span class="avatar ${size}" style="--h:${hueOf(name)}" aria-hidden="true">${esc(initial)}${online ? '<i class="online-dot"></i>' : ''}</span>`;
}

const nf = new Intl.NumberFormat('fr-FR');
export const fmt = (n) => nf.format(Math.round(n ?? 0));

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
  return new Date(ts).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export const fmtDate = (ts) => new Date(ts).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

export const wikiUrl = (lang, pageId) => `https://${lang}.wikipedia.org/?curid=${encodeURIComponent(pageId)}`;

// ---------- Toasts ----------
export function toast(message, { type = '', color = '', iconName = 'sparkles', duration = 5000 } = {}) {
  const root = document.getElementById('toasts');
  const t = el(`<div class="toast ${type}"><span class="t-icon">${icon(type === 'error' ? 'alert' : iconName)}</span><div>${message}</div></div>`);
  if (color) t.style.setProperty('--c', color);
  root.append(t);
  while (root.children.length > 4) root.firstElementChild.remove();
  setTimeout(() => {
    t.classList.add('out');
    t.addEventListener('animationend', () => t.remove(), { once: true });
  }, duration);
}

export const toastError = (err) => toast(esc(err?.message ?? String(err)), { type: 'error' });

// ---------- Modale ----------
let closeCurrent = null;
export function openModal(content, { onClose } = {}) {
  closeCurrent?.();
  const root = document.getElementById('modal-root');
  const modal = el(`<div class="modal" role="dialog" aria-modal="true"></div>`);
  modal.append(content);
  root.append(modal);
  const previous = document.activeElement;
  const close = () => {
    if (closeCurrent !== close) return;
    closeCurrent = null;
    document.removeEventListener('keydown', onKey);
    modal.classList.add('out');
    modal.addEventListener('animationend', () => modal.remove(), { once: true });
    setTimeout(() => modal.remove(), 400);
    onClose?.();
    previous?.focus?.({ preventScroll: true });
  };
  const onKey = (e) => {
    if (e.key === 'Escape') close();
  };
  modal.addEventListener('click', (e) => {
    if (e.target === modal) close();
  });
  document.addEventListener('keydown', onKey);
  closeCurrent = close;
  requestAnimationFrame(() => modal.querySelector('[data-autofocus], button, a, select')?.focus({ preventScroll: true }));
  return close;
}
export const modalOpen = () => Boolean(closeCurrent);
export const closeModal = () => closeCurrent?.();
