import pg from 'pg';

const { Client } = pg;
const connectionString = 'postgres://055ded06552cdaaaf80800ce6b52b43c33826e33e9067c2cdca07532bc9dce05:sk_Ln4VEcWDwoEYqMqoLd9JC@db.prisma.io:5432/postgres?sslmode=require';
const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

await client.connect();
const res = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name");
console.log(JSON.stringify(res.rows, null, 2));
await client.end();
