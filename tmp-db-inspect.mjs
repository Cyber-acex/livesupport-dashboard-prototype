import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const tablesResult = await pool.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name"
  );

  const tables = tablesResult.rows.map((row) => row.table_name);
  console.log('TABLE_COUNT=' + tables.length);
  console.log('TABLES=' + tables.join(', '));

  for (const table of tables) {
    const countResult = await pool.query(`SELECT COUNT(*)::int AS c FROM "${table}"`);
    console.log(`${table}=${countResult.rows[0].c}`);
  }
}

try {
  await main();
} catch (e) {
  console.error('CHECK_FAIL');
  console.error(e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
