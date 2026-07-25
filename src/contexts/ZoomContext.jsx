import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { DEFAULT_ZOOM, MIN_ZOOM, MAX_ZOOM, normalizeZoomValue, ZOOM_STEP, ZOOM_LEVELS } from '../utils/zoom';

const ZoomContext = createContext(null);

function applyZoomToDocument(value) {
  if (typeof document === 'undefined') return;

  const normalized = normalizeZoomValue(value);
  document.documentElement.style.setProperty('--app-zoom', `${normalized}%`);
  document.documentElement.style.setProperty('--app-zoom-scale', String(normalized / 100));
}

export function ZoomProvider({ children }) {
  const [zoom, setZoomState] = useState(() => {
    if (typeof window === 'undefined') return DEFAULT_ZOOM;
    const stored = Number(window.localStorage.getItem('appZoom'));
    return normalizeZoomValue(stored || DEFAULT_ZOOM);
  });

  const syncZoomState = useCallback((nextValue) => {
    const normalized = normalizeZoomValue(nextValue);
    setZoomState((current) => (current === normalized ? current : normalized));
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('appZoom', String(normalized));
      window.localStorage.setItem('pageZoom', String(normalized));
      window.dispatchEvent(new Event('zoom:updated'));
    }
  }, []);

  const setZoom = useCallback((nextValue) => {
    syncZoomState(nextValue);
  }, [syncZoomState]);

  const increaseZoom = useCallback(() => {
    setZoom(zoom + ZOOM_STEP);
  }, [setZoom, zoom]);

  const decreaseZoom = useCallback(() => {
    setZoom(zoom - ZOOM_STEP);
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
      const stored = Number(window.localStorage.getItem('appZoom'));
      const initialZoom = normalizeZoomValue(stored || DEFAULT_ZOOM);
      setZoomState((current) => (current === initialZoom ? current : initialZoom));
      applyZoomToDocument(initialZoom);
    };

    applyStoredZoom();

    const onKeyDown = (event) => {
      const isModifier = event.ctrlKey || event.metaKey;
      if (!isModifier) return;

      if (event.key === '+' || event.key === '=') {
        event.preventDefault();
        setZoom(zoom + ZOOM_STEP);
      } else if (event.key === '-') {
        event.preventDefault();
        setZoom(zoom - ZOOM_STEP);
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
  }, [setZoom, zoom]);

  const value = useMemo(() => ({
    zoom,
    setZoom,
    increaseZoom,
    decreaseZoom,
    resetZoom,
    zoomLevels: ZOOM_LEVELS,
    minZoom: MIN_ZOOM,
    maxZoom: MAX_ZOOM,
    step: ZOOM_STEP
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
