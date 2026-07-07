export async function fetchActiveDeliveries() {
  try {
    const res = await fetch('/api/deliveries/active', { credentials: 'same-origin' });
    if (!res.ok) throw new Error('Failed to load deliveries');
    return res.json();
  } catch (error) {
    console.warn('Could not load deliveries from server:', error.message);
    return [];
  }
}

export async function fetchOrderStatuses() {
  try {
    const res = await fetch('/api/orders', { credentials: 'same-origin' });
    if (!res.ok) throw new Error('Failed to load orders');
    const orders = await res.json();
    const statusMap = new Map();
    if (Array.isArray(orders)) {
      orders.forEach((order) => {
        const orderId = order.id || order.order_id || order.orderId;
        if (orderId) {
          statusMap.set(orderId, normalizeDeliveryStatus(order.status || order.delivery_status || 'pending'));
        }
      });
    }
    return statusMap;
  } catch (error) {
    console.warn('Could not load order statuses:', error.message);
    return new Map();
  }
}

export function normalizeDeliveryStatus(status) {
  if (!status) return 'pending';
  return status.toString().toLowerCase().replace(/\s+/g, '-');
}

export function capitalizeLabel(value) {
  if (!value) return '';
  return value
    .toString()
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export const DELIVERY_STATUS_PRIORITY = {
  pending: 0,
  'picked-up': 1,
  'in-transit': 2,
  arriving: 3,
  delivered: 4
};

export const DEFAULT_CENTER = { lat: 6.5244, lng: 3.3792 };

export function getDeliveryStatusColor(status) {
  const normalized = normalizeDeliveryStatus(status);
  switch (normalized) {
    case 'pending':
      return '#ffc107';
    case 'picked-up':
      return '#17a2b8';
    case 'in-transit':
      return '#28a745';
    case 'arriving':
      return '#fd7e14';
    case 'delivered':
      return '#28a745';
    default:
      return '#6c757d';
  }
}

export function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function generateTestDelivery() {
  const testDeliveryId = Math.floor(Math.random() * 10000);
  const startLat = DEFAULT_CENTER.lat + (Math.random() - 0.5) * 0.05;
  const startLng = DEFAULT_CENTER.lng + (Math.random() - 0.5) * 0.05;
  const endLat = DEFAULT_CENTER.lat + (Math.random() - 0.5) * 0.05;
  const endLng = DEFAULT_CENTER.lng + (Math.random() - 0.5) * 0.05;

  return {
    id: testDeliveryId,
    order_id: `TEST-${Date.now()}`,
    rider_name: `Rider ${Math.floor(Math.random() * 100)}`,
    vehicle: ['Motorcycle', 'Car', 'Bicycle'][Math.floor(Math.random() * 3)],
    current_lat: startLat,
    current_lng: startLng,
    customer_lat: endLat,
    customer_lng: endLng,
    delivery_status: 'in-transit',
    distance: calculateDistance(startLat, startLng, endLat, endLng),
    eta: '8 mins'
  };
}
