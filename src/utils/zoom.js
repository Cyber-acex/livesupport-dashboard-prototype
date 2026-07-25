export const DEFAULT_ZOOM = 100;
export const MIN_ZOOM = 75;
export const MAX_ZOOM = 200;
export const ZOOM_STEP = 5;
export const ZOOM_LEVELS = [75, 80, 90, 100, 110, 125, 150, 175, 200];

export function clampZoom(value, min = MIN_ZOOM, max = MAX_ZOOM) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return DEFAULT_ZOOM;
  }

  return Math.min(max, Math.max(min, numericValue));
}

export function normalizeZoomValue(value) {
  const rounded = Math.round(Number(value) / ZOOM_STEP) * ZOOM_STEP;
  return clampZoom(rounded);
}

export function getZoomPercentLabel(value) {
  return `${normalizeZoomValue(value)}%`;
}
