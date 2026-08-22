import { prisma } from '../db/database-prisma.js';

const items = [
  ['Nigerian', 'Jollof Rice & Grilled Chicken', 14.50, 24], ['Nigerian', 'Nigerian Fried Rice & Chicken', 14.50, 22],
  ['Nigerian', 'Ofada Rice & Ayamase', 15.00, 18], ['Nigerian', 'Coconut Rice & Grilled Chicken', 14.50, 20],
  ['Nigerian', 'White Rice & Nigerian Stew', 12.00, 24], ['Nigerian', 'Pounded Yam & Egusi Soup', 16.00, 18],
  ['Nigerian', 'Eba & Egusi Soup', 14.00, 20], ['Nigerian', 'Amala, Ewedu & Gbegiri', 15.00, 18],
  ['Nigerian', 'Eba & Okro Soup', 14.00, 20], ['Nigerian', 'Beans & Fried Plantain', 12.50, 24],
  ['Nigerian', 'Yam Porridge & Fried Fish', 15.00, 18], ['Nigerian', 'Moi Moi & Jollof Rice', 12.50, 22],
  ['Nigerian', 'Beef Suya', 13.00, 20], ['Nigerian', 'Chicken Suya', 13.00, 20],
  ['Nigerian', 'Asun & Fried Plantain', 15.00, 16], ['Nigerian', 'Peppered Snail', 18.00, 12],
  ['Nigerian', 'Goat Meat Pepper Soup', 16.00, 14], ['Nigerian', 'Catfish Pepper Soup', 17.00, 14],
  ['Nigerian', 'Gizdodo', 13.50, 18], ['Nigerian', 'Nigerian Beef Stew & Plantain', 15.00, 18],
  ['Burgers & Sandwiches', 'Classic Cheeseburger', 11.99, 24], ['Burgers & Sandwiches', 'Double Bacon Cheeseburger', 15.99, 18],
  ['Burgers & Sandwiches', 'Crispy Chicken Burger', 12.99, 20], ['Burgers & Sandwiches', 'BBQ Chicken Sandwich', 12.50, 20],
  ['Burgers & Sandwiches', 'Pulled Pork Sandwich', 13.50, 18], ['BBQ & Grilled', 'BBQ Chicken', 14.99, 20],
  ['BBQ & Grilled', 'BBQ Chicken Wings', 12.99, 24], ['BBQ & Grilled', 'BBQ Beef Ribs', 19.99, 12],
  ['BBQ & Grilled', 'Grilled Ribeye Steak', 24.99, 10], ['BBQ & Grilled', 'Grilled Chicken Steak', 17.99, 16],
  ['BBQ & Grilled', 'Grilled Salmon', 20.99, 14], ['BBQ & Grilled', 'BBQ Pulled Pork', 15.50, 16],
  ['Pasta & Main Courses', 'Chicken Alfredo', 15.99, 18], ['Pasta & Main Courses', 'Shrimp Alfredo', 18.99, 14],
  ['Pasta & Main Courses', 'Spaghetti Bolognese', 14.99, 20], ['Pasta & Main Courses', 'Lasagna', 16.99, 16],
  ['Pasta & Main Courses', 'Creamy Garlic Chicken Pasta', 16.50, 18], ['Pasta & Main Courses', 'Mac & Cheese', 10.99, 24],
  ['Pasta & Main Courses', 'Chicken Parmesan', 17.99, 16], ['Pasta & Main Courses', 'Chicken & Mushroom Risotto', 17.50, 14],
  ['Breakfast & Brunch', 'American Pancakes', 9.99, 24], ['Breakfast & Brunch', 'Blueberry Pancakes', 10.99, 22],
  ['Breakfast & Brunch', 'Chocolate Chip Pancakes', 10.99, 22], ['Breakfast & Brunch', 'French Toast', 9.99, 24],
  ['Breakfast & Brunch', 'Belgian Waffles', 10.99, 22], ['Breakfast & Brunch', 'Chicken & Waffles', 14.99, 18],
  ['Breakfast & Brunch', 'Scrambled Eggs & Toast', 8.99, 26], ['Sides & Snacks', 'Loaded Fries', 8.99, 28],
  ['Sides & Snacks', 'Buffalo Chicken Wings', 12.99, 24], ['Sides & Snacks', 'Chicken Tenders', 10.99, 24],
  ['Sides & Snacks', 'Mozzarella Sticks', 8.99, 24], ['Sides & Snacks', 'Onion Rings', 7.99, 26],
  ['Sides & Snacks', 'Loaded Nachos', 10.99, 22], ['Desserts & Bakery', 'New York Cheesecake', 8.99, 18],
  ['Desserts & Bakery', 'Chocolate Fudge Cake', 8.50, 18], ['Desserts & Bakery', 'Red Velvet Cake', 8.50, 18],
  ['Desserts & Bakery', 'Blueberry Cheesecake', 9.50, 16], ['Desserts & Bakery', 'Blueberry Muffin', 4.99, 28],
  ['Desserts & Bakery', 'Chocolate Chip Cookies', 4.50, 30], ['Desserts & Bakery', 'Apple Pie', 7.99, 18],
  ['Desserts & Bakery', 'Cinnamon Rolls', 5.99, 24], ['Desserts & Bakery', 'Brownies', 5.50, 24],
  ['Desserts & Bakery', 'Strawberry Shortcake', 8.99, 16]
].map(([category, name, price, available]) => ({
  category,
  key_name: name.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
  name,
  price,
  available,
  image_url: null
}));

async function main() {
  const existing = await prisma.menu.findMany({
    where: { OR: items.map(({ category, name }) => ({ category, name })) },
    select: { category: true, key_name: true, name: true }
  });
  const existingNames = new Set(existing.map(({ category, name }) => `${category}\u0000${name}`));
  const pending = items.filter(({ category, name }) => !existingNames.has(`${category}\u0000${name}`));
  const result = pending.length
    ? await prisma.menu.createMany({ data: pending, skipDuplicates: true })
    : { count: 0 };

  const verified = await prisma.menu.findMany({
    where: { OR: items.map(({ category, name }) => ({ category, name })) },
    select: { category: true, name: true }
  });
  const verifiedNames = new Set(verified.map(({ category, name }) => `${category}\u0000${name}`));
  const missing = items.filter(({ category, name }) => !verifiedNames.has(`${category}\u0000${name}`));
  if (missing.length > 0) throw new Error(`Verification failed for: ${missing.map(({ name }) => name).join(', ')}`);

  console.log(JSON.stringify({
    requested: items.length,
    inserted: result.count,
    skipped: items.filter(({ category, name }) => existingNames.has(`${category}\u0000${name}`)).map(({ name }) => name),
    verified: verified.length,
    missing: []
  }, null, 2));
}

try {
  await main();
} catch (error) {
  console.error('Menu seed failed:', error?.message || error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}