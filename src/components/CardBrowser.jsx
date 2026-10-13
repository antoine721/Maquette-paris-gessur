// Parcourir des cartes façon base Futbin : filtres, tri, grille ou tableau.
import { Diamond, ListBullets, MagnifyingGlass, Sparkle, SquaresFour } from '@phosphor-icons/react';
import { motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fmt, fmtCompact } from '../lib/format.js';
import { Pips, RARITY, TYPE, typeOf } from '../lib/visuals.jsx';
import { WikiCard } from './WikiCard.jsx';
import { Chip, Segmented } from './ui.jsx';

export const SORTS = [
  { value: 'rarity', label: 'Rareté' },
  { value: 'recent', label: 'Plus récentes' },
  { value: 'atk', label: 'Meilleure stat' },
  { value: 'views', label: 'Popularité' },
  { value: 'alpha', label: 'A → Z' },
  { value: 'copies', label: 'Exemplaires' },
];

const best = (c) => Math.max(c.atk, c.def);
export const SORT_FN = {
  rarity: (a, b) => b.rarity - a.rarity || Number(b.shiny) - Number(a.shiny) || b.views30 - a.views30,
  recent: (a, b) => (b.lastAt ?? b.discoveredAt) - (a.lastAt ?? a.discoveredAt),
  atk: (a, b) => best(b) - best(a),
  views: (a, b) => b.views30 - a.views30,
  alpha: (a, b) => a.title.localeCompare(b.title, 'fr'),
  copies: (a, b) => (b.count ?? b.copies ?? 0) - (a.count ?? a.copies ?? 0) || b.rarity - a.rarity,
};

const norm = (s) => s.toLocaleLowerCase('fr').normalize('NFD').replace(/\p{M}/gu, '');

export function useCardFilters(initial = {}) {
  const [f, setF] = useState({ q: '', rarity: null, type: null, sort: 'rarity', shiny: false, dup: false, view: 'grid', ...initial });
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }));
  return [f, set];
}

export function applyFilters(cards, f) {
  const q = norm(f.q.trim());
  return cards
    .filter(
      (c) =>
        (f.rarity == null || c.rarity === f.rarity) &&
        (!f.type || c.type === f.type) &&
        (!f.shiny || c.shiny) &&
        (!f.dup || (c.count ?? 0) > 1) &&
        (!q || norm(c.title).includes(q) || norm(c.description || '').includes(q)),
    )
    .sort(SORT_FN[f.sort] ?? SORT_FN.rarity);
}

export function FilterBar({ f, set, counts, showOwnedChips = true, sorts = SORTS }) {
  return (
    <div className="mb-5 flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-[200px] flex-1 sm:max-w-[340px]">
          <MagnifyingGlass size={18} weight="bold" className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-faint" />
          <input
            type="search"
            value={f.q}
            onChange={(e) => set('q')(e.target.value)}
            placeholder="Chercher une carte"
            aria-label="Chercher une carte"
            className="h-10 w-full rounded-full border border-line bg-white/[.045] pr-4 pl-10 text-[14px] outline-none transition-colors placeholder:text-faint focus:border-gold/60 focus:bg-white/[.07]"
          />
        </label>
        <select
          value={f.type ?? ''}
          onChange={(e) => set('type')(e.target.value || null)}
          aria-label="Famille"
          className="h-10 rounded-full border border-line bg-white/[.045] px-4 text-[14px] outline-none focus:border-gold/60 [&>option]:bg-[#161a33]"
        >
          <option value="">Toutes les familles</option>
          {Object.entries(TYPE).map(([k, t]) => (
            <option key={k} value={k}>
              {t.label}
            </option>
          ))}
        </select>
        <select
          value={f.sort}
          onChange={(e) => set('sort')(e.target.value)}
          aria-label="Trier"
          className="h-10 rounded-full border border-line bg-white/[.045] px-4 text-[14px] outline-none focus:border-gold/60 [&>option]:bg-[#161a33]"
        >
          {sorts.map((s) => (
            <option key={s.value} value={s.value}>
              Tri : {s.label}
            </option>
          ))}
        </select>
        <Segmented
          className="ml-auto"
          size="sm"
          value={f.view}
          onChange={set('view')}
          options={[
            { value: 'grid', label: <SquaresFour size={17} weight="bold" />, aria: 'Grille' },
            { value: 'list', label: <ListBullets size={17} weight="bold" />, aria: 'Tableau' },
          ]}
        />
      </div>
      <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
        <Chip active={f.rarity == null} onClick={() => set('rarity')(null)}>
          Toutes{counts ? <b className="tnum text-faint">{fmt(counts.reduce((a, b) => a + b, 0))}</b> : null}
        </Chip>
        {[...RARITY.keys()].reverse().map((r) =>
          !counts || counts[r] ? (
            <Chip key={r} active={f.rarity === r} color={RARITY[r].color} onClick={() => set('rarity')(f.rarity === r ? null : r)}>
              <span style={{ color: RARITY[r].color }}>
                <Pips rarity={r} className="text-[11px]" />
              </span>
              {RARITY[r].label}
              {counts ? <b className="tnum text-faint">{fmt(counts[r])}</b> : null}
            </Chip>
          ) : null,
        )}
        {showOwnedChips ? (
          <>
            <Chip active={f.shiny} color="#c39bff" onClick={() => set('shiny')(!f.shiny)}>
              <Sparkle weight="fill" className="text-[#e6b8ff]" /> Shiny
            </Chip>
            <Chip active={f.dup} onClick={() => set('dup')(!f.dup)}>
              <Diamond weight="fill" /> Doublons
            </Chip>
          </>
        ) : null}
      </div>
    </div>
  );
}

