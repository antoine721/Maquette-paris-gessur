// Accueil : on choisit son booster dans un carrousel, puis on l'ouvre (×1 ou ×10).
import { CaretLeft, CaretRight, Info, Lightning, Package } from '@phosphor-icons/react';
import { AnimatePresence, motion, useMotionTemplate, useMotionValue, useSpring, useTransform } from 'motion/react';
import { useCallback, useEffect, useState } from 'react';
import { Feed } from '../components/Feed.jsx';
import { OddsModal, RarityLadder } from '../components/Odds.jsx';
import { PackArt } from '../components/PackArt.jsx';
import { Button, CountUp, Kbd, LiveDot, Page, Panel, TypeTag } from '../components/ui.jsx';
import { useSession } from '../lib/session.jsx';
import { Opening } from './Opening.jsx';

const PACK_KEY = 'wp-pack';
const FAST_KEY = 'wp-fast';
const store = {
  get(k, d) {
    try {
      return localStorage.getItem(k) ?? d;
    } catch {
      return d;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* préférence non conservée */
    }
  },
};

function SelectedPack({ pack, onOpen }) {
  const mx = useMotionValue(50);
  const my = useMotionValue(50);
  const sx = useSpring(mx, { stiffness: 150, damping: 16 });
  const sy = useSpring(my, { stiffness: 150, damping: 16 });
  const rotateY = useTransform(sx, [0, 100], [-16, 16]);
  const rotateX = useTransform(sy, [0, 100], [12, -12]);
  const px = useMotionTemplate`${sx}%`;
  const py = useMotionTemplate`${sy}%`;
  return (
    <motion.button
      type="button"
      onClick={onOpen}
      aria-label={`Ouvrir le booster ${pack.label}`}
      className="block w-full"
      style={{ rotateX, rotateY, transformPerspective: 1000, '--px': px, '--py': py }}
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        mx.set(((e.clientX - r.left) / r.width) * 100);
        my.set(((e.clientY - r.top) / r.height) * 100);
      }}
      onPointerLeave={() => {
        mx.set(50);
        my.set(50);
      }}
    >
      <motion.div animate={{ y: [0, -12, 0], rotate: [-1, 1, -1] }} transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}>
        <PackArt pack={pack} />
      </motion.div>
    </motion.button>
  );
}

