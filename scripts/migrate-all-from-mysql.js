import dotenv from 'dotenv';
dotenv.config({ override: true });
import mysql from 'mysql2/promise';
import { prisma } from '../db/database-prisma.js';

const MYSQL_CONNECTION_URL = process.env.OLD_MYSQL_DATABASE_URL;
const MYSQL_HOST = process.env.MYSQL_HOST || 'localhost';
const MYSQL_PORT = process.env.MYSQL_PORT || '3306';
const MYSQL_USER = process.env.MYSQL_USER || 'root';
const MYSQL_PASSWORD = process.env.MYSQL_PASSWORD || '';
const MYSQL_DATABASE = process.env.MYSQL_DATABASE || 'livesupport';

function parseConnectionUrl(url) {
  try {
    const urlObj = new URL(url.replace('mysql://', 'http://'));
    return {
      host: urlObj.hostname,
      user: decodeURIComponent(urlObj.username),
      password: decodeURIComponent(urlObj.password),
      port: urlObj.port || '3306',
      database: urlObj.pathname.substring(1),
    };
  } catch (error) {
    throw new Error('Invalid connection URL format. Expected: mysql://user:password@host:port/database');
  }
}

function quoteMysqlIdentifier(name) {
  return `\`${name.replace(/`/g, '``')}\``;
}

function cleanDate(value) {
  if (value === null || value === undefined) return undefined;
  return value instanceof Date ? value : new Date(value);
}

function cleanBoolean(value) {
  if (value === null || value === undefined) return undefined;
  return value === 1 || value === '1' || value === true || value === 'true';
}

function cleanNumber(value) {
  if (value === null || value === undefined) return undefined;
  const num = Number(value);
  return Number.isNaN(num) ? undefined : num;
}

async function fetchRows(connection, tableName) {
  const quoted = quoteMysqlIdentifier(tableName);
  try {
    const [rows] = await connection.query(`SELECT * FROM ${quoted}`);
    return rows;
  } catch (error) {
    if (error && error.code === 'ER_NO_SUCH_TABLE') {
      console.warn(`⚠️  Skipping missing MySQL table: ${tableName}`);
      return [];
    }
    throw error;
  }
}

async function bulkCreate(modelName, rows) {
  if (!rows || rows.length === 0) return 0;
  const model = prisma[modelName];
  if (!model || typeof model.createMany !== 'function') {
    throw new Error(`Prisma model not available: ${modelName}`);
  }
  const result = await model.createMany({ data: rows, skipDuplicates: true });
  return result.count || 0;
}

async function getExistingIds(modelName, fieldName) {
  const rows = await prisma[modelName].findMany({ select: { [fieldName]: true } });
  return new Set(rows.map((row) => row[fieldName]));
}

async function migrateUsers(connection) {
  const rows = await fetchRows(connection, 'users');
  const data = rows.map((row) => ({
    id: row.id,
    email: row.email,
    password: row.password,
    name: row.name,
    role: row.role || 'agent',
    disabled: cleanBoolean(row.disabled),
    created_at: cleanDate(row.created_at),
  }));
  const count = await bulkCreate('user', data);
  console.log(`✅ Migrated users: ${count}`);
}

async function migrateConversations(connection) {
  const rows = await fetchRows(connection, 'conversations');
  const data = rows.map((row) => ({
    id: row.id,
    phone: row.phone,
    name: row.name,
    platform: row.platform || 'whatsapp',
    last_viewed: cleanDate(row.last_viewed),
    created_at: cleanDate(row.created_at),
  }));
  const count = await bulkCreate('conversation', data);
  console.log(`✅ Migrated conversations: ${count}`);
}

