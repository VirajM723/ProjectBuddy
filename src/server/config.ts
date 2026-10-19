import 'dotenv/config';
import crypto from 'crypto';

export const isProduction =
  process.env.NODE_ENV === 'production' || (process.argv[1] || '').endsWith('.cjs');

export const PORT = Number(process.env.PORT) || 3000;

export const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/project-buddy';

// Never fall back to a guessable secret: anyone could forge tokens with it.
// Without JWT_SECRET, a random per-process secret is used (sessions reset on restart).
export const JWT_SECRET = process.env.JWT_SECRET || (() => {
  console.warn('WARNING: JWT_SECRET is not set. Using a random secret; all sessions will be invalidated on restart.');
  return crypto.randomBytes(48).toString('hex');
})();

export const ADMIN_EMAILS = (process.env.ADMIN_EMAIL || 'mankaniviraj55@gmail.com')
  .split(',')
  .map(e => e.trim().toLowerCase())
  .filter(Boolean);
