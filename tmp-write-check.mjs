import dotenv from 'dotenv';
dotenv.config({ override: true });
import { db } from './db/database.js';

function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

const conv = await query('INSERT INTO conversations (phone, name, platform, branch_id, customer_id, created_at) VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING id', ['+15550000000', 'Write Test', 'web', 1, null]);
const conversationId = conv[0].id;
await query('INSERT INTO messages (conversation_id, sender, message, created_at) VALUES ($1, $2, $3, NOW())', [conversationId, 'customer', 'write check']);
const rows = await query('SELECT id, phone, name FROM conversations WHERE id = $1', [conversationId]);
const msgRows = await query('SELECT conversation_id, sender, message FROM messages WHERE conversation_id = $1', [conversationId]);
console.log(JSON.stringify({ conversation: rows, messages: msgRows }, null, 2));
