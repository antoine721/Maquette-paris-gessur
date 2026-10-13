// Ouverture d'un booster, à la manière du TCG Pocket :
// on découpe le haut du paquet en glissant le doigt, les cartes en sortent,
// on les retourne une à une (les grandes raretés se font désirer), puis on les fait glisser.
import { ArrowsClockwise, Cards, HandSwipeRight, Lightning, X } from '@phosphor-icons/react';
import { AnimatePresence, motion, useAnimate } from 'motion/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { PackArt } from '../components/PackArt.jsx';
import { Aura, WikiCard } from '../components/WikiCard.jsx';
import { Button, Kbd, RarityTag, TypeTag, useScrollLock } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { burstFor, celebrate, reducedMotion } from '../lib/fx.js';
import { useSession } from '../lib/session.jsx';
import { sfx } from '../lib/sound.js';
import { RARITY } from '../lib/visuals.jsx';

const CARD_W = 'min(300px, 72vw, calc((100dvh - 270px) * 0.716))';
const CUT_THRESHOLD = 0.62;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Espace et Entrée pilotent l'ouverture, sauf quand le focus est sur un contrôle (bouton, champ…).
const onControl = (e) => Boolean(e.target.closest?.('button, a, input, textarea, select, [contenteditable="true"]'));

// Plus une carte est rare, plus elle arrive tard (un Shiny compte comme une demi-rareté de plus).
const weight = (c) => c.rarity + (c.shiny ? 0.5 : 0);
const isBig = (c) => c.rarity >= 3 || c.shiny;

