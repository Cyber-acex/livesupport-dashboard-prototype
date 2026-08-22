import { prisma } from '../db/database-prisma.js';

const MONEY_PRECISION = 2;

function toNumber(value, fallback = 0) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : Number(fallback || 0);
}

function roundMoney(value) {
  return Number(Number(value || 0).toFixed(MONEY_PRECISION));
}

function getOrderItems(order = {}) {
  const items = Array.isArray(order?.items) ? order.items : [];
  if (items.length === 0 && Array.isArray(order?.lineItems)) {
    return order.lineItems;
  }
  if (items.length === 0 && Array.isArray(order?.products)) {
    return order.products;
  }
  return items;
}

function sumItemTotals(items = []) {
  return items.reduce((total, item) => {
    const quantity = toNumber(item?.quantity || 1, 1);
    const rawPrice = toNumber(item?.price ?? item?.unitPrice ?? item?.unit_price ?? item?.amount ?? 0, 0);
    const lineTotal = toNumber(item?.lineTotal ?? item?.totalPrice ?? item?.total_price ?? rawPrice * quantity, rawPrice * quantity);
    return total + lineTotal;
  }, 0);
}

export function normalizeVoucherCode(code = '') {
  const normalized = String(code || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  return normalized;
}

function parseList(value) {
  if (!value && value !== 0) return [];
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === 'string') {
    return value
      .split(/[|,;\n]/)
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => part.replace(/[^A-Za-z0-9_-]/g, ''))
      .filter(Boolean);
  }
  return [String(value).trim()].filter(Boolean);
}

function normalizeApplicableValues(value) {
  const list = parseList(value).map((item) => item.toUpperCase());
  return list.length ? new Set(list) : null;
}

function buildEffectiveOrder(order = {}) {
  const subtotal = toNumber(order?.subtotal ?? sumItemTotals(getOrderItems(order)), 0);
  const deliveryFee = toNumber(order?.deliveryFee ?? order?.delivery_fee ?? order?.deliveryFeeAmount ?? 0, 0);
  const items = getOrderItems(order).map((item) => {
    const quantity = toNumber(item?.quantity || 1, 1);
    const price = toNumber(item?.price ?? item?.unitPrice ?? item?.unit_price ?? 0, 0);
    const lineTotal = toNumber(item?.lineTotal ?? item?.totalPrice ?? item?.total_price ?? (price * quantity), price * quantity);
    const id = String(item?.id ?? item?.menuItemId ?? item?.menu_item_id ?? item?.key_name ?? item?.key ?? item?.name ?? '').trim();
    const category = String(item?.category ?? item?.menuCategory ?? item?.menu_category ?? 'Uncategorized').trim() || 'Uncategorized';
    const fallbackName = id || 'Item';
    const nameValue = String(item?.name ?? item?.title ?? item?.label ?? item?.menu_name ?? fallbackName).trim();
    const name = nameValue || fallbackName;
    return {
      id,
      name,
      category,
      quantity,
      price,
      lineTotal: roundMoney(lineTotal)
    };
  });

  return {
    subtotal: roundMoney(subtotal),
    deliveryFee: roundMoney(deliveryFee),
    items,
    totalBeforeDiscount: roundMoney(subtotal + deliveryFee)
  };
}

function applyEligibility(voucher, items = []) {
  const applicableItems = normalizeApplicableValues(voucher?.applicable_items ?? voucher?.applicableItems);
  const applicableCategories = normalizeApplicableValues(voucher?.applicable_categories ?? voucher?.applicableCategories);

  if (!applicableItems && !applicableCategories) {
    return items;
  }

  return items.filter((item) => {
    const itemId = String(item.id || '').toUpperCase();
    const itemCategory = String(item.category || '').toUpperCase();
    const itemName = String(item.name || '').toUpperCase();

    if (applicableItems) {
      const matchesItem = itemId && applicableItems.has(itemId);
      const matchesName = itemName && applicableItems.has(itemName.replace(/[^A-Z0-9]/g, ''));
      if (matchesItem || matchesName) return true;
    }

    if (applicableCategories && applicableCategories.has(itemCategory)) return true;
    return false;
  });
}

