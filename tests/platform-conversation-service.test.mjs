import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeIncomingPlatformMessage, buildPendingSessionPayload, processPlatformMessage, shouldBypassBranchSelectionForPlatform } from '../services/platformConversationService.js';

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

test('creates a pending branch session for a first message without creating a conversation', async () => {
  const result = await processPlatformMessage({
    platform: 'web',
    platformUserId: `web-guest-isolated-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    phone: `web-guest-isolated-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    sender: 'received',
    text: 'Hello there',
    sendReply: async () => {}
  });

  assert.equal(result.handled, true);
  assert.equal(result.path, 'pending-session-created');
  assert.equal(result.conversationId, undefined);
});

test('routes a first WhatsApp message through the same pending branch workflow', async () => {
  const whatsappUserId = `whatsapp-guest-isolated-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const result = await processPlatformMessage({
    platform: 'whatsapp',
    platformUserId: whatsappUserId,
    phone: whatsappUserId,
    sender: 'received',
    text: 'Hello there',
    sendReply: async () => {}
  });

  assert.equal(result.handled, true);
  assert.equal(result.path, 'pending-session-created');
  assert.equal(result.conversationId, undefined);
});

test('routes a first Messenger message directly into the Ikeja branch without prompting for selection', async () => {
  globalThis.io = { to: () => ({ emit: () => {} }) };
  const messengerUserId = `messenger-guest-isolated-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const result = await processPlatformMessage({
    platform: 'messenger',
    platformUserId: messengerUserId,
    phone: messengerUserId,
    sender: 'received',
    text: 'Hello there',
    sendReply: async () => {}
  });

  assert.equal(result.handled, true);
  assert.equal(result.path, 'existing-conversation');
  assert.ok(result.conversationId > 0);
  delete globalThis.io;
});

test('falls back to direct message handling for Messenger when no active branches are available', () => {
  assert.equal(shouldBypassBranchSelectionForPlatform('messenger', []), true);
  assert.equal(shouldBypassBranchSelectionForPlatform('messenger', [{ id: 1, name: 'Main', is_active: true, is_archived: false }]), false);
  assert.equal(shouldBypassBranchSelectionForPlatform('whatsapp', []), false);
});
