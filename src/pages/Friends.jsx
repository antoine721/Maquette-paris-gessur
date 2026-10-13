// Amis : podium, classement, fil en direct et lien d'invitation.
import { Copy, Crown, Sparkle } from '@phosphor-icons/react';
import { motion } from 'motion/react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Feed } from '../components/Feed.jsx';
import { WikiCard } from '../components/WikiCard.jsx';
import { Avatar, Button, InfoTip, LiveDot, Page, PageHeader, Panel, Spinner } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { fmt } from '../lib/format.js';
import { useLive, useSession } from '../lib/session.jsx';
import { useToast } from '../lib/toast.jsx';
import { Pips, RARITY } from '../lib/visuals.jsx';

const MEDALS = ['#ffd23f', '#d6dce8', '#e0975a'];

function Podium({ players, online }) {
  const order = [1, 0, 2].filter((i) => players[i]);
  return (
    <div className="flex items-end justify-center gap-2 sm:gap-4">
      {order.map((i) => {
        const p = players[i];
        const top = p.showcase[0] ?? p.bestCard;
        return (
          <motion.div
            key={p.username}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20, delay: 0.1 + (i === 0 ? 0.2 : 0) }}
            className={`w-[32%] max-w-[230px] ${i === 0 ? 'order-2' : i === 1 ? 'order-1' : 'order-3'}`}
          >
            <Link
              to={`/joueur/${encodeURIComponent(p.username)}`}
              className="relative flex flex-col items-center rounded-[24px] border border-line bg-white/[.035] px-2 pt-6 text-center transition-colors hover:bg-white/[.06] sm:px-4"
              style={{
                paddingBottom: [28, 16, 8][i],
                boxShadow: i === 0 ? `0 0 0 1px ${MEDALS[0]}55, 0 20px 60px -30px ${MEDALS[0]}` : undefined,
              }}
            >
              <span className="absolute -top-3.5 grid h-7 w-7 place-items-center rounded-full text-[13px] font-extrabold text-[#1d1400]" style={{ background: MEDALS[i] }}>
                {i === 0 ? <Crown size={15} weight="fill" /> : i + 1}
              </span>
              <Avatar name={p.username} size={i === 0 ? 64 : 52} online={online.includes(p.username)} />
              <b className="mt-2 max-w-full truncate text-[15px]">{p.username}</b>
              <span className="tnum text-[22px] font-extrabold sm:text-[26px]" style={{ color: MEDALS[i] }}>
                {fmt(p.score)}
              </span>
              <span className="text-[11.5px] text-faint">points · {fmt(p.unique)} cartes</span>
              <div className={`mt-3 ${i === 0 ? 'w-[min(124px,25vw)]' : 'w-[min(100px,21vw)]'}`}>
                {top ? (
                  <WikiCard card={top} />
                ) : (
                  <div className="grid aspect-[63/88] place-items-center rounded-[10px] border-2 border-dashed border-line-2 text-[11px] text-faint">aucune carte</div>
                )}
              </div>
            </Link>
          </motion.div>
        );
      })}
    </div>
  );
}

export default function Friends() {
  const { me, online, invite } = useSession();
  const toast = useToast();
  const [players, setPlayers] = useState(null);

  const load = useCallback(() => {
    api
      .players()
      .then((d) => setPlayers(d.players))
      .catch((e) => toast.error(e));
  }, [toast]);
  useEffect(load, [load]);
  useLive('feed', load);

  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.push('Copié !', { duration: 2000 });
    } catch {
      toast.push(text);
    }
  };

  return (
    <Page>
      <PageHeader eyebrow="Amis" title="Classement" sub="Qui a la plus belle collection ? Les belles prises s’affichent en direct." />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          {!players ? (
            <div className="grid min-h-[30vh] place-items-center">
              <Spinner />
            </div>
          ) : (
            <>
              {players.length ? <Podium players={players} online={online} /> : null}
              <Panel
                title={
                  <span className="inline-flex items-center gap-1.5">
                    Tous les joueurs
                    <InfoTip>Score : chaque carte unique rapporte selon sa rareté (1, 3, 10, 30, 100, 400 points), et chaque Shiny unique compte double.</InfoTip>
                  </span>
                }
                aside={<LiveDot>{online.length} en ligne</LiveDot>}
              >
                <ol className="flex flex-col gap-1">
                  {players.map((p, i) => (
                    <li key={p.username}>
                      <Link
                        to={`/joueur/${encodeURIComponent(p.username)}`}
                        className={`grid grid-cols-[28px_auto_1fr_auto] items-center gap-3 rounded-2xl border px-3 py-2.5 transition-[background-color,transform] duration-300 hover:translate-x-1 hover:bg-white/[.05] ${p.username === me.username ? 'border-gold/35 bg-gold/[.04]' : 'border-transparent'}`}
                      >
                        <span className="text-center text-[15px] font-extrabold" style={{ color: MEDALS[i] ?? '#6c7392' }}>
                          {i + 1}
                        </span>
                        <Avatar name={p.username} size={36} online={online.includes(p.username)} />
                        <span className="min-w-0">
                          <b className="block truncate text-[15px]">
                            {p.username}
                            {p.username === me.username ? <span className="font-normal text-faint"> (toi)</span> : null}
                          </b>
                          <span className="flex flex-wrap items-center gap-x-2.5 text-[12px] text-faint">
                            {fmt(p.unique)} cartes · {fmt(p.packs)} boosters
                            {[5, 4, 3].map((r) =>
                              p.byRarity[r] ? (
                                <span key={r} className="inline-flex items-center gap-1 text-muted" title={RARITY[r].label}>
                                  <span style={{ color: RARITY[r].color }} className="text-[10px]">
                                    <Pips rarity={r} />
                                  </span>
                                  {p.byRarity[r]}
                                </span>
                              ) : null,
                            )}
                            {p.shinies ? (
                              <span className="inline-flex items-center gap-1 text-muted">
                                <Sparkle weight="fill" className="text-[#e6b8ff]" /> {p.shinies}
                              </span>
                            ) : null}
                          </span>
                        </span>
                        <span className="tnum text-right text-[16px] font-extrabold">
                          {fmt(p.score)}
                          <span className="block text-[11px] font-normal text-faint">points</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ol>
              </Panel>
            </>
          )}
          <Panel title="Invite tes amis">
            <p className="text-[14px] text-muted">
              Envoie-leur l’adresse du site{invite ? ' et le code d’invitation' : ''}. Chacun crée son compte et ouvre autant de boosters qu’il veut.
            </p>
            <div className="mt-3 flex flex-col gap-2">
              {[location.origin, invite].filter(Boolean).map((text) => (
                <div key={text} className="flex gap-2">
                  <code className="min-w-0 flex-1 truncate rounded-2xl border border-line bg-black/25 px-3.5 py-2.5 text-[13px]">{text}</code>
                  <Button size="md" variant="ghost" onClick={() => copy(text)}>
                    <Copy size={16} weight="bold" /> Copier
                  </Button>
                </div>
              ))}
            </div>
          </Panel>
        </div>
        <aside className="min-w-0 lg:sticky lg:top-24 lg:self-start">
          <Panel title="En direct" aside={<LiveDot>amis</LiveDot>}>
            <Feed limit={30} />
          </Panel>
        </aside>
      </div>
    </Page>
  );
}
