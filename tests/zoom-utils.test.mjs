import test from 'node:test';
import assert from 'node:assert/strict';
import { clampZoom, DEFAULT_ZOOM, MIN_ZOOM, MAX_ZOOM, normalizeZoomValue, ZOOM_STEP, ZOOM_LEVELS } from '../src/utils/zoom.js';

test('clampZoom keeps values inside the supported range', () => {
  assert.equal(clampZoom(80), 80);
  assert.equal(clampZoom(10), MIN_ZOOM);
  assert.equal(clampZoom(500), MAX_ZOOM);
});

test('normalizeZoomValue snaps to the allowed step size', () => {
  assert.equal(normalizeZoomValue(83), 85);
  assert.equal(normalizeZoomValue(107), 105);
  assert.equal(normalizeZoomValue(100), 100);
});

test('default zoom and preset levels are available', () => {
  assert.equal(DEFAULT_ZOOM, 100);
  assert.ok(ZOOM_LEVELS.includes(DEFAULT_ZOOM));
  assert.equal(ZOOM_STEP, 5);
  assert.ok(ZOOM_LEVELS[0] >= MIN_ZOOM);
  assert.ok(ZOOM_LEVELS[ZOOM_LEVELS.length - 1] <= MAX_ZOOM);
});
