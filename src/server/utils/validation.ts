import mongoose from 'mongoose';

export const isValidId = (id: unknown): id is string =>
  typeof id === 'string' && mongoose.Types.ObjectId.isValid(id) && /^[a-f\d]{24}$/i.test(id);

export const cleanString = (value: unknown, maxLength: number): string =>
  typeof value === 'string' ? value.trim().slice(0, maxLength) : '';

export const cleanStringArray = (value: unknown, maxItems = 20, maxLength = 50): string[] => {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  for (const item of value) {
    const s = cleanString(item, maxLength);
    if (s) seen.add(s);
    if (seen.size >= maxItems) break;
  }
  return [...seen];
};

// Only allow http(s) links so user-supplied hrefs can't run `javascript:` URLs
export const cleanUrl = (value: unknown): string => {
  const s = cleanString(value, 500);
  if (!s) return '';
  const withScheme = /^[a-z][a-z\d+.-]*:/i.test(s) ? s : `https://${s}`;
  try {
    const url = new URL(withScheme);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : '';
  } catch {
    return '';
  }
};

const MAX_IMAGE_LENGTH = 1_500_000;

// Profile images are either http(s) URLs or base64 raster data URLs
export const cleanImage = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const s = value.trim();
  if (/^data:image\/(png|jpe?g|gif|webp);base64,[a-z\d+/=]+$/i.test(s) && s.length <= MAX_IMAGE_LENGTH) return s;
  if (s.startsWith('data:image/svg+xml;utf8,') && s.length <= 2000) return s;
  return cleanUrl(s) || null;
};

export const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
