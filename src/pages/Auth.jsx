// Connexion et création de compte, avec un éventail de cartes en vitrine.
import { motion } from 'motion/react';
import { useState } from 'react';
import { Logo } from '../components/Shell.jsx';
import { WikiCard } from '../components/WikiCard.jsx';
import { Button, Segmented } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { useSession } from '../lib/session.jsx';

const SAMPLES = [
  { pageId: 1, image: '/samples/1.svg', title: 'Origami', description: 'art du pliage du papier', type: 'culture', rarity: 2, atk: 4120, def: 3380 },
  { pageId: 2, image: '/samples/2.svg', title: 'Ada Lovelace', description: 'mathématicienne britannique', type: 'personnalite', rarity: 3, atk: 3712, def: 6950, quality: 'BA' },
  { pageId: 3, image: '/samples/3.svg', title: 'Pyramide de Khéops', description: 'monument de l’Égypte antique', type: 'lieu', rarity: 5, atk: 4967, def: 9934, quality: 'AdQ' },
  { pageId: 4, image: '/samples/4.svg', title: 'Chat', description: 'mammifère carnivore', type: 'nature', rarity: 4, atk: 8410, def: 5120, shiny: true },
  { pageId: 5, image: '/samples/5.svg', title: 'Escargot', description: 'mollusque gastéropode', type: 'nature', rarity: 0, atk: 1240, def: 980 },
];

export default function Auth() {
  const { config, signedIn } = useSession();
  const [mode, setMode] = useState('login');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ username: '', password: '', invite: '' });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.username.trim() || !form.password) {
      setError('Remplis ton pseudo et ton mot de passe.');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'register') await api.register(form.username.trim(), form.password, form.invite);
      else await api.login(form.username.trim(), form.password);
      signedIn(await api.me());
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto grid min-h-dvh max-w-[1240px] items-center gap-10 px-4 py-8 sm:px-8 lg:grid-cols-[1.15fr_1fr]">
      <section>
        <Logo />
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="mt-7 text-[clamp(38px,6.4vw,72px)] leading-[.98] font-extrabold tracking-[-.035em]"
        >
          Chaque article de Wikipédia est une{' '}
          <span className="bg-[linear-gradient(90deg,#ffe28a,#ff9f43,#ff6ad5,#7c6cff)] bg-clip-text text-transparent">carte</span>.
        </motion.h1>
        <p className="mt-4 max-w-[480px] text-[17px] text-muted">
          Ouvre des boosters sans limite, complète ta collection et compare tes trouvailles avec tes amis. Plus un article est lu, plus sa carte est rare.
        </p>
        <div className="relative mt-8 h-[230px] sm:h-[290px]" aria-hidden="true">
          {SAMPLES.map((c, i) => {
            const o = i - 2;
            return (
              <motion.div
                key={c.pageId}
                className="absolute top-0 left-1/2 w-[118px] sm:w-[168px]"
                style={{ zIndex: 5 - Math.abs(o), transformOrigin: '50% 120%' }}
                initial={{ opacity: 0, y: 60, rotate: 0, x: '-50%' }}
                animate={{ opacity: 1, y: Math.abs(o) * 14, rotate: o * 10, x: `${-50 + o * 44}%` }}
                transition={{ type: 'spring', stiffness: 120, damping: 14, delay: 0.15 + i * 0.08 }}
              >
                <WikiCard card={c} interactive tilt={12} />
              </motion.div>
            );
          })}
        </div>
      </section>

      <section className="rounded-[30px] border border-line-2 bg-[linear-gradient(180deg,rgb(26_30_60/.85),rgb(16_19_42/.9))] p-6 shadow-pop sm:p-8">
        <Segmented
          className="mb-6 w-full [&>button]:flex-1 [&>button]:justify-center"
          value={mode}
          onChange={(m) => {
            setMode(m);
            setError('');
          }}
          options={[
            { value: 'login', label: 'Connexion' },
            { value: 'register', label: 'Créer un compte' },
          ]}
        />
        <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-muted">
            Pseudo
            <input
              className="h-12 rounded-2xl border border-line bg-white/[.05] px-4 text-[15px] text-text outline-none transition-colors focus:border-gold/60 focus:bg-white/[.08]"
              autoComplete="username"
              autoCapitalize="off"
              spellCheck="false"
              maxLength={20}
              value={form.username}
              onChange={set('username')}
              autoFocus
            />
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-muted">
            Mot de passe
            <input
              type="password"
              className="h-12 rounded-2xl border border-line bg-white/[.05] px-4 text-[15px] text-text outline-none transition-colors focus:border-gold/60 focus:bg-white/[.08]"
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              value={form.password}
              onChange={set('password')}
            />
          </label>
          {mode === 'register' && config.inviteRequired ? (
            <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-muted">
              Code d’invitation
              <input
                className="h-12 rounded-2xl border border-line bg-white/[.05] px-4 text-[15px] text-text outline-none transition-colors focus:border-gold/60 focus:bg-white/[.08]"
                autoComplete="off"
                value={form.invite}
                onChange={set('invite')}
              />
            </label>
          ) : null}
          <p className="min-h-5 text-[14px] text-danger" role="alert">
            {error}
          </p>
          <Button type="submit" variant="gold" size="lg" disabled={busy}>
            {mode === 'register' ? 'Créer mon compte' : 'Se connecter'}
          </Button>
          <p className="text-center text-[12.5px] text-faint">
            {mode === 'register' ? 'Pseudo de 3 à 20 caractères, mot de passe de 6 caractères minimum.' : 'Pas encore de compte ? Passe sur « Créer un compte ».'}
          </p>
        </form>
      </section>
    </main>
  );
}
