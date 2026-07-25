import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveMenuItemMatches, calculateOrderPricing, buildOrderConfirmationMessage } from '../utils/orderPipeline.js';

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
    lineItems: [{ name: 'Margherita', quantity: 2, unitPrice: 8.99, lineTotal: 17.98 }],
    pricing: { subtotal: 17.98, tax: 1.44, deliveryFee: 3.5, discountAmount: 0, finalTotal: 22.92 },
    estimatedPreparationTime: '25 mins',
    estimatedDeliveryTime: '40 mins',
    status: 'Confirmed'
  });

  assert.match(message, /Order ID: ORD-123/);
  assert.match(message, /Customer: Ada/);
  assert.match(message, /Grand total: \$22.92/);
  assert.match(message, /Status: Confirmed/);
});
