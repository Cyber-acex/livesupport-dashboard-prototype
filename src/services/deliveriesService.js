export async function fetchDeliveries() {
  const res = await fetch('/api/deliveries', { credentials: 'same-origin' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to load deliveries');
  }
  return res.json();
}

export async function fetchRiders() {
  const res = await fetch('/api/riders', { credentials: 'same-origin' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to load riders');
  }
  return res.json();
}

export async function updateDeliveryStatus(deliveryId, action, payload = {}) {
  const res = await fetch(`/api/deliveries/${encodeURIComponent(deliveryId)}/${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Unable to update delivery');
  }
  return res.json();
}

export async function submitDeliveryLocation(deliveryId, payload) {
  const res = await fetch(`/api/deliveries/${encodeURIComponent(deliveryId)}/location`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Unable to submit location');
  }
  return res.json();
}
