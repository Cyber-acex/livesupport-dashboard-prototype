import 'dotenv/config';
import { connectDatabase, prisma } from './db/database-prisma.js';

console.log('HAS_DB_URL', !!process.env.DATABASE_URL);

const raw = process.env.DATABASE_URL;
if (!raw) {
  console.log('DB_CONFIG: MISSING');
  process.exit(1);
}

try {
  const url = new URL(raw);
  console.log('DB_HOST=' + url.hostname);
  console.log('DB_PORT=' + (url.port || '5432'));
  console.log('DB_NAME=' + url.pathname.replace(/^\//, ''));
} catch (e) {
  console.error('DB_URL_PARSE_FAILED');
  console.error(e.message);
  process.exit(1);
}

try {
  await connectDatabase();
  console.log('CONNECT_CHECK: SUCCESS');
} catch (e) {
  console.error('CONNECT_CHECK: FAILED');
  console.error(e.message);
  process.exit(1);
} finally {
  try {
    await prisma.$disconnect();
  } catch {}
}
