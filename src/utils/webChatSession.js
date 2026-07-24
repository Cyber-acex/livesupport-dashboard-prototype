const STORAGE_KEY = 'livesupport:webchat:guest-session';
const NAME_PREFIX = 'Guest #';

function createMemoryStorage() {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    }
  };
}

function resolveStorage(storage) {
  if (storage) return storage;
  if (typeof globalThis !== 'undefined' && globalThis.localStorage) return globalThis.localStorage;
  return createMemoryStorage();
}

export function createGuestSessionStorage(storage = resolveStorage()) {
  const resolvedStorage = resolveStorage(storage);
  return {
    getItem(key) {
      try {
        if (typeof resolvedStorage?.getItem === 'function') return resolvedStorage.getItem(key) ?? null;
        if (typeof resolvedStorage?.get === 'function') return resolvedStorage.get(key) ?? null;
        return null;
      } catch (error) {
        console.warn('Unable to read localStorage value', error);
        return null;
      }
    },
    setItem(key, value) {
      try {
        if (typeof resolvedStorage?.setItem === 'function') {
          resolvedStorage.setItem(key, value);
          return;
        }
        if (typeof resolvedStorage?.set === 'function') {
          resolvedStorage.set(key, value);
        }
      } catch (error) {
        console.warn('Unable to write localStorage value', error);
      }
    },
    removeItem(key) {
      try {
        if (typeof resolvedStorage?.removeItem === 'function') {
          resolvedStorage.removeItem(key);
          return;
        }
        if (typeof resolvedStorage?.delete === 'function') {
          resolvedStorage.delete(key);
        }
      } catch (error) {
        console.warn('Unable to remove localStorage value', error);
      }
    }
  };
}

export function getGuestDisplayName(name, storage = createGuestSessionStorage()) {
  const trimmedName = String(name || '').trim();
  if (trimmedName) return trimmedName;

  const existing = loadGuestSession(storage);
  if (existing?.customerName) return existing.customerName;

  const storedIndex = storage.getItem('livesupport:webchat:guest-index') || '0';
  const index = Math.max(0, Number.parseInt(storedIndex, 10) || 0);
  const nextIndex = index + 1;
  storage.setItem('livesupport:webchat:guest-index', String(nextIndex));
  return `${NAME_PREFIX}${String(nextIndex).padStart(3, '0')}`;
}

export function loadGuestSession(storage = createGuestSessionStorage()) {
  const rawValue = storage.getItem(STORAGE_KEY);
  if (!rawValue) return null;

  try {
    const parsed = JSON.parse(rawValue);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (error) {
    console.warn('Unable to parse guest session from storage', error);
    return null;
  }
}

export function saveGuestSession(storage = createGuestSessionStorage(), session) {
  if (!session || typeof session !== 'object') return null;
  const nextValue = JSON.stringify(session);
  storage.setItem(STORAGE_KEY, nextValue);
  return session;
}

export function clearGuestSession(storage = createGuestSessionStorage()) {
  storage.removeItem(STORAGE_KEY);
  storage.removeItem('livesupport:webchat:guest-index');
}