async function migrateSettings(connection) {
  const existingUserIds = await getExistingIds('user', 'id');
  const rows = await fetchRows(connection, 'settings');
  const data = rows
    .map((row) => ({
      id: row.id,
      user_id: cleanNumber(row.user_id),
      displayName: row.displayName,
      email: row.email,
      password: row.password,
      autoReply: row.autoReply,
      chatEnabled: row.chatEnabled,
      msgAlert: cleanBoolean(row.msgAlert),
      ticketAlert: cleanBoolean(row.ticketAlert),
      soundAlert: cleanBoolean(row.soundAlert),
      priority: row.priority,
      autoAssign: row.autoAssign,
      theme: row.theme,
      translateEnabled: cleanBoolean(row.translate_enabled ?? row.translateEnabled),
      translateLang: row.translate_lang ?? row.translateLang,
      avatarUrl: row.avatar_url ?? row.avatarUrl,
      autopilotMode: row.autopilotMode,
    }))
    .filter((item) => item.user_id != null && existingUserIds.has(item.user_id));

  const skipped = rows.length - data.length;
  if (skipped > 0) {
    console.log(`⚠️  Skipped ${skipped} settings rows with missing or invalid user_id`);
  }

  const count = await bulkCreate('setting', data);
  console.log(`✅ Migrated settings: ${count}`);
}

async function migrateInstagramConversations(connection) {
  const existingConversationIds = await getExistingIds('conversation', 'id');
  const rows = await fetchRows(connection, 'instagram_conversations');
  const data = rows
    .map((row) => ({
      id: row.id,
      conversation_id: cleanNumber(row.conversation_id),
      ig_id: row.ig_id,
      ig_username: row.ig_username,
      created_at: cleanDate(row.created_at),
    }))
    .filter((item) => item.conversation_id != null && existingConversationIds.has(item.conversation_id));

  const skipped = rows.length - data.length;
  if (skipped > 0) {
    console.log(`⚠️  Skipped ${skipped} instagram_conversations rows with invalid conversation_id`);
  }

  const count = await bulkCreate('instagramConversation', data);
  console.log(`✅ Migrated instagram_conversations: ${count}`);
}

async function migrateMessages(connection) {
  const existingConversationIds = await getExistingIds('conversation', 'id');
  const rows = await fetchRows(connection, 'messages');
  const data = rows
    .map((row) => ({
      id: row.id,
      conversation_id: cleanNumber(row.conversation_id),
      sender: row.sender,
      message: row.message,
      created_at: cleanDate(row.created_at),
    }))
    .filter((item) => item.conversation_id != null && existingConversationIds.has(item.conversation_id));

  const skipped = rows.length - data.length;
  if (skipped > 0) {
    console.log(`⚠️  Skipped ${skipped} messages rows with invalid conversation_id`);
  }

  const count = await bulkCreate('message', data);
  console.log(`✅ Migrated messages: ${count}`);
}

async function migrateReplies(connection) {
  const existingConversationIds = await getExistingIds('conversation', 'id');
  const existingUserIds = await getExistingIds('user', 'id');
  const rows = await fetchRows(connection, 'replies');
  const data = rows
    .map((row) => ({
      id: row.id,
      conversation_id: cleanNumber(row.conversation_id),
      sender: row.sender,
      message: row.message,
      user_id: cleanNumber(row.user_id),
      created_at: cleanDate(row.created_at),
    }))
    .filter(
      (item) =>
        item.conversation_id != null &&
        existingConversationIds.has(item.conversation_id) &&
        (item.user_id == null || existingUserIds.has(item.user_id))
    );

  const skipped = rows.length - data.length;
  if (skipped > 0) {
    console.log(`⚠️  Skipped ${skipped} replies rows with invalid conversation_id or user_id`);
  }

  const count = await bulkCreate('reply', data);
  console.log(`✅ Migrated replies: ${count}`);
}