function Banner({ card }) {
  if (!card) return null;
  const text = card.shiny ? 'Shiny !' : card.rarity >= 5 ? 'Légendaire !' : card.rarity === 4 ? 'Ultra rare !' : 'Super rare !';
  const colors = card.shiny ? ['#ffd3f2', '#7cc8ff'] : [RARITY[card.rarity].glow, RARITY[card.rarity].color];
  return (
    <motion.div
      key={card.copyId}
      initial={{ opacity: 0, scaleY: 0 }}
      animate={{ opacity: [0, 1, 1, 0], scaleY: [0, 1, 1, 0.4] }}
      transition={{ duration: 2, times: [0, 0.12, 0.78, 1], ease: 'easeOut' }}
      className="pointer-events-none absolute inset-x-0 top-[38%] z-40 border-y py-3 text-center"
      style={{
        borderColor: `${colors[1]}66`,
        background: 'linear-gradient(90deg, transparent, rgb(8 8 20 / .82) 18%, rgb(8 8 20 / .82) 82%, transparent)',
      }}
    >
      <motion.span
        initial={{ scale: 1.5, letterSpacing: '0.4em', opacity: 0 }}
        animate={{ scale: 1, letterSpacing: '0.08em', opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="banner-text inline-block text-[clamp(30px,7vw,60px)] leading-tight font-extrabold uppercase"
        style={{ '--c1': colors[0], '--c2': colors[1], filter: `drop-shadow(0 4px 18px ${colors[1]}aa)` }}
      >
        {text}
      </motion.span>
    </motion.div>
  );
}

// ---------- Étape 1 : découper le booster ----------
function PackStage({ pack, count, torn, leaving, onStart, onCut }) {
  const ref = useRef(null);
  const drag = useRef(null);
  const [cut, setCut] = useState({ from: 0, to: 0, active: false });
  const [hint, setHint] = useState(true);
  const done = useRef(false);

  const finish = useCallback(() => {
    if (done.current) return;
    done.current = true;
    onCut();
  }, [onCut]);

  const rel = (e) => {
    const r = ref.current.getBoundingClientRect();
    return Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
  };
  const down = (e) => {
    if (torn) return;
    onStart();
    setHint(false);
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const x = rel(e);
    drag.current = { start: x, last: x };
    setCut({ from: x, to: x, active: true });
  };
  const move = (e) => {
    if (!drag.current || done.current) return;
    const x = rel(e);
    if (Math.abs(x - drag.current.last) > 0.04) {
      sfx.cut(Math.abs(x - drag.current.start));
      drag.current.last = x;
    }
    setCut({ from: drag.current.start, to: x, active: true });
    if (Math.abs(x - drag.current.start) >= CUT_THRESHOLD) finish();
  };
  const up = () => {
    if (!drag.current) return;
    drag.current = null;
    if (!done.current) setCut((c) => ({ ...c, to: c.from, active: false }));
  };

  // Ouverture au clavier ou au bouton : la lame balaie la ligne toute seule.
  const auto = useCallback(async () => {
    if (done.current || torn) return;
    onStart();
    setHint(false);
    for (let x = 0; x <= 1.0001; x += 0.1) {
      setCut({ from: 0.02, to: Math.min(0.98, x), active: true });
      if (x > 0.3 && x < 0.32) sfx.cut(x);
      await wait(22);
    }
    finish();
  }, [finish, onStart, torn]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.key === ' ' || e.key === 'Enter') && !onControl(e)) {
        e.preventDefault();
        auto();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [auto]);

  const left = Math.min(cut.from, cut.to) * 100;
  const width = Math.abs(cut.to - cut.from) * 100;

  return (
    <motion.div
      className="relative flex flex-col items-center gap-8"
      animate={leaving ? { y: '70%', opacity: 0, scale: 0.92 } : { y: 0, opacity: 1, scale: 1 }}
      transition={leaving ? { duration: 0.6, ease: [0.5, 0, 0.75, 0] } : { type: 'spring', stiffness: 200, damping: 22 }}
    >
      <motion.div
        ref={ref}
        className="relative touch-none select-none"
        style={{ width: 'min(280px, 64vw, calc((100dvh - 300px) * 0.625))', cursor: torn ? 'default' : 'crosshair' }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        animate={torn && !leaving ? { x: [0, -6, 6, -4, 4, 0], rotate: [0, -1.5, 1.5, -1, 1, 0] } : { y: [0, -10, 0] }}
        transition={torn && !leaving ? { duration: 0.5 } : { duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      >
        {count > 1
          ? [2, 1].map((d) => (
              <PackArt
                key={d}
                pack={pack}
                className="!absolute inset-0 opacity-60"
                style={{ transform: `translate(${d * 10}px, ${-d * 8}px) rotate(${d * 3}deg)`, filter: 'brightness(.6)' }}
              />
            ))
          : null}
        <PackArt
          pack={pack}
          top={{
            animate: torn ? { x: 120, y: -170, rotate: -38, opacity: 0 } : { x: 0, y: 0, rotate: 0, opacity: 1 },
            transition: { duration: 0.7, ease: [0.2, 0.7, 0.3, 1] },
          }}
        >
          {/* Ligne de découpe et lame lumineuse */}
          <div className="absolute inset-x-[4%] top-[12%] z-[4] h-0 border-t-2 border-dashed border-white/55" />
          <motion.div
            className="absolute top-[12%] z-[5] h-[3px] -translate-y-1/2 rounded-full bg-white"
            style={{
              left: `${left}%`,
              width: `${width}%`,
              boxShadow: '0 0 10px 3px #fff, 0 0 32px 10px rgb(255 220 140 / .9), 0 0 70px 24px rgb(255 190 110 / .5)',
            }}
            animate={{ opacity: cut.active || torn ? 1 : 0 }}
          />
          {torn ? (
            <motion.div
              className="pointer-events-none absolute inset-x-[-20%] top-[-60%] z-[2] h-[75%]"
              initial={{ opacity: 0, scaleY: 0.2 }}
              animate={{ opacity: [0, 1, 0.75], scaleY: 1 }}
              transition={{ duration: 0.7 }}
              style={{ transformOrigin: '50% 100%', background: 'radial-gradient(60% 100% at 50% 100%, rgb(255 236 180 / .95), rgb(255 200 120 / .35) 45%, transparent 75%)' }}
            />
          ) : null}
          {count > 1 ? (
            <span className="absolute -top-3 -right-3 z-[6] grid h-12 w-12 place-items-center rounded-full bg-[linear-gradient(180deg,#ffe28a,#ffb224)] text-[17px] font-extrabold text-[#1d1400] shadow-lg">
              ×{count}
            </span>
          ) : null}
        </PackArt>
        <AnimatePresence>
          {hint && !torn ? (
            <motion.div
              className="pointer-events-none absolute top-[12%] left-0 z-[6] text-white drop-shadow-[0_4px_10px_rgb(0_0_0/.6)]"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 1, 0], x: ['0%', '0%', '230%', '230%'] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 2.2, repeat: Infinity, repeatDelay: 0.6, times: [0, 0.15, 0.8, 1] }}
            >
              <HandSwipeRight size={44} weight="fill" className="-translate-y-1" />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </motion.div>
      <AnimatePresence>
        {!torn ? (
          <motion.div className="flex flex-col items-center gap-3" exit={{ opacity: 0, y: 10 }}>
            <p className="text-center text-[14.5px] text-muted">Glisse le doigt sur la ligne pour découper le booster</p>
            <Button variant="ghost" onClick={auto}>
              Ouvrir sans découper <Kbd>Espace</Kbd>
            </Button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}

// ---------- Étape 2 : la pile, carte par carte ----------
function StackCard({ card, index, depth, isTop, revealed, onReveal, onThrow, entering, tapRef }) {
  const [scope, animate] = useAnimate();
  const busy = useRef(false);

  const tap = async () => {
    if (!isTop || busy.current) return;
    if (revealed) {
      onThrow(-1);
      return;
    }
    busy.current = true;
    await onReveal(scope.current, animate);
    busy.current = false;
  };
  // Le clavier passe par la même action que le toucher.
  if (isTop) tapRef.current = tap;

  return (
    <motion.div
      className="absolute inset-0"
      style={{ zIndex: 100 - depth }}
      initial={entering ? { y: '55%', opacity: 0, scale: 0.85 } : false}
      animate={{
        y: depth * 9,
        scale: 1 - Math.min(depth, 4) * 0.035,
        rotate: depth === 0 ? 0 : (index % 2 ? 1.6 : -1.6) * Math.min(depth, 2),
        opacity: depth > 3 ? 0 : 1,
        transition: entering ? { delay: index * 0.07, type: 'spring', stiffness: 160, damping: 18 } : { type: 'spring', stiffness: 260, damping: 26 },
      }}
      exit={(dir) => ({
        x: (dir || -1) * Math.max(window.innerWidth * 0.75, 420),
        rotate: (dir || -1) * 26,
        opacity: 0,
        transition: { duration: 0.42, ease: [0.5, 0, 0.75, 0] },
      })}
      drag={isTop && revealed ? 'x' : false}
      dragSnapToOrigin
      dragElastic={0.6}
      onDragEnd={(_, info) => {
        if (Math.abs(info.offset.x) > 90 || Math.abs(info.velocity.x) > 500) onThrow(Math.sign(info.offset.x || info.velocity.x));
      }}
      onTap={tap}
    >
      <div ref={scope} className="relative h-full w-full" style={{ cursor: isTop ? 'pointer' : 'default' }}>
        {!revealed && isTop && (card.rarity >= 2 || card.shiny) ? <Aura color={card.shiny ? '#d6a8ff' : RARITY[card.rarity].color} /> : null}
        <WikiCard card={card} faceDown={!revealed} interactive={revealed && isTop} tilt={10} />
      </div>
    </motion.div>
  );
}

function RevealStage({ cards, onDone, setMood }) {
  const [current, setCurrent] = useState(0);
  const [revealed, setRevealed] = useState(() => cards.map(() => false));
  const [dir, setDir] = useState(-1);
  const [banner, setBanner] = useState(null);
  const [entering, setEntering] = useState(true);
  // Tant que la révélation joue (effets compris), la carte ne peut pas être jetée.
  const busy = useRef(false);

  useEffect(() => {
    const t = setTimeout(() => setEntering(false), 900);
    return () => clearTimeout(t);
  }, []);

  const reveal = useCallback(
    async (el, animate) => {
      const card = cards[current];
      const big = isBig(card);
      busy.current = true;
      if (big && !reducedMotion()) {
        sfx.tease(card.rarity);
        setMood({ dim: true, color: card.shiny ? '#c39bff' : RARITY[card.rarity].color });
        const long = card.rarity >= 5 || card.shiny;
        await animate(
          el,
          { rotate: [0, -2, 2, -3, 3, -2, 0], scale: [1, 1.03, 1.05, 1.06, 1.08, 1.09, 1.1] },
          { duration: long ? 1.15 : 0.7, ease: 'easeIn' },
        );
      }
      sfx.flip();
      setRevealed((r) => r.map((v, i) => (i === current ? true : v)));
      await wait(reducedMotion() ? 0 : 260);
      const rect = el.getBoundingClientRect();
      sfx.reveal(card.rarity, card.shiny);
      burstFor(rect, card.rarity, card.shiny);
      if (card.rarity >= 5 || card.shiny) celebrate(card.rarity, card.shiny);
      if (card.rarity >= 3 || card.shiny) setBanner(card);
      setMood({ dim: false, flash: big, rays: card.rarity >= 3 || card.shiny, color: card.shiny ? '#c39bff' : RARITY[card.rarity].color });
      animate(el, { scale: [big ? 1.1 : 1.04, 1] }, { type: 'spring', stiffness: 260, damping: 14 });
      busy.current = false;
    },
    [cards, current, setMood],
  );

  const next = useCallback(
    (direction) => {
      if (!revealed[current] || busy.current) return;
      sfx.whoosh();
      setDir(direction);
      setBanner(null);
      setMood({ dim: false, rays: false, color: null });
      if (current + 1 >= cards.length) {
        setCurrent(current + 1);
        setTimeout(onDone, 380);
      } else {
        setCurrent(current + 1);
      }
    },
    [cards.length, current, onDone, revealed, setMood],
  );

  // Clavier : Espace/Entrée retourne puis fait passer la carte.
  const tapRef = useRef(null);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== ' ' && e.key !== 'Enter' && e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      if (onControl(e)) return;
      e.preventDefault();
      if (!revealed[current]) tapRef.current?.();
      else next(e.key === 'ArrowRight' ? 1 : -1);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [current, next, revealed]);

  const card = cards[current];
  return (
    <div className="flex flex-col items-center gap-6">
      <div className="relative" style={{ width: CARD_W, aspectRatio: '63 / 88' }}>
        <AnimatePresence custom={dir}>
          {cards.map((c, i) =>
            i < current ? null : (
              <StackCard
                key={c.copyId}
                card={c}
                index={i}
                depth={i - current}
                isTop={i === current}
                revealed={revealed[i]}
                entering={entering}
                onReveal={reveal}
                onThrow={next}
                tapRef={tapRef}
              />
            ),
          )}
        </AnimatePresence>
      </div>
      <div className="flex min-h-[72px] flex-col items-center gap-3">
        <AnimatePresence mode="wait">
          {card && revealed[current] ? (
            <motion.div key={`i${current}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="flex flex-wrap items-center justify-center gap-2">
              <RarityTag rarity={card.rarity} shiny={card.shiny} />
              <TypeTag type={card.type} />
              <span className={`inline-flex h-8 items-center rounded-full px-3 text-[12.5px] font-bold ${card.isNew ? 'bg-gold text-[#1d1400]' : 'bg-white/10 text-muted'}`}>
                {card.isNew ? 'NOUVELLE' : `Doublon · ×${card.count}`}
              </span>
            </motion.div>
          ) : card ? (
            <motion.p key={`h${current}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-[14px] text-muted">
              Touche la carte pour la retourner
            </motion.p>
          ) : null}
        </AnimatePresence>
        <div className="flex gap-2" aria-label={`Carte ${Math.min(current + 1, cards.length)} sur ${cards.length}`}>
          {cards.map((c, i) => (
            <span
              key={c.copyId}
              className="h-2 w-2 rounded-full transition-all duration-300"
              style={{
                background: revealed[i] ? (c.shiny ? '#c39bff' : RARITY[c.rarity].color) : i === current ? 'rgb(255 255 255 / .7)' : 'rgb(255 255 255 / .16)',
                transform: i === current ? 'scale(1.5)' : 'none',
                boxShadow: revealed[i] ? `0 0 10px ${RARITY[c.rarity].color}` : 'none',
              }}
            />
          ))}
        </div>
        {card && revealed[current] ? <p className="text-[12.5px] text-faint">Glisse la carte ou touche-la pour passer</p> : null}
      </div>
      <AnimatePresence>{banner ? <Banner card={banner} /> : null}</AnimatePresence>
    </div>
  );
}

// ---------- Étape 3 : le récapitulatif ----------
function SummaryCard({ card, flipDelay, big, onOpen }) {
  const [faceDown, setFaceDown] = useState(flipDelay != null);
  const ref = useRef(null);
  useEffect(() => {
    if (flipDelay == null) return undefined;
    const t = setTimeout(() => {
      setFaceDown(false);
      sfx.flip();
      if (card.rarity >= 2 || card.shiny) {
        setTimeout(() => ref.current && burstFor(ref.current.getBoundingClientRect(), card.rarity, card.shiny), 220);
      }
    }, flipDelay);
    return () => clearTimeout(t);
  }, [flipDelay, card]);
  return (
    <motion.button
      ref={ref}
      type="button"
      onClick={() => onOpen(card)}
      initial={{ opacity: 0, y: 30, scale: 0.85 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 220, damping: 20, delay: (flipDelay ?? 0) / 1000 / 3 }}
      className={`relative block ${big ? 'w-[min(200px,40vw)]' : 'w-full'}`}
      aria-label={`${card.title}, ${RARITY[card.rarity].label}`}
    >
      {card.isNew ? (
        <span className="absolute -bottom-2.5 left-1/2 z-10 -translate-x-1/2 rounded-full bg-[linear-gradient(180deg,#ffe28a,#ffb224)] px-2 py-0.5 text-[10px] font-extrabold tracking-wide text-[#1d1400] shadow-lg">
          NOUVELLE
        </span>
      ) : (
        <span className="absolute -bottom-2.5 left-1/2 z-10 -translate-x-1/2 rounded-full border border-line-2 bg-[#23284a] px-2 py-0.5 text-[10px] font-bold text-muted">×{card.count}</span>
      )}
      <WikiCard card={card} faceDown={flipDelay != null ? faceDown : undefined} interactive tilt={16} />
    </motion.button>
  );
}

function Summary({ packs, count, animateFlip, onAgain, onClose }) {
  const navigate = useNavigate();
  const all = useMemo(() => packs.flat(), [packs]);
  const sorted = useMemo(() => [...all].sort((a, b) => weight(b) - weight(a)), [all]);
  const best = all.reduce((m, c) => Math.max(m, c.rarity), 0);
  const anyShiny = all.some((c) => c.shiny);
  const fresh = all.filter((c) => c.isNew).length;
  const open = (c) => {
    onClose();
    navigate(`/carte/${c.pageId}`);
  };
  const title = anyShiny ? 'Un Shiny !' : ['Booster ouvert', 'Booster ouvert', 'Joli booster !', 'Superbe booster !', 'Ultra rare !', 'Un Légendaire !'][best];
  const counts = RARITY.map((_, r) => all.filter((c) => c.rarity === r).length);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.key === ' ' || e.key === 'Enter') && !onControl(e)) {
        e.preventDefault();
        onAgain(count);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onAgain, count]);

  const highlights = count > 1 ? sorted.filter(isBig).slice(0, 6) : [];

  return (
    <motion.div className="flex w-full max-w-[1100px] flex-col items-center gap-7 px-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="text-center">
        <h2 className="text-[clamp(24px,4vw,34px)] font-extrabold tracking-[-.02em]">{title}</h2>
        <p className="mt-1 text-muted">
          {count > 1 ? `${count} boosters · ` : ''}
          {fresh} nouvelle{fresh > 1 ? 's' : ''} carte{fresh > 1 ? 's' : ''}
          {all.length - fresh ? ` · ${all.length - fresh} doublon${all.length - fresh > 1 ? 's' : ''}` : ''}
        </p>
        {count > 1 ? (
          <div className="mt-3 flex flex-wrap justify-center gap-1.5">
            {counts.map((n, r) =>
              n ? (
                <span key={r} className="rounded-full px-2.5 py-1 text-[12px] font-bold" style={{ color: RARITY[r].color, background: `${RARITY[r].color}1f` }}>
                  {n} {RARITY[r].label}
                </span>
              ) : null,
            )}
          </div>
        ) : null}
      </div>

      {count === 1 ? (
        <div className="grid w-full max-w-[1000px] grid-cols-6 gap-3 sm:grid-cols-5 sm:gap-5">
          {all.map((c, i) => (
            <div key={c.copyId} className={`col-span-2 sm:col-span-1 ${i === 3 ? 'max-sm:col-start-2' : ''}`}>
              <SummaryCard card={c} flipDelay={animateFlip ? 350 + i * 160 : null} onOpen={open} />
            </div>
          ))}
        </div>
      ) : (
        <>
          {highlights.length ? (
            <div className="w-full">
              <p className="mb-3 text-center text-[12px] font-bold tracking-[.14em] text-faint uppercase">Meilleures prises</p>
              <div className="flex flex-wrap justify-center gap-4">
                {highlights.map((c, i) => (
                  <SummaryCard key={c.copyId} card={c} big flipDelay={300 + i * 260} onOpen={open} />
                ))}
              </div>
            </div>
          ) : null}
          <div className="grid w-full grid-cols-4 gap-2.5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10">
            {sorted.map((c) => (
              <SummaryCard key={c.copyId} card={c} onOpen={open} />
            ))}
          </div>
        </>
      )}

      <div className="sticky bottom-0 z-20 -mx-3 flex w-[calc(100%+24px)] flex-wrap justify-center gap-2.5 bg-[linear-gradient(0deg,#05060d_55%,transparent)] px-3 pt-10 pb-4">
        <Button variant="gold" size="lg" onClick={() => onAgain(count)}>
          <ArrowsClockwise size={20} weight="bold" /> Encore {count > 1 ? `×${count}` : ''} <Kbd>Espace</Kbd>
        </Button>
        <Button variant="ghost" size="lg" onClick={() => onAgain(count > 1 ? 1 : 10)}>
          <Lightning size={19} weight="fill" /> {count > 1 ? 'Un seul' : '×10'}
        </Button>
        <Button
          variant="ghost"
          size="lg"
          onClick={() => {
            onClose();
            navigate('/collection');
          }}
        >
          <Cards size={19} /> Collection
        </Button>
      </div>
    </motion.div>
  );
}

// ---------- L'écran complet ----------
export function Opening({ pack, count = 1, fast = false, onClose, onAgain }) {
  const { setStats } = useSession();
  const [phase, setPhase] = useState('cut');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [mood, setMood] = useState({ dim: false, rays: false, color: null, flash: false });
  const request = useRef(null);
  const flashKey = useRef(0);

  const start = useCallback(() => {
    if (!request.current) {
      request.current = api.openPacks(pack.key, count).then(
        (r) => {
          setStats(r.stats);
          setResult(r);
          return r;
        },
        (e) => {
          setError(e);
          throw e;
        },
      );
      request.current.catch(() => {});
    }
    return request.current;
  }, [pack.key, count, setStats]);

  const onCut = useCallback(async () => {
    sfx.tear();
    setPhase('torn');
    try {
      await Promise.all([start(), wait(reducedMotion() ? 100 : 750)]);
    } catch {
      return;
    }
    if (count > 1 || fast) {
      setPhase('leaving');
      await wait(450);
      setPhase('summary');
      return;
    }
    sfx.whoosh();
    setPhase('deal');
    await wait(reducedMotion() ? 50 : 700);
    setPhase((p) => (p === 'deal' ? 'reveal' : p));
  }, [start, count, fast]);

  const cards = useMemo(() => (result && count === 1 ? [...result.packs[0]].sort((a, b) => weight(a) - weight(b)) : []), [result, count]);

  useScrollLock(true);
  const root = useRef(null);
  useEffect(() => {
    // Le focus entre dans l'écran d'ouverture : Espace n'active plus le bouton resté derrière.
    root.current?.focus({ preventScroll: true });
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const changeMood = useCallback((m) => {
    if (m.flash) flashKey.current += 1;
    setMood((old) => ({ ...old, ...m }));
  }, []);

  const showPack = phase === 'cut' || phase === 'torn' || phase === 'deal' || phase === 'leaving';
  const moodColor = mood.color ?? '#7c6cff';

  return createPortal(
    <motion.div
      ref={root}
      tabIndex={-1}
      className="fixed inset-0 z-[70] overflow-y-auto overflow-x-hidden bg-[#05060d]/[.97] outline-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-label={`Ouverture du booster ${pack.label}`}
    >
      {/* Ambiance : halo, rayons et voile qui suivent la rareté */}
      <div className="pointer-events-none fixed inset-0 grid place-items-center">
        <div className="dots-bg absolute inset-0 opacity-40" />
        <motion.div
          className="absolute h-[620px] w-[620px] rounded-full"
          animate={{ opacity: mood.dim ? 0.25 : 0.6, background: `radial-gradient(circle, ${moodColor}77, transparent 65%)` }}
          transition={{ duration: 0.6 }}
        />
        <motion.div
          className="rays absolute h-[1300px] w-[1300px]"
          style={{ '--ray': `${moodColor}45` }}
          animate={{ opacity: mood.rays ? 1 : 0 }}
          transition={{ duration: 0.8 }}
        />
        <motion.div className="absolute inset-0 bg-black" animate={{ opacity: mood.dim ? 0.55 : 0 }} transition={{ duration: 0.4 }} />
        <AnimatePresence>
          {mood.flash ? (
            <motion.div
              key={flashKey.current}
              className="absolute inset-0"
              style={{ background: `radial-gradient(circle at 50% 45%, ${moodColor}, transparent 70%)` }}
              initial={{ opacity: 0.85 }}
              animate={{ opacity: 0 }}
              transition={{ duration: 0.9 }}
              onAnimationComplete={() => setMood((m) => ({ ...m, flash: false }))}
            />
          ) : null}
        </AnimatePresence>
      </div>

      <div className="relative flex min-h-full flex-col">
        <div className="sticky top-0 z-50 flex items-center justify-between p-3 sm:p-5">
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fermer">
            <X size={19} weight="bold" />
          </Button>
          <p className="text-[13px] font-bold tracking-[.14em] text-faint uppercase">
            {pack.label}
            {count > 1 ? ` · ×${count}` : ''}
          </p>
          <span className="w-10" />
        </div>

        <div className="flex flex-1 items-center justify-center px-3 pt-2 pb-10">
          {error ? (
            <div className="flex flex-col items-center gap-4 text-center">
              <p className="max-w-sm text-muted">{error.message}</p>
              <Button variant="gold" onClick={() => onAgain(count)}>
                Réessayer
              </Button>
            </div>
          ) : (
            <div className="relative grid w-full place-items-center">
              {phase === 'deal' || phase === 'reveal' ? (
                <div className="col-start-1 row-start-1">
                  <RevealStage cards={cards} setMood={changeMood} onDone={() => setPhase('summary')} />
                </div>
              ) : null}
              {showPack && phase !== 'reveal' ? (
                <div className={`col-start-1 row-start-1 ${phase === 'cut' ? '' : 'pointer-events-none'}`} style={{ zIndex: phase === 'deal' ? 200 : 1 }}>
                  <PackStage
                    pack={pack}
                    count={count}
                    torn={phase !== 'cut'}
                    leaving={phase === 'deal' || phase === 'leaving'}
                    onStart={start}
                    onCut={onCut}
                  />
                </div>
              ) : null}
              {phase === 'summary' && result ? (
                <Summary packs={result.packs} count={count} animateFlip={count === 1 ? fast : true} onAgain={onAgain} onClose={onClose} />
              ) : null}
            </div>
          )}
        </div>
      </div>
    </motion.div>,
    document.body,
  );
}
