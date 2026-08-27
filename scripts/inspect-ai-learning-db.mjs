import { prisma } from '../db/database-prisma.js';

async function main() {
  const tables = await prisma.$queryRawUnsafe(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND (table_name LIKE 'ai_%' OR table_name = '_prisma_migrations')
    ORDER BY table_name
  `);
  const migrationRows = await prisma.$queryRawUnsafe(`
    SELECT migration_name, finished_at FROM "_prisma_migrations" ORDER BY started_at
  `).catch(() => []);
  const counts = await prisma.$queryRawUnsafe(`
    SELECT 'notifications' AS table_name, count(*)::int AS count FROM notifications
    UNION ALL SELECT 'tickets', count(*)::int FROM tickets
  `);
  console.log(JSON.stringify({ tables, migrationRows, counts }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
