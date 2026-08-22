import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;
const OLD_DATABASE_URL = 'postgres://055ded06552cdaaaf80800ce6b52b43c33826e33e9067c2cdca07532bc9dce05:sk_Ln4VEcWDwoEYqMqoLd9JC@db.prisma.io:5432/postgres?sslmode=require';
const NEW_DATABASE_URL = process.env.DATABASE_URL;

if (!NEW_DATABASE_URL) {
  throw new Error('DATABASE_URL is missing in the environment.');
}

const oldPool = new Pool({ connectionString: OLD_DATABASE_URL });
const newPool = new Pool({ connectionString: NEW_DATABASE_URL });

function quoteIdent(name) {
  return '"' + String(name).replace(/"/g, '""') + '"';
}

async function getTables(pool) {
  const result = await pool.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name"
  );
  return result.rows.map((row) => row.table_name);
}

async function getColumns(pool, table) {
  const result = await pool.query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`,
    [table]
  );
  return result.rows.map((row) => row.column_name);
}

async function copyTable(table) {
  const columns = await getColumns(oldPool, table);
  if (!columns.length) {
    console.log(`SKIP ${table}: no columns`);
    return;
  }

  const oldRows = await oldPool.query(`SELECT * FROM ${quoteIdent(table)}`);

  if (oldRows.rows.length === 0) {
    console.log(`COPY ${table}: 0 rows`);
    return;
  }

  const targetColumns = columns.map(quoteIdent).join(', ');
  const placeholders = columns.map((_, idx) => `$${idx + 1}`).join(', ');

  await newPool.query(`TRUNCATE TABLE ${quoteIdent(table)} RESTART IDENTITY CASCADE`);

  for (const row of oldRows.rows) {
    const values = columns.map((column) => row[column]);
    await newPool.query(
      `INSERT INTO ${quoteIdent(table)} (${targetColumns}) VALUES (${placeholders})`,
      values
    );
  }

  console.log(`COPIED ${table}: ${oldRows.rows.length} rows`);
}

async function main() {
  const oldTables = await getTables(oldPool);
  const newTables = await getTables(newPool);

  console.log('OLD_TABLE_COUNT=' + oldTables.length);
  console.log('NEW_TABLE_COUNT=' + newTables.length);

  await newPool.query('SET session_replication_role = replica');

  for (const table of oldTables) {
    try {
      await copyTable(table);
    } catch (error) {
      console.error(`FAILED_TABLE=${table}`);
      console.error(error.message);
      throw error;
    }
  }

  await newPool.query('SET session_replication_role = default');

  console.log('MIGRATION_COMPLETE');
}

try {
  await oldPool.query('SELECT 1');
  await newPool.query('SELECT 1');
  console.log('DB_CONNECTIONS_OK');
  await main();
} catch (error) {
  console.error('MIGRATION_FAIL');
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await oldPool.end();
  await newPool.end();
}
