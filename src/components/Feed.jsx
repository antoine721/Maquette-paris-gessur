// Fil d'activité en direct : belles prises, cadeaux, arrivées.
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { ago } from '../lib/format.js';
import { useLive } from '../lib/session.jsx';
import { RARITY } from '../lib/visuals.jsx';
import { Avatar } from './ui.jsx';

export function Feed({ limit = 30, compact = false }) {
  const [events, setEvents] = useState(null);
  const [, tick] = useState(0);

  useEffect(() => {
    let alive = true;
    api
      .feed()
      .then((d) => alive && setEvents(d.events))
      .catch(() => alive && setEvents([]));
    const t = setInterval(() => tick((n) => n + 1), 30000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  useLive('feed', (fresh) => setEvents((list) => [...[...fresh].reverse().map((e) => ({ ...e, fresh: true })), ...(list ?? [])].slice(0, limit)));

  if (!events) return <p className="px-2 py-3 text-sm text-faint">Chargement…</p>;
  if (!events.length) return <p className="px-2 py-3 text-sm text-faint">Rien pour l’instant. Les belles prises de tes amis apparaîtront ici en direct.</p>;

  return (
    <ul className="flex flex-col gap-1">
      <AnimatePresence initial={false}>
        {events.slice(0, limit).map((e) => {
          const r = e.card ? RARITY[e.card.rarity] : null;
          return (
            <motion.li
              key={e.id}
              layout
              initial={{ opacity: 0, x: -12, backgroundColor: 'rgba(255,197,61,.16)' }}
              animate={{ opacity: 1, x: 0, backgroundColor: 'rgba(255,255,255,0)' }}
              transition={{ duration: 0.8 }}
              className="flex items-center gap-3 rounded-2xl p-2"
            >
              <Link to={`/joueur/${encodeURIComponent(e.user)}`} aria-label={`Profil de ${e.user}`}>
                <Avatar name={e.user} size={compact ? 30 : 34} />
              </Link>
              <div className="min-w-0 flex-1 text-[13.5px] leading-snug text-muted">
                <b className="font-semibold text-text">{e.user}</b>{' '}
                {e.type === 'pull' ? (
                  <>
                    a obtenu{' '}
                    <Link to={`/carte/${e.card.pageId}`} className="font-semibold hover:underline" style={{ color: r.color }}>
                      {e.card.title}
                    </Link>
                    {e.shiny ? <span className="font-bold text-[#e6b8ff]"> en Shiny</span> : null}
                  </>
                ) : e.type === 'gift' ? (
                  <>
                    a offert{' '}
                    <Link to={`/carte/${e.card.pageId}`} className="font-semibold hover:underline" style={{ color: r.color }}>
                      {e.card.title}
                    </Link>{' '}
                    à <b className="font-semibold text-text">{e.target}</b>
                  </>
                ) : (
                  'a rejoint la partie'
                )}
                <span className="block text-[12px] text-faint">
                  {r && e.type === 'pull' ? <span style={{ color: r.color }}>{r.label} · </span> : null}
                  {ago(e.at)}
                </span>
              </div>
              {e.card ? (
                <Link to={`/carte/${e.card.pageId}`} className="flex-none" tabIndex={-1} aria-hidden="true">
                  <img src={e.card.image} alt="" className="h-12 w-9 rounded-md object-cover" style={{ boxShadow: `0 0 0 2px ${r.color}` }} />
                </Link>
              ) : null}
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ul>
  );
}
