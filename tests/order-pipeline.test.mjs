import test from 'node:test';
import assert from 'node:assert/strict';
import { formatMenuAvailabilityReply, shouldAskOrderConfirmation } from '../replies.js';
import { resolveMenuItemMatches, calculateOrderPricing, validateCreatedOrder, buildOrderConfirmationMessage } from '../utils/orderPipeline.js';
import { createStructuredOrderConfirmation, validateStructuredConfirmation, createPostOrderConversationState } from '../utils/orderStateManagement.js';

test('structured confirmation requires a database Order ID and confirmed status', () => {
  const order = {
    id: 42,
    order_id: 'ORD-42',
    customer_name: 'Ada',
    status: 'confirmed',
    order_date: new Date().toISOString()
  };
  const confirmation = createStructuredOrderConfirmation(
    order,
    [{ name: 'Margherita', quantity: 1, unitPrice: 8.99, lineTotal: 8.99 }],
    { subtotal: 8.99, tax: 0.72, deliveryFee: 3.5, discountAmount: 0, finalTotal: 13.21 }
  );

  assert.equal(validateStructuredConfirmation(confirmation), true);
  assert.equal(confirmation.orderId, 'ORD-42');
  assert.throws(() => createStructuredOrderConfirmation(
    { ...order, order_id: null },
    [{ name: 'Margherita', quantity: 1, unitPrice: 8.99, lineTotal: 8.99 }],
    { subtotal: 8.99, tax: 0.72, deliveryFee: 3.5, discountAmount: 0, finalTotal: 13.21 }
  ), /Order ID/);
});

test('post-order conversation state clears the completed draft and preserves only the latest ID in history', () => {
  const next = createPostOrderConversationState({
    conversationId: 7,
    workflowState: 'Ready to Create Order',
    draftOrder: { items: [{ name: 'Old item', quantity: 1 }], orderId: 'ORD-OLD' },
    history: []
  }, { order_id: 'ORD-NEW' });

  assert.equal(next.workflowState, 'Order Created');
  assert.equal(next.draftOrder.orderId, null);
  assert.deepEqual(next.draftOrder.items, []);
  assert.match(next.history.at(-1).message, /ORD-NEW/);
});

test('resolveMenuItemMatches flags unavailable items and suggests alternatives', () => {
  const menuRows = [
    { id: 1, key_name: 'margherita', name: 'Margherita', price: 8.99, available: 10 },
    { id: 2, key_name: 'pepperoni', name: 'Pepperoni', price: 9.99, available: 3 },
    { id: 3, key_name: 'classic_burger', name: 'Classic Burger', price: 8.99, available: 5 }
  ];

  const result = resolveMenuItemMatches([
    { name: 'Margherita', quantity: 2 },
    { name: 'Mystery Dish', quantity: 1 }
  ], menuRows);

  assert.equal(result.resolved.length, 1);
  assert.equal(result.unavailable.length, 1);
  assert.equal(result.unavailable[0].name, 'Mystery Dish');
  assert.ok(result.unavailable[0].suggestions.length > 0);
});

test('calculateOrderPricing computes server-side totals from database prices', () => {
  const pricing = calculateOrderPricing([
    { name: 'Margherita', quantity: 2, unitPrice: 8.99 },
    { name: 'Classic Burger', quantity: 1, unitPrice: 8.99 }
  ], { taxRate: 0.08, deliveryFee: 3.5, freeDeliveryThreshold: 100, discountAmount: 0 });

  assert.equal(pricing.subtotal, 26.97);
  assert.equal(pricing.tax, 2.16);
  assert.equal(pricing.deliveryFee, 3.5);
  assert.equal(pricing.finalTotal, 32.63);
});

test('buildOrderConfirmationMessage includes the backend confirmation details', () => {
  const message = buildOrderConfirmationMessage({
    orderId: 'ORD-123',
    customerName: 'Ada',
    customerId: '234709850849',
    lineItems: [{ name: 'Margherita', quantity: 2, unitPrice: 8.99, lineTotal: 17.98 }],
    pricing: { subtotal: 17.98, tax: 1.44, deliveryFee: 3.5, discountAmount: 0, finalTotal: 22.92 },
    estimatedPreparationTime: '25 mins',
    estimatedDeliveryTime: '40 mins',
    status: 'Confirmed'
  });

  assert.match(message, /Order ID: ORD-123/);
  assert.match(message, /Customer: 234709850849/);
  assert.match(message, /Ordered items:/);
  assert.match(message, /• Margherita x2 @ \$8.99 = \$17.98/);
  assert.match(message, /Grand total: \$22.92/);
  assert.match(message, /Status: Confirmed/);
});

test('validateCreatedOrder accepts only the matching system-created order', () => {
  const lineItems = [{ name: 'Margherita', quantity: 2, unitPrice: 8.99, lineTotal: 17.98 }];
  const pricing = { subtotal: 17.98, tax: 1.44, deliveryFee: 3.5, discountAmount: 0, finalTotal: 22.92 };
  const order = {
    order_id: 'ORD-123',
    product: 'Margherita x2',
    amount: 17.98,
    subtotal: 17.98,
    total_amount: 22.92,
    final_total: 22.92,
    discount_amount: 0,
    status: 'confirmed'
  };

  assert.equal(validateCreatedOrder(order, { lineItems, pricing }), true);
  assert.equal(validateCreatedOrder({ ...order, order_id: null }, { lineItems, pricing }), false);
  assert.equal(validateCreatedOrder({ ...order, total_amount: 21.92 }, { lineItems, pricing }), false);
});

test('strict order confirmation only fires after the order is complete and ready', () => {
  assert.equal(shouldAskOrderConfirmation('3 BBQ Chicken please', {
    workflowState: 'Building Order',
    pendingQuestions: ['What delivery address should I use?'],
    draftOrder: { items: [{ name: 'BBQ Chicken', quantity: 3 }] }
  }), false);

  assert.equal(shouldAskOrderConfirmation('No, that’s all', {
    workflowState: 'Ready to Create Order',
    pendingQuestions: [],
    draftOrder: { items: [{ name: 'BBQ Chicken', quantity: 3 }] }
  }), true);
});

test('menu availability replies use the supplied database rows', () => {
  const menuRows = [
    { name: 'Jollof Rice & Grilled Chicken', price: 14.50, available: 24 },
    { name: 'Peppered Snail', price: 18.00, available: 0 }
  ];

  assert.equal(
    formatMenuAvailabilityReply('Do you have Jollof Rice?', menuRows),
    'Yes, Jollof Rice & Grilled Chicken is on the current menu and available now (24 available).'
  );
  assert.equal(
    formatMenuAvailabilityReply('Is Peppered Snail available?', menuRows),
    'Peppered Snail is currently unavailable.'
  );
  assert.equal(
    formatMenuAvailabilityReply('Do you have Chicken Suya?', menuRows),
    "I couldn't find Chicken Suya on the current menu."
  );
});

test('natural confirmation wording stays in the order confirmation flow', () => {
  const state = {
    workflowState: 'Ready to Create Order',
    pendingQuestions: [],
    draftOrder: { items: [{ name: 'BBQ Beef Ribs', quantity: 1 }] }
  };

  assert.equal(detectConversationIntent('come on confirm my order', state), 'Order Confirmation');
});
