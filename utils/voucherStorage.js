import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { calculateDiscount, generateVoucherCode, getVoucherStatus } from './voucherService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STORAGE_PATH = path.join(__dirname, '..', 'data', 'vouchers.json');

function ensureFile() {
  const dir = path.dirname(STORAGE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(STORAGE_PATH)) {
    fs.writeFileSync(STORAGE_PATH, JSON.stringify({ vouchers: [], redemptions: [] }, null, 2));
  }
}

function readStore() {
  ensureFile();
  const raw = fs.readFileSync(STORAGE_PATH, 'utf8');
  return JSON.parse(raw || '{"vouchers":[],"redemptions":[]}');
}

function writeStore(store) {
  ensureFile();
  fs.writeFileSync(STORAGE_PATH, JSON.stringify(store, null, 2));
}

export function prepareVoucherOrderPayload({ voucherCode, voucherType, voucherDiscount, subtotal, finalTotal } = {}) {
  const safeSubtotal = Number(subtotal || 0);
  const safeDiscount = Number(voucherDiscount || 0);
  const safeFinalTotal = Number(finalTotal || subtotal || 0);
  return {
    voucher_code: voucherCode || null,
    discount_type: voucherType || null,
    discount_amount: safeDiscount,
    subtotal: safeSubtotal,
    final_total: safeFinalTotal
  };
}

export function listVouchers() {
  const store = readStore();
  const vouchers = (store.vouchers || []).map((voucher) => ({
    ...voucher,
    status: getVoucherStatus(voucher),
    is_active: Boolean(voucher.is_active)
  }));
  return vouchers.sort((a, b) => new Date(b.created_at || b.createdAt || 0) - new Date(a.created_at || a.createdAt || 0));
}

export function createVoucher(payload = {}) {
  const store = readStore();
  const code = generateVoucherCode((payload.prefix || 'SAVE').toUpperCase());

  const voucher = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    code,
    type: payload.type || 'percentage',
    value: Number(payload.value || 0),
    minimum_order: Number(payload.minimumOrder || 0),
    maximum_discount: Number(payload.maximumDiscount || 0),
    usage_limit: payload.usageLimit === '' || payload.usageLimit === null || payload.usageLimit === undefined ? null : Number(payload.usageLimit || 0),
    used_count: 0,
    expires_at: payload.expiresAt ? new Date(payload.expiresAt).toISOString() : null,
    is_active: payload.isActive !== false,
    created_by: payload.createdBy || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  store.vouchers.push(voucher);
  writeStore(store);
  return { voucher, message: 'Voucher created successfully.' };
}

export function updateVoucher(voucherId, payload = {}) {
  const store = readStore();
  const voucher = store.vouchers.find((item) => String(item.id) === String(voucherId));
  if (!voucher) throw new Error('Voucher not found.');
  Object.assign(voucher, payload, { updated_at: new Date().toISOString() });
  writeStore(store);
  return voucher;
}

export function deleteVoucher(voucherId) {
  const store = readStore();
  store.vouchers = store.vouchers.filter((item) => String(item.id) !== String(voucherId));
  store.redemptions = store.redemptions.filter((item) => String(item.voucher_id) !== String(voucherId));
  writeStore(store);
  return true;
}

export function findVoucher(code) {
  const vouchers = listVouchers();
  return vouchers.find((item) => String(item.code).toUpperCase() === String(code || '').toUpperCase()) || null;
}

export function validateVoucher(code, subtotal) {
  const voucher = findVoucher(code);
  if (!voucher) return { valid: false, error: 'Voucher not found.' };
  if (!voucher.is_active) return { valid: false, error: 'Voucher is disabled.' };
  const expiresAt = voucher.expires_at ? new Date(voucher.expires_at) : null;
  if (expiresAt && expiresAt < new Date()) return { valid: false, error: 'Voucher has expired.' };
  const usageLimit = Number(voucher.usage_limit || 0);
  const usedCount = Number(voucher.used_count || 0);
  if (usageLimit > 0 && usedCount >= usageLimit) return { valid: false, error: 'Voucher usage limit reached.' };
  const minimumOrder = Number(voucher.minimum_order || 0);
  if (subtotal < minimumOrder) return { valid: false, error: 'Minimum order amount not met.' };
  return { valid: true, voucher };
}

export function redeemVoucher(code, subtotal, orderId = null) {
  const store = readStore();
  const voucher = store.vouchers.find((item) => String(item.code).toUpperCase() === String(code || '').toUpperCase());
  if (!voucher) return { valid: false, error: 'Voucher not found.' };
  if (!voucher.is_active) return { valid: false, error: 'Voucher is disabled.' };
  if (voucher.expires_at && new Date(voucher.expires_at) < new Date()) return { valid: false, error: 'Voucher has expired.' };
  const usageLimit = Number(voucher.usage_limit || 0);
  const usedCount = Number(voucher.used_count || 0);
  if (usageLimit > 0 && usedCount >= usageLimit) return { valid: false, error: 'Voucher usage limit reached.' };
  const minimumOrder = Number(voucher.minimum_order || 0);
  if (Number(subtotal || 0) < minimumOrder) return { valid: false, error: 'Minimum order amount not met.' };
  const calc = calculateDiscount({ type: voucher.type, value: voucher.value, subtotal: Number(subtotal || 0), maximumDiscount: voucher.maximum_discount || null });
  voucher.used_count = Number(voucher.used_count || 0) + 1;
  voucher.updated_at = new Date().toISOString();
  store.redemptions.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    voucher_id: voucher.id,
    voucher_code: voucher.code,
    order_id: orderId,
    discount_type: voucher.type,
    discount_amount: calc.discountAmount,
    subtotal: Number(subtotal || 0),
    final_total: calc.newTotal,
    redeemed_at: new Date().toISOString()
  });
  writeStore(store);
  return { valid: true, voucher, pricing: calc };
}

export function getVoucherStats() {
  const store = readStore();
  const vouchers = listVouchers();
  const active = vouchers.filter((item) => item.is_active).length;
  const expired = vouchers.filter((item) => item.status === 'Expired').length;
  const disabled = vouchers.filter((item) => item.status === 'Disabled').length;
  const redemptions = (store.redemptions || []).length;
  const mostUsed = vouchers.slice().sort((a, b) => Number(b.used_count || 0) - Number(a.used_count || 0))[0] || null;
  const totalDiscounts = (store.redemptions || []).reduce((sum, item) => sum + Number(item.discount_amount || 0), 0);
  return { total: vouchers.length, active, expired, disabled, redemptions, mostUsed, totalDiscounts };
}
