import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

(async () => {
  try {
    // Insert test staff
    const result = await pool.query(
      `INSERT INTO staffs (full_name, email, password, role, branch_id, created_at, updated_at)
       VALUES 
        ('John Agent', 'agent1@livesupport.com', 'password123', 'agent', 1, NOW(), NOW()),
        ('Jane Agent', 'agent2@livesupport.com', 'password123', 'agent', 1, NOW(), NOW()),
        ('Admin User', 'admin@livesupport.com', 'admin123', 'admin', 1, NOW(), NOW())
       ON CONFLICT (email) DO UPDATE
       SET password = EXCLUDED.password, full_name = EXCLUDED.full_name
       RETURNING id, email, full_name;`
    );
    console.log('Staff created/updated:', result.rows);
    
    // Check what we have
    const check = await pool.query('SELECT id, email, full_name, role FROM staffs LIMIT 10;');
    console.log('All staff:', check.rows);
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
})();
