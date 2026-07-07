function calculatePercentageChange(current, previous) {
  const currentNumber = Number(current);
  const previousNumber = Number(previous);
  if (!Number.isFinite(currentNumber) || !Number.isFinite(previousNumber) || previousNumber === 0) {
    return null;
  }
  return ((currentNumber - previousNumber) / previousNumber) * 100;
}

export async function fetchDashboardStats() {
  const [conversationsRes, ordersRes, snapshotRes] = await Promise.all([
    fetch('/api/conversations'),
    fetch('/api/dashboard-stats'),
    fetch('/api/dashboard-snapshot/instant').catch(() => null)
  ]);

  const conversations = conversationsRes.ok ? await conversationsRes.json() : [];
  const ordersData = ordersRes.ok ? await ordersRes.json() : { orders: 0 };
  const snapshot = snapshotRes?.ok ? await snapshotRes.json() : null;

  const customerCount = Array.isArray(conversations) ? conversations.length : 0;
  const ordersCount = Number(ordersData.orders || 0);
  const rawSnapshot = snapshot?.data || {};
  const previousSnapshot = {
    ...rawSnapshot,
    customers_change: typeof rawSnapshot.customers_change !== 'undefined' && rawSnapshot.customers_change !== null
      ? Number(rawSnapshot.customers_change)
      : calculatePercentageChange(customerCount, rawSnapshot.customers),
    orders_change: typeof rawSnapshot.orders_change !== 'undefined' && rawSnapshot.orders_change !== null
      ? Number(rawSnapshot.orders_change)
      : calculatePercentageChange(ordersCount, rawSnapshot.orders)
  };

  return {
    customers: customerCount,
    orders: ordersCount,
    previousSnapshot
  };
}

export async function fetchRecentOrders(limit = 5) {
  try {
    const res = await fetch('/api/orders', { credentials: 'same-origin' });
    if (!res.ok) return [];
    const orders = await res.json();
    const normalized = (orders || []).map(o => ({
      id: o.id || o.order_id || o.orderId || '',
      product: o.product || o.product_name || (o.items ? (Array.isArray(o.items) ? o.items.map(i=>i.name).join(', ') : String(o.items)) : ''),
      customer: o.customerName || o.customer_name || o.customer || o.name || '',
      amount: Number(o.amount || o.total_amount || o.total || 0),
      status: o.status || 'pending',
      created_at: o.date || o.order_date || o.created_at || o.createdAt || null
    }));
    return normalized.slice(0, limit);
  } catch (e) {
    console.error('Failed to fetch recent orders', e);
    return [];
  }
}

export async function fetchRecentMessages(limit = 5) {
  const res = await fetch(`/api/recent-messages?limit=${limit}`);
  if (!res.ok) return [];
  return res.json();
}
