import test from 'node:test';
import assert from 'node:assert/strict';
import { buildVoucherShareMessage } from '../utils/voucherShareMessage.js';

test('buildVoucherShareMessage includes voucher code and type details', () => {
  const message = buildVoucherShareMessage({ code: 'SAVE-ABC1-1234', type: 'percentage', value: 10 }, 'Ada');
  assert.match(message, /SAVE-ABC1-1234/);
  assert.match(message, /10%/);
  assert.match(message, /Ada/);
});
