import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeOrderRiderId } from '../utils/orderRider.js';

test('order rider is optional when creating an order', () => {
  assert.equal(normalizeOrderRiderId(undefined), null);
  assert.equal(normalizeOrderRiderId(''), null);
  assert.equal(normalizeOrderRiderId('   '), null);
  assert.equal(normalizeOrderRiderId('9'), 9);
  assert.equal(normalizeOrderRiderId(12), 12);
});
