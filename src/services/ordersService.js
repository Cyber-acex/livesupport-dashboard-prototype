export async function fetchOrders() {
  const res = await fetch('/api/orders', { credentials: 'same-origin' });
  if (!res.ok) throw new Error('Failed to load orders');
  return res.json();
}

export async function createOrder(payload) {
  const res = await fetch('/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to create order');
  }
  return res.json();
}

export async function updateOrder(orderId, payload) {
  const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to update order');
  }
  return res.json();
}

export async function fetchMenuItems() {
  const res = await fetch('/api/menu', { credentials: 'same-origin' });
  if (!res.ok) throw new Error('Failed to load menu items');
  const data = await res.json();
  const menu = [];
  Object.keys(data || {}).forEach((category) => {
    const section = data[category] || {};
    Object.keys(section).forEach((key) => {
      const item = section[key];
      menu.push({
        id: key,
        key,
        name: item.name || key,
        category,
        subtype: item.subtype || '',
        price: Number(item.price || 0),
        available: Boolean(item.available),
        stock: Number(item.available || 0),
        tags: item.tags || [],
        description: item.description || '',
        image_url: item.image_url || null
      });
    });
  });
  return menu;
}

export async function saveMenuItem(payload) {
  const res = await fetch('/api/menu/item', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to save menu item');
  }
  return res.json();
}

export async function deleteMenuItem(category, key) {
  const res = await fetch(`/api/menu/item/${encodeURIComponent(category)}/${encodeURIComponent(key)}`, {
    method: 'DELETE',
    credentials: 'same-origin'
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to delete menu item');
  }
  return res.json();
}

export async function reduceMenuItemStock(payload) {
  const res = await fetch('/api/menu/item/reduce-stock', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to update stock');
  }
  return res.json();
}

export async function fetchTables() {
  const res = await fetch('/api/tables', { credentials: 'same-origin' });
  if (!res.ok) throw new Error('Failed to load tables');
  return res.json();
}

export async function updateTableState(tableNumber, payload) {
  const res = await fetch(`/api/tables/${encodeURIComponent(tableNumber)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to update table');
  }
  return res.json();
}
