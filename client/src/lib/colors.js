// Canonical brand colorway → hex map (mirror of server/src/db.js COLOR_HEX).
// Variants normally carry their own color_hex from the API; this is the
// client-side fallback for legacy/unknown color names.

export const BRAND_COLORS = {
  'Void Black': '#16181c',
  'Moon White': '#f1f0ea',
  'Aurora Green': '#21f59a',
  'Emerald Dust': '#4d7a64',
  Nebula: '#6d5bd0',
  Black: '#16181b',
  White: '#f2f1ec',
  'Dark Grey': '#3b3e43',
  Cream: '#e5ddc8',
  Navy: '#1d2b45',
};

const FALLBACK = '#3b3e43';

export function colorHex(name, fallback = FALLBACK) {
  if (typeof name === 'string' && name.trim().startsWith('#')) return name.trim();
  return BRAND_COLORS[name] || fallback;
}
