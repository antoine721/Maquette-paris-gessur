// Stockage SQLite (module node:sqlite intégré à Node 22, aucune dépendance).
// Le schéma évolue par migrations numérotées (PRAGMA user_version).
import { DatabaseSync } from 'node:sqlite';
import { RARITIES, scoreOf, shinyStats, statsFor } from './cards.js';

const MIGRATIONS = [
  // 1 : schéma initial.
  `
  CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE CHECK (length(username) BETWEEN 3 AND 20),
    password_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );
  CREATE INDEX sessions_user ON sessions (user_id);

  -- Une carte = un article de Wikipédia, figé au premier tirage.
  CREATE TABLE cards (
    page_id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    extract TEXT NOT NULL DEFAULT '',
    image TEXT NOT NULL,
    image_width INTEGER,
    image_height INTEGER,
    wikidata TEXT CHECK (wikidata IS NULL OR wikidata GLOB 'Q[0-9]*'),
    type TEXT NOT NULL,
    rarity INTEGER NOT NULL CHECK (rarity BETWEEN 0 AND 5),
    atk INTEGER NOT NULL CHECK (atk >= 0),
    def INTEGER NOT NULL CHECK (def >= 0),
    views30 INTEGER NOT NULL DEFAULT 0 CHECK (views30 >= 0),
    daily_views TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(daily_views)),
    length INTEGER NOT NULL DEFAULT 0,
    langs INTEGER,
    quality TEXT CHECK (quality IN ('AdQ', 'BA')),
    created_at INTEGER NOT NULL
  );
  CREATE INDEX cards_rarity ON cards (rarity, views30 DESC);
  CREATE INDEX cards_type ON cards (type);

  CREATE TABLE packs (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    theme TEXT NOT NULL,
    opened_at INTEGER NOT NULL
  );
  CREATE INDEX packs_user ON packs (user_id);

  -- Chaque exemplaire est distinct : numéro de série par carte, Shiny ou non.
  CREATE TABLE copies (
    id INTEGER PRIMARY KEY,
    card_id INTEGER NOT NULL REFERENCES cards(page_id),
    owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    serial INTEGER NOT NULL CHECK (serial > 0),
    shiny INTEGER NOT NULL DEFAULT 0 CHECK (shiny IN (0, 1)),
    pack_id INTEGER REFERENCES packs(id) ON DELETE SET NULL,
    gifted_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    obtained_at INTEGER NOT NULL,
    UNIQUE (card_id, serial)
  );
  CREATE INDEX copies_owner ON copies (owner_id, card_id);

  -- Vitrine : jusqu'à 5 exemplaires mis en avant sur le profil.
  CREATE TABLE showcase (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    slot INTEGER NOT NULL CHECK (slot BETWEEN 1 AND 5),
    copy_id INTEGER NOT NULL UNIQUE REFERENCES copies(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, slot)
  );

  CREATE TABLE events (
    id INTEGER PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('pull', 'gift', 'join')),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    card_id INTEGER REFERENCES cards(page_id),
    copy_id INTEGER REFERENCES copies(id) ON DELETE SET NULL,
    shiny INTEGER NOT NULL DEFAULT 0 CHECK (shiny IN (0, 1)),
    created_at INTEGER NOT NULL
  );
  `,
  // 2 : index de tout Wikipédia (un article par ligne, sans le texte) et état de l'indexation.
  `
  CREATE TABLE articles (
    page_id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    image TEXT,
    image_width INTEGER,
    image_height INTEGER,
    wikidata TEXT CHECK (wikidata IS NULL OR wikidata GLOB 'Q[0-9]*'),
    type TEXT NOT NULL,
    length INTEGER NOT NULL DEFAULT 0,
    langs INTEGER,
    quality TEXT CHECK (quality IN ('AdQ', 'BA')),
    views30 INTEGER NOT NULL DEFAULT 0 CHECK (views30 >= 0),
    rarity INTEGER NOT NULL CHECK (rarity BETWEEN 0 AND 5),
    indexed_at INTEGER NOT NULL
  );
  -- Tirage : seuls les articles illustrés deviennent des cartes.
  CREATE INDEX articles_draw ON articles (rarity, type, page_id) WHERE image IS NOT NULL;
  CREATE INDEX articles_popular ON articles (rarity, views30 DESC) WHERE image IS NOT NULL;
  CREATE INDEX articles_title ON articles (title COLLATE NOCASE);

  CREATE TABLE meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL CHECK (json_valid(value))
  );
  `,
];

