import { db } from '../db/database.js';
import { extractInsertId } from '../utils/dbInsert.js';

const TABLE_NAME = 'notifications';

function normalizeNotificationRow(row = {}) {
  const metadata = typeof row.metadata === 'string' && row.metadata
    ? (() => {
        try {
          return JSON.parse(row.metadata);
        } catch (error) {
          return {};
        }
      })()
    : (row.metadata || {});

  return {
    id: row.id,
    userId: row.user_id ?? row.userId ?? null,
    type: row.type || 'system',
    icon: row.icon || 'bell',
    title: row.title || 'Notification',
    message: row.message || '',
    priority: row.priority || 'normal',
    entityType: row.entity_type || row.entityType || null,
    entityId: row.entity_id || row.entityId || null,
    route: row.route || null,
    isRead: Boolean(row.is_read ?? row.isRead ?? false),
    isDeleted: Boolean(row.is_deleted ?? row.isDeleted ?? false),
    createdAt: row.created_at || row.createdAt || null,
    updatedAt: row.updated_at || row.updatedAt || null,
    metadata
  };
}

function buildUserRoom(userId) {
  return `user:${userId}`;
}

async function ensureNotificationsTable() {
  try {
    await db.promise().query(`
      CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        type VARCHAR(80) NOT NULL DEFAULT 'system',
        icon VARCHAR(80) DEFAULT 'bell',
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        priority VARCHAR(40) DEFAULT 'normal',
        entity_type VARCHAR(80),
        entity_id VARCHAR(255),
        route VARCHAR(500),
        metadata TEXT,
        is_read BOOLEAN DEFAULT FALSE,
        is_deleted BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.promise().query(`CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON ${TABLE_NAME} (user_id)`);
    await db.promise().query(`CREATE INDEX IF NOT EXISTS idx_notifications_unread ON ${TABLE_NAME} (user_id, is_read, is_deleted)`);
    await db.promise().query(`CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON ${TABLE_NAME} (created_at DESC)`);
  } catch (error) {
    console.warn('Unable to ensure notifications table exists:', error?.message || error);
  }
}

async function createNotification({ userId, userIds, type = 'system', icon = 'bell', title, message, priority = 'normal', entityType = null, entityId = null, route = null, metadata = {}, source = 'system' }) {
  if (!title || !message) return null;
  const recipients = Array.isArray(userIds)
    ? userIds.filter(Boolean)
    : userId
      ? [userId]
      : [];

  if (!recipients.length) return null;

  const createdItems = [];
  for (const recipientId of recipients) {
    const insertSql = `
      INSERT INTO ${TABLE_NAME} (
        user_id, type, icon, title, message, priority, entity_type, entity_id, route, metadata, is_read, is_deleted, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, FALSE, FALSE, NOW(), NOW()) RETURNING id
    `;

    try {
      const result = await db.promise().query(insertSql, [recipientId, type, icon, title, message, priority, entityType, entityId, route, metadata ? JSON.stringify(metadata) : null]);
      const insertedId = extractInsertId(result);
      const createdNotification = {
        id: insertedId,
        userId: recipientId,
        type,
        icon,
        title,
        message,
        priority,
        entityType,
        entityId,
        route,
        isRead: false,
        isDeleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata
      };

      createdItems.push(createdNotification);
      const unreadCount = await getUnreadCount(recipientId);
      await broadcastNotification(createdNotification, source, unreadCount);
    } catch (error) {
      console.warn('Unable to store notification:', error?.message || error);
    }
  }

  return createdItems;
}

async function broadcastNotification(notification, source = 'system', unreadCount = null) {
  try {
    const io = globalThis.io;
    if (!io || !notification?.userId) return;
    const room = buildUserRoom(notification.userId);
    io.to(room).emit('notification:received', { notification, source });
    const count = typeof unreadCount === 'number' ? unreadCount : await getUnreadCount(notification.userId);
    io.to(room).emit('notification:count', { unreadCount: count });
  } catch (error) {
    console.warn('Unable to broadcast notification update:', error?.message || error);
  }
}

async function getNotificationsForUser(userId, options = {}) {
  const limit = Number(options.limit || 30);
  const unreadOnly = Boolean(options.unreadOnly);
  if (!userId) return { notifications: [], unreadCount: 0 };

  try {
    const whereClause = unreadOnly
      ? `WHERE user_id = ? AND is_deleted = FALSE AND is_read = FALSE`
      : `WHERE user_id = ? AND is_deleted = FALSE`;

    const rows = await db.promise().query(`
      SELECT id, user_id, type, icon, title, message, priority, entity_type, entity_id, route, metadata, is_read, is_deleted, created_at, updated_at
      FROM ${TABLE_NAME}
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ?
    `, [userId, Math.min(limit, 100)]);

    const notifications = (Array.isArray(rows) ? rows : []).map(normalizeNotificationRow);
    const unreadCount = await getUnreadCount(userId);
    return { notifications, unreadCount };
  } catch (error) {
    console.warn('Unable to load notifications:', error?.message || error);
    return { notifications: [], unreadCount: 0 };
  }
}

async function getUnreadCount(userId) {
  if (!userId) return 0;
  try {
    const rows = await db.promise().query(`
      SELECT COUNT(*) AS count
      FROM ${TABLE_NAME}
      WHERE user_id = ? AND is_deleted = FALSE AND is_read = FALSE
    `, [userId]);
    const count = Array.isArray(rows) && rows[0] ? Number(rows[0].count || rows[0].COUNT || 0) : 0;
    return Number.isFinite(count) ? count : 0;
  } catch (error) {
    console.warn('Unable to count unread notifications:', error?.message || error);
    return 0;
  }
}

async function markNotificationRead(notificationId, userId) {
  if (!notificationId || !userId) return null;
  try {
    await db.promise().query(`UPDATE ${TABLE_NAME} SET is_read = TRUE, updated_at = NOW() WHERE id = ? AND user_id = ?`, [notificationId, userId]);
    const unreadCount = await getUnreadCount(userId);
    const io = globalThis.io;
    if (io) {
      io.to(buildUserRoom(userId)).emit('notification:updated', { notificationId, isRead: true, unreadCount });
      io.to(buildUserRoom(userId)).emit('notification:count', { unreadCount });
    }
    return true;
  } catch (error) {
    console.warn('Unable to mark notification as read:', error?.message || error);
    return null;
  }
}

async function markAllNotificationsRead(userId) {
  if (!userId) return null;
  try {
    await db.promise().query(`UPDATE ${TABLE_NAME} SET is_read = TRUE, updated_at = NOW() WHERE user_id = ? AND is_deleted = FALSE`, [userId]);
    const unreadCount = 0;
    const io = globalThis.io;
    if (io) {
      io.to(buildUserRoom(userId)).emit('notification:updated', { type: 'all-read', unreadCount });
      io.to(buildUserRoom(userId)).emit('notification:count', { unreadCount });
    }
    return true;
  } catch (error) {
    console.warn('Unable to mark all notifications as read:', error?.message || error);
    return null;
  }
}

async function dismissNotification(notificationId, userId) {
  if (!notificationId || !userId) return null;
  try {
    await db.promise().query(`UPDATE ${TABLE_NAME} SET is_deleted = TRUE, updated_at = NOW() WHERE id = ? AND user_id = ?`, [notificationId, userId]);
    const unreadCount = await getUnreadCount(userId);
    const io = globalThis.io;
    if (io) {
      io.to(buildUserRoom(userId)).emit('notification:updated', { notificationId, isDeleted: true, unreadCount });
      io.to(buildUserRoom(userId)).emit('notification:count', { unreadCount });
    }
    return true;
  } catch (error) {
    console.warn('Unable to dismiss notification:', error?.message || error);
    return null;
  }
}

async function createBranchNotification({ branchId, ...options }) {
  if (!branchId) return [];
  try {
    const rows = await db.promise().query(`SELECT id FROM staffs WHERE branch_id = ?`, [branchId]);
    const staffIds = Array.isArray(rows) ? rows.map((row) => row.id).filter(Boolean) : [];
    return createNotification({ userIds: staffIds, ...options });
  } catch (error) {
    console.warn('Unable to resolve branch staff for notification:', error?.message || error);
    return [];
  }
}

export {
  ensureNotificationsTable,
  createNotification,
  createBranchNotification,
  getNotificationsForUser,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  dismissNotification
};

export default {
  ensureNotificationsTable,
  createNotification,
  createBranchNotification,
  getNotificationsForUser,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  dismissNotification
};
