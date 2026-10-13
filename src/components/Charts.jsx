// Petits graphiques SVG : vues quotidiennes d'un article et répartition des raretés.
// Règles : trait de 2 px, voile à 10 %, grille discrète, réticule au survol et au clavier,
// textes en couleurs de texte (jamais la couleur de la série), tableau pour les lecteurs d'écran.
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { fmt, fmtCompact, fmtPct } from '../lib/format.js';
import { Pips, RARITY } from '../lib/visuals.jsx';

const H = 170;
const PAD = { top: 14, right: 12, bottom: 24, left: 40 };

function dayLabel(offsetFromEnd) {
  const d = new Date(Date.now() - (offsetFromEnd + 1) * 86400000);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function niceMax(v) {
  if (v <= 5) return 5;
  const p = 10 ** Math.floor(Math.log10(v));
  return Math.ceil(v / p) * p;
}

export function ViewsChart({ daily, color }) {
  const id = useId();
  const [hover, setHover] = useState(null);
  // Le dessin prend la largeur réelle : les textes gardent leur taille, même sur mobile.
  const box = useRef(null);
  const [W, setW] = useState(560);
  useEffect(() => {
    const el = box.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([entry]) => setW(Math.max(260, Math.round(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const points = useMemo(() => (daily ?? []).map((v, i) => ({ i, v })), [daily]);
  if (points.length < 2) return <p ref={box} className="text-[13px] text-faint">Pas encore assez de données de fréquentation.</p>;

  const values = points.map((p) => p.v).filter((v) => v != null);
  const max = niceMax(Math.max(...values, 1));
  const n = points.length;
  const iw = W - PAD.left - PAD.right;
  const ih = H - PAD.top - PAD.bottom;
  const x = (i) => PAD.left + (i / (n - 1)) * iw;
  const y = (v) => PAD.top + ih - (v / max) * ih;
  const known = points.filter((p) => p.v != null);
  const line = known.map((p, k) => `${k ? 'L' : 'M'}${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
  const area = `${line} L${x(known.at(-1).i).toFixed(1)},${PAD.top + ih} L${x(known[0].i).toFixed(1)},${PAD.top + ih} Z`;
  const ticks = [0, max / 2, max];
  const label = (i) => dayLabel(n - 1 - i);
  const h = hover != null ? points[hover] : null;

  const pick = (clientX, rect) => {
    const rel = ((clientX - rect.left) / rect.width) * W;
    const i = Math.round(((rel - PAD.left) / iw) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  };

  return (
    <figure ref={box} className="relative m-0">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full touch-pan-y overflow-visible outline-none focus-visible:rounded-xl focus-visible:ring-2 focus-visible:ring-gold/60"
        role="img"
        aria-label="Vues quotidiennes de l’article sur 30 jours"
        tabIndex={0}
        onPointerMove={(e) => pick(e.clientX, e.currentTarget.getBoundingClientRect())}
        onPointerLeave={() => setHover(null)}
        onFocus={() => setHover((v) => v ?? n - 1)}
        onBlur={() => setHover(null)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') setHover((v) => Math.max(0, (v ?? n - 1) - 1));
          if (e.key === 'ArrowRight') setHover((v) => Math.min(n - 1, (v ?? n - 1) + 1));
        }}
      >
        <defs>
          <linearGradient id={`${id}-wash`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity="0.18" />
            <stop offset="1" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="rgb(255 255 255 / .07)" strokeWidth="1" />
            <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end" className="fill-faint text-[11px] tnum">
              {fmtCompact(t)}
            </text>
          </g>
        ))}
        <path d={area} fill={`url(#${id}-wash)`} />
        <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        <text x={PAD.left} y={H - 6} className="fill-faint text-[11px]">
          {label(0)}
        </text>
        <text x={W - PAD.right} y={H - 6} textAnchor="end" className="fill-faint text-[11px]">
          {label(n - 1)}
        </text>
        {h ? (
          <g pointerEvents="none">
            <line x1={x(h.i)} x2={x(h.i)} y1={PAD.top} y2={PAD.top + ih} stroke="rgb(255 255 255 / .35)" strokeWidth="1" />
            {h.v != null ? <circle cx={x(h.i)} cy={y(h.v)} r="5" fill={color} stroke="#11142a" strokeWidth="2" /> : null}
          </g>
        ) : null}
      </svg>
      {h ? (
        <div
          className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-xl border border-line-2 bg-[#171a33] px-2.5 py-1.5 text-center shadow-pop"
          style={{ left: `${(x(h.i) / W) * 100}%` }}
        >
          <b className="tnum block text-[14px] text-text">{h.v == null ? 'pas de donnée' : `${fmt(h.v)} vues`}</b>
          <span className="block text-[11.5px] text-muted">{label(h.i)}</span>
        </div>
      ) : null}
      <table className="sr-only">
        <caption>Vues quotidiennes sur 30 jours</caption>
        <tbody>
          {points.map((p) => (
            <tr key={p.i}>
              <th scope="row">{label(p.i)}</th>
              <td>{p.v == null ? 'pas de donnée' : p.v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

// Répartition des cartes uniques par rareté : barres horizontales, valeur en bout de barre.
export function RarityBars({ byRarity, shinyByRarity = [] }) {
  const [hover, setHover] = useState(null);
  const total = byRarity.reduce((a, b) => a + b, 0) || 1;
  const max = Math.max(...byRarity, 1);
  return (
    <ul className="flex flex-col gap-2.5" aria-label="Cartes uniques par rareté">
      {[...RARITY.keys()].reverse().map((r) => {
        const n = byRarity[r] ?? 0;
        return (
          <li
            key={r}
            className="grid grid-cols-[128px_1fr_auto] items-center gap-3"
            onPointerEnter={() => setHover(r)}
            onPointerLeave={() => setHover(null)}
            tabIndex={0}
            onFocus={() => setHover(r)}
            onBlur={() => setHover(null)}
            aria-label={`${RARITY[r].label} : ${n} cartes, ${fmtPct(n / total)}`}
          >
            <span className="flex items-center gap-1.5 text-[13px] font-semibold whitespace-nowrap text-muted">
              <span style={{ color: RARITY[r].color }} className="text-[11px]">
                <Pips rarity={r} />
              </span>
              {RARITY[r].label}
            </span>
            <span className="relative h-2.5 rounded-r-[4px] bg-white/[.05]">
              <span
                className="absolute inset-y-0 left-0 rounded-r-[4px] transition-[width,filter] duration-700 ease-out-soft"
                style={{ width: `${(n / max) * 100}%`, background: RARITY[r].color, filter: hover === r ? 'brightness(1.2)' : 'none', minWidth: n ? 3 : 0 }}
              />
              {hover === r ? (
                <span className="pointer-events-none absolute -top-9 left-0 z-10 rounded-lg border border-line-2 bg-[#171a33] px-2 py-1 text-[11.5px] whitespace-nowrap text-muted shadow-pop">
                  <b className="text-text">{fmtPct(n / total)}</b> des cartes uniques{shinyByRarity[r] ? ` · ${shinyByRarity[r]} Shiny` : ''}
                </span>
              ) : null}
            </span>
            <span className="tnum min-w-[2.5ch] text-right text-[13px] font-bold text-text">{fmt(n)}</span>
          </li>
        );
      })}
    </ul>
  );
}