function calculateDiscountForVoucher(voucher, eligibleSubtotal, orderSubtotal, deliveryFee) {
  const voucherType = String(voucher?.type || 'percentage').toLowerCase();
  const value = toNumber(voucher?.value ?? voucher?.discount_value ?? 0, 0);
  const totalBeforeDiscount = roundMoney(orderSubtotal + deliveryFee);
  const eligible = roundMoney(eligibleSubtotal);

  if (voucherType === 'percentage') {
    const rawDiscount = eligible * (value / 100);
    const maxDiscount = toNumber(voucher?.maximum_discount ?? voucher?.maximumDiscount ?? 0, 0);
    const discount = maxDiscount > 0 ? Math.min(rawDiscount, maxDiscount) : rawDiscount;
    const clampedDiscount = Math.min(roundMoney(discount), totalBeforeDiscount);
    return {
      discountAmount: roundMoney(clampedDiscount),
      totalAfterDiscount: roundMoney(Math.max(0, totalBeforeDiscount - clampedDiscount)),
      deliveryFee: roundMoney(deliveryFee),
      subtotal: roundMoney(orderSubtotal),
      voucherType: 'PERCENTAGE'
    };
  }

  if (voucherType === 'fixed') {
    const discount = Math.min(value, totalBeforeDiscount);
    return {
      discountAmount: roundMoney(discount),
      totalAfterDiscount: roundMoney(Math.max(0, totalBeforeDiscount - discount)),
      deliveryFee: roundMoney(deliveryFee),
      subtotal: roundMoney(orderSubtotal),
      voucherType: 'FIXED'
    };
  }

  if (voucherType === 'delivery') {
    return {
      discountAmount: 0,
      totalAfterDiscount: roundMoney(orderSubtotal),
      deliveryFee: 0,
      subtotal: roundMoney(orderSubtotal),
      voucherType: 'DELIVERY'
    };
  }

  return {
    discountAmount: 0,
    totalAfterDiscount: roundMoney(totalBeforeDiscount),
    deliveryFee: roundMoney(deliveryFee),
    subtotal: roundMoney(orderSubtotal),
    voucherType: 'UNKNOWN'
  };
}

export function calculateVoucherDiscount({ voucher, order = {}, eligibleItems = null }) {
  const normalizedOrder = buildEffectiveOrder(order);
  const hasScopedEligibility = Boolean(voucher?.applicable_items || voucher?.applicableItems || voucher?.applicable_categories || voucher?.applicableCategories);
  const effectiveEligibleItems = eligibleItems ?? applyEligibility(voucher, normalizedOrder.items);
  const eligibleSubtotal = hasScopedEligibility
    ? effectiveEligibleItems.reduce((sum, item) => sum + Number(item.lineTotal || 0), 0)
    : normalizedOrder.subtotal;
  const result = calculateDiscountForVoucher(voucher, eligibleSubtotal, normalizedOrder.subtotal, normalizedOrder.deliveryFee);
  return {
    ...result,
    eligibleSubtotal: roundMoney(eligibleSubtotal),
    eligibleItems: effectiveEligibleItems,
    totalBeforeDiscount: normalizedOrder.totalBeforeDiscount,
    subtotal: normalizedOrder.subtotal,
    deliveryFee: result.deliveryFee
  };
}

function buildInvalidVoucherResult({ voucher, code, reason, message, order, requiredMinimum = null, currentSubtotal = null, currentQuantity = null }) {
  const normalizedOrder = buildEffectiveOrder(order);
  return {
    valid: false,
    voucherCode: normalizeVoucherCode(code || voucher?.code || ''),
    voucherType: String(voucher?.type || 'unknown').toUpperCase(),
    reason,
    message,
    requiredMinimum,
    currentSubtotal: currentSubtotal ?? normalizedOrder.subtotal,
    currentQuantity: currentQuantity ?? normalizedOrder.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
    subtotal: normalizedOrder.subtotal,
    deliveryFee: normalizedOrder.deliveryFee,
    totalBeforeDiscount: normalizedOrder.totalBeforeDiscount,
    discountAmount: 0,
    totalAfterDiscount: normalizedOrder.totalBeforeDiscount,
    eligibleSubtotal: 0,
    discountValue: toNumber(voucher?.value ?? 0, 0)
  };
}

