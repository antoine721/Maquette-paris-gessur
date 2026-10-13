// Cartothèque : les cartes découvertes par le groupe, ou toutes les cartes possibles de Wikipédia.
import { useEffect, useState } from 'react';
import { CardGrid, CardTable, FilterBar, useCardFilters } from '../components/CardBrowser.jsx';
import { WikiBrowser } from '../components/WikiIndex.jsx';
import { Chip, InfoTip, Page, PageHeader, Segmented, Spinner } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { fmt } from '../lib/format.js';
import { useToast } from '../lib/toast.jsx';

const PAGE = 60;
const SORTS = [
  { value: 'rarity', label: 'Rareté' },
  { value: 'recent', label: 'Découvertes récentes' },
  { value: 'atk', label: 'Meilleure stat' },
  { value: 'views', label: 'Popularité' },
  { value: 'copies', label: 'Exemplaires' },
  { value: 'alpha', label: 'A → Z' },
];

export default function Catalogue() {
  const [source, setSource] = useState('groupe');
  const switcher = (
    <Segmented
      value={source}
      onChange={setSource}
      options={[
        { value: 'groupe', label: 'Découvertes du groupe' },
        { value: 'wikipedia', label: 'Tout Wikipédia' },
      ]}
    />
  );
  if (source === 'wikipedia') {
    return (
      <Page>
        <PageHeader eyebrow="Cartothèque" title="Tout Wikipédia" sub="Chaque article illustré est une carte possible. Les plus lus d’abord.">
          {switcher}
        </PageHeader>
        <WikiBrowser />
      </Page>
    );
  }
  return <GroupCatalogue switcher={switcher} />;
}

function GroupCatalogue({ switcher }) {
  const toast = useToast();
  const [f, set] = useCardFilters({ sort: 'rarity' });
  const [mine, setMine] = useState(null);
  const [res, setRes] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    let alive = true;
    const t = setTimeout(
      () => {
        api
          .catalogue({ q: f.q.trim(), rarity: f.rarity ?? '', type: f.type ?? '', sort: f.sort, mine: mine == null ? '' : mine ? '1' : '0', limit: PAGE })
          .then((r) => alive && setRes(r))
          .catch((e) => toast.error(e));
      },
      f.q ? 180 : 0,
    );
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [f.q, f.rarity, f.type, f.sort, mine, toast]);

  const more = async () => {
    setLoadingMore(true);
    try {
      const r = await api.catalogue({
        q: f.q.trim(),
        rarity: f.rarity ?? '',
        type: f.type ?? '',
        sort: f.sort,
        mine: mine == null ? '' : mine ? '1' : '0',
        limit: PAGE,
        offset: res.cards.length,
      });
      setRes((old) => {
        const seen = new Set(old.cards.map((c) => c.pageId));
        return { total: r.total, cards: [...old.cards, ...r.cards.filter((c) => !seen.has(c.pageId))] };
      });
    } catch (e) {
      toast.error(e);
    }
    setLoadingMore(false);
  };

  return (
    <Page>
      <PageHeader
        eyebrow="Cartothèque"
        title={
          <span className="inline-flex items-center gap-2">
            Toutes les cartes
            <InfoTip>Chaque carte tirée par un membre du groupe rejoint la cartothèque. Sa rareté et ses statistiques sont figées dès ce premier tirage.</InfoTip>
          </span>
        }
        sub={res ? `${fmt(res.total)} cartes découvertes par le groupe` : 'Chargement…'}
      >
        {switcher}
        <div className="flex gap-1.5">
          <Chip active={mine === true} onClick={() => setMine(mine === true ? null : true)}>
            Je l’ai
          </Chip>
          <Chip active={mine === false} onClick={() => setMine(mine === false ? null : false)}>
            Il me manque
          </Chip>
        </div>
      </PageHeader>
      <FilterBar f={f} set={set} showOwnedChips={false} sorts={SORTS} />
      {!res ? (
        <div className="grid min-h-[40vh] place-items-center">
          <Spinner />
        </div>
      ) : res.cards.length === 0 ? (
        <p className="py-10 text-center text-faint">Aucune carte ne correspond. Ouvre des boosters pour enrichir la cartothèque.</p>
      ) : (
        <>
          {f.view === 'grid' ? (
            <CardGrid
              cards={res.cards}
              badge={(c) =>
                c.mine ? (
                  <span className="absolute -top-2 -right-2 z-10 rounded-full bg-ok px-2 py-0.5 text-[10.5px] font-extrabold text-[#06210f] shadow-lg">À TOI</span>
                ) : null
              }
            />
          ) : (
            <CardTable cards={res.cards} columns="catalogue" />
          )}
          {res.cards.length < res.total ? (
            <div className="mt-8 flex justify-center">
              <button
                type="button"
                onClick={more}
                disabled={loadingMore}
                className="h-11 rounded-full border border-line bg-white/[.045] px-6 text-[14px] font-semibold hover:bg-white/[.08] disabled:opacity-50"
              >
                {loadingMore ? 'Chargement…' : `Voir plus (${fmt(res.total - res.cards.length)})`}
              </button>
            </div>
          ) : null}
        </>
      )}
    </Page>
  );
}
