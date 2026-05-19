import dotenv from 'dotenv';
dotenv.config({ override: true });
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function convertSqlPlaceholders(sql) {
  let paramIndex = 0;
  return sql.replace(/\?/g, () => `$${++paramIndex}`);
}

const db = {
  query(sql, params, callback) {
    if (typeof params === 'function') {
      callback = params;
      params = [];
    }

    const paramsArray = Array.isArray(params)
      ? params
      : params !== undefined && params !== null
      ? [params]
      : [];

    setImmediate(async () => {
      try {
        const sqlUpper = sql.toUpperCase().trim();
        const convertedSql = convertSqlPlaceholders(sql);
        const result = await pool.query(convertedSql, paramsArray);

        if (sqlUpper.startsWith('SELECT')) {
          if (callback) callback(null, result.rows);
          return;
        }

        if (sqlUpper.startsWith('INSERT') || sqlUpper.startsWith('UPDATE') || sqlUpper.startsWith('DELETE')) {
          if (/RETURNING\s+/i.test(sql)) {
            if (callback) callback(null, result.rows);
            return;
          }
          if (callback) callback(null, { affectedRows: result.rowCount });
          return;
        }

        if (callback) callback(null, result);
      } catch (error) {
        console.error('Database query error:', error.message, { sql: sql.substring(0, 100), params: paramsArray });
        if (callback) callback(error);
      }
    });
  },
  promise() {
    return {
      query(sql, params) {
        return new Promise((resolve, reject) => {
          db.query(sql, params, (err, result) => {
            if (err) reject(err);
            else resolve(result);
          });
        });
      }
    };
  }
};

async function syncPostgresSerialSequences() {
  const tables = [
    'conversations',
    'messages',
    'replies',
    'ai_messages',
    'staff_messages',
    'ai replies',
    'staff replies',
    'resolved',
    'escalations',
    'refunds',
    'ai_feedback'
  ];

  for (const table of tables) {
    try {
      const seqResult = await pool.query('SELECT pg_get_serial_sequence($1, $2) AS seq', [table, 'id']);
      const seqName = seqResult.rows?.[0]?.seq;
      if (!seqName) continue;
      const quotedTable = '"' + table.replace(/"/g, '""') + '"';
      await pool.query(`SELECT setval($1, COALESCE(MAX(id), 1), COALESCE(MAX(id), 0) > 0) FROM ${quotedTable}`, [seqName]);
    } catch (sequenceError) {
      console.warn(`Warning: could not sync serial sequence for table ${table}:`, sequenceError.message);
    }
  }
}

async function connectDatabase(callback) {
  try {
    await prisma.$connect();
    if (process.env.DATABASE_URL && config.usePostgres) {
      await syncPostgresSerialSequences();
      console.log('✅ Postgres serial sequences synchronized');
    }
    console.log('✅ Prisma connection is ready');
    if (callback) callback();
  } catch (error) {
    console.error('❌ Prisma connection error:', error.message);
    if (callback) callback(error);
  }
}

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

const config = { usePostgres: true };

export { db, prisma, connectDatabase, config };