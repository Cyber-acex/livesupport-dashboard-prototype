import { db } from '../db/database.js';
import { extractInsertId } from '../utils/dbInsert.js';
import { buildBranchSelectionPrompt, resolveBranchSelection } from '../utils/branchSelection.js';

function normalizeIncomingPlatformMessage(input = {}) {
  const platform = String(input.platform || 'whatsapp').toLowerCase();
  const platformUserId = input.platformUserId || input.phone || input.senderId || input.conversationId || '';
  const messageId = input.messageId || input.id || '';
  const text = typeof input.text === 'string' ? input.text : '';
  const fallbackText = typeof input.messageText === 'string' ? input.messageText : '';
  const resolvedText = text || fallbackText || '';
  const attachments = Array.isArray(input.attachments) ? input.attachments : [];
  const messageType = resolvedText ? 'text' : (attachments.length ? 'attachment' : 'unknown');

  return {
    platform,
    platformUserId,
    messageId,
    customerName: input.customerName || input.name || null,
    messageType,
    text: resolvedText,
    attachments,
    timestamp: input.timestamp || new Date().toISOString(),
    raw: input
  };
}

function buildPendingSessionPayload({ platform, platformUserId, initialMessage, pendingMessages = [] }) {
  const normalizedPendingMessages = Array.isArray(pendingMessages)
    ? pendingMessages.filter((message) => typeof message === 'string' && message.trim())
    : [];
  if (!normalizedPendingMessages.length && typeof initialMessage === 'string' && initialMessage.trim()) {
    normalizedPendingMessages.push(initialMessage.trim());
  }

  return {
    platform,
    platform_user_id: platformUserId,
    state: 'WAITING_FOR_BRANCH',
    pending_messages: JSON.stringify(normalizedPendingMessages),
    expires_at: new Date(Date.now() + 30 * 60 * 1000)
  };
}

function createPendingSessionKey(platform, platformUserId) {
  return `${platform}:${platformUserId}`;
}

async function getSelectableBranches() {
  try {
    const rows = await db.promise().query(`
      SELECT id, name, is_active, is_archived
      FROM branches
      WHERE COALESCE(is_archived, FALSE) = FALSE
        AND COALESCE(is_active, TRUE) = TRUE
      ORDER BY name ASC
    `);
    return Array.isArray(rows) ? rows : [];
  } catch (error) {
    console.warn('Unable to load selectable branches:', error?.message || error);
    return [];
  }
}

async function getOpenConversation(platform, platformUserId) {
  try {
    const rows = await db.promise().query(
      'SELECT id, phone, name, platform, platform_user_id, branch_id, status FROM conversations WHERE platform = ? AND ((platform_user_id IS NOT NULL AND platform_user_id = ?) OR (platform_user_id IS NULL AND phone = ?)) AND COALESCE(status, ?) = ? ORDER BY id DESC LIMIT 1',
      [platform, platformUserId, platformUserId, 'OPEN', 'OPEN']
    );
    return Array.isArray(rows) && rows.length ? rows[0] : null;
  } catch (error) {
    console.warn('Unable to locate open conversation:', error?.message || error);
    return null;
  }
}

async function getPendingSession(platform, platformUserId) {
  try {
    const rows = await db.promise().query(
      'SELECT id, platform, platform_user_id, state, pending_messages, expires_at, created_at, updated_at FROM chat_sessions WHERE platform = ? AND platform_user_id = ? ORDER BY created_at DESC LIMIT 1',
      [platform, platformUserId]
    );
    const session = Array.isArray(rows) && rows.length ? rows[0] : null;
    if (!session) return null;
    const expiresAt = new Date(session.expires_at || session.created_at || new Date());
    if (expiresAt.getTime() <= Date.now()) {
      await db.promise().query('DELETE FROM chat_sessions WHERE id = ?', [session.id]);
      return null;
    }
    return session;
  } catch (error) {
    console.warn('Unable to read chat session:', error?.message || error);
    return null;
  }
}

async function deleteSession(platform, platformUserId) {
  try {
    await db.promise().query('DELETE FROM chat_sessions WHERE platform = ? AND platform_user_id = ?', [platform, platformUserId]);
  } catch (error) {
    console.warn('Unable to delete chat session:', error?.message || error);
  }
}

async function createPendingSession(platform, platformUserId, initialMessage) {
  try {
    const payload = buildPendingSessionPayload({ platform, platformUserId, initialMessage, pendingMessages: initialMessage ? [initialMessage] : [] });
    const rows = await db.promise().query(
      'INSERT INTO chat_sessions (platform, platform_user_id, state, pending_messages, expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW()) RETURNING id',
      [payload.platform, payload.platform_user_id, payload.state, payload.pending_messages, payload.expires_at]
    );
    return Array.isArray(rows) && rows.length ? rows[0]?.id : null;
  } catch (error) {
    console.warn('Unable to create pending session:', error?.message || error);
    return null;
  }
}