async function migrateAiMessages(connection) {
  const existingConversationIds = await getExistingIds('conversation', 'id');
  const existingUserIds = await getExistingIds('user', 'id');
  const rows = await fetchRows(connection, 'ai_messages');
  const data = rows
    .map((row) => ({
      id: row.id,
      conversation_id: cleanNumber(row.conversation_id),
      sender: row.sender,
      message: row.message,
      user_id: cleanNumber(row.user_id),
      created_at: cleanDate(row.created_at),
    }))
    .filter(
      (item) =>
        item.conversation_id != null &&
        existingConversationIds.has(item.conversation_id) &&
        (item.user_id == null || existingUserIds.has(item.user_id))
    );

  const skipped = rows.length - data.length;
  if (skipped > 0) {
    console.log(`⚠️  Skipped ${skipped} ai_messages rows with invalid conversation_id or user_id`);
  }

  const count = await bulkCreate('aiMessage', data);
  console.log(`✅ Migrated ai_messages: ${count}`);
}

async function migrateStaffMessages(connection) {
  const existingConversationIds = await getExistingIds('conversation', 'id');
  const existingUserIds = await getExistingIds('user', 'id');
  const rows = await fetchRows(connection, 'staff_messages');
  const data = rows
    .map((row) => ({
      id: row.id,
      conversation_id: cleanNumber(row.conversation_id),
      sender: row.sender,
      message: row.message,
      user_id: cleanNumber(row.user_id),
      created_at: cleanDate(row.created_at),
    }))
    .filter(
      (item) =>
        item.conversation_id != null &&
        existingConversationIds.has(item.conversation_id) &&
        (item.user_id == null || existingUserIds.has(item.user_id))
    );

  const skipped = rows.length - data.length;
  if (skipped > 0) {
    console.log(`⚠️  Skipped ${skipped} staff_messages rows with invalid conversation_id or user_id`);
  }

  const count = await bulkCreate('staffMessage', data);
  console.log(`✅ Migrated staff_messages: ${count}`);
}

async function migrateAiReplies(connection) {
  const existingConversationIds = await getExistingIds('conversation', 'id');
  const existingUserIds = await getExistingIds('user', 'id');
  const rows = await fetchRows(connection, 'ai replies');
  const data = rows
    .map((row) => ({
      id: row.id,
      conversation_id: cleanNumber(row.conversation_id),
      sender: row.sender,
      message: row.message,
      user_id: cleanNumber(row.user_id),
      created_at: cleanDate(row.created_at),
    }))
    .filter(
      (item) =>
        item.conversation_id != null &&
        existingConversationIds.has(item.conversation_id) &&
        (item.user_id == null || existingUserIds.has(item.user_id))
    );

  const skipped = rows.length - data.length;
  if (skipped > 0) {
    console.log(`⚠️  Skipped ${skipped} ai replies rows with invalid conversation_id or user_id`);
  }

  const count = await bulkCreate('aiReply', data);
  console.log(`✅ Migrated ai replies: ${count}`);
}

async function migrateStaffReplies(connection) {
  const existingConversationIds = await getExistingIds('conversation', 'id');
  const existingUserIds = await getExistingIds('user', 'id');
  const rows = await fetchRows(connection, 'staff replies');
  const data = rows
    .map((row) => ({
      id: row.id,
      conversation_id: cleanNumber(row.conversation_id),
      sender: row.sender,
      message: row.message,
      user_id: cleanNumber(row.user_id),
      created_at: cleanDate(row.created_at),
    }))
    .filter(
      (item) =>
        item.conversation_id != null &&
        existingConversationIds.has(item.conversation_id) &&
        (item.user_id == null || existingUserIds.has(item.user_id))
    );

  const skipped = rows.length - data.length;
  if (skipped > 0) {
    console.log(`⚠️  Skipped ${skipped} staff replies rows with invalid conversation_id or user_id`);
  }

  const count = await bulkCreate('staffReply', data);
  console.log(`✅ Migrated staff replies: ${count}`);
}

async function migrateResolved(connection) {
  const existingConversationIds = await getExistingIds('conversation', 'id');
  const rows = await fetchRows(connection, 'resolved');
  const data = rows
    .map((row) => ({
      id: row.id,
      conversation_id: cleanNumber(row.conversation_id),
      resolved_at: cleanDate(row.resolved_at),
    }))
    .filter((item) => item.conversation_id != null && existingConversationIds.has(item.conversation_id));

  const skipped = rows.length - data.length;
  if (skipped > 0) {
    console.log(`⚠️  Skipped ${skipped} resolved rows with invalid conversation_id`);
  }

  const count = await bulkCreate('resolved', data);
  console.log(`✅ Migrated resolved: ${count}`);
}