// Le prototype précédent n'a jamais été déployé : ses tables sont simplement remplacées.
const PROTOTYPE_TABLES = ['owned', 'events', 'cards', 'sessions', 'users'];

function migrate(db) {
  const version = db.prepare('PRAGMA user_version').get().user_version;
  if (version === 0 && db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'owned'").get()) {
    db.exec('PRAGMA foreign_keys = OFF');
    for (const t of PROTOTYPE_TABLES) db.exec(`DROP TABLE IF EXISTS ${t}`);
    db.exec('PRAGMA foreign_keys = ON');
  }
  for (let v = version; v < MIGRATIONS.length; v++) {
    db.exec('BEGIN');
    try {
      db.exec(MIGRATIONS[v]);
      db.exec(`PRAGMA user_version = ${v + 1}`);
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  }
}

const CARD_COLUMNS = `c.page_id, c.title, c.description, c.image, c.image_width, c.image_height, c.wikidata,
  c.type, c.rarity, c.atk, c.def, c.views30, c.length, c.langs, c.quality, c.created_at`;

function toCard(row, { full = false } = {}) {
  if (!row) return null;
  const card = {
    pageId: row.page_id,
    title: row.title,
    description: row.description,
    image: row.image,
    imageWidth: row.image_width,
    imageHeight: row.image_height,
    wikidata: row.wikidata,
    type: row.type,
    rarity: row.rarity,
    atk: row.atk,
    def: row.def,
    views30: row.views30,
    length: row.length,
    langs: row.langs,
    quality: row.quality,
    discoveredAt: row.created_at,
  };
  if (full) {
    card.extract = row.extract;
    card.daily = JSON.parse(row.daily_views || '[]');
  }
  return card;
}

// Un exemplaire tel qu'on l'affiche : un Shiny montre ses statistiques boostées.
export function copyView(card, { copyId, serial, shiny }) {
  const stats = shiny ? shinyStats(card, card.rarity) : { atk: card.atk, def: card.def };
  return { ...card, ...stats, copyId, serial, shiny: Boolean(shiny) };
}

// Chaque tri finit par page_id pour un ordre stable d'une page de résultats à l'autre.
const SORTS = {
  rarity: 'c.rarity DESC, c.views30 DESC, c.page_id',
  recent: 'c.created_at DESC, c.page_id DESC',
  views: 'c.views30 DESC, c.page_id',
  atk: 'MAX(c.atk, c.def) DESC, c.page_id',
  alpha: 'c.title COLLATE NOCASE ASC, c.page_id',
  copies: 'copies DESC, c.rarity DESC, c.page_id',
};

export function openDb(file) {
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  migrate(db);

  const q = {
    createUser: db.prepare('INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)'),
    userByName: db.prepare('SELECT * FROM users WHERE username = ?'),
    userById: db.prepare('SELECT * FROM users WHERE id = ?'),
    createSession: db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)'),
    sessionUser: db.prepare(
      'SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?',
    ),
    deleteSession: db.prepare('DELETE FROM sessions WHERE token_hash = ?'),
    purgeSessions: db.prepare('DELETE FROM sessions WHERE expires_at <= ?'),

    card: db.prepare('SELECT * FROM cards WHERE page_id = ?'),
    insertCard: db.prepare(`INSERT OR IGNORE INTO cards
      (page_id, title, description, extract, image, image_width, image_height, wikidata, type, rarity, atk, def,
       views30, daily_views, length, langs, quality, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`),

    insertPack: db.prepare('INSERT INTO packs (user_id, theme, opened_at) VALUES (?, ?, ?)'),
    nextSerial: db.prepare('SELECT COALESCE(MAX(serial), 0) + 1 AS n FROM copies WHERE card_id = ?'),
    ownedCount: db.prepare('SELECT COUNT(*) AS n FROM copies WHERE owner_id = ? AND card_id = ?'),
    insertCopy: db.prepare(
      'INSERT INTO copies (card_id, owner_id, serial, shiny, pack_id, gifted_by, obtained_at) VALUES (?, ?, ?, ?, ?, NULL, ?)',
    ),
    copy: db.prepare('SELECT * FROM copies WHERE id = ?'),
    moveCopy: db.prepare('UPDATE copies SET owner_id = ?, gifted_by = ?, obtained_at = ? WHERE id = ?'),

    collection: db.prepare(`SELECT ${CARD_COLUMNS}, COUNT(*) AS count, SUM(cp.shiny) AS shinies,
        MIN(cp.serial) AS best_serial, MIN(cp.obtained_at) AS first_at, MAX(cp.obtained_at) AS last_at,
        (SELECT x.id FROM copies x WHERE x.card_id = cp.card_id AND x.owner_id = cp.owner_id
          ORDER BY x.shiny DESC, x.serial ASC LIMIT 1) AS best_copy
      FROM copies cp JOIN cards c ON c.page_id = cp.card_id
      WHERE cp.owner_id = ? GROUP BY cp.card_id`),
    myCopies: db.prepare(`SELECT cp.id, cp.serial, cp.shiny, cp.obtained_at, g.username AS gifted_by
      FROM copies cp LEFT JOIN users g ON g.id = cp.gifted_by
      WHERE cp.owner_id = ? AND cp.card_id = ? ORDER BY cp.shiny DESC, cp.serial ASC`),
    owners: db.prepare(`SELECT u.username, COUNT(*) AS count, SUM(cp.shiny) AS shinies
      FROM copies cp JOIN users u ON u.id = cp.owner_id WHERE cp.card_id = ?
      GROUP BY cp.owner_id ORDER BY count DESC, u.username`),
    totalCopies: db.prepare('SELECT COUNT(*) AS n FROM copies WHERE card_id = ?'),

    statsByRarity: db.prepare(`SELECT c.rarity, COUNT(DISTINCT cp.card_id) AS uniq, COUNT(*) AS total,
        COUNT(DISTINCT CASE WHEN cp.shiny = 1 THEN cp.card_id END) AS shiny_uniq
      FROM copies cp JOIN cards c ON c.page_id = cp.card_id WHERE cp.owner_id = ? GROUP BY c.rarity`),
    allStatsByRarity: db.prepare(`SELECT cp.owner_id, c.rarity, COUNT(DISTINCT cp.card_id) AS uniq, COUNT(*) AS total,
        COUNT(DISTINCT CASE WHEN cp.shiny = 1 THEN cp.card_id END) AS shiny_uniq
      FROM copies cp JOIN cards c ON c.page_id = cp.card_id GROUP BY cp.owner_id, c.rarity`),
    packCount: db.prepare('SELECT COUNT(*) AS n FROM packs WHERE user_id = ?'),
    allPackCounts: db.prepare('SELECT user_id, COUNT(*) AS n FROM packs GROUP BY user_id'),
    users: db.prepare('SELECT id, username, created_at FROM users'),
    bestCopy: db.prepare(`SELECT cp.id AS copy_id, cp.serial, cp.shiny, ${CARD_COLUMNS}
      FROM copies cp JOIN cards c ON c.page_id = cp.card_id WHERE cp.owner_id = ?
      ORDER BY c.rarity DESC, cp.shiny DESC, c.views30 DESC LIMIT 1`),

    showcase: db.prepare(`SELECT s.slot, cp.id AS copy_id, cp.serial, cp.shiny, ${CARD_COLUMNS}
      FROM showcase s JOIN copies cp ON cp.id = s.copy_id JOIN cards c ON c.page_id = cp.card_id
      WHERE s.user_id = ? ORDER BY s.slot`),
    clearShowcase: db.prepare('DELETE FROM showcase WHERE user_id = ?'),
    setShowcase: db.prepare('INSERT INTO showcase (user_id, slot, copy_id) VALUES (?, ?, ?)'),
    unshowcaseCopy: db.prepare('DELETE FROM showcase WHERE copy_id = ?'),

    searchCards: db.prepare(`SELECT ${CARD_COLUMNS} FROM cards c WHERE c.title LIKE ? ESCAPE '\\'
      ORDER BY (c.title LIKE ? ESCAPE '\\') DESC, c.rarity DESC, c.views30 DESC LIMIT 8`),
    searchUsers: db.prepare(`SELECT username FROM users WHERE username LIKE ? ESCAPE '\\' ORDER BY username LIMIT 5`),

    addEvent: db.prepare(
      'INSERT INTO events (type, user_id, target_id, card_id, copy_id, shiny, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ),
    lastEvent: db.prepare('SELECT COALESCE(MAX(id), 0) AS id FROM events'),
    feed: db.prepare(`SELECT e.id, e.type, e.created_at, e.shiny, u.username AS user, t.username AS target,
        c.page_id, c.title, c.rarity, c.image, c.type AS card_type
      FROM events e JOIN users u ON u.id = e.user_id
      LEFT JOIN users t ON t.id = e.target_id LEFT JOIN cards c ON c.page_id = e.card_id
      WHERE e.id < ? ORDER BY e.id DESC LIMIT ?`),
    feedAfter: db.prepare(`SELECT e.id, e.type, e.created_at, e.shiny, u.username AS user, t.username AS target,
        c.page_id, c.title, c.rarity, c.image, c.type AS card_type
      FROM events e JOIN users u ON u.id = e.user_id
      LEFT JOIN users t ON t.id = e.target_id LEFT JOIN cards c ON c.page_id = e.card_id
      WHERE e.id > ? ORDER BY e.id ASC LIMIT 100`),
  };

  // ---------- Index de tout Wikipédia ----------
  const upsertArticle = db.prepare(`INSERT INTO articles
      (page_id, title, description, image, image_width, image_height, wikidata, type, length, langs, quality, views30, rarity, indexed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (page_id) DO UPDATE SET title = excluded.title, description = excluded.description, image = excluded.image,
      image_width = excluded.image_width, image_height = excluded.image_height, wikidata = excluded.wikidata, type = excluded.type,
      length = excluded.length, langs = excluded.langs, quality = excluded.quality, views30 = excluded.views30,
      rarity = excluded.rarity, indexed_at = excluded.indexed_at`);
  const metaGet = db.prepare('SELECT value FROM meta WHERE key = ?');
  const metaSet = db.prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value');
  const articleRange = db.prepare('SELECT MIN(page_id) AS lo, MAX(page_id) AS hi FROM articles WHERE image IS NOT NULL AND rarity = ?');
  const articleById = db.prepare('SELECT * FROM articles WHERE page_id = ?');
  const articleCounts = db.prepare(`SELECT COUNT(*) AS total, COUNT(image) AS illustrated FROM articles`);
  const articleByRarity = db.prepare('SELECT rarity, COUNT(*) AS n FROM articles WHERE image IS NOT NULL GROUP BY rarity');
  const drawStatements = new Map();

  // Une requête préparée par combinaison (nombre de familles, sens de recherche).
  function drawStatement(nTypes, after) {
    const key = `${nTypes}:${after}`;
    if (!drawStatements.has(key)) {
      const typeFilter = nTypes ? `AND type IN (${Array(nTypes).fill('?').join(', ')})` : '';
      drawStatements.set(
        key,
        db.prepare(`SELECT * FROM articles WHERE image IS NOT NULL AND rarity = ? ${typeFilter}
          AND page_id ${after ? '>=' : '<'} ? ORDER BY page_id ${after ? 'ASC' : 'DESC'} LIMIT 1`),
      );
    }
    return drawStatements.get(key);
  }

  function articleRow(r) {
    return {
      pageId: r.page_id,
      title: r.title,
      description: r.description,
      image: r.image,
      imageWidth: r.image_width,
      imageHeight: r.image_height,
      wikidata: r.wikidata,
      type: r.type,
      length: r.length,
      langs: r.langs,
      quality: r.quality,
      views30: r.views30,
      rarity: r.rarity,
    };
  }

  function tx(fn) {
    db.exec('BEGIN IMMEDIATE');
    try {
      const out = fn();
      db.exec('COMMIT');
      return out;
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  }

  function feedRow(r) {
    return {
      id: r.id,
      type: r.type,
      at: r.created_at,
      user: r.user,
      target: r.target ?? null,
      shiny: Boolean(r.shiny),
      card: r.page_id ? { pageId: r.page_id, title: r.title, rarity: r.rarity, image: r.image, type: r.card_type } : null,
    };
  }

  function statsFrom(rows, packs) {
    const byRarity = RARITIES.map(() => 0);
    const shinyByRarity = RARITIES.map(() => 0);
    let total = 0;
    for (const r of rows) {
      byRarity[r.rarity] = Number(r.uniq);
      shinyByRarity[r.rarity] = Number(r.shiny_uniq);
      total += Number(r.total);
    }
    const unique = byRarity.reduce((a, b) => a + b, 0);
    const shinies = shinyByRarity.reduce((a, b) => a + b, 0);
    return { packs, total, unique, shinies, byRarity, shinyByRarity, score: scoreOf(byRarity, shinyByRarity) };
  }

  function bestOf(userId) {
    const r = q.bestCopy.get(userId);
    return r ? copyView(toCard(r), { copyId: r.copy_id, serial: r.serial, shiny: r.shiny }) : null;
  }

  function showcaseOf(userId) {
    return q.showcase.all(userId).map((r) => ({ slot: r.slot, ...copyView(toCard(r), { copyId: r.copy_id, serial: r.serial, shiny: r.shiny }) }));
  }

  return {
    raw: db,
    close: () => db.close(),

    createUser(username, passwordHash) {
      const { lastInsertRowid } = q.createUser.run(username, passwordHash, Date.now());
      return q.userById.get(Number(lastInsertRowid));
    },
    userByName: (name) => q.userByName.get(name) ?? null,

    createSession: (tokenHash, userId, expiresAt) => q.createSession.run(tokenHash, userId, expiresAt),
    sessionUser: (tokenHash) => q.sessionUser.get(tokenHash, Date.now()) ?? null,
    deleteSession: (tokenHash) => q.deleteSession.run(tokenHash),
    purgeSessions: () => q.purgeSessions.run(Date.now()),

    getCards(ids) {
      const map = new Map();
      for (const id of ids) {
        const row = q.card.get(id);
        if (row) map.set(id, toCard(row, { full: true }));
      }
      return map;
    },
    insertCard(c) {
      if (!c.image) return;
      q.insertCard.run(
        c.pageId, c.title, c.description, c.extract, c.image, c.imageWidth, c.imageHeight, c.wikidata, c.type,
        c.rarity, c.atk, c.def, c.views30, JSON.stringify(c.daily ?? []), c.length, c.langs, c.quality, Date.now(),
      );
    },

    // Enregistre des boosters ouverts. Les belles prises (Super rare et plus, ou Shiny) vont dans le fil.
    recordPacks(userId, theme, packs, notableRarity = 3) {
      return tx(() => {
        const now = Date.now();
        return packs.map((cards) => {
          const packId = Number(q.insertPack.run(userId, theme, now).lastInsertRowid);
          return cards.map(({ card, shiny }) => {
            const isNew = q.ownedCount.get(userId, card.pageId).n === 0;
            const serial = q.nextSerial.get(card.pageId).n;
            const copyId = Number(q.insertCopy.run(card.pageId, userId, serial, shiny ? 1 : 0, packId, now).lastInsertRowid);
            if (card.rarity >= notableRarity || shiny) q.addEvent.run('pull', userId, null, card.pageId, copyId, shiny ? 1 : 0, now);
            const count = q.ownedCount.get(userId, card.pageId).n;
            return { ...copyView(card, { copyId, serial, shiny }), isNew, count };
          });
        });
      });
    },

    collection(userId) {
      return q.collection.all(userId).map((r) => {
        const card = toCard(r);
        const shinies = Number(r.shinies);
        return {
          ...card,
          ...(shinies ? shinyStats(card, card.rarity) : {}),
          shiny: shinies > 0,
          count: Number(r.count),
          shinies,
          bestSerial: r.best_serial,
          bestCopyId: r.best_copy,
          firstAt: r.first_at,
          lastAt: r.last_at,
        };
      });
    },

    card(pageId, viewerId) {
      const row = q.card.get(pageId);
      if (!row) {
        // Pas encore tirée : aperçu depuis l'index de Wikipédia (stats provisoires, rareté actuelle).
        const a = articleById.get(pageId);
        if (!a || !a.image) return null;
        const preview = { ...articleRow(a), ...statsFor(articleRow(a)) };
        return { ...preview, preview: true, extract: '', daily: [], totalCopies: 0, owners: [], myCopies: [], shinyStats: shinyStats(preview, preview.rarity) };
      }
      const card = toCard(row, { full: true });
      card.totalCopies = q.totalCopies.get(pageId).n;
      card.owners = q.owners.all(pageId).map((o) => ({ username: o.username, count: Number(o.count), shinies: Number(o.shinies) }));
      card.myCopies = q.myCopies.all(viewerId ?? 0, pageId).map((c) => ({
        copyId: c.id,
        serial: c.serial,
        shiny: Boolean(c.shiny),
        obtainedAt: c.obtained_at,
        giftedBy: c.gifted_by,
        ...(c.shiny ? shinyStats(card, card.rarity) : { atk: card.atk, def: card.def }),
      }));
      card.shinyStats = shinyStats(card, card.rarity);
      return card;
    },

    // Tout le catalogue découvert par le groupe, façon base de données Futbin.
    catalogue({ q: search = '', rarity = null, type = null, sort = 'rarity', limit = 60, offset = 0, viewerId = 0, mine = null }) {
      const where = [];
      const params = [];
      if (search) {
        where.push("c.title LIKE ? ESCAPE '\\'");
        params.push(`%${search.replace(/[\\%_]/g, '\\$&')}%`);
      }
      if (rarity != null) {
        where.push('c.rarity = ?');
        params.push(rarity);
      }
      if (type) {
        where.push('c.type = ?');
        params.push(type);
      }
      if (mine === true) where.push('mine > 0');
      if (mine === false) where.push('mine = 0');
      const filter = where.length ? `WHERE ${where.join(' AND ')}` : '';
      const base = `SELECT ${CARD_COLUMNS},
          (SELECT COUNT(*) FROM copies x WHERE x.card_id = c.page_id) AS copies,
          (SELECT COUNT(DISTINCT x.owner_id) FROM copies x WHERE x.card_id = c.page_id) AS owners,
          (SELECT COUNT(*) FROM copies x WHERE x.card_id = c.page_id AND x.owner_id = ?) AS mine
        FROM cards c`;
      const wrapped = `SELECT * FROM (${base}) c ${filter}`;
      const total = db.prepare(`SELECT COUNT(*) AS n FROM (${wrapped})`).get(viewerId, ...params).n;
      const order = Object.hasOwn(SORTS, sort) ? SORTS[sort] : SORTS.rarity;
      const lim = Math.min(Math.max(Math.trunc(Number(limit)) || 60, 1), 120);
      const off = Math.max(Math.trunc(Number(offset)) || 0, 0);
      const rows = db.prepare(`${wrapped} ORDER BY ${order} LIMIT ? OFFSET ?`).all(viewerId, ...params, lim, off);
      return {
        total,
        cards: rows.map((r) => ({ ...toCard(r), copies: r.copies, owners: r.owners, mine: r.mine })),
      };
    },

    stats(userId) {
      return statsFrom(q.statsByRarity.all(userId), q.packCount.get(userId).n);
    },

    players() {
      const rows = new Map();
      for (const r of q.allStatsByRarity.all()) {
        if (!rows.has(r.owner_id)) rows.set(r.owner_id, []);
        rows.get(r.owner_id).push(r);
      }
      const packs = new Map(q.allPackCounts.all().map((r) => [r.user_id, r.n]));
      return q.users
        .all()
        .map((u) => ({
          username: u.username,
          joinedAt: u.created_at,
          ...statsFrom(rows.get(u.id) ?? [], packs.get(u.id) ?? 0),
          showcase: showcaseOf(u.id),
          bestCard: bestOf(u.id),
        }))
        .sort((a, b) => b.score - a.score || b.unique - a.unique || a.joinedAt - b.joinedAt);
    },

    showcase: showcaseOf,
    setShowcase(userId, copyIds) {
      return tx(() => {
        for (const id of copyIds) {
          const c = q.copy.get(id);
          if (!c || c.owner_id !== userId) return false;
        }
        q.clearShowcase.run(userId);
        copyIds.forEach((id, i) => q.setShowcase.run(userId, i + 1, id));
        return true;
      });
    },

    gift(fromId, toId, copyId) {
      return tx(() => {
        const c = q.copy.get(copyId);
        if (!c || c.owner_id !== fromId) return null;
        const now = Date.now();
        q.moveCopy.run(toId, fromId, now, copyId);
        q.unshowcaseCopy.run(copyId);
        const eventId = Number(q.addEvent.run('gift', fromId, toId, c.card_id, copyId, c.shiny, now).lastInsertRowid);
        return { eventId, cardId: c.card_id };
      });
    },

    search(text) {
      const like = `%${text.replace(/[\\%_]/g, '\\$&')}%`;
      const prefix = `${text.replace(/[\\%_]/g, '\\$&')}%`;
      return {
        cards: q.searchCards.all(like, prefix).map((r) => toCard(r)),
        players: q.searchUsers.all(like).map((r) => r.username),
      };
    },

    upsertArticles(rows) {
      if (!rows.length) return;
      tx(() => {
        const now = Date.now();
        for (const a of rows) {
          upsertArticle.run(
            a.pageId, a.title, a.description, a.image, a.imageWidth, a.imageHeight,
            typeof a.wikidata === 'string' && /^Q\d+$/.test(a.wikidata) ? a.wikidata : null,
            a.type, a.length, a.langs, a.quality === 'AdQ' || a.quality === 'BA' ? a.quality : null, a.views30, a.rarity, now,
          );
        }
      });
    },
    meta(key) {
      const row = metaGet.get(key);
      return row ? JSON.parse(row.value) : null;
    },
    setMeta: (key, value) => metaSet.run(key, JSON.stringify(value)),
    articleStats() {
      const { total, illustrated } = articleCounts.get();
      const byRarity = RARITIES.map(() => 0);
      for (const r of articleByRarity.all()) byRarity[r.rarity] = r.n;
      return { total, illustrated, byRarity };
    },
    article: (pageId) => {
      const r = articleById.get(pageId);
      return r ? articleRow(r) : null;
    },
    // Un article illustré au hasard, d'une rareté donnée (et d'une des familles si précisées).
    drawArticle(rarity, types, exclude = new Set(), rand = Math.random) {
      const range = articleRange.get(rarity);
      if (range.lo == null) return null;
      const params = types?.length ? types : [];
      for (let attempt = 0; attempt < 6; attempt++) {
        const pivot = Math.floor(range.lo + rand() * (range.hi - range.lo + 1));
        const row =
          drawStatement(params.length, true).get(rarity, ...params, pivot) ?? drawStatement(params.length, false).get(rarity, ...params, pivot);
        if (!row) return null;
        if (!exclude.has(row.page_id)) return articleRow(row);
      }
      return null;
    },
    // Parcourir tout Wikipédia (cartes possibles), par popularité ou par titre.
    browseArticles({ q = '', rarity = null, type = null, sort = 'views', limit = 60, offset = 0, viewerId = 0 }) {
      const where = ['a.image IS NOT NULL'];
      const params = [];
      if (q) {
        where.push('a.title >= ? COLLATE NOCASE AND a.title < ? COLLATE NOCASE');
        params.push(q, `${q}\uffff`);
      }
      if (rarity != null) {
        where.push('a.rarity = ?');
        params.push(rarity);
      }
      if (type) {
        where.push('a.type = ?');
        params.push(type);
      }
      const order = sort === 'alpha' ? 'a.title COLLATE NOCASE ASC, a.page_id' : 'a.views30 DESC, a.page_id';
      const lim = Math.min(Math.max(Math.trunc(Number(limit)) || 60, 1), 120);
      const off = Math.max(Math.trunc(Number(offset)) || 0, 0);
      const rows = db
        .prepare(`SELECT a.*, c.atk, c.def, c.created_at AS discovered,
            (SELECT COUNT(*) FROM copies x WHERE x.card_id = a.page_id AND x.owner_id = ?) AS mine
          FROM articles a LEFT JOIN cards c ON c.page_id = a.page_id
          WHERE ${where.join(' AND ')} ORDER BY ${order} LIMIT ? OFFSET ?`)
        .all(viewerId, ...params, lim + 1, off);
      return {
        hasMore: rows.length > lim,
        cards: rows.slice(0, lim).map((r) => ({
          ...articleRow(r),
          ...(r.discovered ? { atk: r.atk, def: r.def } : statsFor({ ...articleRow(r) })),
          discovered: Boolean(r.discovered),
          mine: r.mine,
        })),
      };
    },

    addEvent(type, userId) {
      return Number(q.addEvent.run(type, userId, null, null, null, 0, Date.now()).lastInsertRowid);
    },
    lastEventId: () => Number(q.lastEvent.get().id),
    feed: (limit = 30, before = Number.MAX_SAFE_INTEGER) => q.feed.all(before, limit).map(feedRow),
    feedSince: (afterId) => q.feedAfter.all(afterId).map(feedRow),
  };
}
