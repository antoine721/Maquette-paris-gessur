// Profil d'un joueur : statistiques, vitrine de 5 cartes, répartition des raretés et collection.
import { Check, PencilSimple, Plus } from '@phosphor-icons/react';
import { motion } from 'motion/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CardGrid, CardTable, FilterBar, OwnedBadge, applyFilters, useCardFilters, useCounts } from '../components/CardBrowser.jsx';
import { RarityBars } from '../components/Charts.jsx';
import { WikiCard } from '../components/WikiCard.jsx';
import { Avatar, Button, CountUp, EmptyState, Modal, Page, Panel, Spinner } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { fmtDate } from '../lib/format.js';
import { useSession } from '../lib/session.jsx';
import { useToast } from '../lib/toast.jsx';

function Showcase({ items, own, onEdit }) {
  const slots = Array.from({ length: 5 }, (_, i) => items[i] ?? null);
  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 sm:gap-5">
      {slots.map((c, i) =>
        c ? (
          <motion.div key={c.copyId} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}>
            <Link to={`/carte/${c.pageId}`} aria-label={c.title}>
              <WikiCard card={c} interactive tilt={18} />
            </Link>
          </motion.div>
        ) : (
          <button
            key={`empty${i}`}
            type="button"
            disabled={!own}
            onClick={onEdit}
            className="grid aspect-[63/88] place-items-center rounded-[14px] border-2 border-dashed border-line-2 text-faint transition-colors enabled:hover:border-gold/50 enabled:hover:text-gold"
            aria-label={own ? 'Ajouter une carte à la vitrine' : 'Emplacement vide'}
          >
            {own ? <Plus size={26} weight="bold" /> : null}
          </button>
        ),
      )}
    </div>
  );
}