export function validateVoucherForOrder({ voucher, order = {}, customer = {}, existingRedemptions = 0, existingOrders = 0, code = '' } = {}) {
  const normalizedCode = normalizeVoucherCode(code || voucher?.code || '');
  if (!voucher) {
    return buildInvalidVoucherResult({
      code: normalizedCode,
      reason: 'VOUCHER_NOT_FOUND',
      message: 'I couldn’t find that voucher code. Please check the code and try again.',
      order
    });
  }

  const now = new Date();
  const normalizedOrder = buildEffectiveOrder(order);
  const voucherType = String(voucher?.type || 'percentage').toLowerCase();
  const applicableItems = applyEligibility(voucher, normalizedOrder.items);
  const hasScopedEligibility = Boolean(voucher?.applicable_items || voucher?.applicableItems || voucher?.applicable_categories || voucher?.applicableCategories);
  const eligibleItems = hasScopedEligibility ? applicableItems : normalizedOrder.items;
  const eligibleSubtotal = hasScopedEligibility
    ? eligibleItems.reduce((sum, item) => sum + Number(item.lineTotal || 0), 0)
    : normalizedOrder.subtotal;
  const eligibleQuantity = eligibleItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const usageLimit = toNumber(voucher?.usage_limit ?? voucher?.usageLimit ?? 0, 0);
  const usedCount = toNumber(voucher?.used_count ?? voucher?.usedCount ?? 0, 0);
  const perCustomerLimit = toNumber(voucher?.per_customer_limit ?? voucher?.perCustomerLimit ?? 0, 0);

  if (voucher.is_active === false) {
    return buildInvalidVoucherResult({
      voucher,
      code: normalizedCode,
      reason: 'VOUCHER_INACTIVE',
      message: 'That voucher is currently unavailable.',
      order
    });
  }

  if (voucher.starts_at && new Date(voucher.starts_at).getTime() > now.getTime()) {
    return buildInvalidVoucherResult({
      voucher,
      code: normalizedCode,
      reason: 'VOUCHER_NOT_STARTED',
      message: `That voucher isn’t available yet. It becomes active on ${new Date(voucher.starts_at).toLocaleDateString()}.`,
      order
    });
  }

  if (voucher.expires_at && new Date(voucher.expires_at).getTime() < now.getTime()) {
    return buildInvalidVoucherResult({
      voucher,
      code: normalizedCode,
      reason: 'VOUCHER_EXPIRED',
      message: `That voucher expired on ${new Date(voucher.expires_at).toLocaleDateString()}, so it can no longer be used.`,
      order
    });
  }

  if (usageLimit > 0 && usedCount >= usageLimit) {
    return buildInvalidVoucherResult({
      voucher,
      code: normalizedCode,
      reason: 'VOUCHER_USAGE_LIMIT_REACHED',
      message: 'That voucher has reached its usage limit and is no longer available.',
      order
    });
  }

  if (perCustomerLimit > 0 && Number(existingRedemptions || 0) >= perCustomerLimit) {
    return buildInvalidVoucherResult({
      voucher,
      code: normalizedCode,
      reason: 'CUSTOMER_USAGE_LIMIT_REACHED',
      message: 'You have already used this voucher the maximum number of times allowed.',
      order
    });
  }

  if (voucher.new_customers_only && Number(existingOrders || 0) > 0) {
    return buildInvalidVoucherResult({
      voucher,
      code: normalizedCode,
      reason: 'NEW_CUSTOMER_ONLY',
      message: 'This voucher is only available to new customers.',
      order
    });
  }

  const minimumOrder = toNumber(voucher?.minimum_order ?? voucher?.minimumOrder ?? 0, 0);
  if (minimumOrder > 0 && normalizedOrder.subtotal < minimumOrder) {
    return buildInvalidVoucherResult({
      voucher,
      code: normalizedCode,
      reason: 'MINIMUM_ORDER_NOT_MET',
      message: `This voucher requires a minimum order of ₦${minimumOrder.toLocaleString()}. Your current subtotal is ₦${normalizedOrder.subtotal.toLocaleString()}.`,
      order,
      requiredMinimum: minimumOrder,
      currentSubtotal: normalizedOrder.subtotal
    });
  }

  const minimumQuantity = toNumber(voucher?.minimum_quantity ?? voucher?.minimumQuantity ?? 0, 0);
  if (minimumQuantity > 0 && eligibleQuantity < minimumQuantity) {
    return buildInvalidVoucherResult({
      voucher,
      code: normalizedCode,
      reason: 'MINIMUM_QUANTITY_NOT_MET',
      message: `This voucher requires at least ${minimumQuantity} eligible item(s) in the order. You currently have ${eligibleQuantity}.`,
      order,
      currentQuantity: eligibleQuantity
    });
  }

  const pricing = calculateVoucherDiscount({ voucher, order, eligibleItems: applicableItems });

  let totalBeforeDiscount = roundMoney(normalizedOrder.subtotal + normalizedOrder.deliveryFee);
  let discountAmount = roundMoney(Math.min(pricing.discountAmount, totalBeforeDiscount));
  let totalAfterDiscount = roundMoney(Math.max(0, totalBeforeDiscount - discountAmount));
  let deliveryFee = pricing.deliveryFee;

  if (voucherType === 'delivery') {
    totalBeforeDiscount = roundMoney(normalizedOrder.subtotal);
    discountAmount = 0;
    totalAfterDiscount = roundMoney(normalizedOrder.subtotal);
    deliveryFee = 0;
  }

  return {
    valid: true,
    voucherCode: normalizedCode,
    voucherType: voucherType === 'delivery' ? 'DELIVERY' : voucherType === 'fixed' ? 'FIXED' : 'PERCENTAGE',
    discountValue: toNumber(voucher?.value ?? 0, 0),
    discountAmount,
    subtotal: normalizedOrder.subtotal,
    deliveryFee,
    totalBeforeDiscount,
    totalAfterDiscount,
    eligibleSubtotal: roundMoney(eligibleSubtotal),
    eligibleItems: applicableItems,
    eligibleQuantity,
    message: 'Voucher applied successfully.',
    reason: null
  };
}

