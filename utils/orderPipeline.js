function normalizeName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function resolveMenuItemMatches(items = [], menuRows = []) {
  const normalizedMenu = (menuRows || []).map((row) => ({
    ...row,
    normalizedName: normalizeName(row.name || row.key_name || '')
  }));

  const resolved = [];
  const unavailable = [];

  for (const entry of Array.isArray(items) ? items : []) {
    const itemName = String(entry.name || '').trim();
    const quantity = Math.max(1, Number(entry.quantity || 1));
    if (!itemName) continue;

    const exactMatch = normalizedMenu.find((row) => row.normalizedName === normalizeName(itemName));
    const containsMatch = normalizedMenu.find((row) => normalizeName(itemName).includes(row.normalizedName) || row.normalizedName.includes(normalizeName(itemName)));
    const match = exactMatch || containsMatch || null;

    if (!match) {
      unavailable.push({
        name: itemName,
        quantity,
        suggestions: normalizedMenu.slice(0, 3).map((row) => row.name || row.key_name)
      });
      continue;
    }

    if (Number(match.available || 0) < quantity) {
      unavailable.push({
        name: itemName,
        quantity,
        suggestions: [match.name || match.key_name],
        reason: 'insufficient_stock'
      });
      continue;
    }

    resolved.push({
      menuItemId: String(match.key_name || match.id || ''),
      menuId: match.id,
      name: match.name || itemName,
      quantity,
      unitPrice: Number(match.price || 0),
      lineTotal: Number((quantity * Number(match.price || 0)).toFixed(2))
    });
  }

  return { resolved, unavailable };
}

function calculateOrderPricing(lineItems = [], options = {}) {
  const subtotal = Number(lineItems.reduce((sum, item) => {
    const quantity = Number(item.quantity || 1);
    const unitPrice = Number(item.unitPrice || item.price || 0);
    const lineTotal = Number(item.lineTotal || (quantity * unitPrice) || 0);
    return sum + lineTotal;
  }, 0).toFixed(2));
  const taxRate = Number(options.taxRate || 0.08);
  const deliveryFee = Number(options.deliveryFee || 0);
  const freeDeliveryThreshold = Number(options.freeDeliveryThreshold || 0);
  const discountAmount = Number(options.discountAmount || 0);
  const tax = Number((subtotal * taxRate).toFixed(2));
  const effectiveDeliveryFee = subtotal >= freeDeliveryThreshold ? 0 : deliveryFee;
  const discount = Number(Math.max(0, discountAmount).toFixed(2));
  const finalTotal = Number((subtotal + tax + effectiveDeliveryFee - discount).toFixed(2));

  return {
    subtotal,
    tax,
    deliveryFee: effectiveDeliveryFee,
    discountAmount: discount,
    finalTotal
  };
}

function formatMoney(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function buildOrderConfirmationMessage({ orderId, customerName, lineItems = [], pricing = {}, estimatedPreparationTime, estimatedDeliveryTime, status = 'Confirmed' }) {
  const lines = [];
  lines.push(`Order ID: ${orderId}`);
  lines.push(`Customer: ${customerName || 'Customer'}`);
  lines.push('Ordered items:');

  for (const item of lineItems) {
    lines.push(`- ${item.name} x${item.quantity} @ ${formatMoney(item.unitPrice)} = ${formatMoney(item.lineTotal)}`);
  }

  lines.push(`Subtotal: ${formatMoney(pricing.subtotal || 0)}`);
  lines.push(`Tax: ${formatMoney(pricing.tax || 0)}`);
  lines.push(`Delivery fee: ${formatMoney(pricing.deliveryFee || 0)}`);
  lines.push(`Discounts: ${formatMoney(pricing.discountAmount || 0)}`);
  lines.push(`Grand total: ${formatMoney(pricing.finalTotal || 0)}`);
  lines.push(`Estimated preparation time: ${estimatedPreparationTime || 'TBD'}`);
  lines.push(`Estimated delivery time: ${estimatedDeliveryTime || 'TBD'}`);
  lines.push(`Status: ${status}`);

  return lines.join('\n');
}

export { resolveMenuItemMatches, calculateOrderPricing, buildOrderConfirmationMessage, formatMoney, normalizeName };