async function migrateEscalations(connection) {
  const existingConversationIds = await getExistingIds('conversation', 'id');
  const rows = await fetchRows(connection, 'escalations');
  const data = rows
    .map((row) => ({
      id: row.id,
      conversation_id: cleanNumber(row.conversation_id),
      customer_name: row.customer_name,
      escalated_at: cleanDate(row.escalated_at),
      claimed_by: row.claimed_by,
      claim_time: cleanDate(row.claim_time),
      snoozed_until: cleanDate(row.snoozed_until),
      alarm_active: cleanBoolean(row.alarm_active),
    }))
    .filter((item) => item.conversation_id != null && existingConversationIds.has(item.conversation_id));

  const skipped = rows.length - data.length;
  if (skipped > 0) {
    console.log(`⚠️  Skipped ${skipped} escalations rows with invalid conversation_id`);
  }

  const count = await bulkCreate('escalation', data);
  console.log(`✅ Migrated escalations: ${count}`);
}

async function migrateRefunds(connection) {
  const existingConversationIds = await getExistingIds('conversation', 'id');
  const rows = await fetchRows(connection, 'refunds');
  const data = rows
    .map((row) => ({
      id: row.id,
      conversation_id: cleanNumber(row.conversation_id),
      customer_name: row.customer_name,
      refunded_at: cleanDate(row.refunded_at),
    }))
    .filter((item) => item.conversation_id != null && existingConversationIds.has(item.conversation_id));

  const skipped = rows.length - data.length;
  if (skipped > 0) {
    console.log(`⚠️  Skipped ${skipped} refunds rows with invalid conversation_id`);
  }

  const count = await bulkCreate('refund', data);
  console.log(`✅ Migrated refunds: ${count}`);
}

async function migrateAiFeedback(connection) {
  const existingConversationIds = await getExistingIds('conversation', 'id');
  const existingUserIds = await getExistingIds('user', 'id');
  const rows = await fetchRows(connection, 'ai_feedback');
  const data = rows.map((row) => {
    const conversation_id = cleanNumber(row.conversation_id);
    const user_id = cleanNumber(row.user_id);
    return {
      id: row.id,
      conversation_id: conversation_id && existingConversationIds.has(conversation_id) ? conversation_id : undefined,
      message_id: cleanNumber(row.message_id),
      user_id: user_id && existingUserIds.has(user_id) ? user_id : undefined,
      rating: cleanNumber(row.rating),
      feedback_text: row.feedback_text,
      correction: row.correction,
      created_at: cleanDate(row.created_at),
    };
  });

  const count = await bulkCreate('aiFeedback', data);
  console.log(`✅ Migrated ai_feedback: ${count}`);
}

async function migrateDeliveryIssues(connection) {
  const existingConversationIds = await getExistingIds('conversation', 'id');
  const rows = await fetchRows(connection, 'delivery_issues');
  const data = rows
    .map((row) => ({
      id: row.id,
      conversation_id: cleanNumber(row.conversation_id),
      customer_name: row.customer_name,
      reported_at: cleanDate(row.reported_at),
    }))
    .filter((item) => item.conversation_id != null && existingConversationIds.has(item.conversation_id));

  const skipped = rows.length - data.length;
  if (skipped > 0) {
    console.log(`⚠️  Skipped ${skipped} delivery_issues rows with invalid conversation_id`);
  }

  const count = await bulkCreate('deliveryIssue', data);
  console.log(`✅ Migrated delivery_issues: ${count}`);
}

async function migrateWhatsappTokens(connection) {
  const rows = await fetchRows(connection, 'whatsapp_tokens');
  const data = rows.map((row) => ({
    id: row.id,
    token: row.token,
    expires_at: cleanDate(row.expires_at),
    created_at: cleanDate(row.created_at),
  }));
  const count = await bulkCreate('whatsappToken', data);
  console.log(`✅ Migrated whatsapp_tokens: ${count}`);
}

