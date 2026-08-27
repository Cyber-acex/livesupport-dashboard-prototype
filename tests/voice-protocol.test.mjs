import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_VOICE_CHANNEL,
  createVoiceRateLimiter,
  isAuthorizedVoiceTarget,
  isValidIceCandidate,
  isValidSignalDescription,
  voiceChannelName
} from '../src/services/voice/voiceProtocol.js';

test('voice protocol scopes rooms by server-resolved branch and channel', () => {
  assert.equal(voiceChannelName(4), 'voice:4:branch');
  assert.equal(voiceChannelName(4, 'management'), 'voice:4:management');
  const sender = { branchId: 4, voiceChannelId: DEFAULT_VOICE_CHANNEL };
  assert.equal(isAuthorizedVoiceTarget(sender, { branchId: 4, voiceChannelId: DEFAULT_VOICE_CHANNEL }), true);
  assert.equal(isAuthorizedVoiceTarget(sender, { branchId: 5, voiceChannelId: DEFAULT_VOICE_CHANNEL }), false);
  assert.equal(isAuthorizedVoiceTarget(sender, { branchId: 4, voiceChannelId: 'management' }), false);
  assert.equal(isAuthorizedVoiceTarget({ ...sender, voiceChannelId: 'management' }, { branchId: 4, voiceChannelId: DEFAULT_VOICE_CHANNEL }), false);
});

test('voice protocol rejects forged and malformed signaling payloads', () => {
  assert.equal(isValidSignalDescription({ type: 'offer', sdp: 'v=0' }), true);
  assert.equal(isValidSignalDescription({ type: 'candidate', sdp: 'v=0' }), false);
  assert.equal(isValidSignalDescription({ type: 'answer', sdp: '' }), false);
  assert.equal(isValidSignalDescription({ type: 'offer', sdp: 'x'.repeat(100001) }), false);
  assert.equal(isValidIceCandidate({ candidate: 'candidate:1' }), true);
  assert.equal(isValidIceCandidate({ candidate: null }), true);
  assert.equal(isValidIceCandidate({ candidate: 'x'.repeat(10001) }), false);
  assert.equal(isValidIceCandidate('candidate:1'), false);
});

test('voice signaling rate limiter bounds a burst and resets its window', () => {
  const allow = createVoiceRateLimiter({ windowMs: 1000, maxEvents: 2 });
  assert.equal(allow(), true);
  assert.equal(allow(), true);
  assert.equal(allow(), false);
});
