# WikiPacks

Chaque article de Wikipédia est une carte. On ouvre des boosters **sans limite**, on complète sa collection et on compare ses trouvailles avec ses amis, en direct.

Inspiré de WikiMasters (mêmes raretés, mêmes seuils, mêmes fourchettes d'attaque et de défense), avec une ouverture de booster à la manière du Pokémon TCG Pocket et une base de cartes façon Futbin.

## Ce qu'on peut faire

- **Comptes** : pseudo et mot de passe, code d'invitation facultatif pour réserver le site à ses amis.
- **Six boosters** dans un carrousel 3D : Encyclopédie (tout Wikipédia), Personnalités, Tour du monde, Règne vivant, Pop culture, Savoirs. Ouverture ×1 ou ×10, aucune limite.
- **Ouverture façon TCG Pocket** : on découpe le haut du paquet en glissant le doigt, les cartes sortent, on les retourne une à une (une grande rareté brille avant d'être retournée, puis rayons, confettis et bandeau), et on les fait glisser pour passer à la suivante. Mode « ouverture rapide » pour enchaîner.
- **Cartes** : illustration de l'article, famille, pastilles de rareté, ATK et DEF, label « Article de qualité » ou « Bon article ». Ultra rares et Légendaires en illustration pleine carte, reflets holographiques qui suivent le doigt, version **Shiny** arc-en-ciel.
- **Collection** et **Cartothèque** : les cartes découvertes par le groupe, ou **tout Wikipédia** (chaque article illustré est une carte possible, avec aperçu même s'il n'a jamais été tiré). Filtres par rareté et famille, recherche, tri, vue grille ou tableau.
- **Fiche carte** : statistiques, courbe des vues sur 30 jours, exemplaires numérotés, qui la possède, lien vers l'article.
- **Amis** : podium et classement, fil en direct (belles prises, cadeaux), toasts quand un ami tire une Légendaire, cadeau d'un exemplaire à un ami.
- **Profil** : statistiques, répartition des raretés, **vitrine** de 5 cartes.
- Recherche globale **⌘K**, sons synthétisés (coupables), responsive jusqu'au téléphone, `prefers-reduced-motion` respecté.

## Les règles (comme WikiMasters)

| Rareté | Vues de l'article sur 30 jours | Part du catalogue | Meilleure stat |
|---|---|---|---|
| Commune | moins de 50 | 50,25 % | 0 à 2 000 |
| Peu commune | 50 et plus | 20 % | 1 500 à 3 500 |
| Rare | 250 et plus | 20 % | 3 000 à 5 500 |
| Super rare | 1 000 et plus | 7 % | 5 000 à 7 500 |
| Ultra rare | 5 000 et plus | 2,5 % | 7 000 à 9 000 |
| Légendaire | 20 000 et plus | 0,25 % | 8 500 à 10 000 |

- La rareté et les statistiques d'une carte sont **figées au premier tirage**, pour tout le groupe.
- La plus haute des deux statistiques tombe dans la fourchette de la rareté, l'autre vaut au moins la moitié. L'attaque suit la longueur de l'article, la défense sa qualité (nombre de langues, label).
- Un booster contient 5 cartes : les 4 premières suivent les proportions du catalogue, la 5ᵉ est toujours Rare ou mieux (70 % Rare, 22 % Super rare, 7 % Ultra rare, 1 % Légendaire).
- Chaque carte a 2 % de chances d'être **Shiny** : sa meilleure stat passe au-dessus de la fourchette (de 10 001 à 15 000 pour une Légendaire).
- Chaque exemplaire est distinct et porte un numéro de série. Le score compte chaque carte unique selon sa rareté (1, 3, 10, 30, 100, 400 points), un Shiny unique compte double.

Tous ces réglages sont regroupés dans [`server/cards.js`](server/cards.js).

## Tout Wikipédia dans la base

Au démarrage, le serveur **indexe tout Wikipédia** en tâche de fond ([`server/indexer.js`](server/indexer.js)) :

- il parcourt chaque article par ordre alphabétique (API `generator=allpages`), 50 à la fois, une requête après l'autre avec une courte pause et le paramètre `maxlag`, comme le demandent les règles d'usage de Wikimedia ;
- pour chaque article il garde : titre, image, description, identifiant Wikidata, famille, longueur, nombre de langues, label de qualité, vues sur 30 jours et donc rareté. Les pages d'homonymie sont écartées ; le texte d'introduction n'est chargé qu'au premier tirage d'une carte ;
- l'avancement est sauvegardé après chaque lot : un redémarrage reprend là où il s'était arrêté. Un nouveau passage a lieu tous les 30 jours pour rafraîchir la popularité ;
- tant que le premier passage n'est pas terminé, les boosters sont tirés directement dans Wikipédia ; ensuite, chaque carte est tirée dans tout l'index.

Wikipédia en français compte environ 2,7 millions d'articles. À ce rythme, un passage complet prend de l'ordre de deux jours et la table `articles` pèse quelques centaines de mégaoctets. L'avancement est visible dans **Cartothèque → Tout Wikipédia**. On peut aussi indexer sans lancer le site : `npm run index` (Ctrl+C pour mettre en pause, relancer pour reprendre).

## Lancer le jeu

Il faut **Node 22.13 ou plus récent** (la base de données utilise le module SQLite intégré à Node).

```bash
npm install
npm run build      # construit l'interface dans dist/
npm start          # http://localhost:3000, vrai Wikipédia
```

Pour développer :

```bash
npm run dev        # interface sur http://localhost:5173, Wikipédia simulé (hors ligne)
WIKI_MOCK=0 npm run dev   # même chose avec le vrai Wikipédia
npm test           # 35 tests (règles, tirages, indexation, API)
npm run index      # indexer tout Wikipédia sans lancer le site
```

### Variables d'environnement

| Variable | Rôle | Défaut |
|---|---|---|
| `PORT` | port du serveur | `3000` |
| `DATA_DIR` | dossier de la base SQLite (à garder entre deux redémarrages) | `./data` |
| `INVITE_CODE` | code demandé à l'inscription ; vide = inscription libre | vide |
| `WIKI_LANG` | édition de Wikipédia utilisée | `fr` |
| `WIKI_USER_AGENT` | identification envoyée à Wikimedia (mets-y un moyen de te contacter) | WikiPacks + lien du repo |
| `WIKI_MOCK` | `1` pour un faux Wikipédia hors ligne | vide |
| `WIKI_INDEX` | `0` pour ne pas indexer tout Wikipédia | vide (indexation active) |
| `WIKI_INDEX_PAUSE_MS` | pause entre deux lots de 50 articles | `300` |

## Jouer avec ses amis : mettre le site en ligne

Le serveur garde les comptes et les collections dans un fichier SQLite : il faut un hébergeur avec un **disque persistant**.

**Render, gratuit** (pour essayer) : le fichier [`render.yaml`](render.yaml) configure tout.
1. Crée un compte sur [render.com](https://render.com) avec ton compte GitHub.
2. **New → Blueprint**, choisis ce dépôt (autorise l'accès à Render si GitHub le demande), puis **Apply**.
3. Attends la fin du premier déploiement (quelques minutes) : le lien `https://wikipacks-xxxx.onrender.com` s'affiche en haut du service.

Limites de l'offre gratuite : le site s'endort après 15 minutes sans visite (premier chargement d'environ une minute ensuite) et, sans disque permanent, **les comptes et les collections sont effacés à chaque redémarrage ou mise à jour**. L'indexation complète de Wikipédia y est donc coupée. Pour garder les données, passe le service sur une offre payante avec un disque monté sur `/data` (`DATA_DIR=/data`), ou utilise Railway.

**Railway** (données conservées) :
1. Nouveau projet depuis ce dépôt GitHub. Railway détecte Node, lance `npm run build` puis `npm start`.
2. Ajoute un **Volume** monté sur `/data`.
3. Variables : `DATA_DIR=/data`, et `INVITE_CODE=un-code-secret` pour que seuls tes amis puissent s'inscrire.
4. Génère un domaine public et envoie le lien (et le code) à tes amis.

**N'importe quel hébergeur Docker** (Fly.io, VPS…) :

```bash
docker build -t wikipacks .
docker run -p 3000:3000 -v wikipacks-data:/data -e INVITE_CODE=un-code-secret wikipacks
```

Pour une soirée entre amis sur le même Wi-Fi, `npm start` sur ton ordinateur suffit : les autres ouvrent `http://<ton-ip-locale>:3000`.

## Renommer le dépôt

Le nom du dépôt se change sur GitHub : **Settings → General → Repository name**, par exemple `wikipacks`. GitHub redirige l'ancienne adresse ; en local, mets à jour le remote avec `git remote set-url origin https://github.com/antoine721/wikipacks.git`.

L'ancienne maquette Guessr Group reste dans l'historique git (commit `a16f7b3`).

## Organisation du code

```
server/            API Node sans dépendance (node:http, node:sqlite, node:crypto)
  cards.js         règles : raretés, stats, Shiny, familles, boosters
  wiki.js          client de l'API Wikipédia et des statistiques Wikimedia
  packs.js         fabrique de boosters (index complet, ou réserves d'articles mesurés)
  indexer.js       indexation de tout Wikipédia en tâche de fond
  db.js            schéma SQLite et migrations, requêtes
  app.js           routes HTTP, sessions, flux en direct (Server-Sent Events)
  mock-wiki.js     faux Wikipédia pour jouer et tester hors ligne
src/               interface React 19 + Vite + Tailwind CSS 4 + motion
  components/      carte holographique, booster, navigateur de cartes, graphiques…
  pages/           boosters, ouverture, collection, cartothèque, fiche carte, amis, profil
test/              tests node:test
```

Seules les pages Wikipédia **illustrées** deviennent des cartes ; les pages d'homonymie sont écartées. Chaque carte stocke son image, sa description Wikidata, l'introduction de l'article, son identifiant Wikidata, sa longueur, son nombre de langues, son label de qualité et ses vues quotidiennes.
