export function normalizeStaffName(value) {
  if (typeof value !== 'string') return '';
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (!normalized) return '';
  if (normalized.includes('@')) return normalized;
  if (/^[A-Za-z0-9]{10,}$/.test(normalized)) return '';
  return normalized;
}

export function pickStaffName(source = {}) {
  const candidates = [
    source.fullName,
    source.name,
    source.displayName,
    source.staffName,
    source.email,
    source.username,
    source.label,
    source.identity
  ];

  for (const candidate of candidates) {
    const normalized = normalizeStaffName(candidate);
    if (normalized) return normalized;
  }

  return 'Staff';
}

export function normalizeVoicePresenceEntry(entry = {}) {
  if (!entry || typeof entry !== 'object') return { name: 'Staff', status: 'active' };
  const safeEntry = { ...entry };
  safeEntry.name = pickStaffName(entry);
  safeEntry.status = safeEntry.status || 'active';
  return safeEntry;
}
