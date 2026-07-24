export function buildVoucherShareMessage(voucher = {}, customerName = 'customer') {
  const typeLabel = voucher.type === 'fixed'
    ? 'fixed discount'
    : voucher.type === 'delivery'
      ? 'free delivery'
      : 'percentage discount';

  const valueLabel = voucher.type === 'percentage'
    ? `${Number(voucher.value || 0).toFixed(0)}%`
    : `$${Number(voucher.value || 0).toFixed(2)}`;

  return `Hi ${customerName || 'there'}, your exclusive voucher code is ${voucher.code || 'N/A'}. It gives you a ${typeLabel} of ${valueLabel}.`;
}
