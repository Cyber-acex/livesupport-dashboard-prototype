import test from 'node:test';
import assert from 'node:assert/strict';
import { canUseTableForOrder, buildOrderTableTransitionPayload } from '../src/utils/tableReservation.js';

test('allows reserved tables to be converted into active table orders', () => {
  const table = { status: 'reserved', customerName: 'Jane Doe' };
  const now = new Date('2026-01-01T12:00:00.000Z');

  assert.equal(canUseTableForOrder(table), true);
  assert.deepEqual(buildOrderTableTransitionPayload(table, now), {
    status: 'occupied',
    customerName: 'Jane Doe',
    reservedUntil: null,
    isBooking: false,
    sessionStartedAt: now.toISOString()
  });
});

test('blocks tables that are unavailable for service', () => {
  assert.equal(canUseTableForOrder({ status: 'cleaning' }), false);
  assert.equal(canUseTableForOrder({ status: 'maintenance' }), false);
  assert.equal(canUseTableForOrder({ status: 'out_of_service' }), false);
});
