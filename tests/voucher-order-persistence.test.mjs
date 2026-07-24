import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareVoucherOrderPayload } from '../utils/voucherStorage.js';

test('prepareVoucherOrderPayload formats voucher metadata for order persistence', () => {
  const payload = prepareVoucherOrderPayload({
    voucherCode: 'SAVE-7KQ2-MXP8',
    voucherType: 'percentage',
    voucherDiscount: 15,
    subtotal: 200,
    finalTotal: 185
  });

  assert.deepEqual(payload, {
    voucher_code: 'SAVE-7KQ2-MXP8',
    discount_type: 'percentage',
    discount_amount: 15,
    subtotal: 200,
    final_total: 185
  });
});