async function migrateReceipts(connection) {
  const rows = await fetchRows(connection, 'receipts');
  const data = rows.map((row) => ({
    id: row.id,
    content: row.content,
    escalated: cleanBoolean(row.escalated),
    created_at: cleanDate(row.created_at),
  }));
  const count = await bulkCreate('receipt', data);
  console.log(`✅ Migrated receipts: ${count}`);
}

async function migrateTickets(connection) {
  const rows = await fetchRows(connection, 'tickets');
  const data = rows.map((row) => ({
    id: row.id,
    ticket_type: row.ticket_type,
    subject: row.subject,
    customer_name: row.customer_name,
    customer_phone: row.customer_phone,
    assignee: row.assignee,
    priority: row.priority,
    status: row.status,
    content: row.content,
    tags: row.tags,
    attachments: row.attachments,
    sla_due: cleanDate(row.sla_due),
    escalated: cleanBoolean(row.escalated),
    created_at: cleanDate(row.created_at),
  }));
  const count = await bulkCreate('ticket', data);
  console.log(`✅ Migrated tickets: ${count}`);
}

async function migrateFoods(connection) {
  const rows = await fetchRows(connection, 'foods');
  const data = rows.map((row) => ({
    id: row.id,
    category: row.category,
    key_name: row.key_name,
    name: row.name,
    price: row.price != null ? row.price.toString() : undefined,
    available: cleanNumber(row.available),
    image_url: row.image_url,
    created_at: cleanDate(row.created_at),
    updated_at: cleanDate(row.updated_at),
  }));
  const count = await bulkCreate('food', data);
  console.log(`✅ Migrated foods: ${count}`);
}

async function migrateOrders(connection) {
  const existingConversationIds = await getExistingIds('conversation', 'id');
  const rows = await fetchRows(connection, 'orders');
  const data = rows.map((row) => {
    const conversation_id = cleanNumber(row.conversation_id);
    return {
      id: row.id,
      order_id: row.order_id,
      customer_name: row.customer_name,
      phone: row.phone,
      product: row.product,
      amount: row.amount != null ? row.amount.toString() : undefined,
      total_amount: row.total_amount != null ? row.total_amount.toString() : undefined,
      status: row.status,
      order_date: cleanDate(row.order_date),
      conversation_id: conversation_id && existingConversationIds.has(conversation_id) ? conversation_id : undefined,
    };
  });

  const count = await bulkCreate('order', data);
  console.log(`✅ Migrated orders: ${count}`);
}

async function migrateDeliveries(connection) {
  const existingOrderIds = await getExistingIds('order', 'id');
  const rows = await fetchRows(connection, 'deliveries');
  const data = rows
    .map((row) => ({
      id: row.id,
      order_id: cleanNumber(row.order_id),
      rider_name: row.rider_name,
      vehicle: row.vehicle,
      current_lat: cleanNumber(row.current_lat),
      current_lng: cleanNumber(row.current_lng),
      customer_lat: cleanNumber(row.customer_lat),
      customer_lng: cleanNumber(row.customer_lng),
      delivery_status: row.delivery_status,
      order_confirmed_time: cleanDate(row.order_confirmed_time),
      rider_assigned_time: cleanDate(row.rider_assigned_time),
      picked_up_time: cleanDate(row.picked_up_time),
      in_transit_time: cleanDate(row.in_transit_time),
      arriving_time: cleanDate(row.arriving_time),
      delivered_time: cleanDate(row.delivered_time),
      created_at: cleanDate(row.created_at),
      updated_at: cleanDate(row.updated_at),
    }))
    .filter((item) => item.order_id != null && existingOrderIds.has(item.order_id));

  const skipped = rows.length - data.length;
  if (skipped > 0) {
    console.log(`⚠️  Skipped ${skipped} deliveries rows with invalid order_id`);
  }

  const count = await bulkCreate('delivery', data);
  console.log(`✅ Migrated deliveries: ${count}`);
}

