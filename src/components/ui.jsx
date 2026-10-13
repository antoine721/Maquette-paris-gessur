// Petits composants d'interface partagés : boutons, pilules, avatar, compteur, modale…
import { Info, X } from '@phosphor-icons/react';
import { AnimatePresence, animate, motion, useInView, useReducedMotion } from 'motion/react';
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { fmt, hueOf } from '../lib/format.js';
import { Pips, RARITY, typeOf } from '../lib/visuals.jsx';

export function Button({ variant = 'ghost', size = 'md', className = '', children, ...rest }) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap transition-[transform,background-color,border-color,box-shadow,opacity] duration-300 ease-out-soft active:scale-[.97] disabled:pointer-events-none disabled:opacity-45 select-none';
  const sizes = {
    sm: 'h-9 px-4 text-[13.5px]',
    md: 'h-11 px-5 text-[14.5px]',
    lg: 'h-14 px-7 text-[16.5px]',
    icon: 'h-10 w-10 text-[15px]',
  };
  const variants = {
    gold: 'text-[#1d1400] bg-[linear-gradient(180deg,#ffe28a,#ffb224)] shadow-[0_10px_34px_-10px_rgb(255_178_36/.7),inset_0_1px_0_rgb(255_255_255/.6)] hover:shadow-[0_14px_42px_-10px_rgb(255_178_36/.85),inset_0_1px_0_rgb(255_255_255/.6)] hover:brightness-105',
    ghost: 'border border-line bg-white/[.045] text-text hover:bg-white/[.08] hover:border-line-2',
    violet: 'text-white bg-[linear-gradient(180deg,#8f80ff,#5b4bff)] shadow-[0_10px_30px_-12px_rgb(110_90_255/.8),inset_0_1px_0_rgb(255_255_255/.3)] hover:brightness-110',
    plain: 'text-muted hover:text-text hover:bg-white/[.06]',
  };
  return (
    <button type="button" className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...rest}>
      {children}
    </button>
  );
}

export function Kbd({ children, className = '' }) {
  return (
    <kbd className={`hidden h-[22px] min-w-[22px] items-center justify-center rounded-md border border-current/25 bg-white/10 px-1.5 font-sans text-[11px] font-semibold opacity-70 [@media(hover:hover)]:inline-flex ${className}`}>
      {children}
    </kbd>
  );
}

export function Avatar({ name, size = 32, online = false, className = '' }) {
  const h = hueOf(name);
  return (
    <span
      className={`relative inline-grid flex-none place-items-center rounded-full font-extrabold text-[#0b0d17] uppercase ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.44, background: `linear-gradient(135deg, hsl(${h} 85% 70%), hsl(${(h + 40) % 360} 70% 48%))` }}
      aria-hidden="true"
    >
      {[...String(name)][0] ?? '?'}
      {online ? <i className="absolute -right-0.5 -bottom-0.5 h-[30%] w-[30%] min-w-2.5 min-h-2.5 rounded-full border-2 border-night bg-ok" /> : null}
    </span>
  );
}

// Chiffre qui s'anime jusqu'à sa valeur quand il apparaît.
export function CountUp({ value, className = '' }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(reduce ? value : 0);
  const from = useRef(0);
  useEffect(() => {
    if (!inView) return undefined;
    if (reduce) {
      setShown(value);
      return undefined;
    }
    const controls = animate(from.current, value, {
      duration: 0.9,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setShown(v),
    });
    from.current = value;
    return () => controls.stop();
  }, [value, inView, reduce]);
  return (
    <span ref={ref} className={`tnum ${className}`}>
      {fmt(shown)}
    </span>
  );
}

export function RarityTag({ rarity, shiny = false, size = 'md', children }) {
  const r = RARITY[rarity];
  const pad = size === 'sm' ? 'h-6 px-2 text-[11px]' : 'h-8 px-3 text-[12.5px]';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-extrabold tracking-[.08em] uppercase ${pad}`}
      style={{ color: r.color, borderColor: `${r.color}66`, background: `${r.color}1f` }}
    >
      <Pips rarity={rarity} className="text-[.95em]" />
      {r.label}
      {shiny ? <span className="ml-0.5 bg-[linear-gradient(90deg,#ff8fd8,#ffd36b,#8affc8,#7cc8ff,#c39bff)] bg-clip-text text-transparent">· Shiny</span> : null}
      {children}
    </span>
  );
}

