// La carte : cadre de rareté, illustration Wikipédia, statistiques et reflets holographiques.
import { Sparkle } from '@phosphor-icons/react';
import { motion, useMotionTemplate, useMotionValue, useSpring, useTransform } from 'motion/react';
import { memo, useRef, useState } from 'react';
import { fmt, hueOf } from '../lib/format.js';
import { Pips, RARITY, typeOf } from '../lib/visuals.jsx';

const SPRING = { stiffness: 170, damping: 18, mass: 0.6 };

function Art({ card }) {
  const [broken, setBroken] = useState(false);
  if (!card.image || broken) {
    const initial = [...card.title.replace(/^(L’|L'|Le |La |Les )/i, '')][0] ?? '?';
    const h = hueOf(card.title);
    return (
      <div
        className="grid h-full w-full place-items-center"
        style={{ background: `radial-gradient(circle at 30% 22%, hsl(${h} 85% 72%), hsl(${h} 55% 38%) 60%, hsl(${(h + 30) % 360} 60% 20%))` }}
      >
        <span className="font-serif text-[30cqw] font-extrabold leading-none text-white/90 drop-shadow-lg">{initial.toUpperCase()}</span>
      </div>
    );
  }
  return <img src={card.image} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" draggable="false" onError={() => setBroken(true)} />;
}

function Front({ card }) {
  const r = card.rarity;
  const T = typeOf(card.type);
  const full = r >= 4;
  return (
    <div className="wcard-face wcard-front" style={{ paddingBottom: '7cqw' }}>
      <div className="wcard-panel">
        <div className="wcard-head">
          <h3 className="wcard-title">{card.title}</h3>
          <span className="wcard-type" style={{ '--tc': T.color }} title={T.label}>
            <T.Icon weight="fill" />
          </span>
        </div>
        <div className="wcard-art">
          <Art card={card} />
          {r === 2 && !card.shiny && <div className="art-holo" />}
          {card.shiny && !full ? (
            <span className="shiny-tag">
              <Sparkle weight="fill" /> SHINY
            </span>
          ) : null}
        </div>
        <div className="wcard-body" style={full ? undefined : { flex: 1 }}>
          <div className="wcard-sub">
            <Pips rarity={r} className="wcard-pips" />
            <span className="wcard-desc">{card.description || 'article de Wikipédia'}</span>
          </div>
          {card.extract ? <p className="wcard-text">{card.extract}</p> : null}
          <div className="wcard-foot">
            <div className="wcard-stats">
              <span className="wcard-stat">
                <small>ATK</small>
                <b className="tnum">{fmt(card.atk)}</b>
              </span>
              <span className="wcard-stat">
                <small>DEF</small>
                <b className="tnum">{fmt(card.def)}</b>
              </span>
            </div>
            <div className="wcard-meta">
              {card.quality ? <span className="wcard-quality">★ {card.quality === 'AdQ' ? 'Qualité' : 'Bon article'}</span> : null}
              <span>{card.serial ? `Ex. n° ${fmt(card.serial)}` : `n° ${card.pageId}`}</span>
            </div>
          </div>
        </div>
      </div>
      {card.shiny && full ? (
        <span className="shiny-tag">
          <Sparkle weight="fill" /> SHINY
        </span>
      ) : null}
      <div className="wcard-rarity">{RARITY[r].label}</div>
      {r >= 3 || card.shiny ? <div className="holo" /> : null}
      <div className="glare" />
    </div>
  );
}

export function Back() {
  return (
    <div className="wcard-face wcard-back">
      <div className="wcard-back-inner">
        <span className="wcard-back-top">ENCYCLOPÉDIE</span>
        <div className="wcard-emblem">
          <b>W</b>
        </div>
        <span className="wcard-back-name">WIKIPACKS</span>
      </div>
    </div>
  );
}

/**
 * card        données de la carte (ou de l'exemplaire : serial, shiny)
 * interactive inclinaison 3D et reflets qui suivent le pointeur
 * faceDown    si défini, la carte a un dos et se retourne quand la valeur change
 */
// Halo pulsé derrière une carte encore face cachée : une grande rareté se trahit.
export function Aura({ color }) {
  return (
    <motion.div
      aria-hidden="true"
      className="pointer-events-none absolute -inset-[24%] rounded-full"
      style={{ background: `radial-gradient(closest-side, ${color} 0%, ${color}aa 45%, ${color}33 70%, transparent 100%)` }}
      initial={{ opacity: 0 }}
      animate={{ opacity: [0.5, 1, 0.5] }}
      transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
    />
  );
}

export const WikiCard = memo(function WikiCard({ card, interactive = false, tilt = 14, faceDown, className = '', style, children }) {
  const mx = useMotionValue(50);
  const my = useMotionValue(50);
  const hyp = useMotionValue(0);
  const sx = useSpring(mx, SPRING);
  const sy = useSpring(my, SPRING);
  const sh = useSpring(hyp, SPRING);
  const rotateY = useTransform(sx, [0, 100], [-tilt, tilt]);
  const rotateX = useTransform(sy, [0, 100], [tilt, -tilt]);
  const px = useMotionTemplate`${sx}%`;
  const py = useMotionTemplate`${sy}%`;
  const ref = useRef(null);

  const move = (e) => {
    const rect = ref.current.getBoundingClientRect();
    const x = Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100));
    mx.set(x);
    my.set(y);
    hyp.set(Math.min(1, Math.hypot(x - 50, y - 50) / 50));
  };
  const leave = () => {
    mx.set(50);
    my.set(50);
    hyp.set(0);
  };

  const hasBack = faceDown !== undefined;
  return (
    <motion.div
      ref={ref}
      className={`wcard rc-${card.rarity} ${className}`}
      data-r={card.rarity}
      data-shiny={card.shiny ? 'true' : 'false'}
      data-full={card.rarity >= 4 ? 'true' : 'false'}
      onPointerMove={interactive ? move : undefined}
      onPointerLeave={interactive ? leave : undefined}
      onPointerCancel={interactive ? leave : undefined}
      style={{
        rotateX: interactive ? rotateX : 0,
        rotateY: interactive ? rotateY : 0,
        transformPerspective: 900,
        '--px': px,
        '--py': py,
        '--hyp': sh,
        ...style,
      }}
    >
      <motion.div
        className="wcard-flip"
        initial={hasBack ? { rotateY: faceDown ? 180 : 0 } : false}
        animate={hasBack ? { rotateY: faceDown ? 180 : 0 } : undefined}
        transition={{ type: 'spring', stiffness: 110, damping: 15, mass: 0.9 }}
      >
        <Front card={card} />
        {hasBack ? <Back /> : null}
      </motion.div>
      {children}
    </motion.div>
  );
});