export default function Boosters() {
  const { me, stats, rules } = useSession();
  const packs = rules.packs;
  const [index, setIndex] = useState(() => Math.max(0, packs.findIndex((p) => p.key === store.get(PACK_KEY, 'encyclopedie'))));
  const [fast, setFast] = useState(() => store.get(FAST_KEY, '0') === '1');
  const [opening, setOpening] = useState(null);
  const [odds, setOdds] = useState(false);
  const pack = packs[index];

  const select = useCallback(
    (i) => {
      const n = (i + packs.length) % packs.length;
      setIndex(n);
      store.set(PACK_KEY, packs[n].key);
    },
    [packs],
  );

  const open = useCallback((count) => setOpening({ key: Date.now(), count, pack: packs[index] }), [packs, index]);

  useEffect(() => {
    if (opening) return undefined;
    const onKey = (e) => {
      if (e.target.closest?.('input, select, textarea, [role="dialog"]')) return;
      if (e.key === 'ArrowRight') select(index + 1);
      else if (e.key === 'ArrowLeft') select(index - 1);
      else if (e.key === ' ' || e.key === 'Enter') {
        if (e.target.closest?.('button, a')) return;
        e.preventDefault();
        open(1);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [opening, index, select, open]);

  const toggleFast = () => {
    setFast((f) => {
      store.set(FAST_KEY, f ? '0' : '1');
      return !f;
    });
  };

  return (
    <Page>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="min-w-0">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="mb-1 text-[12px] font-bold tracking-[.14em] text-faint uppercase">Salut {me.username}</p>
              <h1 className="text-[clamp(28px,4.2vw,40px)] leading-[1.05] font-extrabold tracking-[-.025em]">Choisis ton booster</h1>
              <p className="mt-2 text-muted">Illimité : ouvre-en autant que tu veux, seul ou avec tes amis.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                ['Boosters', stats.packs],
                ['Cartes', stats.total],
                ['Uniques', stats.unique],
                ['Score', stats.score],
              ].map(([label, v]) => (
                <span key={label} className="flex items-baseline gap-1.5 rounded-full border border-line bg-white/[.04] px-3.5 py-1.5 text-[13px] text-muted">
                  {label} <CountUp value={v} className="font-bold text-text" />
                </span>
              ))}
            </div>
          </div>

          {/* Carrousel de boosters */}
          <div className="relative mt-6 overflow-hidden rounded-[32px] border border-line bg-[radial-gradient(circle_at_50%_45%,rgb(120_100_255/.22),transparent_60%)]">
            <div className="dots-bg pointer-events-none absolute inset-0 opacity-50" />
            <motion.div
              className="relative h-[clamp(420px,58vh,560px)] touch-pan-y select-none"
              onPanEnd={(_, info) => {
                if (info.offset.x < -50) select(index + 1);
                else if (info.offset.x > 50) select(index - 1);
              }}
            >
              {packs.map((p, i) => {
                let offset = i - index;
                if (offset > packs.length / 2) offset -= packs.length;
                if (offset < -packs.length / 2) offset += packs.length;
                const abs = Math.abs(offset);
                return (
                  <motion.div
                    key={p.key}
                    className="absolute top-1/2 left-1/2 w-[min(250px,52vw,calc(clamp(420px,58vh,560px)*0.52))]"
                    initial={false}
                    animate={{
                      x: `${-50 + offset * 68}%`,
                      y: '-50%',
                      scale: abs === 0 ? 1 : 0.78 - (abs - 1) * 0.1,
                      rotateY: offset * -24,
                      opacity: abs > 2 ? 0 : abs === 0 ? 1 : 0.6 - (abs - 1) * 0.25,
                      filter: abs === 0 ? 'brightness(1)' : 'brightness(.55) saturate(.8)',
                    }}
                    transition={{ type: 'spring', stiffness: 260, damping: 30 }}
                    style={{ zIndex: 10 - abs, transformPerspective: 1100 }}
                  >
                    {abs === 0 ? (
                      <SelectedPack pack={p} onOpen={() => open(1)} />
                    ) : (
                      <button type="button" className="block w-full" onClick={() => select(i)} aria-label={`Choisir le booster ${p.label}`} tabIndex={abs > 1 ? -1 : 0}>
                        <PackArt pack={p} />
                      </button>
                    )}
                  </motion.div>
                );
              })}
              <Button variant="ghost" size="icon" className="absolute top-1/2 left-3 z-20 -translate-y-1/2 max-sm:hidden" onClick={() => select(index - 1)} aria-label="Booster précédent">
                <CaretLeft size={18} weight="bold" />
              </Button>
              <Button variant="ghost" size="icon" className="absolute top-1/2 right-3 z-20 -translate-y-1/2 max-sm:hidden" onClick={() => select(index + 1)} aria-label="Booster suivant">
                <CaretRight size={18} weight="bold" />
              </Button>
            </motion.div>
          </div>

          <div className="mt-6 flex flex-col items-center gap-4 text-center">
            <div className="flex gap-1.5" role="tablist" aria-label="Boosters">
              {packs.map((p, i) => (
                <button
                  key={p.key}
                  type="button"
                  role="tab"
                  aria-selected={i === index}
                  aria-label={p.label}
                  onClick={() => select(i)}
                  className={`h-2 rounded-full transition-all duration-300 ${i === index ? 'w-6 bg-white' : 'w-2 bg-white/25 hover:bg-white/50'}`}
                />
              ))}
            </div>
            <AnimatePresence mode="wait">
              <motion.div key={pack.key} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}>
                <h2 className="text-[26px] font-extrabold tracking-[-.02em]">{pack.label}</h2>
                <p className="text-muted">{pack.tagline}</p>
                <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                  {(pack.types ?? ['personnalite', 'lieu', 'nature', 'culture', 'sport', 'histoire', 'sciences']).map((t) => (
                    <TypeTag key={t} type={t} size="sm" />
                  ))}
                </div>
              </motion.div>
            </AnimatePresence>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-2.5">
              <Button variant="gold" size="lg" onClick={() => open(1)} className="min-w-[220px]">
                <Package size={21} weight="fill" /> Ouvrir <Kbd>Espace</Kbd>
              </Button>
              <Button variant="violet" size="lg" onClick={() => open(10)}>
                <Lightning size={20} weight="fill" /> Ouvrir ×10
              </Button>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-4 text-[13.5px] text-muted">
              <label className="inline-flex cursor-pointer items-center gap-2.5 select-none">
                <button
                  type="button"
                  role="switch"
                  aria-checked={fast}
                  onClick={toggleFast}
                  className={`relative h-6 w-10 rounded-full border transition-colors ${fast ? 'border-gold/60 bg-gold/30' : 'border-line-2 bg-white/10'}`}
                >
                  <motion.span layout transition={{ type: 'spring', stiffness: 600, damping: 32 }} className={`absolute top-0.5 h-4 w-4 rounded-full ${fast ? 'right-0.5 bg-gold' : 'left-0.5 bg-muted'}`} />
                </button>
                Ouverture rapide
              </label>
              <button type="button" onClick={() => setOdds(true)} className="inline-flex items-center gap-1.5 hover:text-text">
                <Info size={16} weight="bold" /> Taux d’obtention
              </button>
            </div>
          </div>
        </section>

        <aside className="flex min-w-0 flex-col gap-5 lg:sticky lg:top-24 lg:self-start">
          <Panel title="En direct" aside={<LiveDot>amis</LiveDot>}>
            <Feed limit={8} compact />
          </Panel>
          <Panel title="Raretés" aside={<span className="text-[12px] text-faint">part du catalogue</span>}>
            <RarityLadder />
          </Panel>
        </aside>
      </div>

      <OddsModal open={odds} onClose={() => setOdds(false)} />
      <AnimatePresence>
        {opening ? (
          <Opening
            key={opening.key}
            pack={opening.pack}
            count={opening.count}
            fast={fast}
            onClose={() => setOpening(null)}
            onAgain={(count) => setOpening({ key: Date.now(), count, pack: opening.pack })}
          />
        ) : null}
      </AnimatePresence>
    </Page>
  );
}
