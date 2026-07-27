export function normalizeOrderStatusForDelivery(status) {
  const value = String(status || '').toLowerCase();
  if (['completed', 'delivered', 'done'].includes(value)) return 'Delivered';
  if (['processing', 'ready', 'out for delivery'].includes(value)) return 'Out For Delivery';
  if (['cancelled', 'canceled'].includes(value)) return 'Cancelled';
  if (['assigned', 'accepted', 'accepted by rider'].includes(value)) return 'Rider Accepted';
  return 'Assigned';
}

export function shouldCreateDeliveryForOrder(status) {
  const value = String(status || '').toLowerCase();
  return !['cancelled', 'canceled'].includes(value);
}

export function buildDeliveryFromOrder(order) {
  return {
    id: `order-${order?.id ?? 'new'}`,
    source: 'order',
    orderId: order?.id,
    orderNumber: order?.orderId || order?.order_number || order?.id,
    customerName: order?.customerName || order?.customer || 'Customer',
    customerPhone: order?.phone || order?.customerPhone || null,
    product: order?.product || order?.items?.[0]?.name || 'Order',
    amount: Number(order?.amount || order?.finalTotal || 0),
    deliveryAddress: order?.address || order?.deliveryAddress || 'Address pending',
    deliveryStatus: normalizeOrderStatusForDelivery(order?.status),
    riderName: order?.riderName || order?.rider || 'Unassigned',
    updatedAt: order?.date || order?.updatedAt || new Date().toISOString(),
    eta: order?.eta || null,
    distance: order?.distance || null,
    createdAt: order?.createdAt || order?.date || new Date().toISOString(),
  };
}