function normalizePendingMessageList(messages = []) {
  if (!Array.isArray(messages)) return [];
  return messages.filter((message) => typeof message === 'string' && message.trim()).map((message) => message.trim());
}

async function appendCustomerMessage(conversationId, message, sender = 'received') {
  await db.promise().query('INSERT INTO messages (conversation_id, sender, message, created_at) VALUES (?, ?, ?, NOW())', [conversationId, sender, message]);
}

async function appendSystemMessage(conversationId, message) {
  await db.promise().query('INSERT INTO messages (conversation_id, sender, message, created_at) VALUES (?, ?, ?, NOW())', [conversationId, 'system', message]);
}

async function updateConversationTimestamp(conversationId) {
  await db.promise().query('UPDATE conversations SET updated_at = NOW(), last_message_at = NOW() WHERE id = ?', [conversationId]);
}

async function notifyBranchConversation(conversationId, branchId, platform, platformUserId) {
  try {
    const io = globalThis.io;
    if (!io) throw new Error('socket_io_not_initialized');
    // Emit only to the selected branch room so other branches don't receive this event.
    io.to(`branch:${branchId}`).emit('conversation:new', {
      conversationId,
      branchId,
      platform,
      platformUserId,
      createdAt: new Date().toISOString()
    });
    return true;
  } catch (error) {
    console.warn('Unable to emit branch notifications:', error?.message || error);
    throw error;
  }
}

