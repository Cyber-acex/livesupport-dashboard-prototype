export function normalizePresenceStatus(status) {
  if (!status) return 'offline';
  if (status === 'busy' || status === 'in-call' || status === 'calling' || status === 'incoming') return 'busy';
  if (status === 'away') return 'away';
  if (status === 'online' || status === 'available') return 'available';
  return 'offline';
}

export class PresenceService {
  constructor({ onPresenceChanged } = {}) {
    this.onPresenceChanged = onPresenceChanged;
    this.presenceMap = new Map();
  }

  setPresence(userId, entry) {
    if (!userId) return;
    this.presenceMap.set(String(userId), entry);
    this.onPresenceChanged?.(Array.from(this.presenceMap.values()));
  }

  hydrate(payload = []) {
    const entries = Array.isArray(payload) ? payload : [];
    this.presenceMap = new Map(entries.map((entry) => [String(entry.userId), entry]));
    this.onPresenceChanged?.(entries);
    return entries;
  }
}
