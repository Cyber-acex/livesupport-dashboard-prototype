import test from 'node:test';
import assert from 'node:assert/strict';
import { canTransmit, createPttState, getPttLabel, reducePttState } from '../src/services/voice/pttInteraction.js';

test('desktop press and release follows hold-to-talk', () => {
  let state = reducePttState(createPttState(), { type: 'desktop-press' });
  assert.deepEqual(state, { active: true, pressed: true });
  state = reducePttState(state, { type: 'desktop-release' });
  assert.deepEqual(state, { active: false, pressed: false });
});

test('mobile taps toggle active state', () => {
  let state = reducePttState(createPttState(), { type: 'mobile-toggle' });
  assert.equal(state.active, true);
  state = reducePttState(state, { type: 'mobile-toggle' });
  assert.equal(state.active, false);
  for (let index = 0; index < 4; index += 1) state = reducePttState(state, { type: 'mobile-toggle' });
  assert.equal(state.active, false);
});

test('cancel and reset always stop an active PTT state', () => {
  const active = { active: true, pressed: true };
  assert.deepEqual(reducePttState(active, { type: 'cancel' }), { active: false, pressed: false });
  assert.deepEqual(reducePttState(active, { type: 'reset' }), { active: false, pressed: false });
});

test('mute and unavailable microphone override PTT transmission', () => {
  assert.equal(canTransmit({ inVoiceChannel: true, pttActive: true, muted: false, microphoneAvailable: true }), true);
  assert.equal(canTransmit({ inVoiceChannel: true, pttActive: true, muted: true, microphoneAvailable: true }), false);
  assert.equal(canTransmit({ inVoiceChannel: false, pttActive: true, muted: false, microphoneAvailable: true }), false);
  assert.equal(canTransmit({ inVoiceChannel: true, pttActive: true, muted: false, microphoneAvailable: false }), false);
});

test('PTT labels describe desktop and mobile state', () => {
  assert.equal(getPttLabel({ active: false, mobile: false }), 'Push to talk - hold to speak');
  assert.equal(getPttLabel({ active: true, mobile: false }), 'Push to talk active - release to stop');
  assert.equal(getPttLabel({ active: false, mobile: true }), 'Push to talk - tap to start');
  assert.equal(getPttLabel({ active: true, mobile: true }), 'Push to talk active - tap to stop');
});
