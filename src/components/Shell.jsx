// Coquille : en-tête, navigation (barre du bas sur mobile), recherche ⌘K et toasts du direct.
import { Books, Cards, MagnifyingGlass, Package, SignOut, SpeakerHigh, SpeakerSlash, UsersThree } from '@phosphor-icons/react';
import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { setSound, soundOn } from '../lib/sound.js';
import { useLive, useSession } from '../lib/session.jsx';
import { useToast } from '../lib/toast.jsx';
import { RARITY } from '../lib/visuals.jsx';
import { CommandPalette } from './CommandPalette.jsx';
import { Avatar, Button, Kbd } from './ui.jsx';

export const NAV = [
  { to: '/', label: 'Boosters', Icon: Package, end: true },
  { to: '/collection', label: 'Collection', Icon: Cards },
  { to: '/cartes', label: 'Cartothèque', Icon: Books },
  { to: '/amis', label: 'Amis', Icon: UsersThree },
];

export function Logo({ className = '' }) {
  return (
    <span className={`inline-flex items-center gap-2.5 text-[19px] font-extrabold tracking-[-.02em] ${className}`}>
      <span className="grid h-[30px] w-[22px] -rotate-[8deg] place-items-center rounded-[5px] border-[1.5px] border-gold bg-[linear-gradient(135deg,#2b3a8f,#151a3d)] font-serif text-[14px] font-extrabold text-gold-2 shadow-[0_6px_16px_-6px_rgb(255_197_61/.7)]">
        W
      </span>
      WikiPacks
    </span>
  );
}

function LiveToasts() {
  const { me, refresh } = useSession();
  const toast = useToast();
  useLive('feed', (events) => {
    for (const ev of events) {
      if (ev.user === me?.username) continue;
      const r = ev.card ? RARITY[ev.card.rarity] : null;
      if (ev.type === 'pull') {
        toast.push(
          <>
            <b>{ev.user}</b> vient d’obtenir <b style={{ color: r.color }}>{ev.card.title}</b>
            {ev.shiny ? ' en Shiny' : ''} · {r.label} !
          </>,
          { kind: 'sparkle', color: r.color, image: ev.card.image },
        );
      } else if (ev.type === 'gift' && ev.target === me?.username) {
        toast.push(
          <>
            <b>{ev.user}</b> t’a offert <b style={{ color: r.color }}>{ev.card.title}</b> !
          </>,
          { kind: 'gift', color: r.color, image: ev.card.image, duration: 7000 },
        );
        refresh();
      } else if (ev.type === 'join') {
        toast.push(
          <>
            <b>{ev.user}</b> a rejoint la partie.
          </>,
          { kind: 'join', color: '#7c6cff' },
        );
      }
    }
  });
  return null;
}

export function Shell({ children }) {
  const { me, logout } = useSession();
  const [palette, setPalette] = useState(false);
  const [sound, setSoundState] = useState(soundOn());
  const location = useLocation();

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPalette((p) => !p);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => setPalette(false), [location.pathname]);

  const toggleSound = () => {
    setSound(!sound);
    setSoundState(!sound);
  };

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-line bg-night/80 backdrop-blur-xl max-md:bg-night/95 max-md:backdrop-blur-none">
        <div className="mx-auto flex h-16 max-w-[1320px] items-center gap-3 px-4 sm:px-8">
          <Link to="/" aria-label="WikiPacks, accueil">
            <Logo />
          </Link>
          <nav className="ml-6 hidden items-center gap-1 md:flex" aria-label="Navigation principale">
            {NAV.map(({ to, label, Icon, end }) => (
              <NavLink key={to} to={to} end={end} className="relative">
                {({ isActive }) => (
                  <span className={`relative flex h-10 items-center gap-2 rounded-full px-4 text-[14.5px] font-semibold transition-colors ${isActive ? 'text-text' : 'text-muted hover:text-text'}`}>
                    {isActive ? (
                      <motion.span layoutId="nav-pill" className="absolute inset-0 rounded-full bg-white/[.09]" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />
                    ) : null}
                    <Icon size={18} weight={isActive ? 'fill' : 'regular'} className="relative" />
                    <span className="relative">{label}</span>
                  </span>
                )}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => setPalette(true)}
              className="flex h-10 items-center gap-2 rounded-full border border-line bg-white/[.04] px-3 text-[13.5px] text-faint transition-colors hover:border-line-2 hover:text-text sm:w-56"
              aria-label="Rechercher une carte ou un joueur"
            >
              <MagnifyingGlass size={17} weight="bold" />
              <span className="hidden sm:inline">Rechercher</span>
              <Kbd className="ml-auto hidden sm:inline-flex">⌘K</Kbd>
            </button>
            <Button size="icon" variant="plain" onClick={toggleSound} aria-label={sound ? 'Couper le son' : 'Activer le son'} aria-pressed={sound}>
              {sound ? <SpeakerHigh size={19} weight="bold" /> : <SpeakerSlash size={19} weight="bold" />}
            </Button>
            <Link
              to={`/joueur/${encodeURIComponent(me.username)}`}
              className="flex h-10 items-center gap-2 rounded-full border border-line bg-white/[.04] py-1 pr-1 pl-1 transition-colors hover:border-line-2 sm:pr-3.5"
              title="Mon profil"
            >
              <Avatar name={me.username} size={30} />
              <span className="hidden max-w-[140px] truncate text-[14px] font-semibold sm:inline">{me.username}</span>
            </Link>
            <Button size="icon" variant="plain" onClick={logout} aria-label="Se déconnecter" title="Se déconnecter">
              <SignOut size={19} weight="bold" />
            </Button>
          </div>
        </div>
      </header>

      {children}

      <nav
        className="fixed inset-x-0 bottom-0 z-40 flex justify-around border-t border-line bg-night/95 px-2 pt-1.5 pb-[calc(6px+env(safe-area-inset-bottom))] md:hidden"
        aria-label="Navigation"
      >
        {NAV.map(({ to, label, Icon, end }) => (
          <NavLink key={to} to={to} end={end} className="relative flex-1">
            {({ isActive }) => (
              <span className={`relative mx-auto flex max-w-[92px] flex-col items-center gap-0.5 rounded-2xl py-1.5 text-[11px] font-semibold ${isActive ? 'text-text' : 'text-faint'}`}>
                {isActive ? (
                  <motion.span layoutId="tab-pill" className="absolute inset-0 rounded-2xl bg-white/[.08]" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />
                ) : null}
                <Icon size={23} weight={isActive ? 'fill' : 'regular'} className="relative" />
                <span className="relative">{label}</span>
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <CommandPalette open={palette} onClose={() => setPalette(false)} />
      <LiveToasts />
    </>
  );
}
