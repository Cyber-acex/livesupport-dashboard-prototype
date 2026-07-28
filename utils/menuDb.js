export function buildMenuSeedRows(menuItems = {}) {
  const rows = [];

  for (const [category, items] of Object.entries(menuItems || {})) {
    for (const [key, item] of Object.entries(items || {})) {
      rows.push({
        category,
        key_name: key,
        name: item?.name || key,
        price: parseFloat(item?.price || 0),
        available: parseInt(item?.available ?? item?.stock ?? 0, 10) || 0,
        image_url: item?.image_url || null
      });
    }
  }

  return rows;
}
