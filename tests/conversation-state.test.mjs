import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultConversationSession, mergeConversationState, buildSessionOrderKey, applyWorkflowTransition, ORDER_WORKFLOW_STATES } from '../utils/conversationState.js';

test('conversation session preserves the active draft order and workflow state between updates', () => {
  const session = createDefaultConversationSession({
    conversationId: 42,
    sessionId: 'session-42',
    branchId: 3,
    customerId: 5
  });

  const resumed = mergeConversationState(session, {
    workflowState: 'Waiting for Allergy Confirmation',
    draftOrder: {
      items: [{ name: 'Chicken Burger', quantity: 1 }],
      notes: 'No onions',
      pickup: 'delivery'
    },
    pendingQuestions: ['Do you have any allergies?']
  });

  const updated = mergeConversationState(resumed, {
    workflowState: 'Building Order',
    draftOrder: {
      ...resumed.draftOrder,
      items: [{ name: 'Chicken Burger', quantity: 1 }, { name: 'Sparkling Water', quantity: 2 }],
      allergens: ['dairy']
    },
    history: [
      { role: 'customer', message: 'I want a chicken burger' },
      { role: 'ai', message: 'Do you have any allergies?' },
      { role: 'customer', message: 'I am allergic to dairy' }
    ]
  });

  assert.equal(updated.workflowState, 'Building Order');
  assert.equal(updated.draftOrder.items.length, 2);
  assert.equal(updated.draftOrder.allergens[0], 'dairy');
  assert.equal(updated.pendingQuestions[0], 'Do you have any allergies?');
  assert.equal(updated.branchId, 3);
  assert.equal(buildSessionOrderKey({ conversationId: 42, sessionId: 'session-42' }), 'conversation:42:session:session-42:order');
});

test('explicit workflow transitions keep allergy, pickup, payment, and order-creation states persistent', () => {
  const baseSession = createDefaultConversationSession({
    conversationId: 101,
    sessionId: 'session-101',
    branchId: 7,
    customerId: 9
  });

  const allergyState = applyWorkflowTransition(baseSession, {
    customerMessage: 'I am allergic to dairy.',
    draftOrder: {
      items: [{ name: 'Chicken Burger', quantity: 1 }],
      pickup: 'delivery',
      allergies: ['dairy']
    }
  });

  assert.equal(allergyState.workflowState, 'Waiting for Allergy Confirmation');
  assert.equal(allergyState.pendingQuestions[0], 'Do you have any allergies?');

  const pickupState = applyWorkflowTransition(allergyState, {
    customerMessage: 'Delivery to 2 Oak Street',
    draftOrder: {
      ...allergyState.draftOrder,
      address: '2 Oak Street',
      pickup: 'delivery'
    }
  });

  assert.equal(pickupState.workflowState, 'Waiting for Payment Method');
  assert.equal(pickupState.draftOrder.address, '2 Oak Street');

  const paymentState = applyWorkflowTransition(pickupState, {
    customerMessage: 'Pay by card',
    draftOrder: {
      ...pickupState.draftOrder,
      paymentMethod: 'card'
    }
  });

  assert.equal(paymentState.workflowState, 'Ready to Create Order');
  assert.equal(paymentState.draftOrder.paymentMethod, 'card');

  const orderCreated = applyWorkflowTransition(paymentState, {
    customerMessage: 'Yes, place it now',
    draftOrder: {
      ...paymentState.draftOrder,
      orderId: 'ORD-123',
      total: 24.5,
      status: 'confirmed'
    }
  });

  assert.equal(orderCreated.workflowState, 'Order Created');
  assert.equal(orderCreated.draftOrder.orderId, 'ORD-123');
  assert.ok(ORDER_WORKFLOW_STATES.includes('Waiting for Allergy Confirmation'));
});

test('new cart updates clear stale order IDs so the next order gets a fresh ID', () => {
  const previousOrder = createDefaultConversationSession({
    conversationId: 202,
    sessionId: 'session-202',
    draftOrder: {
      items: [{ name: 'BBQ Chicken', quantity: 1 }],
      orderId: 'ORD-OLD-100',
      total: 12.5,
      status: 'confirmed'
    }
  });

  const nextDraft = mergeConversationState(previousOrder, {
    workflowState: 'Building Order',
    draftOrder: {
      items: [{ name: 'Grilled Chicken Steak', quantity: 2 }],
      total: 26.0,
      paymentMethod: 'card'
    }
  });

  assert.equal(nextDraft.draftOrder.orderId, null);
  assert.equal(nextDraft.workflowState, 'Building Order');
  assert.equal(nextDraft.draftOrder.items[0].name, 'Grilled Chicken Steak');
});