export function TypeTag({ type, size = 'md' }) {
  const T = typeOf(type);
  const pad = size === 'sm' ? 'h-6 px-2 text-[11.5px]' : 'h-8 px-3 text-[13px]';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${pad}`} style={{ color: T.color, background: `${T.color}1f` }}>
      <T.Icon weight="fill" />
      {T.label}
    </span>
  );
}

// Groupe de pilules avec indicateur animé (filtres, vues).
export function Segmented({ value, onChange, options, className = '', size = 'md' }) {
  const id = useId();
  const h = size === 'sm' ? 'h-8 text-[12.5px]' : 'h-10 text-[13.5px]';
  return (
    <div className={`inline-flex rounded-full border border-line bg-white/[.04] p-1 ${className}`} role="radiogroup">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={o.aria}
            onClick={() => onChange(o.value)}
            className={`relative flex items-center gap-1.5 rounded-full px-3.5 font-semibold transition-colors ${h} ${active ? 'text-text' : 'text-muted hover:text-text'}`}
          >
            {active ? (
              <motion.span layoutId={`seg-${id}`} className="absolute inset-0 rounded-full bg-white/[.1] shadow-[inset_0_1px_0_rgb(255_255_255/.08)]" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />
            ) : null}
            <span className="relative flex items-center gap-1.5">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function Chip({ active, color, onClick, children, className = '' }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-[13px] font-semibold transition-colors ${active ? 'text-text' : 'border-line bg-white/[.035] text-muted hover:border-line-2 hover:text-text'} ${className}`}
      style={active ? { borderColor: `${color ?? '#ffffff'}88`, background: `${color ?? '#ffffff'}22` } : undefined}
    >
      {children}
    </button>
  );
}

// Bulle d'aide « i » sur les notions qui ne vont pas de soi.
export function InfoTip({ children, label = 'En savoir plus' }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button type="button" aria-label={label} onClick={() => setOpen((o) => !o)} onBlur={() => setOpen(false)} className="grid h-6 w-6 place-items-center rounded-full text-faint hover:text-text">
        <Info size={16} weight="bold" />
      </button>
      <AnimatePresence>
        {open ? (
          <motion.span
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15 }}
            role="tooltip"
            className="absolute bottom-full left-1/2 z-50 mb-2 w-64 -translate-x-1/2 rounded-2xl border border-line-2 bg-[#171a33] p-3 text-left text-[12.5px] leading-relaxed font-normal tracking-normal normal-case text-muted shadow-pop"
          >
            {children}
          </motion.span>
        ) : null}
      </AnimatePresence>
    </span>
  );
}

export function Modal({ open, onClose, children, className = '', label }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-[#05060e]/75 p-3 backdrop-blur-md sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(e) => e.target === e.currentTarget && onClose()}
          role="dialog"
          aria-modal="true"
          aria-label={label}
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            className={`relative w-full rounded-[28px] border border-line-2 bg-[linear-gradient(180deg,#161a33,#0f1229)] shadow-pop ${className}`}
          >
            <Button variant="plain" size="icon" className="absolute top-3 right-3 z-10" onClick={onClose} aria-label="Fermer">
              <X size={18} weight="bold" />
            </Button>
            {children}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}

export function EmptyState({ title, children, action }) {
  return (
    <div className="rounded-[28px] border border-dashed border-line-2 px-6 py-16 text-center">
      <h2 className="text-xl font-bold">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-muted">{children}</p>
      {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function PageHeader({ title, sub, eyebrow, children }) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow ? <p className="mb-1.5 text-[11.5px] font-bold tracking-[.12em] text-faint uppercase">{eyebrow}</p> : null}
        <h1 className="text-[clamp(28px,4.2vw,40px)] leading-[1.05] font-extrabold tracking-[-.025em]">{title}</h1>
        {sub ? <p className="mt-2 text-muted">{sub}</p> : null}
      </div>
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  );
}

export function Panel({ title, aside, children, className = '' }) {
  return (
    <section className={`rounded-[26px] border border-line bg-white/[.035] p-4 sm:p-5 ${className}`}>
      {title ? (
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-[16px] font-bold">{title}</h2>
          {aside}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function LiveDot({ children }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-ok">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ok opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-ok" />
      </span>
      {children}
    </span>
  );
}

// Entrée de page : fondu, légère montée et flou qui disparaît.
// filter: none à la fin, sinon la page deviendrait le repère des éléments en position fixe.
export function Page({ children, className = '' }) {
  return (
    <motion.main
      initial={{ opacity: 0, y: 14, filter: 'blur(6px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)', transitionEnd: { filter: 'none' } }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className={`mx-auto w-full max-w-[1320px] px-4 pt-6 pb-28 sm:px-8 sm:pt-9 sm:pb-16 ${className}`}
    >
      {children}
    </motion.main>
  );
}

export function Spinner({ className = '' }) {
  return <span className={`inline-block h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white ${className}`} />;
}
