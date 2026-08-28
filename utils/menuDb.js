export function buildMenuSeedRows(menuItems = {}) {
  const rows = [];

  function visit(group, category = null) {
    for (const [key, value] of Object.entries(group || {})) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) continue;

      const isMenuItem = Object.prototype.hasOwnProperty.call(value, 'name')
        || Object.prototype.hasOwnProperty.call(value, 'price');
      if (!isMenuItem) {
        visit(value, key);
        continue;
      }

      rows.push({
        category: category || 'Menu',
        key_name: key,
        name: value.name || key,
        price: parseFloat(value.price || 0),
        available: parseInt(value.available ?? value.stock ?? 0, 10) || 0,
        image_url: value.image_url || null
      });
    }
  }

  visit(menuItems);
  return rows;
}
