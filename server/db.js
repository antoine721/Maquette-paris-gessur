// Stockage SQLite (module node:sqlite intégré à Node 22, aucune dépendance).
import { DatabaseSync } from 'node:sqlite';
import { RARITIES, scoreOf } from './cards.js';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  packs_opened INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS cards (
  page_id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  extract TEXT NOT NULL DEFAULT '',
  image TEXT,
  length INTEGER NOT NULL DEFAULT 0,
  views REAL NOT NULL DEFAULT 0,
  langs INTEGER,
  rarity INTEGER NOT NULL,
  atk INTEGER NOT NULL,
  def INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS owned (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  page_id INTEGER NOT NULL REFERENCES cards(page_id),
  count INTEGER NOT NULL,
  first_at INTEGER NOT NULL,
  last_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, page_id)
);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY,
  type TEXT NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  page_id INTEGER REFERENCES cards(page_id),
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS events_recent ON events (id DESC);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions (user_id);
`;

const LIST_COLUMNS = 'c.page_id, c.title, c.description, c.image, c.length, c.views, c.langs, c.rarity, c.atk, c.def';

function toCard(row, withExtract = false) {
  if (!row) return null;
  const card = {
    pageId: row.page_id,
    title: row.title,
    description: row.description,
    image: row.image,
    length: row.length,
    views: row.views,
    langs: row.langs,
    rarity: row.rarity,
    atk: row.atk,
    def: row.def,
  };
  if (withExtract) card.extract = row.extract;
  if (row.count != null) {
    card.count = row.count;
    card.firstAt = row.first_at;
    card.lastAt = row.last_at;
  }
  return card;
}

const pointsCase = `CASE c.rarity ${RARITIES.map((r) => `WHEN ${r.id} THEN ${r.points}`).join(' ')} ELSE 0 END`;
const rarityCounts = RARITIES.map((r) => `COALESCE(SUM(c.rarity = ${r.id}), 0) AS r${r.id}`).join(', ');

export function openDb(file) {
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  db.exec(SCHEMA);

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
      (page_id, title, description, extract, image, length, views, langs, rarity, atk, def, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`),
    addOwned: db.prepare(`INSERT INTO owned (user_id, page_id, count, first_at, last_at) VALUES (?, ?, 1, ?, ?)
      ON CONFLICT (user_id, page_id) DO UPDATE SET count = count + 1, last_at = excluded.last_at
      RETURNING count`),
    owned: db.prepare('SELECT count FROM owned WHERE user_id = ? AND page_id = ?'),
    decOwned: db.prepare('UPDATE owned SET count = count - 1 WHERE user_id = ? AND page_id = ?'),
    dropEmpty: db.prepare('DELETE FROM owned WHERE user_id = ? AND page_id = ? AND count <= 0'),
    bumpPacks: db.prepare('UPDATE users SET packs_opened = packs_opened + 1 WHERE id = ?'),
    collection: db.prepare(`SELECT ${LIST_COLUMNS}, o.count, o.first_at, o.last_at
      FROM owned o JOIN cards c ON c.page_id = o.page_id WHERE o.user_id = ? ORDER BY o.last_at DESC`),
    ownedCard: db.prepare(`SELECT c.*, o.count, o.first_at, o.last_at
      FROM cards c LEFT JOIN owned o ON o.page_id = c.page_id AND o.user_id = ? WHERE c.page_id = ?`),
    owners: db.prepare(`SELECT u.username, o.count FROM owned o JOIN users u ON u.id = o.user_id
      WHERE o.page_id = ? ORDER BY o.first_at`),
    players: db.prepare(`SELECT u.id, u.username, u.packs_opened, u.created_at,
        COALESCE(SUM(o.count), 0) AS total, COUNT(o.page_id) AS uniq, ${rarityCounts}
      FROM users u LEFT JOIN owned o ON o.user_id = u.id LEFT JOIN cards c ON c.page_id = o.page_id
      GROUP BY u.id`),
    stats: db.prepare(`SELECT COALESCE(SUM(o.count), 0) AS total, COUNT(o.page_id) AS uniq, ${rarityCounts},
        COALESCE(SUM(${pointsCase}), 0) AS score
      FROM owned o JOIN cards c ON c.page_id = o.page_id WHERE o.user_id = ?`),
    lastEvent: db.prepare('SELECT COALESCE(MAX(id), 0) AS id FROM events'),
    addEvent: db.prepare('INSERT INTO events (type, user_id, target_id, page_id, created_at) VALUES (?, ?, ?, ?, ?)'),
    feed: db.prepare(`SELECT e.id, e.type, e.created_at, u.username AS user, t.username AS target,
        c.page_id, c.title, c.rarity, c.image
      FROM events e JOIN users u ON u.id = e.user_id
      LEFT JOIN users t ON t.id = e.target_id LEFT JOIN cards c ON c.page_id = e.page_id
      WHERE e.id < ? ORDER BY e.id DESC LIMIT ?`),
  };

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
      card: r.page_id ? { pageId: r.page_id, title: r.title, rarity: r.rarity, image: r.image } : null,
    };
  }

  function statsRow(r) {
    const byRarity = RARITIES.map((x) => Number(r[`r${x.id}`] ?? 0));
    return { total: Number(r.total ?? 0), unique: Number(r.uniq ?? 0), byRarity, score: scoreOf(byRarity) };
  }

  return {
    raw: db,
    close: () => db.close(),

    createUser(username, passwordHash) {
      const { lastInsertRowid } = q.createUser.run(username, passwordHash, Date.now());
      return q.userById.get(Number(lastInsertRowid));
    },
    userByName: (name) => q.userByName.get(name) ?? null,
    userById: (id) => q.userById.get(id) ?? null,

    createSession: (tokenHash, userId, expiresAt) => q.createSession.run(tokenHash, userId, expiresAt),
    sessionUser: (tokenHash) => q.sessionUser.get(tokenHash, Date.now()) ?? null,
    deleteSession: (tokenHash) => q.deleteSession.run(tokenHash),
    purgeSessions: () => q.purgeSessions.run(Date.now()),

    getCards(ids) {
      const map = new Map();
      for (const id of ids) {
        const row = q.card.get(id);
        if (row) map.set(id, toCard(row, true));
      }
      return map;
    },
    insertCard(c) {
      q.insertCard.run(
        c.pageId, c.title, c.description, c.extract, c.image, c.length, c.views, c.langs, c.rarity, c.atk, c.def,
        Date.now(),
      );
    },

    // Enregistre un booster ouvert : ajoute les cartes et note les belles prises dans le fil.
    recordPack(userId, cards, notableRarity = 3) {
      return tx(() => {
        const now = Date.now();
        q.bumpPacks.run(userId);
        const results = cards.map((c) => {
          const { count } = q.addOwned.get(userId, c.pageId, now, now);
          if (c.rarity >= notableRarity) q.addEvent.run('pull', userId, null, c.pageId, now);
          return { ...c, count, isNew: count === 1 };
        });
        return results;
      });
    },

    collection: (userId) => q.collection.all(userId).map((r) => toCard(r)),
    card(pageId, userId) {
      const row = q.ownedCard.get(userId ?? 0, pageId);
      if (!row) return null;
      const card = toCard(row, true);
      card.owners = q.owners.all(pageId).map((o) => ({ username: o.username, count: o.count }));
      return card;
    },

    stats(userId) {
      const user = q.userById.get(userId);
      return { packs: user?.packs_opened ?? 0, ...statsRow(q.stats.get(userId)) };
    },

    players() {
      return q.players
        .all()
        .map((r) => ({ username: r.username, packs: r.packs_opened, joinedAt: r.created_at, ...statsRow(r) }))
        .sort((a, b) => b.score - a.score || b.unique - a.unique || a.joinedAt - b.joinedAt);
    },

    gift(fromId, toId, pageId) {
      return tx(() => {
        const row = q.owned.get(fromId, pageId);
        if (!row || row.count < 1) return null;
        const now = Date.now();
        q.decOwned.run(fromId, pageId);
        q.dropEmpty.run(fromId, pageId);
        const { count } = q.addOwned.get(toId, pageId, now, now);
        const { lastInsertRowid } = q.addEvent.run('gift', fromId, toId, pageId, now);
        return { remaining: row.count - 1, received: count, eventId: Number(lastInsertRowid) };
      });
    },

    addEvent(type, userId, targetId = null, pageId = null) {
      const { lastInsertRowid } = q.addEvent.run(type, userId, targetId, pageId, Date.now());
      return Number(lastInsertRowid);
    },
    feed: (limit = 30, before = Number.MAX_SAFE_INTEGER) => q.feed.all(before, limit).map(feedRow),
    lastEventId: () => Number(q.lastEvent.get().id),
    feedSince(afterId) {
      return q.feed.all(Number.MAX_SAFE_INTEGER, 50).map(feedRow).filter((e) => e.id > afterId).reverse();
    },
  };
}
