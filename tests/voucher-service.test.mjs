import test from 'node:test';
import assert from 'node:assert/strict';
import { generateVoucherCode, calculateDiscount, getVoucherStatus } from '../utils/voucherService.js';

test('generateVoucherCode creates uppercase alphanumeric codes without ambiguous characters', () => {
  const code = generateVoucherCode('SAVE');
  assert.match(code, /^SAVE-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
  assert.equal(code.includes('O'), false);
  assert.equal(code.includes('0'), false);
  assert.equal(code.includes('I'), false);
  assert.equal(code.includes('1'), false);
});

test('calculateDiscount applies percentage discounts with a maximum cap', () => {
  const result = calculateDiscount({ type: 'percentage', value: 10, subtotal: 200, maximumDiscount: 15 });
  assert.equal(result.discountAmount, 15);
  assert.equal(result.newTotal, 185);
});

test('calculateDiscount caps fixed discounts at the subtotal', () => {
  const result = calculateDiscount({ type: 'fixed', value: 80, subtotal: 60 });
  assert.equal(result.discountAmount, 60);
  assert.equal(result.newTotal, 0);
});

test('getVoucherStatus returns the correct label based on voucher state', () => {
  assert.equal(getVoucherStatus({ is_active: true, expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), usage_limit: 10, used_count: 2 }), 'Active');
  assert.equal(getVoucherStatus({ is_active: false }), 'Disabled');
  assert.equal(getVoucherStatus({ is_active: true, expires_at: new Date(Date.now() - 1000), usage_limit: 10, used_count: 2 }), 'Expired');
  assert.equal(getVoucherStatus({ is_active: true, expires_at: new Date(Date.now() + 1000), usage_limit: 2, used_count: 2 }), 'Fully Used');
});
