import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSecureAudioConstraints } from '../src/services/webrtcService.js';

test('buildSecureAudioConstraints enables secure audio defaults and preserves explicit overrides', () => {
  const constraints = buildSecureAudioConstraints({ audio: { noiseSuppression: false } });

  assert.equal(constraints.video, false);
  assert.equal(constraints.audio.echoCancellation, true);
  assert.equal(constraints.audio.noiseSuppression, false);
  assert.equal(constraints.audio.autoGainControl, true);
  assert.equal(constraints.audio.channelCount, 1);
  assert.equal(constraints.audio.sampleRate, 48000);
});

test('buildSecureAudioConstraints supports disabling audio when needed', () => {
  const constraints = buildSecureAudioConstraints({ audio: false });

  assert.equal(constraints.audio, false);
  assert.equal(constraints.video, false);
});
