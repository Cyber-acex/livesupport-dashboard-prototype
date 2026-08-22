import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeVoucherCode,
  calculateVoucherDiscount,
  validateVoucherForOrder,
  redeemVoucherForOrder,
  finalizeVoucherOrder
} from '../utils/voucherValidation.js';

const baseOrder = {
  subtotal: 15000,
  deliveryFee: 1500,
  items: [
    { id: 'burger-1', name: 'Smoky Burger', category: 'Burgers', quantity: 1, price: 8000 },
    { id: 'pasta-1', name: 'Pasta Bowl', category: 'Pasta', quantity: 1, price: 7000 }
  ]
};

const buildVoucher = (overrides = {}) => ({
  id: 1,
  code: 'SAVE20',
  type: 'percentage',
  value: 20,
  minimum_order: 0,
  minimum_quantity: 0,
  maximum_discount: null,
  usage_limit: null,
  used_count: 0,
  starts_at: null,
  expires_at: null,
  is_active: true,
  per_customer_limit: null,
  new_customers_only: false,
  applicable_items: null,
  applicable_categories: null,
  customer_id: null,
  customer_phone: null,
  ...overrides
});

test('normalizes voucher codes consistently', () => {
  assert.equal(normalizeVoucherCode(' save-20 '), 'SAVE20');
  assert.equal(normalizeVoucherCode('save20'), 'SAVE20');
});

test('valid percentage voucher calculates capped discount correctly', () => {
  const voucher = buildVoucher({ code: 'SAVE20', type: 'percentage', value: 20, maximum_discount: 2000 });
  const result = validateVoucherForOrder({ voucher, order: baseOrder, customer: { phone: '+2348000000001' }, existingRedemptions: 0 });
  assert.equal(result.valid, true);
  assert.equal(result.discountAmount, 2000);
  assert.equal(result.totalAfterDiscount, 15000 + 1500 - 2000);
});

test('valid fixed amount voucher returns fixed discount and never goes below zero', () => {
  const voucher = buildVoucher({ code: 'SAVE2000', type: 'fixed', value: 2000, minimum_order: 1000 });
  const result = validateVoucherForOrder({ voucher, order: { ...baseOrder, subtotal: 5000, deliveryFee: 800 }, customer: { phone: '+2348000000002' }, existingRedemptions: 0 });
  assert.equal(result.valid, true);
  assert.equal(result.discountAmount, 2000);
  assert.equal(result.totalAfterDiscount, 5000 + 800 - 2000);
});

test('expired voucher is rejected with reason VOUCHER_EXPIRED', () => {
  const voucher = buildVoucher({ expires_at: new Date(Date.now() - 60000).toISOString() });
  const result = validateVoucherForOrder({ voucher, order: baseOrder, customer: { phone: '+2348000000003' }, existingRedemptions: 0 });
  assert.equal(result.valid, false);
  assert.equal(result.reason, 'VOUCHER_EXPIRED');
});

test('not-yet-started voucher is rejected with reason VOUCHER_NOT_STARTED', () => {
  const voucher = buildVoucher({ starts_at: new Date(Date.now() + 60000).toISOString() });
  const result = validateVoucherForOrder({ voucher, order: baseOrder, customer: { phone: '+2348000000004' }, existingRedemptions: 0 });
  assert.equal(result.valid, false);
  assert.equal(result.reason, 'VOUCHER_NOT_STARTED');
});

test('inactive voucher is rejected with reason VOUCHER_INACTIVE', () => {
  const voucher = buildVoucher({ is_active: false });
  const result = validateVoucherForOrder({ voucher, order: baseOrder, customer: { phone: '+2348000000005' }, existingRedemptions: 0 });
  assert.equal(result.valid, false);
  assert.equal(result.reason, 'VOUCHER_INACTIVE');
});

test('unknown voucher is rejected with reason VOUCHER_NOT_FOUND', () => {
  const result = validateVoucherForOrder({ voucher: null, order: baseOrder, customer: { phone: '+2348000000006' }, existingRedemptions: 0, code: 'UNKNOWN' });
  assert.equal(result.valid, false);
  assert.equal(result.reason, 'VOUCHER_NOT_FOUND');
});

test('minimum order requirement is enforced', () => {
  const voucher = buildVoucher({ minimum_order: 20000 });
  const result = validateVoucherForOrder({ voucher, order: { ...baseOrder, subtotal: 15000 }, customer: { phone: '+2348000000007' }, existingRedemptions: 0 });
  assert.equal(result.valid, false);
  assert.equal(result.reason, 'MINIMUM_ORDER_NOT_MET');
});

test('minimum quantity requirement is enforced', () => {
  const voucher = buildVoucher({ minimum_quantity: 3 });
  const order = {
    ...baseOrder,
    items: [{ id: 'burger-1', name: 'Smoky Burger', category: 'Burgers', quantity: 1, price: 8000 }]
  };
  const result = validateVoucherForOrder({ voucher, order, customer: { phone: '+2348000000008' }, existingRedemptions: 0 });
  assert.equal(result.valid, false);
  assert.equal(result.reason, 'MINIMUM_QUANTITY_NOT_MET');
});

