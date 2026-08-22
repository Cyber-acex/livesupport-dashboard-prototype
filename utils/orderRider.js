export function normalizeOrderRiderId(value) {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  if (normalized === '') return null;
  const numericValue = Number(normalized);
  return Number.isFinite(numericValue) ? numericValue : null;
}
