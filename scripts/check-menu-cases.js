import { prisma } from '../db/database.js';

async function tryQuery(sql) {
  try {
    const rows = await prisma.$queryRawUnsafe(sql);
    return Array.isArray(rows) ? rows : [];
  } catch (err) {
    return { error: err?.message || String(err) };
  }
}

async function main() {
  await prisma.$connect();
  console.log('Checking unquoted menu (menu):');
  const menuLower = await tryQuery('SELECT * FROM menu LIMIT 100');
  if (menuLower?.error) {
    console.log(' menu (lowercase) error:', menuLower.error);
  } else {
    console.log(' menu (lowercase) count:', menuLower.length);
    if (menuLower.length > 0) console.log(' sample:', menuLower.slice(0, 10));
  }

  console.log('\nChecking quoted Menu ("Menu") table:');
  const menuUpper = await tryQuery('SELECT * FROM "Menu" LIMIT 100');
  if (menuUpper?.error) {
    console.log(' "Menu" (quoted) error:', menuUpper.error);
  } else {
    console.log(' "Menu" (quoted) count:', menuUpper.length);
    if (menuUpper.length > 0) console.log(' sample:', menuUpper.slice(0, 10));
  }

  await prisma.$disconnect();
}

main().catch(e => {
  console.error('Script error:', e?.message || e);
  prisma.$disconnect();
  process.exit(1);
});