test('maximum discount clamps the calculated percentage discount', () => {
  const voucher = buildVoucher({ type: 'percentage', value: 50, maximum_discount: 5000 });
  const result = validateVoucherForOrder({ voucher, order: { ...baseOrder, subtotal: 70000 }, customer: { phone: '+2348000000009' }, existingRedemptions: 0 });
  assert.equal(result.valid, true);
  assert.equal(result.discountAmount, 5000);
});

test('usage limit is enforced for all customers', () => {
  const voucher = buildVoucher({ usage_limit: 1, used_count: 1 });
  const result = validateVoucherForOrder({ voucher, order: baseOrder, customer: { phone: '+2348000000010' }, existingRedemptions: 0 });
  assert.equal(result.valid, false);
  assert.equal(result.reason, 'VOUCHER_USAGE_LIMIT_REACHED');
});

test('per-customer usage limit is enforced', () => {
  const voucher = buildVoucher({ per_customer_limit: 1, code: 'SAVEPER' });
  const result = validateVoucherForOrder({ voucher, order: baseOrder, customer: { phone: '+2348000000011' }, existingRedemptions: 1 });
  assert.equal(result.valid, false);
  assert.equal(result.reason, 'CUSTOMER_USAGE_LIMIT_REACHED');
});

test('new-customer-only voucher blocks repeat customer orders', () => {
  const voucher = buildVoucher({ new_customers_only: true, code: 'NEWSAVE' });
  const result = validateVoucherForOrder({ voucher, order: baseOrder, customer: { phone: '+2348000000012' }, existingOrders: 2, existingRedemptions: 0 });
  assert.equal(result.valid, false);
  assert.equal(result.reason, 'NEW_CUSTOMER_ONLY');
});

test('item-specific voucher only discounts eligible items', () => {
  const voucher = buildVoucher({ type: 'percentage', value: 20, applicable_items: 'burger-1', code: 'SAVEITEM' });
  const result = validateVoucherForOrder({ voucher, order: baseOrder, customer: { phone: '+2348000000013' }, existingRedemptions: 0 });
  assert.equal(result.valid, true);
  assert.equal(result.eligibleSubtotal, 8000);
  assert.equal(result.discountAmount, 1600);
});

test('category-specific voucher only discounts matching category items', () => {
  const voucher = buildVoucher({ type: 'percentage', value: 15, applicable_categories: 'Burgers', code: 'SAVECAT' });
  const result = validateVoucherForOrder({ voucher, order: baseOrder, customer: { phone: '+2348000000014' }, existingRedemptions: 0 });
  assert.equal(result.valid, true);
  assert.equal(result.eligibleSubtotal, 8000);
  assert.equal(result.discountAmount, 1200);
});

test('free delivery voucher sets delivery fee to zero without changing subtotal', () => {
  const voucher = buildVoucher({ type: 'delivery', code: 'FREED' });
  const result = validateVoucherForOrder({ voucher, order: baseOrder, customer: { phone: '+2348000000015' }, existingRedemptions: 0 });
  assert.equal(result.valid, true);
  assert.equal(result.discountAmount, 0);
  assert.equal(result.deliveryFee, 0);
  assert.equal(result.totalAfterDiscount, 15000);
});

test('discount cannot make total negative', () => {
  const voucher = buildVoucher({ type: 'fixed', value: 999999, minimum_order: 0 });
  const result = validateVoucherForOrder({ voucher, order: { ...baseOrder, subtotal: 2500, deliveryFee: 300 }, customer: { phone: '+2348000000016' }, existingRedemptions: 0 });
  assert.equal(result.valid, true);
  assert.equal(result.discountAmount, 2800);
  assert.equal(result.totalAfterDiscount, 0);
});

test('redeemVoucherForOrder increments usage and stores a redemption record in the same transaction', async () => {
  const voucher = buildVoucher({ code: 'SAVEFINAL', usage_limit: 2, used_count: 1 });
  const tx = {
    voucher: {
      update: async ({ data }) => {
        assert.equal(data.used_count.increment, 1);
        return { id: 1, used_count: 2 };
      }
    },
    voucherRedemption: {
      create: async ({ data }) => ({ ...data, id: 10 })
    }
  };

  const result = await redeemVoucherForOrder({ voucher, order: { ...baseOrder, id: 77 }, customer: { id: 1, phone: '+2348000000017', name: 'Ada' }, tx });
  assert.equal(result.valid, true);
  assert.equal(result.redemption?.orderId, 77);
});

test('validation without redemption does not consume usage', () => {
  const voucher = buildVoucher({ code: 'SAVEDELAY', usage_limit: 3, used_count: 2 });
  const result = validateVoucherForOrder({ voucher, order: baseOrder, customer: { phone: '+2348000000018' }, existingRedemptions: 0 });
  assert.equal(result.valid, true);
  assert.equal(result.discountAmount, 3000);
  assert.equal(voucher.used_count, 2);
});

test('final order total matches deterministic backend calculation', async () => {
  const voucher = buildVoucher({ type: 'percentage', value: 20, maximum_discount: 5000, code: 'SAVE20B' });
  const result = await finalizeVoucherOrder({ voucher, order: { ...baseOrder, subtotal: 20000, deliveryFee: 1200 }, customer: { phone: '+2348000000019' } });
  assert.equal(result.finalTotal, 20000 + 1200 - 4000);
  assert.equal(result.discountAmount, 4000);
});
