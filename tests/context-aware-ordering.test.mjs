import test from 'node:test';
import assert from 'node:assert/strict';
import { detectConversationIntent, buildPromptContext, isAddressReplyForPendingQuestion } from '../utils/aiConversationFlow.js';

test('address provided after delivery prompt is treated as delivery context, not order modification', () => {
  const state = {
    workflowState: 'Waiting for Delivery Address',
    pendingQuestions: ['Where should we deliver your order?'],
    draftOrder: { items: [{ name: 'BBQ Chicken', quantity: 1 }, { name: 'Grilled Ribeye Steak', quantity: 2 }] }
  };

  const message = "my address is: 1 Saidat Kilani Street off Abaranje Road";
  assert.equal(detectConversationIntent(message, state), 'Delivery');
  assert.equal(isAddressReplyForPendingQuestion(message, state), true);
  const prompt = buildPromptContext({
    intent: detectConversationIntent(message, state),
    message,
    conversationHistory: [{ sender: 'sent', message: 'Could you confirm your delivery address so I can check the delivery time?' }],
    conversationState: state
  });
  assert.match(prompt, /Previous assistant message/i);
  assert.match(prompt, /Waiting for Delivery Address/i);
});

test('customer confirmation after final order step stays in order confirmation flow', () => {
  const state = {
    workflowState: 'Ready to Create Order',
    pendingQuestions: ['Would you like me to place the order?'],
    draftOrder: { items: [{ name: 'BBQ Chicken', quantity: 1 }], total: 14.99 }
  };

  assert.equal(detectConversationIntent('yes, place it', state), 'Order Confirmation');
});

test('modification language is only treated as order modification when the customer is actively editing an order', () => {
  const state = {
    workflowState: 'Building Order',
    pendingQuestions: ['What would you like to order?'],
    draftOrder: { items: [{ name: 'Chicken Burger', quantity: 1 }] }
  };

  assert.equal(detectConversationIntent('actually make that two', state), 'Order Modification');
  assert.equal(detectConversationIntent('what time do you close?', state), 'FAQ');
});
