// Mots de passe (scrypt) et jetons de session, avec le module crypto de Node.
import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);
const KEY_LEN = 64;

export const SESSION_DAYS = 90;
export const USERNAME_RE = /^[\p{L}\p{N}_.-]{3,20}$/u;
export const PASSWORD_MIN = 6;

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await scryptAsync(password.normalize('NFKC'), salt, KEY_LEN);
  return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(password, stored) {
  const [scheme, saltB64, keyB64] = String(stored).split('$');
  if (scheme !== 'scrypt' || !saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, 'base64');
  const key = await scryptAsync(password.normalize('NFKC'), Buffer.from(saltB64, 'base64'), expected.length);
  return timingSafeEqual(key, expected);
}

export const newToken = () => randomBytes(32).toString('base64url');
export const hashToken = (token) => createHash('sha256').update(token).digest('hex');

export function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    if (!k) continue;
    try {
      out[k] = decodeURIComponent(part.slice(i + 1).trim());
    } catch {
      out[k] = part.slice(i + 1).trim();
    }
  }
  return out;
}

export function sessionCookie(token, { secure, maxAgeSec }) {
  return [
    `sid=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAgeSec}`,
    secure ? 'Secure' : '',
  ]
    .filter(Boolean)
    .join('; ');
}

// Limite les essais de connexion ratés (par IP), sans rien bloquer d'autre.
export function createLoginLimiter({ max = 10, windowMs = 10 * 60 * 1000 } = {}) {
  const fails = new Map();
  return {
    blocked(key) {
      const f = fails.get(key);
      if (!f) return false;
      if (Date.now() - f.since > windowMs) {
        fails.delete(key);
        return false;
      }
      return f.count >= max;
    },
    fail(key) {
      const f = fails.get(key);
      if (!f || Date.now() - f.since > windowMs) fails.set(key, { count: 1, since: Date.now() });
      else f.count++;
    },
    reset: (key) => fails.delete(key),
  };
}
