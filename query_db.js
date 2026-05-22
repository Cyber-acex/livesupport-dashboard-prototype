const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  try {
    console.log("=== Checking available models ===");
    // Get all tables from the database
    const query = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `;
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = ${"public"}
      ORDER BY table_name
    `;
    console.log("Available tables:", tables);

    // Try to query settings table if it exists
    console.log("\n=== Checking settings table ===");
    const settingsExists = tables.some(t => t.table_name === "settings");
    if (settingsExists) {
      const columns = await prisma.$queryRaw`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = ${"settings"}
      `;
      console.log("Settings table columns:", columns);

      const settingsData = await prisma.$queryRaw`
        SELECT * FROM settings WHERE "user_id" IS NOT NULL AND "avatar_url" IS NOT NULL
      `;
      console.log("Settings with avatar_url:", settingsData);
    } else {
      console.log("Settings table not found");
      
      // Check other user/staff related tables
      const staffTables = tables.filter(t => 
        t.table_name.includes("user") || 
        t.table_name.includes("staff") || 
        t.table_name.includes("profile")
      );
      console.log("\nUser/Staff related tables:", staffTables);
    }
  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
