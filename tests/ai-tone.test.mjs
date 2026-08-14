import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveAiTone } from '../replies.js';
import { canChangeAiTone } from '../src/services/settingsService.js';

test('resolveAiTone returns the matching preset for each supported tone', () => {
  assert.match(resolveAiTone('warm'), /warm|empathetic|friendly/i);
  assert.match(resolveAiTone('professional'), /professional|polished|efficient/i);
  assert.match(resolveAiTone('friendly'), /friendly|approachable|upbeat/i);
  assert.match(resolveAiTone('concise'), /concise|direct|short/i);
});

test('resolveAiTone falls back to warm when tone is missing or invalid', () => {
  assert.match(resolveAiTone(''), /warm|empathetic|friendly/i);
  assert.match(resolveAiTone('unknown-tone'), /warm|empathetic|friendly/i);
});

test('AI tone changes are restricted to admins and managers', () => {
  assert.equal(canChangeAiTone('admin'), true);
  assert.equal(canChangeAiTone('manager'), true);
  assert.equal(canChangeAiTone('agent'), false);
  assert.equal(canChangeAiTone('viewer'), false);
  assert.equal(canChangeAiTone(''), false);
});
