// Fiche d'une carte, façon page joueur de Futbin.
import { ArrowSquareOut, CaretLeft, Gift, PushPin, Sparkle } from '@phosphor-icons/react';
import { motion } from 'motion/react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ViewsChart } from '../components/Charts.jsx';
import { WikiCard } from '../components/WikiCard.jsx';
import { Avatar, Button, InfoTip, Modal, Page, Panel, RarityTag, Segmented, Spinner, TypeTag } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { fmt, fmtBytes, fmtDate, wikiUrl } from '../lib/format.js';
import { useSession } from '../lib/session.jsx';
import { useToast } from '../lib/toast.jsx';
import { RARITY } from '../lib/visuals.jsx';

function StatBar({ label, value, range, color, hint }) {
  const max = 15000;
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-[12px] font-bold tracking-[.12em] text-faint uppercase">{label}</span>
        <span className="tnum font-stat text-[30px] leading-none font-semibold">{fmt(value)}</span>
      </div>
      <div className="relative mt-2 h-2 overflow-hidden rounded-full bg-white/[.06]">
        <div className="absolute inset-y-0 rounded-full bg-white/[.08]" style={{ left: `${(range[0] / max) * 100}%`, width: `${((range[1] - range[0]) / max) * 100}%` }} />
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, (value / max) * 100)}%` }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
      <p className="mt-1.5 text-[12px] text-faint">{hint}</p>
    </div>
  );
}

function Fact({ label, value, sub }) {
  return (
    <div className="rounded-2xl border border-line bg-white/[.03] px-3.5 py-3">
      <span className="block text-[11.5px] font-bold tracking-[.08em] text-faint uppercase">{label}</span>
      <span className="tnum mt-0.5 block text-[18px] font-bold">{value}</span>
      {sub ? <span className="block text-[12px] text-muted">{sub}</span> : null}
    </div>
  );
}

export default function CardPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { rules, config, me, showcase, setShowcase, setStats } = useSession();
  const toast = useToast();
  const [card, setCard] = useState(null);
  const [error, setError] = useState(null);
  const [variant, setVariant] = useState('normal');
  const [giftCopy, setGiftCopy] = useState(null);

  const load = useCallback(() => {
    api
      .card(id)
      .then(({ card: c }) => {
        setCard(c);
        setVariant(c.myCopies.some((x) => x.shiny) ? 'shiny' : 'normal');
      })
      .catch(setError);
  }, [id]);
  useEffect(load, [load]);

  if (error) {
    return (
      <Page>
        <p className="py-20 text-center text-muted">{error.message}</p>
      </Page>
    );
  }
  if (!card) {
    return (
      <Page>
        <div className="grid min-h-[50vh] place-items-center">
          <Spinner />
        </div>
      </Page>
    );
  }

  const r = RARITY[card.rarity];
  const rule = rules.rarities[card.rarity];
  const shown = variant === 'shiny' ? { ...card, ...card.shinyStats, shiny: true } : card;
  const showcaseIds = showcase.map((s) => s.copyId);
  const nextRarity = rules.rarities[card.rarity + 1];

  // Une carte n'apparaît qu'une fois en vitrine : épingler un exemplaire remplace un autre exemplaire de la même carte.
  const toggleShowcase = async (copyId) => {
    const others = showcase.filter((s) => s.pageId !== card.pageId).map((s) => s.copyId);
    const ids = showcaseIds.includes(copyId) ? showcaseIds.filter((x) => x !== copyId) : [...others, copyId];
    if (ids.length > 5) {
      toast.push('Ta vitrine est pleine : retire d’abord une carte (5 au maximum).', { kind: 'error' });
      return;
    }
    try {
      const res = await api.setShowcase(ids);
      setShowcase(res.showcase);
      toast.push(showcaseIds.includes(copyId) ? 'Carte retirée de ta vitrine.' : 'Carte ajoutée à ta vitrine.', { color: r.color });
    } catch (e) {
      toast.error(e);
    }
  };

  return (
    <Page>
      <button type="button" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/collection'))} className="mb-5 inline-flex items-center gap-1 text-[14px] text-muted hover:text-text">
        <CaretLeft size={16} weight="bold" /> Retour
      </button>

      <div className="grid gap-8 lg:grid-cols-[minmax(280px,380px)_minmax(0,1fr)] lg:gap-12">
        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="relative mx-auto w-[min(340px,78vw)]">
            <div className="pointer-events-none absolute -inset-10 rounded-full opacity-50 blur-3xl" style={{ background: `radial-gradient(circle, ${shown.shiny ? '#c39bff' : r.color}66, transparent 70%)` }} />
            <WikiCard card={shown} interactive tilt={18} />
          </div>
          <div className="mt-5 flex flex-col items-center gap-3">
            <Segmented
              size="sm"
              value={variant}
              onChange={setVariant}
              options={[
                { value: 'normal', label: 'Normale' },
                {
                  value: 'shiny',
                  label: (
                    <>
                      <Sparkle weight="fill" className="text-[#e6b8ff]" /> Shiny
                    </>
                  ),
                },
              ]}
            />
            <a href={wikiUrl(config.wikiLang, card.pageId)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-muted hover:text-text">
              <ArrowSquareOut size={16} weight="bold" /> Lire l’article sur Wikipédia
            </a>
          </div>
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <RarityTag rarity={card.rarity} shiny={variant === 'shiny'} />
            <TypeTag type={card.type} />
            {card.quality ? (
              <span className="inline-flex h-8 items-center rounded-full bg-[linear-gradient(180deg,#ffe9a6,#ffcf4d)] px-3 text-[12.5px] font-extrabold text-[#5a3d00]">
                ★ {card.quality === 'AdQ' ? 'Article de qualité' : 'Bon article'}
              </span>
            ) : null}
          </div>
          <h1 className="mt-4 font-serif text-[clamp(32px,5vw,52px)] leading-[1.02] font-semibold tracking-[-.015em]">{card.title}</h1>
          {card.description ? <p className="mt-2 font-serif text-[18px] text-muted italic">{card.description}</p> : null}
          {card.extract ? <p className="mt-4 max-w-[68ch] font-serif text-[16px] leading-relaxed text-text/85">{card.extract}</p> : null}

          <div className="mt-7 grid gap-5 sm:grid-cols-2">
            <Panel>
              <div className="flex flex-col gap-5">
                <StatBar
                  label="Attaque"
                  value={shown.atk}
                  range={rule.stat}
                  color={r.color}
                  hint={`Nourrie par la longueur de l’article (${fmtBytes(card.length)})`}
                />
                <StatBar
                  label="Défense"
                  value={shown.def}
                  range={rule.stat}
                  color={r.color}
                  hint={card.langs == null ? 'Nourrie par la qualité de l’article' : `Nourrie par sa qualité : ${fmt(card.langs)} langue${card.langs > 1 ? 's' : ''}${card.quality ? ', labellisé' : ''}`}
                />
                <p className="text-[12px] text-faint">
                  Zone claire : fourchette {rule.label} ({fmt(rule.stat[0])} à {fmt(rule.stat[1])}) pour la meilleure stat.
                </p>
              </div>
            </Panel>
            <div className="grid grid-cols-2 gap-2.5">
              <Fact label="Vues 30 j" value={fmt(card.views30)} sub={nextRarity ? `${fmt(nextRarity.min)} pour ${nextRarity.label}` : 'Rareté maximale'} />
              <Fact label="En circulation" value={fmt(card.totalCopies)} sub={`exemplaire${card.totalCopies > 1 ? 's' : ''} dans le groupe`} />
              <Fact label="Longueur" value={fmtBytes(card.length)} sub="de texte" />
              <Fact label="Langues" value={card.langs == null ? '?' : fmt(card.langs)} sub={card.langs === 1 ? 'édition de Wikipédia' : 'éditions de Wikipédia'} />
              <Fact label="Découverte" value={new Date(card.discoveredAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} sub={new Date(card.discoveredAt).getFullYear()} />
              <Fact label="Numéro" value={`n° ${card.pageId}`} sub={card.wikidata ?? 'page Wikipédia'} />
            </div>
          </div>

          <Panel
            className="mt-5"
            title={
              <span className="inline-flex items-center gap-1.5">
                Vues sur 30 jours
                <InfoTip>Relevées le jour où la carte a été découverte : elles ont fixé sa rareté, qui ne change plus ensuite, même si l’article devient plus ou moins lu.</InfoTip>
              </span>
            }
          >
            <ViewsChart daily={card.daily} color={r.color} endAt={card.discoveredAt} />
          </Panel>

          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <Panel title="Tes exemplaires" aside={<span className="text-[12px] text-faint">{card.myCopies.length || 'aucun'}</span>}>
              {card.myCopies.length ? (
                <ul className="flex flex-col gap-1.5">
                  {card.myCopies.map((c) => (
                    <li key={c.copyId} className="flex flex-wrap items-center gap-2 rounded-2xl bg-white/[.03] px-3 py-2">
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5 font-semibold">
                          Ex. n° {fmt(c.serial)}
                          {c.shiny ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-[linear-gradient(90deg,#ffb3e6,#ffe08a,#a6ffd9,#a6d8ff)] px-1.5 text-[10.5px] font-extrabold text-[#2b1a4a]">
                              <Sparkle weight="fill" /> SHINY
                            </span>
                          ) : null}
                        </span>
                        <span className="block text-[12px] text-faint">
                          {c.giftedBy ? `offert par ${c.giftedBy} · ` : ''}
                          {fmtDate(c.obtainedAt)}
                        </span>
                      </span>
                      <Button size="sm" variant={showcaseIds.includes(c.copyId) ? 'violet' : 'ghost'} onClick={() => toggleShowcase(c.copyId)} aria-pressed={showcaseIds.includes(c.copyId)}>
                        <PushPin size={15} weight={showcaseIds.includes(c.copyId) ? 'fill' : 'bold'} /> Vitrine
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setGiftCopy(c)}>
                        <Gift size={15} weight="bold" /> Offrir
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[13.5px] text-muted">Tu n’as pas encore cette carte. Elle peut sortir de n’importe quel booster de sa famille.</p>
              )}
            </Panel>
            <Panel title="Qui l’a ?" aside={<span className="text-[12px] text-faint">{card.owners.length} joueur{card.owners.length > 1 ? 's' : ''}</span>}>
              {card.owners.length ? (
                <ul className="flex flex-col gap-1">
                  {card.owners.map((o) => (
                    <li key={o.username}>
                      <Link to={`/joueur/${encodeURIComponent(o.username)}`} className="flex items-center gap-3 rounded-2xl px-2 py-1.5 hover:bg-white/[.05]">
                        <Avatar name={o.username} size={32} />
                        <span className="flex-1 font-semibold">
                          {o.username}
                          {o.username === me.username ? <span className="font-normal text-faint"> (toi)</span> : null}
                        </span>
                        <span className="tnum text-[13px] text-muted">
                          ×{o.count}
                          {o.shinies ? <span className="ml-1 text-[#e6b8ff]">· {o.shinies} Shiny</span> : null}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[13.5px] text-muted">Personne pour l’instant.</p>
              )}
            </Panel>
          </div>
        </div>
      </div>

      <GiftModal
        copy={giftCopy}
        card={card}
        onClose={() => setGiftCopy(null)}
        onDone={(res, to) => {
          setGiftCopy(null);
          setStats(res.stats);
          setShowcase(res.showcase);
          toast.push(
            <>
              Tu as offert <b>{card.title}</b> à <b>{to}</b>.
            </>,
            { kind: 'gift', color: r.color, image: card.image },
          );
          load();
        }}
      />
    </Page>
  );
}

function GiftModal({ copy, card, onClose, onDone }) {
  const { me } = useSession();
  const toast = useToast();
  const [players, setPlayers] = useState([]);
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!copy) return;
    setTo('');
    api
      .players()
      .then((d) => setPlayers(d.players.filter((p) => p.username !== me.username)))
      .catch(() => setPlayers([]));
  }, [copy, me.username]);

  const send = async () => {
    setBusy(true);
    try {
      onDone(await api.gift(to, copy.copyId), to);
    } catch (e) {
      toast.error(e);
    }
    setBusy(false);
  };

  return (
    <Modal open={Boolean(copy)} onClose={onClose} className="max-w-[460px] p-6" label="Offrir une carte">
      {copy ? (
        <>
          <h2 className="pr-8 text-[20px] font-extrabold">Offrir « {card.title} »</h2>
          <p className="mt-1 text-[14px] text-muted">
            Exemplaire n° {fmt(copy.serial)}
            {copy.shiny ? ' (Shiny)' : ''}. Il quittera ta collection.
          </p>
          {players.length ? (
            <div className="mt-5 grid max-h-[300px] grid-cols-1 gap-1.5 overflow-y-auto">
              {players.map((p) => (
                <button
                  key={p.username}
                  type="button"
                  onClick={() => setTo(p.username)}
                  aria-pressed={to === p.username}
                  className={`flex items-center gap-3 rounded-2xl border px-3 py-2 text-left transition-colors ${to === p.username ? 'border-gold/60 bg-gold/10' : 'border-line hover:bg-white/[.05]'}`}
                >
                  <Avatar name={p.username} size={32} />
                  <span className="flex-1 font-semibold">{p.username}</span>
                  <span className="text-[12px] text-faint">{fmt(p.unique)} cartes</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="mt-5 rounded-2xl bg-white/[.04] p-4 text-[14px] text-muted">Aucun ami inscrit pour l’instant. Partage le lien du site depuis la page Amis.</p>
          )}
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>
              Annuler
            </Button>
            <Button variant="gold" disabled={!to || busy} onClick={send}>
              <Gift size={18} weight="fill" /> Offrir à {to || '…'}
            </Button>
          </div>
        </>
      ) : null}
    </Modal>
  );
}
