// Tout Wikipédia : avancement de l'indexation et toutes les cartes possibles.
import { Database, WarningCircle } from '@phosphor-icons/react';
import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { fmt, fmtCompact } from '../lib/format.js';
import { useToast } from '../lib/toast.jsx';
import { Pips, RARITY } from '../lib/visuals.jsx';
import { CardGrid, CardTable, FilterBar, useCardFilters } from './CardBrowser.jsx';
import { CountUp, InfoTip, LiveDot, Panel, Spinner } from './ui.jsx';

const PAGE = 60;
const SORTS = [
  { value: 'views', label: 'Popularité' },
  { value: 'alpha', label: 'A → Z' },
];

function duration(minutes) {
  if (minutes < 90) return `${Math.max(1, Math.round(minutes))} min`;
  const h = minutes / 60;
  return h < 48 ? `${Math.round(h)} h` : `${Math.round(h / 24)} jours`;
}

export function IndexStatus({ index }) {
  if (!index) {
    return (
      <Panel>
        <p className="text-[14px] text-muted">L’indexation de Wikipédia est désactivée sur ce serveur (WIKI_INDEX=0). Les boosters sont tirés directement dans Wikipédia.</p>
      </Panel>
    );
  }
  const done = index.completedPasses > 0 && index.finishedAt;
  const pct = index.expected ? Math.min(1, index.scanned / index.expected) : null;
  const left = index.perMinute && index.expected ? (index.expected - index.scanned) / index.perMinute : null;
  return (
    <Panel
      title={
        <span className="inline-flex items-center gap-2">
          <Database size={18} weight="duotone" /> Index de Wikipédia
          <InfoTip>
            Le serveur parcourt chaque article de Wikipédia, 50 à la fois, et garde ce qu’il faut pour en faire une carte : titre, image, description,
            popularité sur 30 jours, longueur, langues, label de qualité. Le texte est chargé au premier tirage. Un nouveau passage a lieu chaque mois.
          </InfoTip>
        </span>
      }
      aside={
        index.lastError ? (
          <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-danger">
            <WarningCircle weight="fill" /> en pause
          </span>
        ) : done ? (
          <span className="text-[12px] font-semibold text-ok">à jour</span>
        ) : (
          <LiveDot>indexation</LiveDot>
        )
      }
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="block text-[11.5px] font-bold tracking-[.08em] text-faint uppercase">Cartes possibles</span>
          <CountUp value={index.illustrated} className="text-[34px] leading-none font-extrabold" />
          <span className="mt-1 block text-[13px] text-muted">
            sur <CountUp value={index.articles} /> articles indexés
          </span>
        </div>
        <div className="text-right text-[13px] text-muted">
          {index.finishedAt && index.completedPasses ? (
            <p>Passage {index.completedPasses} terminé le {new Date(index.finishedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}</p>
          ) : null}
          {!index.finishedAt ? (
            <p>
              Passage {index.pass} : {fmt(index.scanned)}
              {index.expected ? ` / ${fmt(index.expected)}` : ''} articles parcourus
            </p>
          ) : null}
          {left && !index.finishedAt ? <p className="text-faint">environ {duration(left)} restantes</p> : null}
        </div>
      </div>
      {pct != null && !index.finishedAt ? (
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/[.06]">
          <motion.div className="h-full rounded-full bg-[linear-gradient(90deg,#7c6cff,#e85bc7,#ffd23f)]" initial={{ width: 0 }} animate={{ width: `${pct * 100}%` }} transition={{ duration: 0.8 }} />
        </div>
      ) : null}
      <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
        {[...RARITY.keys()].reverse().map((r) => (
          <div key={r} className="rounded-xl bg-white/[.03] px-2.5 py-2">
            <span className="flex items-center gap-1 text-[11px] font-bold whitespace-nowrap" style={{ color: RARITY[r].color }}>
              <Pips rarity={r} /> {RARITY[r].label}
            </span>
            <span className="tnum text-[16px] font-bold">{fmtCompact(index.byRarity?.[r] ?? 0)}</span>
          </div>
        ))}
      </div>
      {!index.completedPasses ? (
        <p className="mt-3 text-[12.5px] text-faint">
          Tant que le premier passage n’est pas fini, les boosters sont tirés directement dans Wikipédia. Ensuite, chaque carte est tirée dans tout l’index.
        </p>
      ) : null}
      {index.lastError ? <p className="mt-3 text-[12.5px] text-danger">{index.lastError}. Nouvel essai automatique.</p> : null}
    </Panel>
  );
}

export function WikiBrowser() {
  const toast = useToast();
  const [f, set] = useCardFilters({ sort: 'views' });
  const [index, setIndex] = useState(undefined);
  const [res, setRes] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = () =>
      api
        .wiki()
        .then((d) => alive && setIndex(d.index))
        .catch(() => {});
    load();
    const t = setInterval(load, 10000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const params = { q: f.q.trim(), rarity: f.rarity ?? '', type: f.type ?? '', sort: f.sort, limit: PAGE };
  useEffect(() => {
    let alive = true;
    const t = setTimeout(
      () => {
        api
          .wikiArticles(params)
          .then((r) => alive && setRes(r))
          .catch((e) => toast.error(e));
      },
      f.q ? 200 : 0,
    );
    return () => {
      alive = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.q, f.rarity, f.type, f.sort, toast]);

  const more = async () => {
    setLoadingMore(true);
    try {
      const r = await api.wikiArticles({ ...params, offset: res.cards.length });
      setRes((old) => {
        const seen = new Set(old.cards.map((c) => c.pageId));
        return { hasMore: r.hasMore, cards: [...old.cards, ...r.cards.filter((c) => !seen.has(c.pageId))] };
      });
    } catch (e) {
      toast.error(e);
    }
    setLoadingMore(false);
  };

  return (
    <div className="flex flex-col gap-6">
      {index === undefined ? null : <IndexStatus index={index} />}
      <div>
        <FilterBar f={f} set={set} showOwnedChips={false} sorts={SORTS} />
        {!res ? (
          <div className="grid min-h-[30vh] place-items-center">
            <Spinner />
          </div>
        ) : res.cards.length === 0 ? (
          <p className="py-10 text-center text-faint">
            {f.q ? 'Aucun article ne commence par ce texte.' : 'L’index est encore vide : les premières cartes apparaissent dans quelques secondes.'}
          </p>
        ) : (
          <>
            {f.view === 'grid' ? (
              <CardGrid
                cards={res.cards}
                badge={(c) =>
                  c.mine ? (
                    <span className="absolute -top-2 -right-2 z-10 rounded-full bg-ok px-2 py-0.5 text-[10.5px] font-extrabold text-[#06210f] shadow-lg">À TOI</span>
                  ) : c.discovered ? (
                    <span className="absolute -top-2 -right-2 z-10 rounded-full border border-line-2 bg-[#23284a] px-2 py-0.5 text-[10.5px] font-bold text-muted">DÉCOUVERTE</span>
                  ) : (
                    <span className="absolute -top-2 -right-2 z-10 rounded-full bg-white/90 px-2 py-0.5 text-[10.5px] font-extrabold text-[#141627]">JAMAIS TIRÉE</span>
                  )
                }
              />
            ) : (
              <CardTable cards={res.cards.map((c) => ({ ...c, copies: c.mine }))} columns="catalogue" />
            )}
            {res.hasMore ? (
              <div className="mt-8 flex justify-center">
                <button
                  type="button"
                  onClick={more}
                  disabled={loadingMore}
                  className="h-11 rounded-full border border-line bg-white/[.045] px-6 text-[14px] font-semibold hover:bg-white/[.08] disabled:opacity-50"
                >
                  {loadingMore ? 'Chargement…' : 'Voir plus'}
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
