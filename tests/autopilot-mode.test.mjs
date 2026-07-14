import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeAutopilotMode,
  canUseAiReply,
  canAutoSendReplies
} from '../src/services/autopilotMode.js';

test('normalizes supported autopilot modes', () => {
  assert.equal(normalizeAutopilotMode('Assist'), 'assist');
  assert.equal(normalizeAutopilotMode('AUTO'), 'auto');
  assert.equal(normalizeAutopilotMode('Manual'), 'manual');
  assert.equal(normalizeAutopilotMode('unknown'), 'assist');
});

test('mode capabilities match the requested behavior', () => {
  assert.equal(canUseAiReply('assist'), true);
  assert.equal(canUseAiReply('auto'), true);
  assert.equal(canUseAiReply('manual'), false);

  assert.equal(canAutoSendReplies('assist'), false);
  assert.equal(canAutoSendReplies('auto'), true);
  assert.equal(canAutoSendReplies('manual'), false);
});
