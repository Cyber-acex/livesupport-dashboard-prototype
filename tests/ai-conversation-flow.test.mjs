import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SUPPORTED_INTENTS,
  detectConversationIntent,
  shouldInjectBusinessContext,
  buildPromptContext,
  createGreetingReply
} from '../utils/aiConversationFlow.js';
import { resolveAiRequestConfig } from '../replies.js';

test('detects greetings as a greeting intent without business context', () => {
  const intent = detectConversationIntent('Hi there');
  assert.equal(intent, 'Greeting');
  assert.ok(SUPPORTED_INTENTS.includes(intent));
});

test('detects Messenger greetings containing invisible formatting characters', () => {
  assert.equal(detectConversationIntent('he\u200By'), 'Greeting');
});

test('keeps greeting replies simple and avoids business context', () => {
  const reply = createGreetingReply();
  assert.match(reply, /How can I help you today/);
  assert.doesNotMatch(reply, /order|refund|delivery|payment|ticket/i);
});

test('only injects order context for order-related intents', () => {
  const orderIntent = detectConversationIntent('Where is my order?');
  assert.equal(orderIntent, 'Order Tracking');
  assert.equal(shouldInjectBusinessContext(orderIntent), true);

  const generalIntent = detectConversationIntent('How are you today?');
  assert.equal(generalIntent, 'General Conversation');
  assert.equal(shouldInjectBusinessContext(generalIntent), false);

  const context = buildPromptContext({
    intent: orderIntent,
    message: 'Where is my order?',
    businessContext: { order: { id: 'ORD-123', status: 'On the way' } }
  });

  assert.match(context, /ORD-123/);
  assert.doesNotMatch(context, /refund|payment|ticket/i);
});

test('does not classify issue-free greetings as a greeting intent when additional request text is present', () => {
  const intent = detectConversationIntent('Hi there, I need help with my order');
  assert.notEqual(intent, 'Greeting');
  assert.equal(intent, 'Order Tracking');
});

test('stale order confirmation state is not included when the customer just greets', () => {
  const staleState = {
    workflowState: 'Ready to Create Order',
    pendingQuestions: ['Would you like me to place the order?'],
    draftOrder: { items: [{ name: 'Cheese Burger', quantity: 1 }] }
  };

  const prompt = buildPromptContext({
    intent: 'Greeting',
    message: 'Hey',
    conversationState: staleState,
    conversationHistory: [{ sender: 'received', message: 'Hey' }, { sender: 'sent', message: 'Would you like me to place the order?' }]
  });

  assert.match(prompt, /Customer message: "Hey"/i);
  assert.doesNotMatch(prompt, /Ready to Create Order|place the order|Cheese Burger|Active order/i);
});

test('uses the faster AI config for Messenger responses', () => {
  const config = resolveAiRequestConfig();

  assert.equal(config.model, 'mistral-small-latest');
  assert.ok(config.timeoutMs <= 4500, 'AI timeout must be under 4.5s');
  assert.ok(config.maxTokens <= 180, 'Response length should stay compact');
});
