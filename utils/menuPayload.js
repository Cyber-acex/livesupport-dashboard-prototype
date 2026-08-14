function isMenuItemObject(value) {
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    return false;
  }

  return ['name', 'price', 'available', 'stock', 'description', 'image_url', 'tags'].some((key) => Object.prototype.hasOwnProperty.call(value, key));
}

function isMenuCollection(value) {
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    return false;
  }

  const entries = Object.entries(value || {});
  if (entries.length === 0) {
    return false;
  }

  return entries.every(([, entryValue]) => isMenuItemObject(entryValue));
}

export function flattenMenuItems(data = {}) {
  const menu = [];

  const visit = (value, category = null) => {
    if (!value || Array.isArray(value) || typeof value !== 'object') {
      return;
    }

    if (isMenuCollection(value)) {
      Object.entries(value).forEach(([key, item]) => {
        menu.push({
          id: key,
          key,
          name: item?.name || key,
          category: category || 'Uncategorized',
          subtype: item?.subtype || '',
          price: Number(item?.price || 0),
          available: Boolean(item?.available ?? item?.stock ?? 0),
          stock: Number(item?.available ?? item?.stock ?? 0),
          tags: item?.tags || [],
          description: item?.description || '',
          image_url: item?.image_url || null
        });
      });
      return;
    }

    Object.entries(value).forEach(([entryKey, childValue]) => {
      if (isMenuCollection(childValue)) {
        visit(childValue, entryKey);
      } else {
        visit(childValue, category || entryKey);
      }
    });
  };

  visit(data);
  return menu;
}
