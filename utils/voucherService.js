export const VOUCHER_TYPES = ['percentage', 'fixed', 'delivery'];

function makeAlphabet() {
  return 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
}

export function generateVoucherCode(prefix = 'SAVE') {
  const alphabet = makeAlphabet();
  const segment = () => Array.from({ length: 4 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
  return `${prefix}-${segment()}-${segment()}`.toUpperCase();
}

export function calculateDiscount({ type, value, subtotal, maximumDiscount = null, deliveryFee = 0 }) {
  const safeSubtotal = Number(subtotal || 0);
  const safeValue = Number(value || 0);
  const safeMaximum = Number(maximumDiscount || 0);

  if (type === 'percentage') {
    const rawDiscount = safeSubtotal * (safeValue / 100);
    const cappedDiscount = safeMaximum > 0 ? Math.min(rawDiscount, safeMaximum) : rawDiscount;
    return {
      discountAmount: Number(Math.min(cappedDiscount, safeSubtotal).toFixed(2)),
      newTotal: Number(Math.max(safeSubtotal - (safeMaximum > 0 ? Math.min(rawDiscount, safeMaximum) : rawDiscount), 0).toFixed(2)),
      deliveryFee,
      appliedType: 'percentage'
    };
  }

  if (type === 'fixed') {
    const discountAmount = Math.min(safeValue, safeSubtotal);
    return {
      discountAmount: Number(discountAmount.toFixed(2)),
      newTotal: Number(Math.max(safeSubtotal - discountAmount, 0).toFixed(2)),
      deliveryFee,
      appliedType: 'fixed'
    };
  }

  if (type === 'delivery') {
    return {
      discountAmount: 0,
      newTotal: safeSubtotal,
      deliveryFee: 0,
      appliedType: 'delivery'
    };
  }

  return {
    discountAmount: 0,
    newTotal: safeSubtotal,
    deliveryFee,
    appliedType: type || 'none'
  };
}

export function getVoucherStatus(voucher) {
  const now = new Date();
  if (!voucher?.is_active) return 'Disabled';
  const expiry = voucher.expires_at ? new Date(voucher.expires_at) : null;
  if (expiry && expiry < now) return 'Expired';
  const usageLimit = Number(voucher.usage_limit || 0);
  const usedCount = Number(voucher.used_count || 0);
  if (usageLimit > 0 && usedCount >= usageLimit) return 'Fully Used';
  return 'Active';
}