async function notifyConversationUpdate(conversationId) {
  try {
    const io = globalThis.io;
    if (!io) return;
    const conversationRows = await db.promise().query('SELECT branch_id, platform, platform_user_id FROM conversations WHERE id = ?', [conversationId]);
    const conversation = Array.isArray(conversationRows) && conversationRows.length ? conversationRows[0] : null;
    if (!conversation?.branch_id) return;
    io.to(`branch:${conversation.branch_id}`).emit('conversation:updated', {
      conversationId,
      branchId: conversation.branch_id,
      platform: conversation.platform,
      platformUserId: conversation.platform_user_id,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.warn('Unable to emit conversation update notification:', error?.message || error);
  }
}

async function createConversationFromPendingSelection({ platform, platformUserId, phone, branchId, branchName, initialMessages = [], promptText, selectionReply, messageId, sendReply }) {
  try {
    await db.promise().query('BEGIN');
    let committed = false;
    const insertConvSql = 'INSERT INTO conversations (phone, name, platform, platform_user_id, branch_id, status, created_at, updated_at, last_message_at) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW(), NOW()) RETURNING id';
    const insertResult = await db.promise().query(insertConvSql, [phone, phone, platform, platformUserId, branchId, 'OPEN']);
    const convoId = extractInsertId(insertResult);
    if (!convoId) {
      throw new Error('conversation_id_missing');
    }

    const preservedMessages = normalizePendingMessageList(initialMessages);
    for (const message of preservedMessages) {
      await appendCustomerMessage(convoId, message, 'received');
    }

    if (promptText) {
      await appendSystemMessage(convoId, promptText);
    }

    if (typeof selectionReply === 'string' && selectionReply.trim()) {
      await appendCustomerMessage(convoId, selectionReply.trim(), 'received');
    }

    await updateConversationTimestamp(convoId);
    await deleteSession(platform, platformUserId);
    const branchLabel = branchName || 'Selected';
    const welcomeMessage = `✅ You're now connected to our ${branchLabel} Branch.\n\nA staff member will respond shortly.`;

    // Ensure socket.io is available before committing so we can rollback safely if notifications can't be delivered
    if (!globalThis.io) {
      await db.promise().query('ROLLBACK');
      console.error('✖ Aborting conversation creation: socket.io not initialized');
      throw new Error('socket_io_not_initialized');
    }

    // Commit DB changes before notifying sockets or making external network calls
    await db.promise().query('COMMIT');
    committed = true;
    console.log('✓ Transaction committed', { conversationId: convoId });

    // Notify branch staff first. If notification fails, log and continue to send confirmation.
    try {
      await notifyBranchConversation(convoId, branchId, platform, platformUserId);
      console.log('✓ conversation:new emitted', { conversationId: convoId, branchId });
    } catch (notifyErr) {
      console.error('✖ Failed to notify branch after commit', { conversationId: convoId, branchId, err: notifyErr?.message || notifyErr });
      // Do not attempt to rollback since we've already committed; surface error to caller
      throw notifyErr;
    }

    // After successful notification, send confirmation message to customer as the final step
    try {
      if (typeof sendReply === 'function') {
        await sendReply(phone, welcomeMessage, platform);
        console.log('✓ Confirmation message sent to customer', { conversationId: convoId, platform, platformUserId });
      }
    } catch (err) {
      // Log but do not rollback since DB changes are already committed. Staff has been notified.
      console.warn('⚠️ Failed to send confirmation message after notifying staff:', err?.message || err);
    }

    console.log('✅ Conversation finalized', { conversationId: convoId, branchId, platform, platformUserId, messageId });
    return convoId;
  } catch (error) {
    // Only attempt rollback if we didn't already commit
    if (!committed) {
      await db.promise().query('ROLLBACK').catch(() => {});
    }
    console.error('Conversation creation failed:', error?.message || error);
    throw error;
  }
}

async function processPlatformMessage(input = {}) {
  const sendReply = input.sendReply;
  const normalized = normalizeIncomingPlatformMessage(input);
  const { platform, platformUserId, text, messageId } = normalized;
  if (!platformUserId) {
    return { normalized, handled: false, reason: 'missing_platform_user_id' };
  }

  console.log('📥 Webhook normalized', { platform, platformUserId, messageId, text });

  const openConversation = await getOpenConversation(platform, platformUserId);
  if (openConversation) {
    console.log('🧭 Open conversation found', { platform, platformUserId, conversationId: openConversation.id, messageId });
    await appendCustomerMessage(openConversation.id, text || '[non-text message]', 'received');
    await updateConversationTimestamp(openConversation.id);
    await notifyConversationUpdate(openConversation.id);
    console.log('[Router] Existing conversation handled.', { platform, platformUserId, conversationId: openConversation.id, messageId });
    return { normalized, handled: true, conversationId: openConversation.id, path: 'existing-conversation', continueWithLegacyWorkflow: true };
  }

  const pendingSession = await getPendingSession(platform, platformUserId);
  if (pendingSession) {
    const branches = await getSelectableBranches();
    const selectedBranch = resolveBranchSelection(text, branches);
    if (!selectedBranch) {
      const pendingMessages = normalizePendingMessageList(pendingSession.pending_messages ? JSON.parse(pendingSession.pending_messages) : []);
      const nextPendingMessages = [...pendingMessages, text.trim()].filter(Boolean);
      await db.promise().query('UPDATE chat_sessions SET pending_messages = ?, updated_at = NOW() WHERE id = ?', [JSON.stringify(nextPendingMessages), pendingSession.id]);
      const invalidPrompt = [
        '❌ Invalid selection.',
        '',
        'Please reply with one of the available branch numbers.',
        '',
        buildBranchSelectionPrompt(branches)
      ].join('\n');
      if (typeof sendReply === 'function') {
        await sendReply(platformUserId, invalidPrompt, platform);
      }
      console.log('⚠️ Pending session resumed', { platform, platformUserId, messageId, sessionId: pendingSession.id });
      console.log('[Router] Pending branch session resumed.', { platform, platformUserId, sessionId: pendingSession.id, messageId });
      return { normalized, handled: true, path: 'pending-session-invalid', continueWithLegacyWorkflow: false };
    }

    const parsedPendingMessages = pendingSession.pending_messages ? JSON.parse(pendingSession.pending_messages) : [];
    const previousMessages = normalizePendingMessageList(parsedPendingMessages);
    const conversationId = await createConversationFromPendingSelection({
      platform,
      platformUserId,
      phone: platformUserId,
      branchId: selectedBranch.id,
      branchName: selectedBranch.name,
      initialMessages: previousMessages,
      promptText: buildBranchSelectionPrompt(branches),
      selectionReply: text,
      messageId,
      sendReply
    });
    console.log('✅ Branch resolved', { platform, platformUserId, branchId: selectedBranch.id, conversationId, messageId });
    console.log('[Router] Pending branch session resolved.', { platform, platformUserId, branchId: selectedBranch.id, conversationId, messageId });
    return { normalized, handled: true, conversationId, path: 'branch-selected', continueWithLegacyWorkflow: false };
  }

  const branchPrompt = buildBranchSelectionPrompt(await getSelectableBranches());
  const sessionId = await createPendingSession(platform, platformUserId, text);
  if (typeof sendReply === 'function') {
    await sendReply(platformUserId, branchPrompt, platform);
  }
  console.log('🗂️ Pending session created', { platform, platformUserId, sessionId, messageId });
  console.log('[Router] Pending session created.', { platform, platformUserId, sessionId, messageId });
  return { normalized, handled: true, path: 'pending-session-created', continueWithLegacyWorkflow: false };
}

async function routeIncomingPlatformMessage(input = {}) {
  const result = await processPlatformMessage(input);
  console.log('[Router] Processing complete.', { path: result?.path, conversationId: result?.conversationId, platform: result?.normalized?.platform, platformUserId: result?.normalized?.platformUserId });
  return result;
}

export {
  normalizeIncomingPlatformMessage,
  buildPendingSessionPayload,
  processPlatformMessage,
  routeIncomingPlatformMessage,
  createConversationFromPendingSelection,
  getOpenConversation,
  getPendingSession,
  createPendingSession,
  notifyConversationUpdate
};
