// Ma collection : toutes mes cartes, façon base de données.
import { Package } from '@phosphor-icons/react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CardGrid, CardTable, FilterBar, OwnedBadge, applyFilters, useCardFilters, useCounts } from '../components/CardBrowser.jsx';
import { Button, CountUp, EmptyState, Page, PageHeader, Spinner } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { useLive, useSession } from '../lib/session.jsx';
import { useToast } from '../lib/toast.jsx';
import { Pips, RARITY } from '../lib/visuals.jsx';

export function RarityTiles({ stats }) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
      {[...RARITY.keys()].reverse().map((r) => (
        <div key={r} className="relative overflow-hidden rounded-2xl border border-line bg-white/[.035] px-3 py-2.5">
          <div className="absolute inset-x-0 top-0 h-0.5" style={{ background: RARITY[r].color }} />
          <span className="flex items-center gap-1.5 text-[11.5px] font-bold" style={{ color: RARITY[r].color }}>
            <Pips rarity={r} /> {RARITY[r].label}
          </span>
          <CountUp value={stats.byRarity[r]} className="mt-0.5 block text-[22px] font-extrabold" />
          {stats.shinyByRarity?.[r] ? <span className="text-[11px] font-semibold text-[#e6b8ff]">dont {stats.shinyByRarity[r]} Shiny</span> : null}
        </div>
      ))}
    </div>
  );
}

export default function Collection() {
  const { stats, me } = useSession();
  const toast = useToast();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [f, set] = useCardFilters();

  const load = () =>
    api
      .collection()
      .then(setData)
      .catch((e) => toast.error(e));
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useLive('feed', (events) => {
    if (events.some((e) => e.type === 'gift' && e.target === me.username)) load();
  });

  const cards = useMemo(() => (data ? applyFilters(data.cards, f) : []), [data, f]);
  const counts = useCounts(data?.cards ?? []);

  if (!data) {
    return (
      <Page>
        <div className="grid min-h-[50vh] place-items-center">
          <Spinner />
        </div>
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader
        eyebrow="Collection"
        title="Ma collection"
        sub={
          <>
            <CountUp value={stats.unique} className="font-semibold text-text" /> cartes uniques · <CountUp value={stats.total} /> exemplaires · score{' '}
            <CountUp value={stats.score} className="font-semibold text-gold" />
          </>
        }
      >
        <Button variant="gold" onClick={() => navigate('/')}>
          <Package size={19} weight="fill" /> Ouvrir un booster
        </Button>
      </PageHeader>
      {data.cards.length ? (
        <>
          <div className="mb-7">
            <RarityTiles stats={stats} />
          </div>
          <FilterBar f={f} set={set} counts={counts} />
          {cards.length === 0 ? (
            <p className="py-10 text-center text-faint">Aucune carte ne correspond à ces filtres.</p>
          ) : f.view === 'grid' ? (
            <CardGrid cards={cards} badge={(c) => <OwnedBadge card={c} />} />
          ) : (
            <CardTable cards={cards} />
          )}
        </>
      ) : (
        <EmptyState
          title="Ta collection est vide"
          action={
            <Button variant="gold" size="lg" onClick={() => navigate('/')}>
              <Package size={20} weight="fill" /> Ouvrir mon premier booster
            </Button>
          }
        >
          Chaque article de Wikipédia est une carte. Ouvre un booster pour commencer.
        </EmptyState>
      )}
    </Page>
  );
}
