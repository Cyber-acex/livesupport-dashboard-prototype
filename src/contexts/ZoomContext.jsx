import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { DEFAULT_ZOOM, MIN_ZOOM, MAX_ZOOM, normalizeZoomValue, ZOOM_LEVELS, ZOOM_STORAGE_KEY } from '../utils/zoom';

const ZoomContext = createContext(null);

function applyZoomToDocument(value) {
  if (typeof document === 'undefined') return;

  const normalized = normalizeZoomValue(value);
  document.documentElement.style.setProperty('--app-zoom', `${normalized * 100}%`);
}

function readStoredZoom() {
  if (typeof window === 'undefined') return DEFAULT_ZOOM;
  const stored = window.localStorage.getItem(ZOOM_STORAGE_KEY)
    || window.localStorage.getItem('appZoom')
    || window.localStorage.getItem('pageZoom');
  return normalizeZoomValue(stored || DEFAULT_ZOOM);
}

export function ZoomProvider({ children }) {
  const [zoom, setZoomState] = useState(() => {
    if (typeof window === 'undefined') return DEFAULT_ZOOM;
    return readStoredZoom();
  });

  const syncZoomState = useCallback((nextValue) => {
    const normalized = normalizeZoomValue(nextValue);
    setZoomState((current) => (current === normalized ? current : normalized));
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(ZOOM_STORAGE_KEY, String(normalized));
      window.dispatchEvent(new Event('zoom:updated'));
    }
  }, []);

  const setZoom = useCallback((nextValue) => {
    syncZoomState(nextValue);
  }, [syncZoomState]);

  const increaseZoom = useCallback(() => {
    const nextIndex = Math.min(ZOOM_LEVELS.length - 1, ZOOM_LEVELS.indexOf(zoom) + 1);
    setZoom(ZOOM_LEVELS[nextIndex]);
  }, [setZoom, zoom]);

  const decreaseZoom = useCallback(() => {
    const nextIndex = Math.max(0, ZOOM_LEVELS.indexOf(zoom) - 1);
    setZoom(ZOOM_LEVELS[nextIndex]);
  }, [setZoom, zoom]);

  const resetZoom = useCallback(() => {
    setZoom(DEFAULT_ZOOM);
  }, [setZoom]);

  useLayoutEffect(() => {
    applyZoomToDocument(zoom);
  }, [zoom]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const applyStoredZoom = () => {
      const initialZoom = readStoredZoom();
      setZoomState((current) => (current === initialZoom ? current : initialZoom));
      applyZoomToDocument(initialZoom);
    };

    applyStoredZoom();

    const onKeyDown = (event) => {
      const isModifier = event.ctrlKey || event.metaKey;
      if (!isModifier) return;

      if (event.key === '+' || event.key === '=') {
        event.preventDefault();
        increaseZoom();
      } else if (event.key === '-') {
        event.preventDefault();
        decreaseZoom();
      } else if (event.key === '0') {
        event.preventDefault();
        setZoom(DEFAULT_ZOOM);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('zoom:updated', applyStoredZoom);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('zoom:updated', applyStoredZoom);
    };
  }, [decreaseZoom, increaseZoom, setZoom]);

  const value = useMemo(() => ({
    zoom,
    setZoom,
    increaseZoom,
    decreaseZoom,
    resetZoom,
    zoomLevels: ZOOM_LEVELS,
    minZoom: MIN_ZOOM,
    maxZoom: MAX_ZOOM,
    step: null
  }), [zoom, setZoom, increaseZoom, decreaseZoom, resetZoom]);

  return <ZoomContext.Provider value={value}>{children}</ZoomContext.Provider>;
}

export function useZoom() {
  const context = useContext(ZoomContext);
  if (!context) {
    throw new Error('useZoom must be used within a ZoomProvider');
  }
  return context;
}
