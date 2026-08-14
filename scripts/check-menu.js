import { prisma } from '../db/database.js';

async function main() {
  try {
    await prisma.$connect();
    const items = await prisma.menu.findMany({ orderBy: [{ category: 'asc' }, { name: 'asc' }] });
    console.log('Menu items count:', Array.isArray(items) ? items.length : 0);
    if (Array.isArray(items) && items.length > 0) {
      console.log('Sample rows (up to 10):');
      console.log(items.slice(0, 10).map(i => ({ id: i.id, name: i.name, category: i.category, price: i.price })));
    }
    await prisma.$disconnect();
  } catch (err) {
    console.error('Error checking Menu table:', err?.message || err);
    try { await prisma.$disconnect(); } catch (e) {}
    process.exit(1);
  }
}

main();
