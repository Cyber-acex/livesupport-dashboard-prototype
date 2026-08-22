import pg from 'pg';

const { Pool } = pg;
const OLD_DATABASE_URL = 'postgres://055ded06552cdaaaf80800ce6b52b43c33826e33e9067c2cdca07532bc9dce05:sk_Ln4VEcWDwoEYqMqoLd9JC@db.prisma.io:5432/postgres?sslmode=require';
const NEW_DATABASE_URL = 'postgres://a920c2f7151fcf567c5e4755ae7372643663959db20714d98a609330d96539c5:sk_Hk4c9vGEBanyxNnq08yC5@pooled.db.prisma.io:5432/postgres?sslmode=require';

function redact(url) {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.username ? '[redacted]' : 'anonymous'}@${u.hostname}:${u.port || '5432'}${u.pathname}`;
  } catch {
    return '[invalid url]';
  }
}

async function test(label, url) {
  const pool = new Pool({ connectionString: url });
  try {
    const result = await pool.query('SELECT 1 AS ok');
    console.log(label + ': CONNECT_OK ' + JSON.stringify(result.rows[0]));
  } catch (error) {
    console.log(label + ': CONNECT_FAIL ' + (error && error.message ? error.message : String(error)));
  } finally {
    await pool.end();
  }
}

console.log('OLD=' + redact(OLD_DATABASE_URL));
console.log('NEW=' + redact(NEW_DATABASE_URL));
await test('OLD', OLD_DATABASE_URL);
await test('NEW', NEW_DATABASE_URL);