async function migrateUserAvatars(connection) {
  const existingUserIds = await getExistingIds('user', 'id');
  const rows = await fetchRows(connection, 'user_avatars');
  const data = rows
    .map((row) => ({
      id: row.id,
      user_id: cleanNumber(row.user_id),
      filename: row.filename,
      url: row.url,
      created_at: cleanDate(row.created_at),
    }))
    .filter((item) => item.user_id != null && existingUserIds.has(item.user_id));

  const skipped = rows.length - data.length;
  if (skipped > 0) {
    console.log(`⚠️  Skipped ${skipped} user_avatars rows with invalid user_id`);
  }

  const count = await bulkCreate('userAvatar', data);
  console.log(`✅ Migrated user_avatars: ${count}`);
}

async function migrateAll(connection) {
  await migrateUsers(connection);
  await migrateConversations(connection);
  await migrateSettings(connection);
  await migrateMessages(connection);
  await migrateReplies(connection);
  await migrateAiMessages(connection);
  await migrateStaffMessages(connection);
  await migrateAiReplies(connection);
  await migrateStaffReplies(connection);
  await migrateResolved(connection);
  await migrateEscalations(connection);
  await migrateRefunds(connection);
  await migrateAiFeedback(connection);
  await migrateDeliveryIssues(connection);
  await migrateWhatsappTokens(connection);
  await migrateReceipts(connection);
  await migrateTickets(connection);
  await migrateFoods(connection);
  await migrateOrders(connection);
  await migrateDeliveries(connection);
  await migrateUserAvatars(connection);
}

async function resetAllSequences() {
  const serialTables = [
    'users',
    'conversations',
    'resolved',
    'escalations',
    'ai_messages',
    'staff_messages',
    'ai replies',
    'staff replies',
    'refunds',
    'ai_feedback',
    'delivery_issues',
    'whatsapp_tokens',
    'settings',
    'messages',
    'replies',
    'receipts',
    'tickets',
    'foods',
    'orders',
    'deliveries',
    'user_avatars',
  ];

  for (const table of serialTables) {
    try {
      await resetSequence(table);
      console.log(`🔧 Reset sequence for ${table}`);
    } catch (error) {
      console.warn(`⚠️  Could not reset sequence for ${table}:`, error.message || error);
    }
  }
}

async function main() {
  console.log('🔄 Starting full MySQL -> Prisma migration...');
  let mysqlConnection;

  try {
    let config;
    if (MYSQL_CONNECTION_URL) {
      config = parseConnectionUrl(MYSQL_CONNECTION_URL);
    } else if (MYSQL_HOST && MYSQL_USER && MYSQL_DATABASE) {
      config = {
        host: MYSQL_HOST,
        port: MYSQL_PORT,
        user: MYSQL_USER,
        password: MYSQL_PASSWORD,
        database: MYSQL_DATABASE,
      };
    } else {
      throw new Error('No MySQL connection info provided. Set OLD_MYSQL_DATABASE_URL or MYSQL_HOST+MYSQL_USER+MYSQL_DATABASE.');
    }

    console.log(`📍 Connecting to MySQL: ${config.host}/${config.database}`);
    mysqlConnection = await mysql.createConnection({
      host: config.host,
      port: config.port || '3306',
      user: config.user,
      password: config.password,
      database: config.database,
      dateStrings: false,
    });
    console.log('✅ Connected to MySQL');

    await migrateAll(mysqlConnection);
    await resetAllSequences();

    console.log('🎉 Full migration complete.');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exitCode = 1;
  } finally {
    if (mysqlConnection) await mysqlConnection.end();
    await prisma.$disconnect();
  }
}

if (MYSQL_CONNECTION_URL && MYSQL_CONNECTION_URL.includes('user:password')) {
  console.error('❌ Error: Please update the OLD_MYSQL_DATABASE_URL in this script or environment variable.');
  console.error('   Format: mysql://username:password@hostname:port/database_name');
  process.exit(1);
}

main();
