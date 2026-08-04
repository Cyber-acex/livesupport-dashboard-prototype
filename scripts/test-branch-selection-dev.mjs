import { routeIncomingPlatformMessage, getPendingSession, getOpenConversation } from '../services/platformConversationService.js';
import { db } from '../db/database.js';

async function run() {
  // Ensure clean state for test phone
  const phone = '+15559990001';
  await db.promise().query('DELETE FROM chat_sessions WHERE platform_user_id = ?', [phone]);
  await db.promise().query('DELETE FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE platform_user_id = ?)', [phone]);
  await db.promise().query('DELETE FROM conversations WHERE platform_user_id = ?', [phone]);

  const sendReplyMock = async (target, message, platform) => {
    console.log('[MOCK sendReply] to', target, 'platform', platform, 'message:', message);
    return true;
  };

  // Mock socket.io for testing so notifications don't fail
  globalThis.io = {
    to: (room) => ({
      emit: (event, payload) => {
        console.log('[MOCK IO] emit to', room, 'event', event, 'payload', payload);
      }
    })
  };

  console.log('--- Step 1: Customer sends initial message ---');
  await routeIncomingPlatformMessage({ platform: 'whatsapp', platformUserId: phone, messageId: 'm1', text: 'hey', sendReply: sendReplyMock });
  const session = await getPendingSession('whatsapp', phone);
  console.log('Pending session created:', !!session, session && { id: session.id, pending_messages: session.pending_messages });

  console.log('\n--- Step 2: Customer selects branch 1 ---');
  const res = await routeIncomingPlatformMessage({ platform: 'whatsapp', platformUserId: phone, messageId: 'm2', text: '1', sendReply: sendReplyMock });
  console.log('Route result:', res.path, 'conversationId:', res.conversationId);

  const conv = await getOpenConversation('whatsapp', phone);
  console.log('Open conversation found:', !!conv, conv && { id: conv.id, branch_id: conv.branch_id, platform: conv.platform, platform_user_id: conv.platform_user_id, status: conv.status });

  const messages = await db.promise().query('SELECT sender, message FROM messages WHERE conversation_id = ? ORDER BY id ASC', [conv.id]);
  console.log('Messages:', messages);

  const remainingSession = await getPendingSession('whatsapp', phone);
  console.log('Pending session exists after selection?', !!remainingSession);

  console.log('\n--- Step 3: Simulate staff reply ---');
  const staffMessage = 'Hello, how can I help you today?';
  // Persist reply as staff would via /api/send-message
  await new Promise((resolve, reject) => {
    db.query('INSERT INTO replies (conversation_id, sender, message, user_id, created_at) VALUES (?, ?, ?, ?, NOW())', [conv.id, 'sent', staffMessage, 1], (err) => {
      if (err) return reject(err);
      db.query('INSERT INTO staff_messages (conversation_id, sender, message, user_id, created_at) VALUES (?, ?, ?, ?, NOW())', [conv.id, 'sent', staffMessage, 1], (err2) => {
        if (err2) return reject(err2);
        resolve();
      });
    });
  });
  console.log('Staff reply persisted to DB');

  const replies = await db.promise().query('SELECT id, sender, message FROM replies WHERE conversation_id = ? ORDER BY id ASC', [conv.id]);
  console.log('Replies table rows:', replies);

  console.log('\nTest complete');
  
  console.log('\n--- Step 4: Customer sends follow-up message ---');
  await routeIncomingPlatformMessage({ platform: 'whatsapp', platformUserId: phone, messageId: 'm3', text: 'What time do you close?', sendReply: sendReplyMock });
  const updatedMessages = await db.promise().query('SELECT sender, message FROM messages WHERE conversation_id = ? ORDER BY id ASC', [conv.id]);
  console.log('Messages after follow-up:', updatedMessages);

  process.exit(0);
}

run().catch(err => { console.error(err); process.exit(1); });
