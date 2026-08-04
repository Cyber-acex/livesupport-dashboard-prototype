import { db } from './db/database.js';

const queries = [
  "ALTER TABLE branches ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE",
  "ALTER TABLE branches ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE",
  "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS platform_user_id VARCHAR(255)",
  "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'OPEN'",
  "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS assigned_staff_id INTEGER",
  "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
  "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
  "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS order_id INTEGER",
  "CREATE TABLE IF NOT EXISTS chat_sessions (id SERIAL PRIMARY KEY, platform VARCHAR(50) NOT NULL, platform_user_id VARCHAR(255) NOT NULL, state VARCHAR(50) NOT NULL DEFAULT 'WAITING_FOR_BRANCH', pending_messages TEXT, expires_at TIMESTAMP NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)",
  "CREATE INDEX IF NOT EXISTS idx_chat_sessions_platform_user_id ON chat_sessions (platform_user_id)",
  "CREATE INDEX IF NOT EXISTS idx_chat_sessions_state ON chat_sessions (state)",
  "CREATE INDEX IF NOT EXISTS idx_chat_sessions_expires_at ON chat_sessions (expires_at)",
  "CREATE INDEX IF NOT EXISTS idx_conversations_platform_user_id ON conversations (platform_user_id)",
  "CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations (status)"
];

for (const sql of queries) {
  try {
    await db.promise().query(sql);
    console.log('OK', sql);
  } catch (error) {
    console.log('SKIP', sql, error.message);
  }
}

console.log('branch-selection schema update complete');