export async function validateAndApplyVoucherTool({ voucherCode, order = {}, customer = {} } = {}) {
  const normalizedCode = normalizeVoucherCode(voucherCode);
  if (!normalizedCode) {
    return {
      valid: false,
      voucherCode: '',
      reason: 'VOUCHER_NOT_FOUND',
      message: 'I couldn’t find that voucher code. Please check the code and try again.'
    };
  }

  const voucher = await prisma.voucher.findFirst({
    where: { code: normalizedCode }
  });

  const validation = validateVoucherForOrder({
    voucher,
    order,
    customer,
    existingRedemptions: Array.isArray(customer?.redemptions) ? customer.redemptions.length : Number(customer?.existingRedemptions || 0),
    existingOrders: Number(customer?.existingOrders || 0),
    code: normalizedCode
  });

  return validation;
}

export async function redeemVoucherForOrder({ voucher, order = {}, customer = {}, tx = null } = {}) {
  const validation = validateVoucherForOrder({
    voucher,
    order,
    customer,
    existingRedemptions: Number(customer?.existingRedemptions || customer?.voucherRedemptionCount || 0),
    existingOrders: Number(customer?.existingOrders || 0),
    code: voucher?.code || ''
  });

  if (!validation.valid) {
    return { valid: false, ...validation };
  }

  const orderId = Number(order?.id ?? order?.orderId ?? 0) || null;
  const customerId = Number(customer?.id ?? customer?.customerId ?? 0) || null;
  const customerPhone = customer?.phone || customer?.customer_phone || null;
  const voucherCode = String(voucher?.code || '').trim();

  const orderReference = orderId ? String(orderId) : (order?.order_id || order?.orderId || null);

  if (tx) {
    const updatedVoucher = await tx.voucher.update({
      where: { id: voucher.id },
      data: { used_count: { increment: 1 } }
    });

    const redemption = await tx.voucherRedemption.create({
      data: {
        voucher_id: voucher.id,
        voucher_code: voucherCode,
        order_id: orderReference,
        customer_id: customerId,
        customer_phone: customerPhone,
        discount_type: voucher.type,
        discount_amount: validation.discountAmount,
        subtotal: validation.subtotal,
        final_total: validation.totalAfterDiscount,
        voucher: {
          connect: { id: voucher.id }
        }
      }
    });

    const normalizedOrderId = orderId ?? (redemption.order_id !== undefined && redemption.order_id !== null ? Number(redemption.order_id) || redemption.order_id : null);

    return {
      valid: true,
      voucherId: voucher.id,
      updatedVoucher,
      redemption: {
        id: redemption.id,
        voucherId: redemption.voucher_id,
        orderId: normalizedOrderId,
        discountAmount: Number(redemption.discount_amount || 0),
        finalTotal: Number(redemption.final_total || 0)
      }
    };
  }

  return prisma.$transaction(async (transaction) => {
    const updatedVoucher = await transaction.voucher.update({
      where: { id: voucher.id },
      data: { used_count: { increment: 1 } }
    });

    const redemption = await transaction.voucherRedemption.create({
      data: {
        voucher_id: voucher.id,
        voucher_code: voucherCode,
        order_id: orderReference,
        customer_id: customerId,
        customer_phone: customerPhone,
        discount_type: voucher.type,
        discount_amount: validation.discountAmount,
        subtotal: validation.subtotal,
        final_total: validation.totalAfterDiscount,
        voucher: {
          connect: { id: voucher.id }
        }
      }
    });

    const normalizedOrderId = orderId ?? (redemption.order_id !== undefined && redemption.order_id !== null ? Number(redemption.order_id) || redemption.order_id : null);

    return {
      valid: true,
      voucherId: voucher.id,
      updatedVoucher,
      redemption: {
        id: redemption.id,
        voucherId: redemption.voucher_id,
        orderId: normalizedOrderId,
        discountAmount: Number(redemption.discount_amount || 0),
        finalTotal: Number(redemption.final_total || 0)
      }
    };
  });
}

export async function finalizeVoucherOrder({ voucher, order = {}, customer = {} } = {}) {
  const validation = validateVoucherForOrder({
    voucher,
    order,
    customer,
    existingRedemptions: Number(customer?.existingRedemptions || customer?.voucherRedemptionCount || 0),
    existingOrders: Number(customer?.existingOrders || 0),
    code: voucher?.code || ''
  });

  if (!validation.valid) {
    return validation;
  }

  return {
    ...validation,
    finalTotal: validation.totalAfterDiscount,
    discountAmount: validation.discountAmount,
    totalBeforeDiscount: validation.totalBeforeDiscount
  };
}
