export function extractCsatRating(text) {
  if (typeof text !== 'string') return null;
  const normalized = text.trim().toLowerCase();
  if (!normalized) return null;
  const match = normalized.match(/^([1-5])$/);
  if (!match) return null;
  return Number(match[1]);
}

export function isCsatReplyText(text) {
  return extractCsatRating(text) !== null;
}
