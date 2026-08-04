import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeIncomingPlatformMessage, buildPendingSessionPayload } from '../services/platformConversationService.js';

test('normalizes WhatsApp payload into a shared internal format', () => {
  const normalized = normalizeIncomingPlatformMessage({
    platform: 'whatsapp',
    platformUserId: '2348012345678',
    messageId: 'wamid.123',
    customerName: 'Ada',
    text: 'Hello there',
    timestamp: '2026-07-28T10:00:00.000Z',
    attachments: [{ type: 'image' }],
    metadata: { source: 'webhook' }
  });

  assert.equal(normalized.platform, 'whatsapp');
  assert.equal(normalized.platformUserId, '2348012345678');
  assert.equal(normalized.customerName, 'Ada');
  assert.equal(normalized.messageType, 'text');
  assert.equal(normalized.text, 'Hello there');
  assert.equal(normalized.attachments.length, 1);
  assert.equal(normalized.timestamp, '2026-07-28T10:00:00.000Z');
});

test('builds a pending session payload that keeps earlier customer messages', () => {
  const payload = buildPendingSessionPayload({
    platform: 'messenger',
    platformUserId: 'page-user-1',
    initialMessage: 'Hello',
    pendingMessages: ['Hello', 'Anyone there?']
  });

  assert.equal(payload.state, 'WAITING_FOR_BRANCH');
  assert.deepEqual(JSON.parse(payload.pending_messages), ['Hello', 'Anyone there?']);
  assert.equal(payload.platform, 'messenger');
  assert.equal(payload.platform_user_id, 'page-user-1');
});