function ShowcaseEditor({ open, cards, current, onClose, onSaved }) {
  const toast = useToast();
  // Sélection par carte ; un exemplaire déjà épinglé (depuis sa fiche) est gardé tel quel.
  const [picked, setPicked] = useState([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setPicked([...new Set(current.map((s) => s.pageId))]);
  }, [open, current]);
  const copyFor = (pageId) => current.find((s) => s.pageId === pageId)?.copyId ?? cards.find((c) => c.pageId === pageId)?.bestCopyId;
  const sorted = useMemo(() => [...cards].sort((a, b) => b.rarity - a.rarity || Number(b.shiny) - Number(a.shiny) || b.views30 - a.views30), [cards]);
  const toggle = (pageId) =>
    setPicked((p) => (p.includes(pageId) ? p.filter((x) => x !== pageId) : p.length >= 5 ? p : [...p, pageId]));
  const save = async () => {
    setBusy(true);
    try {
      const res = await api.setShowcase(picked.map(copyFor).filter(Boolean));
      onSaved(res.showcase);
      toast.push('Vitrine mise à jour.');
    } catch (e) {
      toast.error(e);
    }
    setBusy(false);
  };
  return (
    <Modal open={open} onClose={onClose} className="max-w-[960px] p-5 sm:p-7" label="Modifier la vitrine">
      <h2 className="pr-8 text-[22px] font-extrabold">Ta vitrine</h2>
      <p className="mt-1 text-[14px] text-muted">Choisis jusqu’à 5 cartes à montrer sur ton profil, dans l’ordre où tu les touches.</p>
      <div className="mt-5 grid max-h-[58vh] grid-cols-3 gap-3 overflow-y-auto p-1 sm:grid-cols-5 lg:grid-cols-6">
        {sorted.map((c) => {
          const n = picked.indexOf(c.pageId);
          return (
            <button key={c.pageId} type="button" onClick={() => toggle(c.pageId)} aria-pressed={n >= 0} className="relative rounded-[12px] text-left">
              {n >= 0 ? (
                <span className="absolute -top-2 -right-2 z-10 grid h-7 w-7 place-items-center rounded-full bg-gold text-[13px] font-extrabold text-[#1d1400] shadow-lg">{n + 1}</span>
              ) : null}
              <div className={`transition-[opacity,transform] duration-300 ${n >= 0 ? 'scale-[.96]' : picked.length >= 5 ? 'opacity-40' : 'opacity-80 hover:opacity-100'}`}>
                <WikiCard card={c} />
              </div>
            </button>
          );
        })}
      </div>
      <div className="mt-5 flex items-center justify-between gap-3">
        <span className="text-[13px] text-faint">{picked.length} / 5</span>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setPicked([])}>
            Vider
          </Button>
          <Button variant="gold" onClick={save} disabled={busy}>
            <Check size={18} weight="bold" /> Enregistrer
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default function Profile() {
  const { name } = useParams();
  const { me, online, setShowcase } = useSession();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(false);
  const [f, set] = useCardFilters();
  const own = name.toLocaleLowerCase() === me.username.toLocaleLowerCase();

  const load = useCallback(() => {
    setError(null);
    api
      .player(name)
      .then(setData)
      .catch((e) => (e.status === 404 ? setError(e) : toast.error(e)));
  }, [name, toast]);
  useEffect(load, [load]);

  const cards = useMemo(() => (data ? applyFilters(data.cards, f) : []), [data, f]);
  const counts = useCounts(data?.cards ?? []);

  if (error) {
    return (
      <Page>
        <EmptyState title="Joueur introuvable">Ce pseudo n’existe pas.</EmptyState>
      </Page>
    );
  }
  if (!data) {
    return (
      <Page>
        <div className="grid min-h-[50vh] place-items-center">
          <Spinner />
        </div>
      </Page>
    );
  }
  const s = data.stats;

  return (
    <Page>
      <section className="relative overflow-hidden rounded-[32px] border border-line bg-[radial-gradient(120%_140%_at_0%_0%,rgb(124_108_255/.28),transparent_55%),radial-gradient(100%_120%_at_100%_100%,rgb(232_91_199/.16),transparent_60%)] p-5 sm:p-8">
        <div className="flex flex-wrap items-center gap-5">
          <Avatar name={data.user.username} size={84} online={online.includes(data.user.username)} />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[clamp(28px,4.4vw,44px)] leading-tight font-extrabold tracking-[-.025em]">{data.user.username}</h1>
            <p className="text-muted">Joueur depuis le {fmtDate(data.user.joinedAt)}</p>
          </div>
        </div>
        <dl className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-5">
          {[
            ['Score', s.score, 'text-gold'],
            ['Cartes uniques', s.unique, ''],
            ['Exemplaires', s.total, ''],
            ['Boosters', s.packs, ''],
            ['Shiny', s.shinies, 'text-[#e6b8ff]'],
          ].map(([label, v, cls]) => (
            <div key={label} className="rounded-2xl bg-black/20 px-4 py-3">
              <dt className="text-[11.5px] font-bold tracking-[.08em] text-faint uppercase">{label}</dt>
              <dd className={`text-[26px] font-extrabold ${cls}`}>
                <CountUp value={v} />
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Panel
          title="Vitrine"
          aside={
            own ? (
              <Button size="sm" variant="ghost" onClick={() => setEditing(true)} disabled={!data.cards.length}>
                <PencilSimple size={15} weight="bold" /> Modifier
              </Button>
            ) : null
          }
        >
          {data.showcase.length || own ? (
            <Showcase items={data.showcase} own={own} onEdit={() => setEditing(true)} />
          ) : (
            <p className="text-[14px] text-muted">{data.user.username} n’a pas encore choisi ses cartes préférées.</p>
          )}
        </Panel>
        <Panel title="Répartition des raretés">
          <RarityBars byRarity={s.byRarity} shinyByRarity={s.shinyByRarity} />
        </Panel>
      </div>

      <h2 className="mt-10 mb-4 text-[22px] font-extrabold tracking-[-.02em]">Collection</h2>
      {data.cards.length ? (
        <>
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
        <EmptyState title="Pas encore de cartes">{own ? 'Ouvre ton premier booster !' : `${data.user.username} n’a pas encore ouvert de booster.`}</EmptyState>
      )}

      {own ? (
        <ShowcaseEditor
          open={editing}
          cards={data.cards}
          current={data.showcase}
          onClose={() => setEditing(false)}
          onSaved={(showcase) => {
            setShowcase(showcase);
            setData((d) => ({ ...d, showcase }));
            setEditing(false);
          }}
        />
      ) : null}
    </Page>
  );
}
