import test from 'node:test';
import assert from 'node:assert/strict';
import { flattenMenuItems } from '../utils/menuPayload.js';

test('flattenMenuItems expands nested menu payloads into list items', () => {
  const payload = {
    Pizza: {
      margherita: { name: 'Margherita', price: 8.99, available: 24, description: 'Tomato basil' },
      pepperoni: { name: 'Pepperoni', price: 9.99, available: 18, description: 'Pepperoni' }
    },
    Drinks: {
      sparkling_water: { name: 'Sparkling Water', price: 2.99, available: 50, tags: ['Featured'] }
    }
  };

  const menu = flattenMenuItems(payload);

  assert.equal(menu.length, 3);
  assert.deepEqual(menu[0], {
    id: 'margherita',
    key: 'margherita',
    name: 'Margherita',
    category: 'Pizza',
    subtype: '',
    price: 8.99,
    available: true,
    stock: 24,
    tags: [],
    description: 'Tomato basil',
    image_url: null
  });
  assert.equal(menu[2].category, 'Drinks');
  assert.equal(menu[2].tags[0], 'Featured');
});
