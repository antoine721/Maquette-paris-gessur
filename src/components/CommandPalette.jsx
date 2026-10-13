// Recherche globale ⌘K : cartes découvertes, joueurs et raccourcis.
import { ArrowRight, Books, Cards, MagnifyingGlass, Package, UsersThree } from '@phosphor-icons/react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { Pips, RARITY } from '../lib/visuals.jsx';
import { Avatar, Kbd } from './ui.jsx';

const SHORTCUTS = [
  { label: 'Ouvrir un booster', to: '/', Icon: Package },
  { label: 'Ma collection', to: '/collection', Icon: Cards },
  { label: 'Cartothèque du groupe', to: '/cartes', Icon: Books },
  { label: 'Amis et classement', to: '/amis', Icon: UsersThree },
];

export function CommandPalette({ open, onClose }) {
  const [q, setQ] = useState('');
  const [res, setRes] = useState({ cards: [], players: [] });
  const [index, setIndex] = useState(0);
  const navigate = useNavigate();
  const input = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    setQ('');
    setIndex(0);
    const t = setTimeout(() => input.current?.focus(), 30);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    const text = q.trim();
    if (!text) {
      setRes({ cards: [], players: [] });
      return undefined;
    }
    let alive = true;
    const t = setTimeout(async () => {
      try {
        const r = await api.search(text);
        if (alive) setRes(r);
      } catch {
        /* recherche silencieuse */
      }
    }, 140);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q]);

  const items = useMemo(() => {
    const text = q.trim().toLocaleLowerCase('fr');
    const shortcuts = SHORTCUTS.filter((s) => !text || s.label.toLocaleLowerCase('fr').includes(text)).map((s) => ({ kind: 'nav', ...s }));
    return [
      ...res.cards.map((c) => ({ kind: 'card', card: c, to: `/carte/${c.pageId}` })),
      ...res.players.map((p) => ({ kind: 'player', name: p, to: `/joueur/${encodeURIComponent(p)}` })),
      ...shortcuts,
    ];
  }, [res, q]);

  useEffect(() => setIndex(0), [items.length]);

  const go = (item) => {
    if (!item) return;
    navigate(item.to);
    onClose();
  };

  const onKey = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIndex((i) => Math.min(items.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIndex((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      go(items[index]);
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[85] flex items-start justify-center bg-[#05060e]/70 px-3 pt-[12vh] backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(e) => e.target === e.currentTarget && onClose()}
          role="dialog"
          aria-modal="true"
          aria-label="Recherche"
        >
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
            className="w-full max-w-[600px] overflow-hidden rounded-[24px] border border-line-2 bg-[#12152c] shadow-pop"
          >
            <div className="flex items-center gap-3 border-b border-line px-4">
              <MagnifyingGlass size={20} weight="bold" className="text-faint" />
              <input
                ref={input}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={onKey}
                placeholder="Une carte, un joueur…"
                className="h-14 flex-1 bg-transparent text-[16px] outline-none placeholder:text-faint"
                aria-label="Rechercher"
              />
              <Kbd>Échap</Kbd>
            </div>
            <ul className="max-h-[56vh] overflow-y-auto p-2" role="listbox">
              {items.length === 0 ? <li className="px-3 py-6 text-center text-sm text-faint">Aucun résultat parmi les cartes découvertes.</li> : null}
              {items.map((item, i) => (
                <li key={`${item.kind}-${item.to}`} role="option" aria-selected={i === index}>
                  <button
                    type="button"
                    onMouseEnter={() => setIndex(i)}
                    onClick={() => go(item)}
                    className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors ${i === index ? 'bg-white/[.08]' : ''}`}
                  >
                    {item.kind === 'card' ? (
                      <>
                        <img src={item.card.image} alt="" className="h-11 w-9 flex-none rounded-md object-cover" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">{item.card.title}</span>
                          <span className="flex items-center gap-1.5 text-[12.5px]" style={{ color: RARITY[item.card.rarity].color }}>
                            <Pips rarity={item.card.rarity} /> {RARITY[item.card.rarity].label}
                          </span>
                        </span>
                      </>
                    ) : item.kind === 'player' ? (
                      <>
                        <Avatar name={item.name} size={36} />
                        <span className="flex-1 font-semibold">{item.name}</span>
                      </>
                    ) : (
                      <>
                        <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/[.06] text-muted">
                          <item.Icon size={19} />
                        </span>
                        <span className="flex-1 font-semibold">{item.label}</span>
                      </>
                    )}
                    <ArrowRight size={16} className="text-faint" />
                  </button>
                </li>
              ))}
            </ul>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
