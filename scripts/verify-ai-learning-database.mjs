import { prisma } from '../db/database-prisma.js';

async function main() {
  const columns = await prisma.$queryRawUnsafe(`
    SELECT table_name, column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name IN ('notifications', 'tickets')
    ORDER BY table_name, ordinal_position
  `);
  const counts = await prisma.$queryRawUnsafe(`
    SELECT 'notifications' AS table_name, count(*)::int AS count FROM notifications
    UNION ALL SELECT 'tickets', count(*)::int FROM tickets
  `);
  console.log(JSON.stringify({ columns, counts }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
