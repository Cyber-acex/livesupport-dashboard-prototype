export const DEFAULT_ZOOM = 0.8;
export const ZOOM_STORAGE_KEY = 'livesupport-interface-zoom';
export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 1.5;
export const ZOOM_LEVELS = [0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5];

export function normalizeZoomValue(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return DEFAULT_ZOOM;

  // Accept older percentage values while migrating to CSS zoom factors.
  const factor = numericValue > MAX_ZOOM ? numericValue / 100 : numericValue;
  return ZOOM_LEVELS.reduce((closest, level) => (
    Math.abs(level - factor) < Math.abs(closest - factor) ? level : closest
  ), DEFAULT_ZOOM);
}

export function getZoomPercentLabel(value) {
  return `${Math.round(normalizeZoomValue(value) * 100)}%`;
}
