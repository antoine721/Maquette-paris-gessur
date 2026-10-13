// Connexion et création de compte.
import { api } from '../api.js';
import { cardHTML } from '../card.js';
import { $, esc } from '../ui.js';

const SAMPLES = [
  { pageId: 681159, title: 'Origami', description: 'art du pliage du papier', rarity: 1, atk: 2350, def: 3150, extract: 'L’origami est l’art du pliage du papier.' },
  { pageId: 1563, title: 'Ada Lovelace', description: 'mathématicienne britannique', rarity: 3, atk: 2900, def: 3550, extract: 'Pionnière de la science informatique.' },
  { pageId: 4087, title: 'Pyramide de Khéops', description: 'monument de l’Égypte antique', rarity: 4, atk: 3500, def: 3500, extract: 'La grande pyramide de Gizeh.' },
  { pageId: 4220, title: 'Chat', description: 'mammifère carnivore', rarity: 2, atk: 3650, def: 3950, extract: 'Le chat domestique.' },
  { pageId: 230115, title: 'Escargot', description: 'mollusque gastéropode', rarity: 0, atk: 1950, def: 3050, extract: 'Escargot est un nom vernaculaire.' },
];

export function mountAuth(root, { config, onLoggedIn }) {
  let mode = 'login';
  const fan = SAMPLES.map((c, i) => cardHTML(c).replace('class="card ', `style="--i:${i - 2};--ai:${Math.abs(i - 2)}" class="card `)).join('');

  root.innerHTML = `
    <main class="auth">
      <section class="auth-hero">
        <span class="logo"><span class="logo-mark">W</span>WikiPacks</span>
        <h1>Chaque article de Wikipédia est une <em>carte</em>.</h1>
        <p>Ouvre des boosters sans limite, complète ta collection et compare tes trouvailles avec tes amis. Plus un article est lu, plus sa carte est rare.</p>
        <div class="auth-fan" aria-hidden="true">${fan}</div>
      </section>
      <section class="auth-box">
        <div class="tabs" role="tablist">
          <button type="button" role="tab" data-mode="login" aria-selected="true">Connexion</button>
          <button type="button" role="tab" data-mode="register" aria-selected="false">Créer un compte</button>
        </div>
        <form class="form" novalidate>
          <label>Pseudo<input class="field" name="username" autocomplete="username" required minlength="3" maxlength="20" autocapitalize="off" spellcheck="false" data-autofocus></label>
          <label>Mot de passe<input class="field" name="password" type="password" autocomplete="current-password" required minlength="6"></label>
          <label data-invite hidden>Code d’invitation<input class="field" name="invite" autocomplete="off" spellcheck="false"></label>
          <p class="form-error" data-error role="alert"></p>
          <button class="btn btn-primary btn-lg" type="submit" data-submit>Se connecter</button>
          <p class="form-note" data-note>Pas encore de compte ? Passe sur « Créer un compte ».</p>
        </form>
      </section>
    </main>`;

  const form = $('form', root);
  const error = $('[data-error]', root);
  const submit = $('[data-submit]', root);

  function setMode(m) {
    mode = m;
    root.querySelectorAll('[data-mode]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.mode === m)));
    $('[data-invite]', root).hidden = !(m === 'register' && config.inviteRequired);
    form.password.autocomplete = m === 'register' ? 'new-password' : 'current-password';
    submit.textContent = m === 'register' ? 'Créer mon compte' : 'Se connecter';
    $('[data-note]', root).textContent =
      m === 'register' ? 'Pseudo de 3 à 20 caractères, mot de passe de 6 caractères minimum.' : 'Pas encore de compte ? Passe sur « Créer un compte ».';
    error.textContent = '';
  }
  root.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    error.textContent = '';
    const username = form.username.value.trim();
    const password = form.password.value;
    if (!username || !password) {
      error.textContent = 'Remplis ton pseudo et ton mot de passe.';
      return;
    }
    submit.disabled = true;
    try {
      const data = mode === 'register' ? await api.register(username, password, form.invite.value) : await api.login(username, password);
      onLoggedIn(data);
    } catch (err) {
      error.innerHTML = esc(err.message);
      submit.disabled = false;
    }
  });

  requestAnimationFrame(() => form.username.focus());
}
