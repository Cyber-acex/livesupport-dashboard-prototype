import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeOrderStatusForDelivery, shouldCreateDeliveryForOrder, buildDeliveryFromOrder } from '../utils/deliveryOrderSync.js';

test('completed orders become delivered entries and create delivery rows', () => {
  assert.equal(normalizeOrderStatusForDelivery('completed'), 'Delivered');
  assert.equal(normalizeOrderStatusForDelivery('processing'), 'Out For Delivery');
  assert.equal(shouldCreateDeliveryForOrder('pending'), true);
  assert.equal(shouldCreateDeliveryForOrder('cancelled'), false);

  const delivery = buildDeliveryFromOrder({
    id: 42,
    orderId: 'ORD-42',
    customerName: 'Ada',
    address: '12 Main St',
    status: 'completed',
    date: '2026-07-25T10:00:00.000Z',
    riderName: 'Mina'
  });

  assert.equal(delivery.deliveryStatus, 'Delivered');
  assert.equal(delivery.orderId, 42);
  assert.equal(delivery.customerName, 'Ada');
  assert.equal(delivery.source, 'order');
});
