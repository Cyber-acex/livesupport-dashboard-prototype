import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeConversationMessagesForDisplay } from '../utils/conversationHistory.js';

test('mergeConversationMessagesForDisplay orders customer messages and agent replies in chronological order', () => {
  const rows = [
    { id: 2, conversation_id: 10, sender: 'customer', message: 'Hello there', created_at: '2024-01-01T00:00:02.000Z' },
    { id: 4, conversation_id: 10, sender: 'sent', message: 'Hi! How can I help?', created_at: '2024-01-01T00:00:04.000Z' },
    { id: 1, conversation_id: 10, sender: 'customer', message: 'Hi', created_at: '2024-01-01T00:00:01.000Z' },
    { id: 3, conversation_id: 10, sender: 'sent', message: 'Thanks for waiting', created_at: '2024-01-01T00:00:03.000Z' }
  ];

  const merged = mergeConversationMessagesForDisplay(rows);

  assert.deepEqual(merged.map((row) => row.message), ['Hi', 'Hello there', 'Thanks for waiting', 'Hi! How can I help?']);
  assert.deepEqual(merged.map((row) => row.sender), ['customer', 'customer', 'sent', 'sent']);
});
