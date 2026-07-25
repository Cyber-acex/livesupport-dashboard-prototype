import test from 'node:test';
import assert from 'node:assert/strict';
import { buildIncomingMessageNotification, shouldShowIncomingMessageNotification, buildTicketEventNotification } from '../src/utils/inboxNotifications.js';

test('buildIncomingMessageNotification includes the incoming message content', () => {
  const notification = buildIncomingMessageNotification({
    message: 'Hi, is my order ready?',
    sender: 'customer',
    customer_name: 'Ada'
  });

  assert.equal(notification, 'New message from Ada: Hi, is my order ready?');
});

test('buildIncomingMessageNotification falls back to sender when no customer name is available', () => {
  const notification = buildIncomingMessageNotification({
    message: 'Looking for an update',
    sender: 'customer'
  });

  assert.equal(notification, 'New message from customer: Looking for an update');
});

test('shouldShowIncomingMessageNotification is false for the active conversation', () => {
  assert.equal(shouldShowIncomingMessageNotification({ conversation_id: 42, message: 'Hi' }, '42'), false);
});

test('shouldShowIncomingMessageNotification is true for other conversations', () => {
  assert.equal(shouldShowIncomingMessageNotification({ conversation_id: 43, message: 'Hi' }, '42'), true);
});

test('buildTicketEventNotification formats ticket created events', () => {
  const notification = buildTicketEventNotification({ id: 12, subject: 'Refund request' }, 'created');
  assert.equal(notification, 'New ticket created #12: Refund request');
});

test('buildTicketEventNotification formats resolved events without subject', () => {
  const notification = buildTicketEventNotification({ ticket_id: 7 }, 'resolved');
  assert.equal(notification, 'Ticket #7 resolved');
});
