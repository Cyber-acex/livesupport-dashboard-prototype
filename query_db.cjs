const pg = require("pg");
const { Client } = pg;

// Parse DATABASE_URL
const dbUrl = process.env.DATABASE_URL || require("fs").readFileSync(".env", "utf8")
  .split("\n")
  .find(line => line.startsWith("DATABASE_URL="))
  .replace("DATABASE_URL=", "");

console.log("Connecting to database...");

const client = new Client({
  connectionString: dbUrl,
});

async function main() {
  try {
    await client.connect();
    console.log("Connected to database!\n");

    // Get all tables
    console.log("=== Available Tables ===");
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    tablesRes.rows.forEach(row => console.log("  -", row.table_name));

    // Check if settings table exists
    const settingsTableExists = tablesRes.rows.some(r => r.table_name === "settings");
    
    if (settingsTableExists) {
      console.log("\n=== Settings Table Structure ===");
      const columnsRes = await client.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'settings'
        ORDER BY ordinal_position
      `);
      columnsRes.rows.forEach(row => {
        console.log(`  - ${row.column_name} (${row.data_type}) nullable=${row.is_nullable}`);
      });

      console.log("\n=== Settings Records with user_id (first 10) ===");
      const settingsRes = await client.query(`
        SELECT * FROM settings WHERE user_id IS NOT NULL LIMIT 10
      `);
      if (settingsRes.rows.length === 0) {
        console.log("  (no records)");
      } else {
        console.log(JSON.stringify(settingsRes.rows, null, 2));
      }

      console.log("\n=== Settings Records with Non-Null avatar_url ===");
      const avatarRes = await client.query(`
        SELECT * FROM settings WHERE user_id IS NOT NULL AND avatar_url IS NOT NULL
      `);
      if (avatarRes.rows.length === 0) {
        console.log("  (no records with avatar_url)");
      } else {
        console.log(`  Found ${avatarRes.rows.length} record(s):`);
        console.log(JSON.stringify(avatarRes.rows, null, 2));
      }
    } else {
      console.log("\nSettings table NOT found!");
      console.log("\n=== Looking for related tables ===");
      const relatedTables = tablesRes.rows.filter(row => 
        row.table_name.includes("user") || 
        row.table_name.includes("staff") || 
        row.table_name.includes("profile") ||
        row.table_name.includes("avatar")
      );
      if (relatedTables.length > 0) {
        console.log("Related tables found:");
        relatedTables.forEach(row => console.log("  -", row.table_name));
      } else {
        console.log("No related user/staff/profile/avatar tables found");
      }
    }
  } catch (err) {
    console.error("Database Error:", err.message);
    if (err.code) console.error("Error Code:", err.code);
  } finally {
    await client.end();
  }
}

main();