// Grille qui se remplit au fil du défilement.
export function CardGrid({ cards, badge }) {
  const [shown, setShown] = useState(48);
  const sentinel = useRef(null);
  useEffect(() => setShown(48), [cards]);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return undefined;
    const io = new IntersectionObserver((e) => e.some((x) => x.isIntersecting) && setShown((n) => n + 48), { rootMargin: '800px' });
    io.observe(el);
    return () => io.disconnect();
  }, [cards]);
  return (
    <>
      <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 sm:gap-x-5 sm:gap-y-7 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {cards.slice(0, shown).map((c, i) => (
          <motion.div
            key={c.pageId}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: Math.min(i % 48, 12) * 0.025, ease: [0.22, 1, 0.36, 1] }}
          >
            <Link to={`/carte/${c.pageId}`} className="group relative block rounded-[14px] outline-offset-4" aria-label={`${c.title}, ${RARITY[c.rarity].label}`}>
              {badge?.(c)}
              <div className="transition-transform duration-500 ease-out-soft group-hover:-translate-y-1.5">
                <WikiCard card={c} interactive tilt={16} />
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
      <div ref={sentinel} className="h-px" />
    </>
  );
}

// Tableau façon Futbin.
export function CardTable({ cards, columns = 'collection' }) {
  const navigate = useNavigate();
  const [shown, setShown] = useState(80);
  useEffect(() => setShown(80), [cards]);
  return (
    <div className="overflow-hidden rounded-[22px] border border-line">
      <table className="w-full text-left text-[13.5px]">
        <thead className="bg-white/[.04] text-[11px] tracking-[.1em] text-faint uppercase">
          <tr>
            <th className="px-3 py-3 font-bold sm:px-4">Carte</th>
            <th className="hidden px-3 py-3 font-bold md:table-cell">Famille</th>
            <th className="hidden px-3 py-3 font-bold sm:table-cell">Rareté</th>
            <th className="px-3 py-3 text-right font-bold">ATK</th>
            <th className="px-3 py-3 text-right font-bold">DEF</th>
            <th className="hidden px-3 py-3 text-right font-bold lg:table-cell">Vues 30 j</th>
            <th className="px-3 py-3 text-right font-bold sm:px-4">{columns === 'catalogue' ? 'Exempl.' : 'Possédés'}</th>
          </tr>
        </thead>
        <tbody>
          {cards.slice(0, shown).map((c) => {
            const r = RARITY[c.rarity];
            const T = typeOf(c.type);
            return (
              <tr
                key={c.pageId}
                tabIndex={0}
                onClick={() => navigate(`/carte/${c.pageId}`)}
                onKeyDown={(e) => e.key === 'Enter' && navigate(`/carte/${c.pageId}`)}
                className="cursor-pointer border-t border-line transition-colors hover:bg-white/[.04] focus-visible:bg-white/[.06] focus-visible:outline-none"
              >
                <td className="px-3 py-2 sm:px-4">
                  <span className="flex items-center gap-3">
                    <img src={c.image} alt="" loading="lazy" className="h-12 w-[38px] flex-none rounded-md object-cover" style={{ boxShadow: `0 0 0 2px ${c.shiny ? '#e6b8ff' : r.color}` }} />
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{c.title}</span>
                      <span className="block truncate text-[12px] text-faint italic">{c.description}</span>
                      <span className="mt-0.5 flex items-center gap-1 text-[11.5px] sm:hidden" style={{ color: r.color }}>
                        <Pips rarity={c.rarity} /> {r.label}
                      </span>
                    </span>
                  </span>
                </td>
                <td className="hidden px-3 py-2 md:table-cell">
                  <span className="inline-flex items-center gap-1.5 text-[13px]" style={{ color: T.color }}>
                    <T.Icon weight="fill" /> {T.label}
                  </span>
                </td>
                <td className="hidden px-3 py-2 sm:table-cell">
                  <span className="inline-flex items-center gap-1.5 font-semibold" style={{ color: r.color }}>
                    <Pips rarity={c.rarity} /> {r.label}
                    {c.shiny ? <Sparkle weight="fill" className="text-[#e6b8ff]" /> : null}
                  </span>
                </td>
                <td className="tnum px-3 py-2 text-right font-stat text-[16px] font-semibold">{fmt(c.atk)}</td>
                <td className="tnum px-3 py-2 text-right font-stat text-[16px] font-semibold">{fmt(c.def)}</td>
                <td className="tnum hidden px-3 py-2 text-right text-muted lg:table-cell">{fmtCompact(c.views30)}</td>
                <td className="tnum px-3 py-2 text-right sm:px-4">
                  {columns === 'catalogue' ? (
                    <span className="text-muted">
                      {fmt(c.copies)}
                      {c.mine ? <span className="ml-1.5 rounded-full bg-ok/15 px-1.5 py-0.5 text-[11px] font-bold text-ok">à toi</span> : null}
                    </span>
                  ) : (
                    <span className="font-semibold">×{c.count}</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {shown < cards.length ? (
        <button type="button" onClick={() => setShown((n) => n + 120)} className="w-full border-t border-line py-3 text-[13.5px] font-semibold text-muted hover:bg-white/[.04] hover:text-text">
          Afficher plus ({fmt(cards.length - shown)} restantes)
        </button>
      ) : null}
    </div>
  );
}

export function OwnedBadge({ card }) {
  if (card.count > 1)
    return <span className="absolute -top-2 -right-2 z-10 rounded-full border border-line-2 bg-[#23284a] px-2 py-0.5 text-[11px] font-bold text-text shadow-lg">×{card.count}</span>;
  return null;
}

export function useCounts(cards) {
  return useMemo(() => RARITY.map((_, r) => cards.filter((c) => c.rarity === r).length), [cards]);
}
