import { db } from '../db/database.js';

const items = [
  { category: 'Pizza', key_name: 'garden-fusion', name: 'Garden Fusion', price: 14.5, available: 18 },
  { category: 'Pizza', key_name: 'firecracker-chicken', name: 'Firecracker Chicken', price: 15.75, available: 16 },
  { category: 'Pizza', key_name: 'smoked-sausage', name: 'Smoked Sausage', price: 15.25, available: 14 },
  { category: 'Pizza', key_name: 'buffalo-veggie', name: 'Buffalo Veggie', price: 13.75, available: 15 },
  { category: 'Pizza', key_name: 'harissa-halloumi', name: 'Harissa Halloumi', price: 14.25, available: 13 },
  { category: 'Burgers', key_name: 'smoky-garlic-burger', name: 'Smoky Garlic Burger', price: 16.5, available: 11 },
  { category: 'Burgers', key_name: 'spicy-lime-burger', name: 'Spicy Lime Burger', price: 15.5, available: 10 },
  { category: 'Burgers', key_name: 'truffle-burger', name: 'Truffle Burger', price: 17.25, available: 9 },
  { category: 'Burgers', key_name: 'sunset-burger', name: 'Sunset Burger', price: 15.75, available: 8 },
  { category: 'Burgers', key_name: 'bacon-maple-burger', name: 'Bacon Maple Burger', price: 16.75, available: 7 },
  { category: 'Sandwiches', key_name: 'smoked-turkey-club', name: 'Smoked Turkey Club', price: 12.5, available: 13 },
  { category: 'Sandwiches', key_name: 'grilled-veggie-panini', name: 'Grilled Veggie Panini', price: 11.75, available: 12 },
  { category: 'Sandwiches', key_name: 'spicy-chicken-sandwich', name: 'Spicy Chicken Sandwich', price: 13.25, available: 10 },
  { category: 'Sandwiches', key_name: 'ham-and-brie-toast', name: 'Ham Brie Toast', price: 12.75, available: 11 },
  { category: 'Sandwiches', key_name: 'bbq-chicken-wrap', name: 'BBQ Chicken Wrap', price: 12.25, available: 9 },
  { category: 'Salads', key_name: 'sunrise-salad', name: 'Sunrise Salad', price: 11.25, available: 14 },
  { category: 'Salads', key_name: 'crunchy-apple-salad', name: 'Crunchy Apple Salad', price: 10.5, available: 13 },
  { category: 'Salads', key_name: 'thai-peanut-salad', name: 'Thai Peanut Salad', price: 11.5, available: 12 },
  { category: 'Salads', key_name: 'roasted-beet-salad', name: 'Roasted Beet Salad', price: 12.25, available: 10 },
  { category: 'Salads', key_name: 'herb-chicken-salad', name: 'Herb Chicken Salad', price: 12.75, available: 11 },
  { category: 'Bowls', key_name: 'sesame-shrimp-bowl', name: 'Sesame Shrimp Bowl', price: 17.5, available: 9 },
  { category: 'Bowls', key_name: 'kimchi-tofu-bowl', name: 'Kimchi Tofu Bowl', price: 13.5, available: 10 },
  { category: 'Bowls', key_name: 'cajun-chicken-bowl', name: 'Cajun Chicken Bowl', price: 16.25, available: 8 },
  { category: 'Bowls', key_name: 'tabbouleh-lamb-bowl', name: 'Tabbouleh Lamb Bowl', price: 18.25, available: 7 },
  { category: 'Bowls', key_name: 'green-goddess-bowl', name: 'Green Goddess Bowl', price: 14.75, available: 9 },
  { category: 'Desserts', key_name: 'coconut-cream-pie', name: 'Coconut Cream Pie', price: 8.75, available: 16 },
  { category: 'Desserts', key_name: 'blackberry-crumb-cake', name: 'Blackberry Crumb Cake', price: 7.5, available: 15 },
  { category: 'Desserts', key_name: 'lemon-posset', name: 'Lemon Posset', price: 6.75, available: 20 },
  { category: 'Desserts', key_name: 'hazelnut-torte', name: 'Hazelnut Torte', price: 8.25, available: 14 },
  { category: 'Desserts', key_name: 'tropical-pavlova', name: 'Tropical Pavlova', price: 7.25, available: 12 }
];

const buildInsertSql = (tableName) => `
  INSERT INTO ${tableName} (category, key_name, name, price, available, image_url)
  VALUES ${items.map((_, index) => `($${index * 6 + 1}, $${index * 6 + 2}, $${index * 6 + 3}, $${index * 6 + 4}, $${index * 6 + 5}, $${index * 6 + 6})`).join(', ')}
  ON CONFLICT (category, key_name) DO UPDATE SET
    name = EXCLUDED.name,
    price = EXCLUDED.price,
    available = EXCLUDED.available,
    image_url = EXCLUDED.image_url
`;

const values = items.flatMap((item) => [item.category, item.key_name, item.name, item.price, item.available, null]);

await db.promise().query(buildInsertSql('menu'), values);
await db.promise().query(buildInsertSql('foods'), values);

const menuResult = await db.promise().query('SELECT COUNT(*) AS cnt FROM menu');
const foodsResult = await db.promise().query('SELECT COUNT(*) AS cnt FROM foods');

const menuCount = Array.isArray(menuResult) ? menuResult[0]?.cnt : menuResult?.rows?.[0]?.cnt;
const foodsCount = Array.isArray(foodsResult) ? foodsResult[0]?.cnt : foodsResult?.rows?.[0]?.cnt;

console.log(JSON.stringify({ inserted: items.length, totalMenuRows: Number(menuCount ?? 0), totalFoodRows: Number(foodsCount ?? 0) }, null, 2));
