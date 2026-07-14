// server.js
import fetch from "node-fetch";
import http from "http";
import { Server } from "socket.io";
import "dotenv/config";
import express from "express";
import bodyParser from "body-parser";
import session from "express-session";
import path from "path";
import fs from "fs";
import multer from "multer";
import { randomUUID, randomBytes } from 'crypto';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import { db, connectDatabase, config as dbConfig, prisma } from "./db/database.js";
import { getMistralReply, initDatabase, setDisableAICallback, setHandoffCallback, setPlayHandoffAudioCallback, isTicketCreationRequest, isRequestingStaff, MENU_ITEMS, createTicket, detectTicketCategory } from "./replies.js";
import { sendEmail } from "./utils/email.js";
import { fetchGmailEmails } from "./utils/gmail-imap.js";
import createAuthRouter from "./routes/auth.js";
const app = express();

const upload = multer({ dest: path.join(__dirname, "uploads") });

// Initialize database connection for replies module
initDatabase(db);

// AI Response Control System
// Track when agents last sent messages per conversation
const agentActivity = new Map(); // conversation_id -> { lastMessage: timestamp, aiDisabled: boolean, timer: timeoutId }
// Track timers for snoozed escalations: conversation_id -> timeoutId
const escalationTimers = new Map();
// Track presence and typing
const onlineAgents = new Map(); // socketId -> { userId, name, role, socketId, lastActive, activeConversation }
const typingIndicators = new Map(); // conversationId -> Set of agent names
// Track user sessions to support force-logout
const userSessions = new Map(); // userId -> Set of sessionIDs

// Voice infrastructure
const voiceUsers = new Map(); // socketId -> { userId, name, role, socketId, avatarUrl, status, voiceSessionId, muted, speaking, currentChannelId }
const voiceSessions = new Map(); // sessionId -> { id, type, createdBy, status, room, channelId, participants: Map<socketId, {...}>, startedAt, endedAt }
const voiceChannels = new Map(); // channelId -> { id, name, description, createdAt, members: Set<socketId>, activeSessionId }

const callSessions = new Map(); // secureToken -> { secureToken, conversationId, customerName, staffId, staffName, status, createdAt, expiresAt, startedAt, answeredAt, endedAt, duration, staffSocketId, customerSocketId, timeoutId }
const CALL_EXPIRY_MINUTES = Number(process.env.CALL_SESSION_EXPIRY_MINUTES || 15);
const CALL_UNANSWERED_TIMEOUT_MS = 60 * 1000;

// Dashboard snapshots storage
const dashboardSnapshots = new Map(); // name -> { data, saved_at }

const defaultVoiceChannels = [
    { id: 1, name: 'General Staff', description: 'Open staff channel for general coordination', createdAt: new Date().toISOString() },
    { id: 2, name: 'Support Team', description: 'Support staff only', createdAt: new Date().toISOString() },
    { id: 3, name: 'Sales Team', description: 'Sales and upsell coordination', createdAt: new Date().toISOString() },
    { id: 4, name: 'Management', description: 'Leadership and escalation channel', createdAt: new Date().toISOString() }
];

function ensureDefaultVoiceChannels() {
    if (voiceChannels.size) return;
    defaultVoiceChannels.forEach(channel => {
        voiceChannels.set(channel.id, Object.assign({}, channel, { members: new Set(), activeSessionId: null }));
    });
}

function broadcastVoicePresence() {
    const list = Array.from(voiceUsers.values()).map(u => ({
        userId: u.userId,
        name: u.name,
        role: u.role,
        status: u.status || 'offline',
        voiceSessionId: u.voiceSessionId || null,
        muted: !!u.muted,
        speaking: !!u.speaking,
        currentChannelId: u.currentChannelId || null,
        avatarUrl: u.avatarUrl || null
    }));
    io.emit('voice:presenceUpdate', list);
}

function getVoiceChannelList() {
    ensureDefaultVoiceChannels();
    return Array.from(voiceChannels.values()).map(ch => ({
        id: ch.id,
        name: ch.name,
        description: ch.description,
        memberCount: ch.members.size,
        hasActiveSession: !!ch.activeSessionId
    }));
}

function normalizeVoiceUser(socket, data) {
    if (!socket || !data) return null;
    return {
        userId: data.userId,
        name: data.name || data.displayName || 'Staff',
        role: data.role || 'agent',
        avatarUrl: data.avatarUrl || null,
        socketId: socket.id,
        status: data.status || 'online',
        voiceSessionId: data.voiceSessionId || null,
        muted: !!data.muted,
        speaking: !!data.speaking,
        currentChannelId: data.currentChannelId || null
    };
}

// Disable AI responses for 15 minutes after agent sends a message or after an AI handoff
function disableAIForConversation(conversationId, source = 'agent') {
    // Ensure conversation_id is a number for consistent Map lookups
    const id = Number(conversationId);
    const now = Date.now();
    const fifteenMinutes = 15 * 60 * 1000;

    // Clear any existing timer
    if (agentActivity.has(id)) {
        const existing = agentActivity.get(id);
        if (existing.timer) {
            clearTimeout(existing.timer);
        }
    }

    // Set AI as disabled and start timer
    agentActivity.set(id, {
        lastMessage: now,
        aiDisabled: true,
        source,
        timer: setTimeout(() => {
            // Re-enable AI after 15 minutes
            const data = agentActivity.get(id);
            if (data) {
                data.aiDisabled = false;
                data.timer = null;
                console.log(`✅ AI responses re-enabled for conversation ${id} after 15 minutes`);
            }
        }, fifteenMinutes)
    });

    console.log(`🚫 AI responses DISABLED for conversation ${id} for 15 minutes`, {
        conversationId: id,
        timestamp: new Date().toISOString(),
        mapSize: agentActivity.size
    });
}

// Set the callback for disabling AI in replies module
setDisableAICallback((conversationId) => {
    disableAIForConversation(conversationId, 'handoff');
});

// Set the callback for playing handoff audio
setPlayHandoffAudioCallback((conversationId) => {
    console.log(`Playing handoff audio for conversation ${conversationId}`);
    io.emit('playHandoffAudio', { conversationId });
});

// Check if AI should respond to a conversation
function shouldAIRespond(conversationId) {
    // Ensure conversation_id is a number for consistent Map lookups
    const id = Number(conversationId);
    const data = agentActivity.get(id);
    const should = !data || !data.aiDisabled;
    console.log(`shouldAIRespond check for conversation ${id}:`, {
        originalId: conversationId,
        numericId: id,
        hasData: !!data,
        aiDisabled: data?.aiDisabled,
        shouldRespond: should,
        mapSize: agentActivity.size,
        mapKeys: Array.from(agentActivity.keys())
    });
    return should;
}

async function initVoiceChannelsFromDb() {
    ensureDefaultVoiceChannels();
    try {
        const channels = await prisma.voiceChannel.findMany();
        if (Array.isArray(channels) && channels.length > 0) {
            voiceChannels.clear();
            channels.forEach(channel => {
                voiceChannels.set(channel.id, Object.assign({}, channel, { members: new Set(), activeSessionId: null }));
            });
        }
    } catch (err) {
        console.warn('Voice channel DB load failed, using defaults', err?.message || err);
    }
}

async function persistVoiceSession(session) {
    if (!prisma || !session) return null;
    try {
        const created = await prisma.voiceSession.create({
            data: {
                type: session.type.toUpperCase(),
                createdBy: session.createdBy || null,
                startedAt: session.startedAt ? new Date(session.startedAt) : null,
                endedAt: session.endedAt ? new Date(session.endedAt) : null,
                status: session.status.toUpperCase(),
                channelId: session.channelId || null
            }
        });
        return created;
    } catch (err) {
        console.warn('persistVoiceSession failed', err?.message || err);
        return null;
    }
}

async function persistVoiceParticipants(sessionId, participants) {
    if (!prisma || !sessionId || !Array.isArray(participants)) return [];
    try {
        return await Promise.all(participants.map(p => prisma.voiceParticipant.create({
            data: {
                sessionId,
                userId: p.userId,
                joinedAt: p.joinedAt ? new Date(p.joinedAt) : new Date(),
                leftAt: p.leftAt ? new Date(p.leftAt) : null,
                muted: !!p.muted
            }
        })));
    } catch (err) {
        console.warn('persistVoiceParticipants failed', err?.message || err);
        return [];
    }
}

function saveVoiceActivity(socketId, data) {
    const user = voiceUsers.get(socketId);
    if (!user) return;
    user.speaking = !!data.speaking;
    user.muted = !!data.muted;
    user.status = data.status || user.status || 'online';
    voiceUsers.set(socketId, user);
    broadcastVoicePresence();
}

function getSocketByUserId(userId) {
    for (const [socketId, record] of voiceUsers.entries()) {
        if (String(record.userId) === String(userId)) return socketId;
    }
    return null;
}

function getVoiceSessionById(sessionId) {
    return voiceSessions.get(sessionId) || null;
}

function endVoiceSession(sessionId, reason = 'ended') {
    const session = voiceSessions.get(sessionId);
    if (!session) return;
    session.status = 'ended';
    session.endedAt = new Date().toISOString();
    session.participants.forEach((participant, socketId) => {
        const user = voiceUsers.get(socketId);
        if (user) {
            user.voiceSessionId = null;
            user.status = 'online';
            voiceUsers.set(socketId, user);
        }
    });
    voiceSessions.delete(sessionId);
    broadcastVoicePresence();
}

function getRoomName(sessionId) {
    return `voice-session-${sessionId}`;
}

function generateSecureToken(length = 64) {
    return randomBytes(length).toString('hex');
}

function expireCallSession(token) {
    const record = callSessions.get(token);
    if (!record) return;
    if (record.status === 'waiting' || record.status === 'ringing') {
        record.status = 'missed';
        record.endedAt = new Date().toISOString();
        record.duration = 0;
        record.timeoutId = null;
        callSessions.set(token, record);
        persistCallSession(record).catch(() => {});
        if (record.staffSocketId) {
            io.to(record.staffSocketId).emit('call:missed', { secureToken: token, status: record.status });
        }
        if (record.customerSocketId) {
            io.to(record.customerSocketId).emit('call:status', { secureToken: token, status: record.status });
        }
    }
}

function createCallTimeout(token) {
    const record = callSessions.get(token);
    if (!record) return;
    if (record.timeoutId) {
        clearTimeout(record.timeoutId);
    }
    record.timeoutId = setTimeout(() => {
        expireCallSession(token);
    }, CALL_UNANSWERED_TIMEOUT_MS);
    callSessions.set(token, record);
}

function cleanupCallSession(token) {
    const record = callSessions.get(token);
    if (!record) return;
    if (record.timeoutId) {
        clearTimeout(record.timeoutId);
        record.timeoutId = null;
    }
    callSessions.delete(token);
}

function findCallSessionBySocket(socketId) {
    for (const [token, session] of callSessions.entries()) {
        if (session.staffSocketId === socketId || session.customerSocketId === socketId) {
            return session;
        }
    }
    return null;
}

function getOppositeSocket(token, socketId) {
    const session = callSessions.get(token);
    if (!session) return null;
    if (session.staffSocketId === socketId) return session.customerSocketId;
    if (session.customerSocketId === socketId) return session.staffSocketId;
    return null;
}

function persistCallSession(session) {
    return new Promise((resolve, reject) => {
        if (!session || !session.secureToken) return resolve(null);
        const values = [
            session.secureToken,
            session.conversationId,
            session.customerName,
            session.staffId,
            session.staffName,
            session.status,
            session.startedAt ? session.startedAt : null,
            session.answeredAt ? session.answeredAt : null,
            session.endedAt ? session.endedAt : null,
            session.duration,
            session.expiresAt,
            session.createdAt,
            new Date().toISOString()
        ];
        const insertSql = isPg
            ? `INSERT INTO call_sessions (secure_token, conversation_id, customer_name, staff_id, staff_name, status, started_at, answered_at, ended_at, duration, expires_at, created_at, updated_at)
                   VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
                   ON CONFLICT (secure_token) DO UPDATE SET
                     conversation_id = EXCLUDED.conversation_id,
                     customer_name = EXCLUDED.customer_name,
                     staff_id = EXCLUDED.staff_id,
                     staff_name = EXCLUDED.staff_name,
                     status = EXCLUDED.status,
                     started_at = EXCLUDED.started_at,
                     answered_at = EXCLUDED.answered_at,
                     ended_at = EXCLUDED.ended_at,
                     duration = EXCLUDED.duration,
                     expires_at = EXCLUDED.expires_at,
                     updated_at = EXCLUDED.updated_at`
            : `INSERT INTO call_sessions (secure_token, conversation_id, customer_name, staff_id, staff_name, status, started_at, answered_at, ended_at, duration, expires_at, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                   ON DUPLICATE KEY UPDATE
                     conversation_id = VALUES(conversation_id),
                     customer_name = VALUES(customer_name),
                     staff_id = VALUES(staff_id),
                     staff_name = VALUES(staff_name),
                     status = VALUES(status),
                     started_at = VALUES(started_at),
                     answered_at = VALUES(answered_at),
                     ended_at = VALUES(ended_at),
                     duration = VALUES(duration),
                     expires_at = VALUES(expires_at),
                     updated_at = VALUES(updated_at)`;

        db.query(insertSql, values, (err) => {
            if (err) {
                console.error('persistCallSession error', err);
                return reject(err);
            }
            resolve(session);
        });
    });
}

function getVoiceSessionSummary(session) {
    return {
        id: session.id,
        type: session.type,
        status: session.status,
        createdBy: session.createdBy,
        channelId: session.channelId || null,
        startedAt: session.startedAt || null,
        endedAt: session.endedAt || null,
        participants: Array.from(session.participants.values()).map(participant => ({
            userId: participant.userId,
            name: participant.name,
            role: participant.role,
            muted: !!participant.muted,
            speaking: !!participant.speaking,
            joinedAt: participant.joinedAt,
            leftAt: participant.leftAt || null
        }))
    };
}

function getConversationAutopilotMode(conversationId) {
    const convId = Number(conversationId);
    if (Number.isNaN(convId)) return 'assist';

    for (const record of onlineAgents.values()) {
        if (Number(record.activeConversation) === convId) {
            return record.autopilotMode ? String(record.autopilotMode).toLowerCase() : 'assist';
        }
    }

    return 'assist';
}

function isAIAutoSendEnabled(conversationId) {
    return getConversationAutopilotMode(conversationId) === 'auto';
}

function emitNewMessageEvent(conversationId, messageData) {
    const id = Number(conversationId);
    db.query("SELECT phone, name FROM conversations WHERE id = ? LIMIT 1", [id], (err, rows) => {
        const senderName = (!err && Array.isArray(rows) && rows.length > 0)
            ? (rows[0].name || rows[0].phone || null)
            : null;
        const payload = Object.assign({}, messageData, { conversation_id: id });
        if (senderName) payload.sender_name = senderName;

        const roomName = `conversation:${id}`;
        io.to(roomName).emit("newMessage", payload);
        io.to("inbox").emit("newMessage", payload);
        io.to("inbox").emit("conversation:updated", { conversationId: id, message: payload });
        console.log(`📤 Socket.IO newMessage event emitted for conversation ${id}:`, {
            conversationId: id,
            sender: payload.sender,
            messageLength: payload.message ? payload.message.length : 0,
            room: roomName,
            connectedSockets: io.engine.clientsCount || 'unknown'
        });
    });
}

function reduceMenuStock(items, callback) {
    if (!Array.isArray(items) || items.length === 0) return callback(null);
    const quantities = items.reduce((acc, item) => {
        const qty = Number(item.quantity || 1);
        if (!item.menuItemId || qty <= 0) return acc;
        acc[item.menuItemId] = (acc[item.menuItemId] || 0) + qty;
        return acc;
    }, {});

    const updates = Object.entries(quantities);
    if (updates.length === 0) return callback(null);

    let completed = 0;
    let hasError = false;
    updates.forEach(([key, qty]) => {
        const sql = isPg
            ? 'UPDATE Menu SET available = GREATEST(available - $1, 0) WHERE key_name = $2'
            : 'UPDATE Menu SET available = GREATEST(available - ?, 0) WHERE key_name = ?';
        db.query(sql, [qty, key], (err) => {
            if (err && !hasError) {
                hasError = true;
                return callback(err);
            }
            completed += 1;
            if (completed === updates.length && !hasError) {
                callback(null);
            }
        });
    });
}

function isCustomerGreeting(text) {
    if (!text) return false;
    const normalized = text.toLowerCase().trim();
    const greetings = [
        'hey',
        'hello',
        'hi',
        'hiya',
        'yo',
        'good morning',
        'good afternoon',
        'good evening',
        'what\'s up',
        'sup'
    ];
    return greetings.some(greeting =>
        normalized === greeting ||
        normalized.startsWith(greeting + ' ') ||
        normalized.endsWith(' ' + greeting) ||
        normalized.includes(' ' + greeting + ' ') ||
        normalized === greeting + '!' ||
        normalized === greeting + '.'
    );
}

function enableAIForConversation(conversationId) {
    const id = Number(conversationId);
    const existing = agentActivity.get(id);

    if (existing) {
        if (existing.timer) {
            clearTimeout(existing.timer);
        }
        existing.aiDisabled = false;
        existing.timer = null;
        agentActivity.set(id, existing);
    } else {
        agentActivity.set(id, { lastMessage: Date.now(), aiDisabled: false, timer: null, source: 'agent' });
    }

    console.log(`✅ AI responses re-enabled immediately for conversation ${id} after customer greeting`);
}

function isStaffIdleForThreeMinutes(conversationId) {
    const id = Number(conversationId);
    const data = agentActivity.get(id);
    if (!data || !data.aiDisabled || data.source !== 'agent') {
        return false;
    }

    const threeMinutes = 3 * 60 * 1000;
    return (Date.now() - data.lastMessage) >= threeMinutes;
}

// Automated ticket creation function
async function checkAndCreateTicket(conversationId, phone, message) {
    // Auto-create a ticket when our keyword detector sees a support issue or complaint.
    // It will assign the ticket to the best matching staff role based on the message.
    const problemKeywords = [
        // Delivery issues
        'late', 'delayed', 'delay', 'slow', 'not arrived', 'waiting', 'ETA', 'estimated', 'delivery time', 'taking long', 'where is', 'not here', 'missing delivery', 'late delivery', 'delayed delivery',
        // Refund issues
        'refund', 'money back', 'return my money', 'cancel order', 'cancel my order', 'chargeback', 'refund request', 'back', 'return', 'cancel', 'charge back', 'want refund', 'need refund', 'get money back',
        // Kitchen/food issues
        'allergy', 'allergic', 'bad food', 'food quality', 'tastes bad', 'spoiled', 'cold food', 'cold order', 'cold', 'taste', 'smell', 'texture', 'wrong', 'missing', 'burnt', 'undercooked', 'overcooked', 'raw', 'soggy', 'dry', 'allergic reaction', 'food poisoning', 'sick', 'ill',
        // General complaints
        'complaint', 'complain', 'issue', 'problem', 'help', 'trouble', 'support', 'not happy', 'dissatisfied', 'unhappy', 'angry', 'frustrated', 'terrible', 'awful', 'horrible', 'worst', 'error', 'bug', 'broken', 'stuck', 'failed', 'not working', 'doesn\'t work', 'won\'t work', 'glitch', 'crash', 'freeze'
    ];
    const lowerMessage = message.toLowerCase();
    const hasProblem = problemKeywords.some(keyword => lowerMessage.includes(keyword));

    if (!hasProblem) return;

    db.query(`
        SELECT sender, message FROM messages 
        WHERE conversation_id = ? 
        ORDER BY created_at DESC LIMIT 10
    `, [conversationId], async (err, messages) => {
        if (err) {
            console.log("Error checking messages for auto-ticket:", err);
            return;
        }

        const customerMessages = messages.filter(m => m.sender !== 'sent').length;
        const agentMessages = messages.filter(m => m.sender === 'sent').length;

        // Create ticket when a problem keyword appears and the customer has no recent agent response.
        if (agentMessages === 0) {
            const assignee = detectTicketCategory(message);
            console.log(`Auto-creating ticket for conversation ${conversationId}. Assigning to: ${assignee}`);

            const ticket = await createTicket(message, phone, conversationId, assignee);
            if (ticket) {
                console.log(`Ticket #${ticket.id} auto-created for conversation ${conversationId} and assigned to ${assignee}`);
                io.emit('ticketCreated', ticket);
                io.emit('staffNotification', {
                    message: `Ticket #${ticket.id} created`,
                    from: 'Auto creation system',
                    time: new Date().toISOString()
                });
            }
        }
    });
}

// Create/ensure schema for several tables with Postgres compatibility when configured
const isPg = !!(dbConfig && dbConfig.usePostgres);

function getSlaMinutes(assignee, ticketType) {
    const value = `${assignee || ''} ${ticketType || ''}`.toLowerCase();
    if (value.includes('refund')) return 60;
    if (value.includes('kitchen') || value.includes('quality') || value.includes('food') || value.includes('cold')) return 90;
    if (value.includes('delivery') || value.includes('late') || value.includes('delay')) return 120;
    return 180;
}

function computeSlaDue(assignee, ticketType) {
    const minutes = getSlaMinutes(assignee, ticketType);
    return new Date(Date.now() + minutes * 60 * 1000);
}

// Runtime SQL/DDL removed: schema is managed by Prisma migrations.
// Use `npm run migrate` or `npx prisma db push` to apply the schema defined in `prisma/schema.prisma`.
console.log('Runtime SQL/DDL blocks in server.js are disabled. Apply Prisma migrations to create tables.');

async function storeWhatsAppToken(token, expiresInSeconds = null) {
    const expiresAt = expiresInSeconds ? new Date(Date.now() + expiresInSeconds * 1000) : null;
    try {
        await prisma.whatsappToken.create({ data: { token, expires_at: expiresAt } });
    } catch (err) {
        console.error("Error storing WhatsApp token:", err);
    }
}

async function getStoredWhatsAppToken() {
    try {
        const row = await prisma.whatsappToken.findFirst({ orderBy: { created_at: 'desc' } });
        return row || null;
    } catch (err) {
        throw err;
    }
}

async function getWhatsAppToken() {
    if (process.env.WHATSAPP_TOKEN) {
        return process.env.WHATSAPP_TOKEN;
    }

    const row = await getStoredWhatsAppToken();
    if (!row || !row.token) {
        throw new Error("WhatsApp token is not configured. Add it in your .env or save it via /api/whatsapp-token.");
    }

    if (row.expires_at && new Date(row.expires_at) <= new Date()) {
        throw new Error("Stored WhatsApp token has expired. Update it via /api/whatsapp-token.");
    }

    return row.token;
}

async function exchangeWhatsAppToken(shortLivedToken) {
    const clientId = process.env.WHATSAPP_APP_ID;
    const clientSecret = process.env.WHATSAPP_APP_SECRET;
    if (!clientId || !clientSecret) {
        throw new Error("Missing WHATSAPP_APP_ID or WHATSAPP_APP_SECRET for token exchange.");
    }

    const url = `https://graph.facebook.com/v18.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${clientId}&client_secret=${clientSecret}&fb_exchange_token=${encodeURIComponent(shortLivedToken)}`;
    const response = await fetch(url);
    const data = await response.json();
    if (!response.ok || !data.access_token) {
        throw new Error(`Token exchange failed: ${JSON.stringify(data)}`);
    }

    storeWhatsAppToken(data.access_token, data.expires_in);
    return data;
}

app.post('/api/whatsapp-token', (req, res) => {
    const { token, expires_in } = req.body;
    if (!token) {
        return res.status(400).json({ error: "Missing WhatsApp token." });
    }

    storeWhatsAppToken(token, expires_in || null);
    res.json({ success: true });
});

app.post('/api/whatsapp-token/exchange', async (req, res) => {
    const { token } = req.body;
    const sourceToken = token || process.env.WHATSAPP_TOKEN;
    if (!sourceToken) {
        return res.status(400).json({ error: "Missing source token for exchange." });
    }

    try {
        const exchangedData = await exchangeWhatsAppToken(sourceToken);
        res.json({ success: true, expires_in: exchangedData.expires_in || null });
    } catch (error) {
        console.error("WhatsApp token exchange error:", error);
        res.status(500).json({ error: error.message || "Token exchange failed." });
    }
});

// API to record AI feedback from staff or customers
app.post('/api/ai-feedback', express.json(), async (req, res) => {
    try {
        const { conversation_id, message_id, user_id, rating, feedback_text, correction } = req.body || {};
        if (!conversation_id && !message_id) {
            if (!feedback_text && !correction) return res.status(400).json({ error: 'Missing identifiers or feedback content' });
        }

        const created = await prisma.aiFeedback.create({
            data: {
                conversation_id: conversation_id || null,
                message_id: message_id || null,
                user_id: user_id || null,
                rating: rating || null,
                feedback_text: feedback_text || null,
                correction: correction || null
            }
        });
        res.json({ success: true, id: created.id });
    } catch (e) {
        console.error('ai-feedback error', e);
        res.status(500).json({ error: 'internal_error' });
    }
});

// Simple endpoint to fetch recent feedback (admin use)
app.get('/api/ai-feedback', async (req, res) => {
    try {
        const limit = Math.min(1000, parseInt(req.query.limit || '200', 10));
        const results = await prisma.aiFeedback.findMany({ take: limit, orderBy: { created_at: 'desc' } });
        res.json(results || []);
    } catch (err) {
        console.error('ai-feedback list error', err);
        res.status(500).json({ error: 'db_error' });
    }
});

// Email inbox - now using database
// Get all emails from database
app.get('/api/email/inbox', async (req, res) => {
    try {
        const emails = await prisma.email.findMany({
            orderBy: { created_at: 'desc' },
            take: 100
        });
        res.json({ success: true, emails });
    } catch (err) {
        console.error('Failed to fetch emails from database:', err);
        res.status(500).json({ success: false, error: err.message || 'Failed to fetch emails' });
    }
});

// Send email and save to database
app.post('/api/email/send', express.json(), async (req, res) => {
    try {
        const { to, subject, message } = req.body || {};
        if (!to || !subject || !message) {
            return res.status(400).json({ success: false, error: 'Missing required fields: to, subject, message' });
        }

        const emailResult = await sendEmail({
            to,
            subject,
            text: message,
            html: `<p>${message.replace(/\n/g, '<br>')}</p>`
        });

        if (!emailResult.success) {
            return res.status(500).json({ success: false, error: emailResult.error || 'Email send failed' });
        }

        // Save sent email to database
        const savedEmail = await prisma.email.create({
            data: {
                from: 'Support Team',
                fromEmail: 'support@livesupport.com',
                to,
                subject,
                body: message,
                preview: message.slice(0, 100),
                date: new Date(),
                isRead: true // Mark sent emails as read
            }
        });

        res.json({ success: true, message: 'Email sent', messageId: emailResult.messageId, email: savedEmail });
    } catch (err) {
        console.error('email send error', err);
        res.status(500).json({ success: false, error: err.message || 'internal_error' });
    }
});

// Receive email and save to database
app.post('/api/email/receive', express.json(), async (req, res) => {
    try {
        const { from, fromEmail, subject, body, preview, date } = req.body || {};
        if (!from || !fromEmail || !subject || !body) {
            return res.status(400).json({ success: false, error: 'Missing required fields: from, fromEmail, subject, body' });
        }

        const newEmail = await prisma.email.create({
            data: {
                from,
                fromEmail,
                to: 'support@livesupport.com',
                subject,
                preview: preview || body.slice(0, 100),
                body,
                date: date ? new Date(date) : new Date(),
                isRead: false
            }
        });

        // Broadcast email received via Socket.IO for real-time updates
        try {
            io.emit('email:received', newEmail);
        } catch (e) {
            console.log('Socket broadcast warning:', e.message);
        }

        res.json({ success: true, email: newEmail });
    } catch (err) {
        console.error('email receive error', err);
        res.status(500).json({ success: false, error: err.message || 'internal_error' });
    }
});

// Helper function to sync Gmail emails to database
async function syncGmailEmails(broadcast = true) {
    try {
        if (!prisma) {
            console.warn('⚠️ Prisma client not ready yet, skipping email sync');
            return { success: false, synced: 0, error: 'Prisma client not initialized' };
        }

        console.log('🔄 Starting Gmail email sync...');
        const result = await fetchGmailEmails(100);  // Fetch up to 100 emails per sync
        console.log('Gmail sync result:', result);

        if (!result.success) {
            console.error('❌ Gmail sync failed:', result.error);
            return { success: false, synced: 0, error: result.error };
        }

        if (!Array.isArray(result.emails)) {
            console.log('⚠️ No emails in result');
            return { success: true, synced: 0 };
        }

        console.log(`📧 Found ${result.emails.length} emails from Gmail`);

        let syncCount = 0;
        for (const gmailEmail of result.emails) {
            // Check if email already exists in database
            const exists = await prisma.email.findFirst({
                where: {
                    fromEmail: gmailEmail.fromEmail,
                    subject: gmailEmail.subject
                }
            });

            if (!exists) {
                const newEmail = await prisma.email.create({
                    data: {
                        from: gmailEmail.from,
                        fromEmail: gmailEmail.fromEmail,
                        to: gmailEmail.to || 'cyberincognito16@gmail.com',
                        subject: gmailEmail.subject,
                        body: gmailEmail.body,
                        preview: gmailEmail.preview || gmailEmail.body.slice(0, 100),
                        date: gmailEmail.date ? new Date(gmailEmail.date) : new Date(),
                        isRead: false
                    }
                });
                syncCount++;

                if (broadcast) {
                    try {
                        io.emit('email:received', newEmail);
                    } catch (e) {
                        console.log('Socket broadcast warning:', e.message);
                    }
                }
            }
        }

        if (syncCount > 0) {
            console.log(`✅ Synced ${syncCount} new emails from Gmail`);
        }
        return { success: true, synced: syncCount };
    } catch (err) {
        console.error('Gmail sync error:', err.message);
        return { success: false, synced: 0, error: err.message };
    }
}

// Manual Gmail sync endpoint
app.post('/api/email/sync', async (req, res) => {
    try {
        console.log('Starting email sync from Gmail (manual)...');
        const result = await syncGmailEmails(true);

        if (!result.success) {
            return res.status(500).json({ success: false, error: result.error });
        }

        // Get updated email list from database
        const emails = await prisma.email.findMany({
            orderBy: { created_at: 'desc' },
            take: 100
        });

        res.json({ success: true, synced: result.synced, total: emails.length, emails });
    } catch (err) {
        console.error('email sync error', err);
        res.status(500).json({ success: false, error: err.message || 'internal_error' });
    }
});

// Get emails with filter
app.get('/api/email/filter/:filter', async (req, res) => {
    try {
        const { filter } = req.params;
        let whereClause = {};

        switch (filter.toLowerCase()) {
            case 'unread':
                whereClause = { isRead: false };
                break;
            case 'important':
                whereClause = { isImportant: true };
                break;
            case 'archived':
                whereClause = { isArchived: true };
                break;
            case 'spam':
                whereClause = { isSpam: true };
                break;
            default:
                whereClause = {};
        }

        const emails = await prisma.email.findMany({
            where: whereClause,
            orderBy: { created_at: 'desc' },
            take: 100
        });

        res.json({ success: true, emails });
    } catch (err) {
        console.error('Email filter error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Mark email as read
app.post('/api/email/:id/read', express.json(), async (req, res) => {
    try {
        const { id } = req.params;
        const email = await prisma.email.update({
            where: { id: parseInt(id) },
            data: { isRead: true }
        });
        res.json({ success: true, email });
    } catch (err) {
        console.error('Failed to mark email as read:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Mark email as important
app.post('/api/email/:id/important', express.json(), async (req, res) => {
    try {
        const { id } = req.params;
        const { isImportant } = req.body;
        const email = await prisma.email.update({
            where: { id: parseInt(id) },
            data: { isImportant: isImportant !== false }
        });
        res.json({ success: true, email });
    } catch (err) {
        console.error('Failed to toggle important:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Mark email as archived
app.post('/api/email/:id/archive', express.json(), async (req, res) => {
    try {
        const { id } = req.params;
        const { isArchived } = req.body;
        const email = await prisma.email.update({
            where: { id: parseInt(id) },
            data: { isArchived: isArchived !== false }
        });
        res.json({ success: true, email });
    } catch (err) {
        console.error('Failed to archive email:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Mark email as spam
app.post('/api/email/:id/spam', express.json(), async (req, res) => {
    try {
        const { id } = req.params;
        const { isSpam } = req.body;
        const email = await prisma.email.update({
            where: { id: parseInt(id) },
            data: { isSpam: isSpam !== false }
        });
        res.json({ success: true, email });
    } catch (err) {
        console.error('Failed to mark as spam:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Delete email
app.delete('/api/email/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.email.delete({
            where: { id: parseInt(id) }
        });
        res.json({ success: true, message: 'Email deleted' });
    } catch (err) {
        console.error('Failed to delete email:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Create user settings, messages, instagram_conversations, replies, receipts, tickets (Postgres or MySQL)
if (isPg) {
    db.query(`
        CREATE TABLE IF NOT EXISTS settings (
            id SERIAL PRIMARY KEY,
            user_id INTEGER UNIQUE,
            displayName VARCHAR(255),
            email VARCHAR(255),
            password VARCHAR(255),
            autoReply VARCHAR(255),
            chatEnabled VARCHAR(10),
            msgAlert BOOLEAN,
            ticketAlert BOOLEAN,
            soundAlert BOOLEAN,
            priority VARCHAR(20),
            autoAssign VARCHAR(10),
            theme VARCHAR(20),
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `, (err) => { if (err) console.log('Error creating settings table (pg):', err); });

    db.query(`
        CREATE TABLE IF NOT EXISTS messages (
            id SERIAL PRIMARY KEY,
            conversation_id INTEGER,
            sender VARCHAR(50),
            message TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (conversation_id) REFERENCES conversations(id)
        );
    `, (err) => { if (err) console.log('Error creating messages table (pg):', err); });

    

    db.query(`
        CREATE TABLE IF NOT EXISTS replies (
            id SERIAL PRIMARY KEY,
            conversation_id INTEGER,
            sender VARCHAR(50),
            message TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (conversation_id) REFERENCES conversations(id)
        );
    `, (err) => { if (err) console.log('Error creating replies table (pg):', err); });

    db.query("ALTER TABLE replies ADD COLUMN IF NOT EXISTS user_id INTEGER", (err) => { if (err) console.log('Error adding user_id to replies (pg):', err); });

    db.query(`
        CREATE TABLE IF NOT EXISTS receipts (
            id SERIAL PRIMARY KEY,
            content TEXT,
            escalated BOOLEAN DEFAULT false,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `, (err) => { if (err) console.log('Error creating receipts table (pg):', err); });

    db.query(`
        CREATE TABLE IF NOT EXISTS tickets (
            id SERIAL PRIMARY KEY,
            content TEXT,
            escalated BOOLEAN DEFAULT false,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `, (err) => { if (err) console.log('Error creating tickets table (pg):', err); });

    db.query("ALTER TABLE tickets ADD COLUMN IF NOT EXISTS ticket_type VARCHAR(255)", (err) => {});
    db.query("ALTER TABLE tickets ADD COLUMN IF NOT EXISTS subject VARCHAR(255)", (err) => {});
    db.query("ALTER TABLE tickets ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255)", (err) => {});
    db.query("ALTER TABLE tickets ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(255)", (err) => {});
    db.query("ALTER TABLE tickets ADD COLUMN IF NOT EXISTS assignee VARCHAR(255)", (err) => {});
    db.query("ALTER TABLE tickets ADD COLUMN IF NOT EXISTS priority VARCHAR(20)", (err) => {});
    db.query("ALTER TABLE tickets ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'Open'", (err) => {});
    db.query("ALTER TABLE tickets ADD COLUMN IF NOT EXISTS tags TEXT", (err) => {});
    db.query("ALTER TABLE tickets ADD COLUMN IF NOT EXISTS attachments TEXT", (err) => {});
    db.query("ALTER TABLE tickets ADD COLUMN IF NOT EXISTS sla_due TIMESTAMP", (err) => {});
} else {
    // keep MySQL originals
    db.query(`
        CREATE TABLE IF NOT EXISTS settings (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT UNIQUE,
            displayName VARCHAR(255),
            email VARCHAR(255),
            password VARCHAR(255),
            autoReply VARCHAR(255),
            chatEnabled VARCHAR(10),
            msgAlert TINYINT(1),
            ticketAlert TINYINT(1),
            soundAlert TINYINT(1),
            priority VARCHAR(20),
            autoAssign VARCHAR(10),
            theme VARCHAR(20),
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `, (err) => { if (err) console.log('Error creating settings table:', err); });

    db.query(`
        CREATE TABLE IF NOT EXISTS messages (
            id INT AUTO_INCREMENT PRIMARY KEY,
            conversation_id INT,
            sender VARCHAR(50),
            message TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (conversation_id) REFERENCES conversations(id)
        )
    `, (err) => { if (err) console.log('Error creating messages table:', err); });

    

    db.query(`
        CREATE TABLE IF NOT EXISTS replies (
            id INT AUTO_INCREMENT PRIMARY KEY,
            conversation_id INT,
            sender VARCHAR(50),
            message TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (conversation_id) REFERENCES conversations(id)
        )
    `, (err) => { if (err) console.log('Error creating replies table:', err); });

    db.query("ALTER TABLE replies ADD COLUMN IF NOT EXISTS user_id INT NULL", (err) => { if (err && err.errno !== 1060) console.log('Error adding user_id to replies:', err); });

    db.query(`
        CREATE TABLE IF NOT EXISTS receipts (
            id INT AUTO_INCREMENT PRIMARY KEY,
            content TEXT,
            escalated TINYINT(1) DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `, (err) => { if (err) console.log('Error creating receipts table:', err); });

    db.query(`
        CREATE TABLE IF NOT EXISTS tickets (
            id INT AUTO_INCREMENT PRIMARY KEY,
            content TEXT,
            escalated TINYINT(1) DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `, (err) => { if (err) console.log('Error creating tickets table:', err); });

    db.query("ALTER TABLE tickets ADD COLUMN IF NOT EXISTS ticket_type VARCHAR(255)", (err) => { if (err && err.errno !== 1060) console.log('Error adding ticket_type to tickets:', err); });
    db.query("ALTER TABLE tickets ADD COLUMN IF NOT EXISTS subject VARCHAR(255)", (err) => { if (err && err.errno !== 1060) console.log('Error adding subject to tickets:', err); });
    db.query("ALTER TABLE tickets ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255)", (err) => { if (err && err.errno !== 1060) console.log('Error adding customer_name to tickets:', err); });
    db.query("ALTER TABLE tickets ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(255)", (err) => { if (err && err.errno !== 1060) console.log('Error adding customer_phone to tickets:', err); });
    db.query("ALTER TABLE tickets ADD COLUMN IF NOT EXISTS assignee VARCHAR(255)", (err) => { if (err && err.errno !== 1060) console.log('Error adding assignee to tickets:', err); });
    db.query("ALTER TABLE tickets ADD COLUMN IF NOT EXISTS priority VARCHAR(20)", (err) => { if (err && err.errno !== 1060) console.log('Error adding priority to tickets:', err); });
    db.query("ALTER TABLE tickets ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'Open'", (err) => { if (err && err.errno !== 1060) console.log('Error adding status to tickets:', err); });
    db.query("ALTER TABLE tickets ADD COLUMN IF NOT EXISTS tags TEXT", (err) => { if (err && err.errno !== 1060) console.log('Error adding tags to tickets:', err); });
    db.query("ALTER TABLE tickets ADD COLUMN IF NOT EXISTS attachments TEXT", (err) => { if (err && err.errno !== 1060) console.log('Error adding attachments to tickets:', err); });
    db.query("ALTER TABLE tickets ADD COLUMN IF NOT EXISTS sla_due TIMESTAMP", (err) => { if (err && err.errno !== 1060) console.log('Error adding sla_due to tickets:', err); });
}


// ---------------------------
// Middleware
// ---------------------------
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(session({
    secret: "livesupportsecret",
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 24 * 60 * 60 * 1000 } // Default 24 hours
}));

// Update lastActivity timestamp for authenticated sessions on each request
app.use((req, res, next) => {
    try {
        if (req.session && req.session.user) {
            req.session.lastActivity = new Date().toISOString();
        }
    } catch (e) {}
    next();
});

// Middleware to protect HTML pages
app.use((req, res, next) => {
    if (req.path.endsWith('.html') && req.path !== '/login.html') {
        // Allow public password reset pages without authentication
        if (req.path === '/forgot-password.html' || 
            req.path === '/check-email.html' || 
            req.path === '/reset-password.html') {
            return next();
        }
        if (!req.session || !req.session.user) {
            return res.redirect('/login.html');
        }
    }
    next();
});

// Protect admin assets/pages before static middleware: require login only
app.use((req, res, next) => {
    if (req.path === '/admin-users.html' || req.path.startsWith('/js/admin-users')) {
        if (!req.session || !req.session.user) return res.redirect('/loginx.html');
    }
    next();
});

// Serve favicon explicitly to avoid caching/path issues
app.get('/favicon.svg', (req, res) => {
    res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    res.sendFile(path.join(__dirname, 'public', 'favicon.png'));
});
app.get('/favicon.ico', (req, res) => {
    res.redirect('/favicon.png');
});
app.get('/favicon-icon.svg', (req, res) => {
    res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    res.sendFile(path.join(__dirname, 'public', 'favicon.png'));
});
app.get('/favicon.png', (req, res) => {
    res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    res.sendFile(path.join(__dirname, 'public', 'favicon.png'));
});

// Mount auth routes for password reset
app.use('/api/auth', createAuthRouter(prisma));

// Monthly messages counts (AI vs Staff)
app.get('/api/messages/monthly', async (req, res) => {
    try {
        const year = Number(req.query.year || new Date().getFullYear());

        const aiRows = await prisma.$queryRaw`
            SELECT EXTRACT(MONTH FROM created_at) AS month, COUNT(*)::int AS count
            FROM ai_messages
            WHERE EXTRACT(YEAR FROM created_at) = ${year}
            GROUP BY month
            ORDER BY month
        `;

        const staffRows = await prisma.$queryRaw`
            SELECT EXTRACT(MONTH FROM created_at) AS month, COUNT(*)::int AS count
            FROM staff_messages
            WHERE EXTRACT(YEAR FROM created_at) = ${year}
            GROUP BY month
            ORDER BY month
        `;

        const labels = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        const ai = new Array(12).fill(0);
        const staff = new Array(12).fill(0);

        for (const r of aiRows) {
            const m = Number(r.month);
            if (m >=1 && m <=12) ai[m-1] = Number(r.count || 0);
        }
        for (const r of staffRows) {
            const m = Number(r.month);
            if (m >=1 && m <=12) staff[m-1] = Number(r.count || 0);
        }

        res.json({ labels, ai, staff, year });
    } catch (err) {
        console.error('Failed to fetch monthly messages', err?.message || err);
        res.status(500).json({ error: err?.message || String(err) });
    }
});

const reactDistPath = path.join(__dirname, 'dist');
const reactIndexFile = path.join(reactDistPath, 'index.html');

// Serve React build if the dist folder is present.
// This ensures the app can load the built React entrypoint and assets even when NODE_ENV is not explicitly set.
if (fs.existsSync(reactDistPath) && fs.existsSync(reactIndexFile)) {
    app.use(express.static(reactDistPath));
    app.use('/assets', express.static(path.join(reactDistPath, 'assets')));
}

// Redirect the legacy static tracking page to the React tracking route.
app.get('/tracking.html', (req, res) => {
    return res.redirect('/tracking');
});

app.use(express.static(path.join(__dirname, 'public')));
app.use('/vendor', express.static(path.join(__dirname, 'node_modules')));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve top-level image folder so design assets can be referenced directly
if (fs.existsSync(path.join(__dirname, 'image'))) {
    app.use('/image', express.static(path.join(__dirname, 'image')));
}

if (!fs.existsSync(path.join(__dirname, "uploads"))) {
    fs.mkdirSync(path.join(__dirname, "uploads"), { recursive: true });
}

function isAuthenticated(req, res, next) {
    if (req.session && req.session.user) {
        return next();
    }
    // If the client expects JSON (AJAX/fetch) or it's an API request, return 401 JSON
    const accept = req.headers && req.headers.accept ? String(req.headers.accept) : '';
    const isAjax = req.xhr || (req.headers['x-requested-with'] === 'XMLHttpRequest');
    if (isAjax || accept.indexOf('application/json') !== -1 || (req.path && req.path.startsWith('/api'))) {
        return res.status(401).json({ error: 'not_logged_in' });
    }
    // Otherwise redirect to login page for normal browser navigation
    return res.redirect('/login.html');
}

// Enforce read-only for users with role 'viewer' on API endpoints
app.use((req, res, next) => {
    try {
        const role = req.session && req.session.user && req.session.user.role ? String(req.session.user.role).toLowerCase() : null;
        // Only enforce for logged-in viewers
        if (role === 'viewer') {
            // Allow navigation (GET/HEAD) everywhere, but block non-GET API actions
            if (req.path.startsWith('/api') && req.method !== 'GET' && req.method !== 'HEAD') {
                return res.status(403).json({ error: 'read_only_viewer' });
            }
            // Prevent debug emit helper for viewers
            if (req.path.startsWith('/debug') && req.method !== 'GET') {
                return res.status(403).json({ error: 'read_only_viewer' });
            }
        }
    } catch (e) {
        console.error('Viewer middleware error', e);
    }
    next();
});

// ---------------------------
// Auth Routes
// ---------------------------
app.get("/", isAuthenticated, (req, res) => {
    if (fs.existsSync(reactIndexFile)) {
        return res.sendFile(reactIndexFile);
    }
    return res.sendFile(path.join(__dirname, "public", "login.html"));
});

app.get("/login", (req, res) => {
    if (fs.existsSync(reactIndexFile)) {
        return res.sendFile(reactIndexFile);
    }
    return res.sendFile(path.join(__dirname, "public", "login.html"));
});

app.get("/login.html", (req, res) => {
    if (fs.existsSync(reactIndexFile)) {
        return res.sendFile(reactIndexFile);
    }
    return res.sendFile(path.join(__dirname, "public", "login.html"));
});

app.post("/login", (req, res) => {
    console.log("Full req.body:", JSON.stringify(req.body, null, 2));
    const { email, password, remember } = req.body;
    console.log("Login attempt:", email, password);
    console.log("Email type:", typeof email, "Password type:", typeof password);
    console.log("Remember me:", remember);
    const sql = "SELECT * FROM users WHERE email = ? AND password = ?";
    // Use pool.query which handles connection acquisition/release internally
    db.query(sql, [email, password], (err, result) => {
        console.log("DB result:", result);
        if (err) {
            console.error('Login DB error:', err);
            return res.status(500).send('Internal Server Error');
        }
        if (result && result.length > 0) {
            // Normalize role to lowercase to avoid case-sensitivity issues (e.g., 'Admin' vs 'admin')
            try { result[0].role = (result[0].role || '').toString().toLowerCase(); } catch(e) {}
            req.session.user = result[0];
                // record login time for session info
                try { req.session.loginTime = new Date().toISOString(); } catch (e) {}
                req.session.userId = result[0].id;
                // If "remember me" is checked, extend session to 72 hours
                if (remember === 'on' || remember === true) {
                    const seventyTwoHours = 72 * 60 * 60 * 1000;
                    req.session.cookie.maxAge = seventyTwoHours;
                    console.log('Remember me enabled: session extended to 72 hours');
                }
                // Track this session id for the logged-in user to allow force-logout
                try {
                    const sid = req.sessionID;
                    const uid = String(result[0].id);
                    const set = userSessions.get(uid) || new Set();
                    set.add(sid);
                    userSessions.set(uid, set);
                    try { io.emit('admin:users:changed', { action: 'login', id: uid }); } catch (e) { console.error('Emit admin users changed error', e); }
                } catch (e) {
                    console.error('Failed to track user session', e);
                }
            // Redirect to dashboard and indicate a fresh login so client can show welcome animation
            res.redirect("/dashboard?welcome=1");
        } else {
            res.redirect("/login?error=invalid");
        }
    });
});

// Initiate Google OAuth login flow
app.get('/auth/google', (req, res) => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${process.env.APP_URL || 'http://localhost:3000'}/auth/google/callback`;
    
    if (!clientId) {
        return res.status(500).send('Google OAuth is not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_REDIRECT_URI in .env');
    }
    
    const scope = 'openid email profile';
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${encodeURIComponent(clientId)}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `response_type=code&` +
        `scope=${encodeURIComponent(scope)}`;
    
    res.redirect(authUrl);
});

// Handle Google OAuth callback
app.get('/auth/google/callback', async (req, res) => {
    const { code, error } = req.query;
    
    if (error) {
        return res.redirect(`/login?error=google_${error}`);
    }
    
    if (!code) {
        return res.redirect('/login?error=google_no_code');
    }
    
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${process.env.APP_URL || 'http://localhost:3000'}/auth/google/callback`;
    
    if (!clientId || !clientSecret) {
        return res.status(500).send('Google OAuth credentials not configured');
    }

    try {
        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                code,
                client_id: clientId,
                client_secret: clientSecret,
                redirect_uri: redirectUri,
                grant_type: 'authorization_code'
            }).toString()
        });

        const tokenData = await tokenRes.json();
        if (!tokenRes.ok || !tokenData || !tokenData.access_token) {
            console.error('Google token exchange failed', tokenData);
            return res.redirect('/login?error=google_token_failed');
        }

        // Fetch userinfo
        const uiRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${tokenData.access_token}` }
        });
        const userInfo = await uiRes.json();
        if (!userInfo || !userInfo.email) {
            console.error('Failed to fetch Google userinfo', userInfo);
            return res.redirect('/login?error=google_userinfo_failed');
        }

        // Find or create user in local DB
        db.query('SELECT * FROM users WHERE email = ?', [userInfo.email], (err, rows) => {
            if (err) {
                console.error('DB lookup error during Google auth', err);
                return res.redirect('/login?error=google_db_error');
            }

            const finishLogin = (user) => {
                try {
                    req.session.user = user;
                    req.session.loginTime = new Date().toISOString();
                    req.session.userId = user.id;
                    const sid = req.sessionID;
                    const uid = String(user.id);
                    const set = userSessions.get(uid) || new Set();
                    set.add(sid);
                    userSessions.set(uid, set);
                    try { io.emit('admin:users:changed', { action: 'login', id: uid }); } catch (e) { console.error('Emit admin users changed error', e); }
                } catch (e) { console.error('Failed to finalize session for Google user', e); }
                return res.redirect('/dashboard?welcome=1');
            };

            if (rows && rows.length > 0) {
                return finishLogin(rows[0]);
            }

            // Create new user with role 'agent'
            const name = userInfo.name || (userInfo.email || '').split('@')[0];
            const email = userInfo.email;
            const pw = Math.random().toString(36).slice(-12);
            const sql = 'INSERT INTO users (name, email, password, role, disabled) VALUES (?, ?, ?, ?, 0)';
            db.query(sql, [name, email, pw, 'agent'], (insertErr, result) => {
                if (insertErr) {
                    console.error('Error creating new Google user', insertErr);
                    return res.redirect('/login?error=google_create_failed');
                }
                
                const newUser = { id: result.insertId, email, name, role: 'agent' };
                return finishLogin(newUser);
            });
        });
    } catch (err) {
        console.error('Google OAuth error:', err);
        res.redirect('/login?error=google_exception');
    }
});

// Exchange Google authorization code for tokens, fetch userinfo, create/find user and establish session
app.post('/auth/google', async (req, res) => {
    const { code } = req.body || {};
    if (!code) return res.status(400).json({ error: 'missing_code' });

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) return res.status(500).json({ error: 'google_client_not_configured' });

    try {
        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                code,
                client_id: clientId,
                client_secret: clientSecret,
                redirect_uri: 'postmessage',
                grant_type: 'authorization_code'
            }).toString()
        });

        const tokenData = await tokenRes.json();
        if (!tokenRes.ok || !tokenData || !tokenData.access_token) {
            console.error('Google token exchange failed', tokenData);
            return res.status(500).json({ error: 'token_exchange_failed', details: tokenData });
        }

        // Fetch userinfo
        const uiRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${tokenData.access_token}` }
        });
        const userInfo = await uiRes.json();
        if (!userInfo || !userInfo.email) {
            console.error('Failed to fetch Google userinfo', userInfo);
            return res.status(500).json({ error: 'failed_fetch_userinfo', details: userInfo });
        }

        // Find or create user in local DB
        db.query('SELECT * FROM users WHERE email = ?', [userInfo.email], (err, rows) => {
            if (err) {
                console.error('DB lookup error during Google auth', err);
                return res.status(500).json({ error: 'db_error' });
            }

            const finishLogin = (user) => {
                try {
                    req.session.user = user;
                    // record login time for session info
                    try { req.session.loginTime = new Date().toISOString(); } catch (e) {}
                    req.session.userId = user.id;
                    const sid = req.sessionID;
                    const uid = String(user.id);
                    const set = userSessions.get(uid) || new Set();
                    set.add(sid);
                    userSessions.set(uid, set);
                    try { io.emit('admin:users:changed', { action: 'login', id: uid }); } catch (e) { console.error('Emit admin users changed error', e); }
                } catch (e) { console.error('Failed to finalize session for Google user', e); }
                // Tell client to redirect to dashboard with welcome flag for animation
                return res.json({ success: true, redirect: '/dashboard?welcome=1' });
            };

            if (rows && rows.length > 0) {
                return finishLogin(rows[0]);
            }

            // Create new user with role 'agent' (change as needed)
            const name = userInfo.name || (userInfo.email || '').split('@')[0];
            const email = userInfo.email;
            const pw = Math.random().toString(36).slice(-12);
            const sql = isPg
                ? 'INSERT INTO users (name, email, password, role, disabled) VALUES (?, ?, ?, ?, 0) RETURNING id'
                : 'INSERT INTO users (name, email, password, role, disabled) VALUES (?, ?, ?, ?, 0)';
            db.query(sql, [name, email, pw, 'agent'], (insertErr, result) => {
                if (insertErr) {
                    console.error('Failed to create user from Google info', insertErr);
                    return res.status(500).json({ error: 'db_insert_failed', details: insertErr.message });
                }
                const newId = result.insertId;
                db.query('SELECT * FROM users WHERE id = ?', [newId], (err2, newRows) => {
                    if (err2 || !newRows || newRows.length === 0) {
                        console.error('Failed to fetch newly created Google user', err2);
                        return res.status(500).json({ error: 'db_fetch_failed' });
                    }
                    return finishLogin(newRows[0]);
                });
            });
        });

    } catch (e) {
        console.error('Unhandled error in /auth/google', e);
        return res.status(500).json({ error: 'internal', message: e.message });
    }
});

// Return public auth config (safe to expose client id)
app.get('/auth/config', (req, res) => {
    const id = process.env.GOOGLE_CLIENT_ID || null;
    if (!id) {
        console.warn('GET /auth/config - GOOGLE_CLIENT_ID not set');
        return res.status(500).json({ error: 'google_client_not_configured' });
    }
    console.log('GET /auth/config - returning google client id present');
    res.json({ googleClientId: id });
});

const reactRoutes = [
    '/dashboard',
    '/tickets',
    '/analytics',
    '/orders',
    '/inbox',
    '/knowledge',
    '/tracking',
    '/settings',
    '/admin-users'
];

reactRoutes.forEach((route) => {
    app.get(route, isAuthenticated, (req, res) => {
        if (fs.existsSync(reactIndexFile)) {
            return res.sendFile(reactIndexFile);
        }
        return res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
    });
});

app.use((req, res, next) => {
    const pathname = req.path || '/';
    if (
        pathname.startsWith('/api') ||
        pathname.startsWith('/auth') ||
        pathname.startsWith('/uploads') ||
        pathname.startsWith('/vendor') ||
        pathname.startsWith('/image') ||
        pathname === '/login' ||
        pathname === '/login.html' ||
        pathname.startsWith('/webhook') ||
        pathname.includes('.')
    ) {
        return next();
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
        return next();
    }

    if (req.session && req.session.user) {
        if (fs.existsSync(reactIndexFile)) {
            return res.sendFile(reactIndexFile);
        }
        return res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
    }

    return isAuthenticated(req, res, next);
});

// Menu page removed

// Expose menu to frontend
app.get('/api/menu', (req, res) => {
    try {
        // Prefer DB-backed menu if available
        db.query('SELECT id, category, key_name, name, price, available, image_url FROM Menu', (err, results) => {
            if (err) {
                console.error('GET /api/menu db error, falling back to in-memory MENU_ITEMS', err);
                return res.json(MENU_ITEMS || {});
            }
            if (!results || results.length === 0) return res.json(MENU_ITEMS || {});
            const out = {};
            for (const row of results) {
                const cat = row.category || 'other';
                out[cat] = out[cat] || {};
                out[cat][row.key_name] = { name: row.name, price: parseFloat(row.price), available: row.available, image_url: row.image_url };
            }
            res.json(out);
        });
    } catch (e) {
        console.error('GET /api/menu error', e);
        res.status(500).json({ error: 'internal' });
    }
});

// Return AI vs Staff message counts for the last 7 days (oldest -> newest)
app.get('/api/messages-last7', (req, res) => {
    try {
        const sql = isPg ? `
            SELECT DATE(created_at) AS dt,
                SUM(CASE WHEN LOWER(sender) ~ 'ai|bot|assistant' THEN 1 ELSE 0 END) AS ai_count,
                SUM(CASE WHEN (user_id IS NOT NULL OR LOWER(sender) ~ 'agent|staff|sent|sent_by_agent') THEN 1 ELSE 0 END) AS staff_count
            FROM (
                SELECT sender, created_at, NULL AS user_id FROM messages
                UNION ALL
                SELECT sender, created_at, user_id FROM ai_messages
                UNION ALL
                SELECT sender, created_at, user_id FROM staff_messages
            ) AS all_msgs
            WHERE DATE(created_at) BETWEEN CURRENT_DATE - INTERVAL '6 days' AND CURRENT_DATE
            GROUP BY DATE(created_at)
            ORDER BY DATE(created_at)
        ` : `
            SELECT DATE(created_at) AS dt,
                SUM(CASE WHEN LOWER(sender) REGEXP 'ai|bot|assistant' THEN 1 ELSE 0 END) AS ai_count,
                SUM(CASE WHEN (user_id IS NOT NULL OR LOWER(sender) REGEXP 'agent|staff|sent|sent_by_agent') THEN 1 ELSE 0 END) AS staff_count
            FROM (
                SELECT sender, created_at, NULL AS user_id FROM messages
                UNION ALL
                SELECT sender, created_at, user_id FROM ai_messages
                UNION ALL
                SELECT sender, created_at, user_id FROM staff_messages
            ) AS all_msgs
            WHERE DATE(created_at) BETWEEN DATE_SUB(CURDATE(), INTERVAL 6 DAY) AND CURDATE()
            GROUP BY DATE(created_at)
            ORDER BY DATE(created_at)
        `;

        db.query(sql, (err, rows) => {
            if (err) {
                console.error('/api/messages-last7 db error', err);
                return res.status(500).json({ error: 'DB error' });
            }

            // Build full 7-day array (oldest -> newest)
            const outAi = [];
            const outStaff = [];
            const labels = [];
            const map = {};
            (rows || []).forEach(r => { map[String(r.dt)] = r; });

            for (let i = 6; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                const key = d.toISOString().slice(0,10);
                labels.push((7 - i) + 'd');
                const row = map[key];
                outAi.push(row ? Number(row.ai_count || 0) : 0);
                outStaff.push(row ? Number(row.staff_count || 0) : 0);
            }

            res.json({ labels: labels, ai: outAi, staff: outStaff });
        });
    } catch (e) {
        console.error('GET /api/messages-last7 error', e);
        res.status(500).json({ error: 'internal' });
    }
});

async function ensureDefaultRestaurantTables() {
    return new Promise((resolve) => {
        db.query('SELECT number FROM restaurant_tables', (err, rows) => {
            if (err) {
                console.warn('restaurant_tables check failed, using fallback data:', err.message || err);
                return resolve();
            }

            const existingNumbers = new Set((rows || [])
                .map((row) => Number(row.number))
                .filter((value) => Number.isFinite(value)));
            const missingNumbers = Array.from({ length: 25 }, (_, index) => index + 1)
                .filter((number) => !existingNumbers.has(number));

            if (missingNumbers.length === 0) return resolve();

            const inserts = [];
            const values = [];
            missingNumbers.forEach((number) => {
                inserts.push(`($${values.length + 1}, $${values.length + 2}, $${values.length + 3}, $${values.length + 4}, $${values.length + 5}, $${values.length + 6})`);
                values.push(number, `Table ${number}`, 'vacant', null, false, new Date().toISOString());
            });

            let sql;
            if (isPg) {
                sql = `INSERT INTO restaurant_tables (number, label, status, customer_name, is_booking, updated_at) VALUES ${inserts.join(', ')} ON CONFLICT (number) DO NOTHING`;
            } else {
                sql = `INSERT INTO restaurant_tables (number, label, status, customer_name, is_booking, updated_at) VALUES ${inserts.join(', ')} ON DUPLICATE KEY UPDATE number = number`;
            }
            db.query(sql, values, (insertErr) => {
                if (insertErr) {
                    console.warn('restaurant_tables seed failed, using fallback data:', insertErr.message || insertErr);
                }
                resolve();
            });
        });
    });
}

app.get('/api/tables', async (req, res) => {
    try {
        await ensureDefaultRestaurantTables();

        const fallbackTables = Array.from({ length: 25 }, (_, index) => ({
            id: index + 1,
            number: index + 1,
            label: `Table ${index + 1}`,
            status: 'vacant',
            customerName: undefined,
            reservedUntil: undefined,
            isBooking: false
        }));

        const updateReservedToOccupiedSql = `UPDATE restaurant_tables SET status = 'occupied', updated_at = NOW() WHERE status = 'reserved' AND reserved_until <= NOW()`;
        const updateExpiredOccupiedSql = `UPDATE restaurant_tables SET status = 'vacant', customer_name = NULL, reserved_until = NULL, is_booking = FALSE, updated_at = NOW() WHERE status = 'occupied' AND reserved_until <= NOW() AND is_booking = FALSE`;

        db.query(updateReservedToOccupiedSql, (updateErr) => {
            if (updateErr) console.warn('Failed to update expired reservations:', updateErr.message || updateErr);
            db.query(updateExpiredOccupiedSql, (expiredErr) => {
                if (expiredErr) console.warn('Failed to update expired occupied table states:', expiredErr.message || expiredErr);
                db.query('SELECT id, number, label, status, customer_name, reserved_until, is_booking FROM restaurant_tables ORDER BY number', (err, rows) => {
                    if (err) {
                        console.warn('GET /api/tables db error, returning fallback tables:', err.message || err);
                        return res.json(fallbackTables);
                    }
                    const tables = (rows || []).map(row => ({
                        id: row.id,
                        number: row.number,
                        label: row.label,
                        status: row.status,
                        customerName: row.customer_name || undefined,
                        reservedUntil: row.reserved_until ? new Date(row.reserved_until).toISOString() : undefined,
                        isBooking: !!row.is_booking
                    }));

                    const tableMap = new Map(tables.map((table) => [Number(table.number), table]));
                    const normalizedTables = Array.from({ length: 25 }, (_, index) => {
                        const number = index + 1;
                        const existingTable = tableMap.get(number);
                        if (existingTable) return existingTable;

                        return {
                            id: number,
                            number,
                            label: `Table ${number}`,
                            status: 'vacant',
                            customerName: undefined,
                            reservedUntil: undefined,
                            isBooking: false
                        };
                    });

                    res.json(normalizedTables);
                });
            });
        });
    } catch (e) {
        console.error('GET /api/tables error', e);
        res.json(Array.from({ length: 25 }, (_, index) => ({
            id: index + 1,
            number: index + 1,
            label: `Table ${index + 1}`,
            status: 'vacant'
        })));
    }
});

app.put('/api/tables/:number', express.json(), async (req, res) => {
    try {
        const number = Number(req.params.number);
        const { status, customerName, reservedUntil, isBooking } = req.body;
        const validStatuses = ['vacant', 'reserved', 'occupied', 'cleaning', 'maintenance', 'out_of_service'];
        if (!number || !status || !validStatuses.includes(status)) {
            return res.status(400).json({ error: 'invalid payload' });
        }

        const reservedUntilValue = reservedUntil ? new Date(reservedUntil) : null;
        if (reservedUntil && isNaN(reservedUntilValue.getTime())) {
            return res.status(400).json({ error: 'invalid reservedUntil value' });
        }

        await ensureDefaultRestaurantTables();
        db.query(
            'INSERT INTO restaurant_tables (number, label, status, customer_name, reserved_until, is_booking, updated_at) VALUES (?, ?, ?, ?, ?, ?, NOW()) ON CONFLICT (number) DO UPDATE SET status = EXCLUDED.status, customer_name = EXCLUDED.customer_name, reserved_until = EXCLUDED.reserved_until, is_booking = EXCLUDED.is_booking, updated_at = NOW()',
            [number, `Table ${number}`, status, customerName || null, reservedUntilValue ? reservedUntilValue.toISOString() : null, isBooking ? true : false],
            (err) => {
                if (err) {
                    console.warn('PUT /api/tables/:number db error, returning fallback response:', err.message || err);
                    return res.json({ number, status, customerName: customerName || undefined, reservedUntil: reservedUntilValue ? reservedUntilValue.toISOString() : undefined, isBooking: !!isBooking });
                }
                res.json({ number, status, customerName: customerName || undefined, reservedUntil: reservedUntilValue ? reservedUntilValue.toISOString() : undefined, isBooking: !!isBooking });
            }
        );
    } catch (e) {
        console.error('PUT /api/tables/:number error', e);
        res.status(500).json({ error: 'internal' });
    }
});

// Create menu table for menu persistence
if (isPg) {
    db.query(`
        CREATE TABLE IF NOT EXISTS Menu (
            id SERIAL PRIMARY KEY,
            category VARCHAR(100) NOT NULL,
            key_name VARCHAR(100) NOT NULL,
            name VARCHAR(255) NOT NULL,
            price DECIMAL(10,2) NOT NULL DEFAULT 0,
            available INT NOT NULL DEFAULT 0,
            image_url TEXT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `, (err) => {
        if (err) {
            console.error('Error creating Menu table (pg):', err);
            return;
        }

        db.query('CREATE UNIQUE INDEX IF NOT EXISTS uk_category_key ON Menu(category, key_name)', (ie) => {});
        db.query(`
            CREATE TABLE IF NOT EXISTS restaurant_tables (
                id SERIAL PRIMARY KEY,
                number INT UNIQUE NOT NULL,
                label VARCHAR(255) NOT NULL,
                status VARCHAR(50) NOT NULL DEFAULT 'vacant',
                customer_name VARCHAR(255),
                reserved_until TIMESTAMP,
                is_booking BOOLEAN NOT NULL DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
        `, (tableErr) => {
            if (tableErr) {
                console.error('Error creating restaurant_tables table (pg):', tableErr);
            } else {
                console.log('restaurant_tables table ready (pg)');
            }
        });
        db.query('SELECT COUNT(*) AS cnt FROM Menu', (cErr, rows) => {
            if (cErr) return console.error('Error counting Menu rows:', cErr);
            const cnt = rows && rows[0] ? rows[0].cnt : 0;
            if (cnt === 0) {
                const inserts = [];
                for (const [cat, items] of Object.entries(MENU_ITEMS || {})) {
                    for (const [key, it] of Object.entries(items)) {
                        inserts.push([cat, key, it.name || key, it.price || 0, it.available || 0, it.image_url || null]);
                    }
                }
                if (inserts.length > 0) {
                    const valuesClause = inserts.map((_, idx) => `($${idx*6+1}, $${idx*6+2}, $${idx*6+3}, $${idx*6+4}, $${idx*6+5}, $${idx*6+6})`).join(', ');
                    const flatParams = inserts.flat();
                    const upsertSql = `INSERT INTO Menu (category, key_name, name, price, available, image_url) VALUES ${valuesClause} ON CONFLICT (category, key_name) DO UPDATE SET name = EXCLUDED.name, price = EXCLUDED.price, available = EXCLUDED.available, image_url = EXCLUDED.image_url`;
                    db.query(upsertSql, flatParams, (insErr) => {
                        if (insErr) console.error('Error seeding Menu table:', insErr);
                        else console.log('Menu table seeded from MENU_ITEMS');
                    });
                }
            }
        });
    });
} else {
    db.query(`
        CREATE TABLE IF NOT EXISTS Menu (
            id INT AUTO_INCREMENT PRIMARY KEY,
            category VARCHAR(100) NOT NULL,
            key_name VARCHAR(100) NOT NULL,
            name VARCHAR(255) NOT NULL,
            price DECIMAL(10,2) NOT NULL DEFAULT 0,
            available INT NOT NULL DEFAULT 0,
            image_url TEXT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uk_category_key (category, key_name)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `, (err) => {
        if (err) {
            console.error('Error creating Menu table:', err);
            return;
        }

        db.query(`
            CREATE TABLE IF NOT EXISTS restaurant_tables (
                id INT AUTO_INCREMENT PRIMARY KEY,
                number INT NOT NULL UNIQUE,
                label VARCHAR(255) NOT NULL,
                status VARCHAR(50) NOT NULL DEFAULT 'vacant',
                customer_name VARCHAR(255),
                reserved_until DATETIME,
                is_booking TINYINT(1) NOT NULL DEFAULT 0,
                created_at DATETIME DEFAULT NOW(),
                updated_at DATETIME DEFAULT NOW() ON UPDATE NOW()
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `, (tableErr) => {
            if (tableErr) {
                console.error('Error creating restaurant_tables table:', tableErr);
            } else {
                console.log('restaurant_tables table ready');
            }
        });

        db.query('SELECT COUNT(*) AS cnt FROM Menu', (cErr, rows) => {
            if (cErr) return console.error('Error counting Menu rows:', cErr);
            const cnt = rows && rows[0] ? rows[0].cnt : 0;
            if (cnt === 0) {
                const inserts = [];
                for (const [cat, items] of Object.entries(MENU_ITEMS || {})) {
                    for (const [key, it] of Object.entries(items)) {
                        inserts.push([cat, key, it.name || key, it.price || 0, it.available || 0, it.image_url || null]);
                    }
                }
                if (inserts.length > 0) {
                    db.query('INSERT INTO Menu (category, key_name, name, price, available, image_url) VALUES ? ON DUPLICATE KEY UPDATE name=VALUES(name), price=VALUES(price), available=VALUES(available), image_url=VALUES(image_url)', [inserts], (insErr) => {
                        if (insErr) console.error('Error seeding Menu table:', insErr);
                        else console.log('Menu table seeded from MENU_ITEMS');
                    });
                }
            }
        });
    });
}

// Ensure Menu table has image_url column
db.query("ALTER TABLE Menu ADD COLUMN IF NOT EXISTS image_url TEXT NULL", (err) => {
    if (err && err.errno !== 1060) console.error('Error adding image_url to Menu:', err);
});

// Upload image endpoint for menu images
app.post('/api/menu/upload', upload.single('image'), (req, res) => {
    try {
        if (!req.session || !req.session.user) return res.status(401).json({ error: 'not_logged_in' });
        if (!req.file) return res.status(400).json({ error: 'no_file' });
        // Return a URL that can be used as background
        const fileUrl = `/uploads/${req.file.filename}`;
        res.json({ success: true, url: fileUrl });
    } catch (e) {
        console.error('/api/menu/upload error', e);
        res.status(500).json({ error: 'internal' });
    }
});

// Upsert or add menu item
app.post('/api/menu/item', express.json(), (req, res) => {
    try {
        if (!req.session || !req.session.user) return res.status(401).json({ error: 'not_logged_in' });
        const { category, key, name, price, available, sumWithExisting, image_url } = req.body || {};
        if (!category || !key || !name) return res.status(400).json({ error: 'missing_fields' });
        const p = parseFloat(price || 0);
        const avail = parseInt(available || 0, 10) || 0;

        db.query('SELECT id, available FROM Menu WHERE category = ? AND key_name = ? LIMIT 1', [category, key], (sErr, rows) => {
            if (sErr) return res.status(500).json({ error: 'db_error' });
            if (rows && rows.length > 0) {
                const existing = rows[0];
                const newAvailable = sumWithExisting ? (existing.available + avail) : avail;
                db.query('UPDATE Menu SET name = ?, price = ?, available = ?, image_url = ? WHERE id = ?', [name, p, newAvailable, image_url || null, existing.id], (uErr) => {
                    if (uErr) return res.status(500).json({ error: 'db_error' });
                    return res.json({ success: true });
                });
            } else {
                db.query('INSERT INTO Menu (category, key_name, name, price, available, image_url) VALUES (?, ?, ?, ?, ?, ?)', [category, key, name, p, avail, image_url || null], (iErr) => {
                    if (iErr) return res.status(500).json({ error: 'db_error' });
                    return res.json({ success: true });
                });
            }
        });
    } catch (e) {
        console.error('/api/menu/item error', e);
        res.status(500).json({ error: 'internal' });
    }
});

app.post('/api/menu/bulk', express.json(), (req, res) => {
    try {
        if (!req.session || !req.session.user) return res.status(401).json({ error: 'not_logged_in' });
        const items = Array.isArray(req.body.items) ? req.body.items : [];
        if (!items.length) return res.status(400).json({ error: 'missing_items' });

        const normalized = items.map(item => {
            const name = typeof item.name === 'string' && item.name.trim() ? item.name.trim() : '';
            const key = typeof item.key === 'string' && item.key.trim() ? item.key.trim() : name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
            return {
                category: item.category || 'Uncategorized',
                key: key || 'item-' + Math.random().toString(36).slice(2, 10),
                name: name || key || 'Unnamed Item',
                price: parseFloat(item.price || 0) || 0,
                available: parseInt(item.available || 0, 10) || 0,
                image_url: item.image_url || null
            };
        }).filter(item => item.category && item.key && item.name);

        if (!normalized.length) return res.status(400).json({ error: 'invalid_items' });

        if (isPg) {
            const values = [];
            const rows = normalized.map((item, idx) => {
                const base = idx * 6;
                values.push(item.category, item.key, item.name, item.price, item.available, item.image_url);
                return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6})`;
            });
            const sql = `INSERT INTO Menu (category, key_name, name, price, available, image_url) VALUES ${rows.join(', ')} ON CONFLICT (category, key_name) DO UPDATE SET name = EXCLUDED.name, price = EXCLUDED.price, available = EXCLUDED.available, image_url = EXCLUDED.image_url`;
            db.query(sql, values, (err) => {
                if (err) {
                    console.error('/api/menu/bulk db error', err);
                    return res.status(500).json({ error: 'db_error' });
                }
                res.json({ success: true });
            });
        } else {
            const values = [];
            const rows = normalized.map(() => '(?, ?, ?, ?, ?, ?)');
            normalized.forEach(item => {
                values.push(item.category, item.key, item.name, item.price, item.available, item.image_url);
            });
            const sql = `INSERT INTO Menu (category, key_name, name, price, available, image_url) VALUES ${rows.join(', ')} ON DUPLICATE KEY UPDATE name=VALUES(name), price=VALUES(price), available=VALUES(available), image_url=VALUES(image_url)`;
            db.query(sql, values, (err) => {
                if (err) {
                    console.error('/api/menu/bulk db error', err);
                    return res.status(500).json({ error: 'db_error' });
                }
                res.json({ success: true });
            });
        }
    } catch (e) {
        console.error('/api/menu/bulk error', e);
        res.status(500).json({ error: 'internal' });
    }
});

app.delete('/api/menu/item/:category/:key', (req, res) => {
    try {
        if (!req.session || !req.session.user) return res.status(401).json({ error: 'not_logged_in' });
        const category = req.params.category || 'other';
        const key = req.params.key;
        if (!key) return res.status(400).json({ error: 'missing_key' });
        db.query('DELETE FROM Menu WHERE category = ? AND key_name = ?', [category, key], (err) => {
            if (err) {
                console.error('/api/menu/item delete db error', err);
                return res.status(500).json({ error: 'db_error' });
            }
            res.json({ success: true });
        });
    } catch (e) {
        console.error('/api/menu/item delete error', e);
        res.status(500).json({ error: 'internal' });
    }
});

// Reduce stock for a menu item
app.post('/api/menu/item/reduce-stock', express.json(), (req, res) => {
    try {
        const { itemId, category, key, quantity } = req.body || {};
        if (!itemId && (!category || !key)) return res.status(400).json({ error: 'missing_fields' });
        
        const qty = Math.max(1, parseInt(quantity || 1, 10));
        
        let query, params;
        if (itemId) {
            query = 'UPDATE Menu SET available = GREATEST(available - ?, 0) WHERE id = ?';
            params = [qty, itemId];
        } else {
            query = 'UPDATE Menu SET available = GREATEST(available - ?, 0) WHERE category = ? AND key_name = ?';
            params = [qty, category, key];
        }
        
        db.query(query, params, (err) => {
            if (err) {
                console.error('/api/menu/item/reduce-stock db error', err);
                return res.status(500).json({ error: 'db_error' });
            }
            // Fetch updated item to return current stock
            let selectQuery, selectParams;
            if (itemId) {
                selectQuery = 'SELECT id, category, key_name, name, price, available, image_url FROM Menu WHERE id = ?';
                selectParams = [itemId];
            } else {
                selectQuery = 'SELECT id, category, key_name, name, price, available, image_url FROM Menu WHERE category = ? AND key_name = ?';
                selectParams = [category, key];
            }
            
            db.query(selectQuery, selectParams, (sErr, rows) => {
                if (sErr || !rows || rows.length === 0) {
                    return res.json({ success: true, stock: 0 });
                }
                const item = rows[0];
                res.json({ success: true, stock: item.available, item: { id: item.id, name: item.name, category: item.category, stock: item.available } });
            });
        });
    } catch (e) {
        console.error('/api/menu/item/reduce-stock error', e);
        res.status(500).json({ error: 'internal' });
    }
});

app.get("/logout", (req, res) => {
    try {
        const uid = req.session && req.session.userId ? String(req.session.userId) : null;
        if (uid && userSessions.has(uid)) {
            const set = userSessions.get(uid);
            set.delete(req.sessionID);
            if (set.size === 0) userSessions.delete(uid);
            else userSessions.set(uid, set);
        }
    } catch (e) { console.error('Error cleaning userSessions on logout', e); }
    try { const uid = req.session && req.session.userId ? String(req.session.userId) : null; req.session.destroy(() => { try { if (uid) io.emit('admin:users:changed', { action: 'logout', id: uid }); } catch (e) {} }); } catch (e) { req.session.destroy(); }
    res.redirect("/login.html");
});

// Health check route to verify DB connectivity
app.get('/health', (req, res) => {
    db.query('SELECT 1 AS ok', (qErr, rows) => {
        if (qErr) {
            console.error('Health check query error:', qErr);
            return res.status(500).json({ status: 'error', error: qErr.message });
        }
        res.json({ status: 'ok', rows });
    });
});

// ---------------------------
// User API
// ---------------------------
app.get("/api/user", (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: "Not logged in" });
    // Include latest avatar URL when available
    const userId = req.session.userId;
    const base = req.protocol + '://' + req.get('host');
    const avatarQuery = isPg
        ? 'SELECT url FROM user_avatars WHERE user_id = ? ORDER BY created_at DESC LIMIT 1'
        : 'SELECT url FROM user_avatars WHERE user_id = ? ORDER BY created_at DESC LIMIT 1';

    db.query(avatarQuery, [userId], (err, avatarResult) => {
        if (err) {
            console.error('Error fetching avatar for /api/user:', err);
            return res.json({
                id: req.session.userId,
                name: req.session.user.name,
                role: req.session.user.role,
                password: req.session.user.password || ''
            });
        }

        const avatarUrl = avatarResult && avatarResult[0] && avatarResult[0].url ? (avatarResult[0].url.startsWith('http') ? avatarResult[0].url : base + avatarResult[0].url) : null;

        res.json({
            id: req.session.userId,
            name: req.session.user.name,
            role: req.session.user.role,
            password: req.session.user.password || '',
            avatar_url: avatarUrl
        });
    });
});

// Return minimal session info for UI (login time and last activity)
app.get('/api/session', (req, res) => {
    if (!req.session || !req.session.user) return res.status(401).json({ error: 'not_logged_in' });
    try {
        return res.json({ loginTime: req.session.loginTime || null, lastActivity: req.session.lastActivity || null });
    } catch (e) {
        return res.json({ loginTime: null, lastActivity: null });
    }
});

// Admin middleware
function isAdmin(req, res, next) {
    if (req.session && req.session.user && req.session.user.role === 'admin') return next();
    return res.status(403).json({ error: 'admin_required' });
}

// ---------------------------
// Admin: User management APIs
// ---------------------------
app.get('/api/admin/users', isAuthenticated, isAdmin, (req, res) => {
    db.query('SELECT id, name, email, role, disabled FROM users', (err, rows) => {
        if (err) return res.status(500).json({ error: 'db_error' });
        try {
            const augmented = rows.map(r => {
                const uid = String(r.id);
                const sessions = userSessions.get(uid);
                // check onlineAgents map for any socket with this userId
                let online = false;
                for (const a of onlineAgents.values()) {
                    if (String(a.userId) === uid) { online = true; break; }
                }
                return Object.assign({}, r, { active: !!(sessions && sessions.size > 0) || online });
            });
            res.json(augmented);
        } catch (e) {
            console.error('augment admin users error', e);
            res.json(rows);
        }
    });
});

app.post('/api/admin/users', isAuthenticated, isAdmin, (req, res) => {
    const { name, email, password, role } = req.body;
    console.log('POST /api/admin/users body=', req.body);
    if (!email || !password) return res.status(400).json({ error: 'email_and_password_required' });
    const sql = isPg
        ? 'INSERT INTO users (name, email, password, role, disabled) VALUES (?, ?, ?, ?, false) RETURNING id'
        : 'INSERT INTO users (name, email, password, role, disabled) VALUES (?, ?, ?, ?, 0)';
    db.query(sql, [name || email.split('@')[0], email, password, role || 'agent'], (err, result) => {
        if (err) {
            console.error('Failed to insert user:', err);
            const payload = { error: 'db_error', code: err.code || null, message: err.sqlMessage || String(err) };
            return res.status(500).json(payload);
        }
        const insertedId = result && (result.insertId || result.lastID || (result.rows && result.rows[0] && result.rows[0].id) || null);
        console.log('User created id=', insertedId);
        try { io.emit('admin:users:changed', { action: 'create', id: insertedId, email }); } catch (e) { console.error('Emit admin users changed error', e); }
        res.json({ success: true, id: insertedId });
    });
});

app.put('/api/admin/users/:id', isAuthenticated, isAdmin, (req, res) => {
    const id = req.params.id;
    const { name, role, disabled } = req.body;
    const sql = 'UPDATE users SET name = COALESCE(?, name), role = COALESCE(?, role), disabled = COALESCE(?, disabled) WHERE id = ?';
    db.query(sql, [name, role, (disabled ? true : false), id], (err) => {
        if (err) return res.status(500).json({ error: 'db_error' });
        try { io.emit('admin:users:changed', { action: 'update', id }); } catch (e) { console.error('Emit admin users changed error', e); }
        res.json({ success: true });
    });
});

app.delete('/api/admin/users/:id', isAuthenticated, isAdmin, (req, res) => {
    const id = req.params.id;
    db.query('DELETE FROM users WHERE id = ?', [id], (err) => {
        if (err) return res.status(500).json({ error: 'db_error' });
        // destroy tracked sessions
        try {
            const set = userSessions.get(String(id));
            if (set) {
                set.forEach(sid => {
                    // destroy session by id if possible
                    try { req.sessionStore.destroy(sid, () => {}); } catch (e) {}
                });
                userSessions.delete(String(id));
            }
        } catch (e) {}
        res.json({ success: true });
        try { io.emit('admin:users:changed', { action: 'delete', id }); } catch (e) { console.error('Emit admin users changed error', e); }
    });
});

app.post('/api/admin/users/:id/reset-password', isAuthenticated, isAdmin, (req, res) => {
    const id = req.params.id;
    const newPass = Math.random().toString(36).slice(-8);
    db.query('UPDATE users SET password = ? WHERE id = ?', [newPass, id], (err) => {
        if (err) return res.status(500).json({ error: 'db_error' });
        // Optionally email the password; here we just return it so admin can communicate it
        try { io.emit('admin:users:changed', { action: 'reset-password', id }); } catch (e) { console.error('Emit admin users changed error', e); }
        res.json({ success: true, password: newPass });
    });
});

app.post('/api/admin/users/:id/force-logout', isAuthenticated, isAdmin, (req, res) => {
    const id = req.params.id;
    try {
        const set = userSessions.get(String(id));
        if (set) {
            set.forEach(sid => {
                try { req.sessionStore.destroy(sid, () => {}); } catch (e) { console.error('destroy session error', e); }
            });
            userSessions.delete(String(id));
        }
    } catch (e) {
        console.error('force-logout error', e);
        return res.status(500).json({ error: 'internal' });
    }
    try { io.emit('admin:users:changed', { action: 'force-logout', id }); } catch (e) { console.error('Emit admin users changed error', e); }
    res.json({ success: true });
});

// ---------------------------
// Staff Metrics (mock/sample)
// ---------------------------
app.get('/api/staff-metrics', isAuthenticated, (req, res) => {
    // Real implementation: compute per-staff metrics from DB
    // We'll gather: id, name, messages_handled, avg_response_time (sec), avg_resolution_time (sec), last_week array

    // First get staff users (basic list)
    db.query("SELECT id, name FROM users", (err, users) => {
        if (err) {
            console.error('Error fetching users for metrics:', err);
            return res.status(500).json({ error: 'DB error' });
        }

        const tasks = users.map(u => {
            return new Promise((resolve) => {
                const out = { id: u.id, name: u.name, messages_handled: 0, avg_response_time: null, avg_resolution_time: null, satisfaction: null, last_week: [] };

                // messages handled
                db.query('SELECT COUNT(*) AS cnt FROM replies WHERE user_id = ?', [u.id], (err2, r2) => {
                    if (!err2 && r2 && r2[0]) out.messages_handled = r2[0].cnt || 0;

                    // avg response time: average seconds between the most recent customer message before a reply and the reply
                    const avgRespSql = `
                        SELECT AVG(TIMESTAMPDIFF(SECOND, m.prev_created, r.created_at)) AS avg_resp FROM (
                            SELECT r1.id, r1.conversation_id, r1.created_at
                            FROM replies r1
                            WHERE r1.user_id = ?
                        ) r
                        JOIN (
                            SELECT m1.conversation_id, m1.created_at AS prev_created
                            FROM messages m1
                        ) m ON m.conversation_id = r.conversation_id AND m.prev_created = (
                            SELECT MAX(m2.created_at) FROM messages m2 WHERE m2.conversation_id = r.conversation_id AND m2.created_at < r.created_at
                        )
                    `;

                    // Due to MySQL limitations with complex correlated subqueries in JOINs, we'll compute avg response using a simpler approach:
                    const avgRespFallback = `
                        SELECT AVG(TIMESTAMPDIFF(SECOND, (
                            SELECT MAX(m2.created_at) FROM messages m2 WHERE m2.conversation_id = r3.conversation_id AND m2.created_at < r3.created_at
                        ), r3.created_at)) AS avg_resp
                        FROM replies r3
                        WHERE r3.user_id = ? AND EXISTS (
                            SELECT 1 FROM messages m3 WHERE m3.conversation_id = r3.conversation_id AND m3.created_at < r3.created_at
                        )
                    `;

                    db.query(avgRespFallback, [u.id], (err3, r3) => {
                        if (!err3 && r3 && r3[0] && r3[0].avg_resp != null) out.avg_response_time = Math.round(r3[0].avg_resp);

                        // avg resolution time: approximate as average time from conversation creation to the last reply by this user in that conversation
                        const avgResSql = `
                            SELECT AVG(TIMESTAMPDIFF(SECOND, c.created_at, r4.created_at)) AS avg_res
                            FROM (
                                SELECT conversation_id, MAX(created_at) AS created_at
                                FROM replies
                                WHERE user_id = ?
                                GROUP BY conversation_id
                            ) r4
                            JOIN conversations c ON c.id = r4.conversation_id
                        `;
                        db.query(avgResSql, [u.id], (err4, r4) => {
                            if (!err4 && r4 && r4[0] && r4[0].avg_res != null) out.avg_resolution_time = Math.round(r4[0].avg_res);

                            // resolution rate: resolved conversations where last reply was by this user
                            const resolutionRateSql = isPg ? `
                                SELECT COUNT(*) FILTER (WHERE res.conversation_id IS NOT NULL) AS resolvedConvos,
                                       COUNT(*) AS totalConvos
                                FROM (
                                    SELECT conversation_id, MAX(created_at) AS last_reply_at
                                    FROM replies
                                    WHERE user_id = ?
                                    GROUP BY conversation_id
                                ) lr
                                LEFT JOIN resolved res ON res.conversation_id = lr.conversation_id
                            ` : `
                                SELECT SUM(CASE WHEN res.conversation_id IS NOT NULL THEN 1 ELSE 0 END) AS resolvedConvos,
                                       COUNT(*) AS totalConvos
                                FROM (
                                    SELECT conversation_id, MAX(created_at) AS last_reply_at
                                    FROM replies
                                    WHERE user_id = ?
                                    GROUP BY conversation_id
                                ) lr
                                LEFT JOIN resolved res ON res.conversation_id = lr.conversation_id
                            `;

                            db.query(resolutionRateSql, [u.id], (errRes, rRes) => {
                                if (!errRes && rRes && rRes[0]) {
                                    const total = Number(rRes[0].totalConvos) || 0;
                                    const resolved = Number(rRes[0].resolvedConvos) || 0;
                                    out.resolution_rate = total ? Number(((resolved / total) * 100).toFixed(1)) : null;
                                }

                                // last_week: counts of replies by day (Mon..Sun) for the last 7 days
                                const lastWeekSql = isPg ? `
                                    SELECT DATE(created_at) AS d, COUNT(*) AS cnt
                                    FROM replies
                                    WHERE user_id = ? AND created_at >= CURRENT_DATE - INTERVAL '7 days'
                                    GROUP BY DATE(created_at)
                                    ORDER BY DATE(created_at) ASC
                                ` : `
                                    SELECT DATE(created_at) AS d, COUNT(*) AS cnt
                                    FROM replies
                                    WHERE user_id = ? AND created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
                                    GROUP BY DATE(created_at)
                                    ORDER BY DATE(created_at) ASC
                                `;
                                db.query(lastWeekSql, [u.id], (err5, r5) => {
                                    if (!err5 && r5) {
                                        // build last_week array of length up to 7
                                        const map = {};
                                        r5.forEach(rr => {
                                            const key = (rr.d instanceof Date) ? rr.d.toISOString().slice(0,10) : (new Date(rr.d)).toISOString().slice(0,10);
                                            map[key] = rr.cnt;
                                        });
                                        const arr = [];
                                        for (let i=6;i>=0;i--) {
                                            const d = new Date(); d.setDate(d.getDate() - i);
                                            const key = d.toISOString().slice(0,10);
                                            arr.push(map[key] || 0);
                                        }
                                        out.last_week = arr;
                                    }

                                    resolve(out);
                                });
                            });
                        });
                    });
                });
            });
        });

        Promise.all(tasks).then(results => res.json(results)).catch(e => {
            console.error('Metrics assembly error', e);
            res.status(500).json({ error: 'Failed to build metrics' });
        });
    });
});

// ---------------------------
// Staff Presence API
// ---------------------------
app.get('/api/staff-presence', isAuthenticated, (req, res) => {
    // Get live staff presence from onlineAgents map and enrich with status data
    const staffPresence = Array.from(onlineAgents.values()).map(agent => {
        const lastActiveMs = agent.lastActive ? Date.now() - agent.lastActive : null;
        let lastActiveText = '—';
        if (lastActiveMs !== null) {
            if (lastActiveMs < 60000) lastActiveText = 'just now';
            else if (lastActiveMs < 3600000) lastActiveText = Math.floor(lastActiveMs / 60000) + 'm ago';
            else if (lastActiveMs < 86400000) lastActiveText = Math.floor(lastActiveMs / 3600000) + 'h ago';
            else lastActiveText = Math.floor(lastActiveMs / 86400000) + 'd ago';
        }
        
        return {
            userId: agent.userId,
            name: agent.name || '—',
            role: agent.role || 'agent',
            status: agent.status || 'online',
            activeConversation: agent.activeConversation,
            lastActive: lastActiveText,
            lastActiveMs: lastActiveMs,
            socketId: agent.socketId
        };
    });
    
    res.json(staffPresence);
});

// ---------------------------
// Settings API (per-user)
// ---------------------------
// Add columns if missing
db.query("ALTER TABLE settings ADD COLUMN IF NOT EXISTS translate_enabled TINYINT(1) DEFAULT 0", (err) => {
    if (err && err.errno !== 1060) console.log("Error adding translate_enabled to settings:", err);
});
db.query("ALTER TABLE settings ADD COLUMN IF NOT EXISTS translate_lang VARCHAR(10) DEFAULT 'en'", (err) => {
    if (err && err.errno !== 1060) console.log("Error adding translate_lang to settings:", err);
});
// Ensure settings table can store an avatar URL
db.query("ALTER TABLE settings ADD COLUMN IF NOT EXISTS avatar_url TEXT NULL", (err) => {
    if (err && err.errno !== 1060) console.log("Error adding avatar_url to settings:", err);
});
db.query("ALTER TABLE settings ADD COLUMN IF NOT EXISTS autopilotMode VARCHAR(20) DEFAULT 'assist'", (err) => {
    if (err && err.errno !== 1060) console.log("Error adding autopilotMode to settings:", err);
});

// Create user_avatars table to keep avatar history and metadata
if (isPg) {
    db.query(`
        CREATE TABLE IF NOT EXISTS user_avatars (
            id SERIAL PRIMARY KEY,
            user_id INT NOT NULL,
            filename VARCHAR(255) NOT NULL,
            url TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
    `, (err) => {
        if (err) console.error('Error creating user_avatars table (pg):', err);
        else db.query('CREATE INDEX IF NOT EXISTS idx_user_avatars_user_id ON user_avatars(user_id)', (ie) => {});
    });
} else {
    db.query(`
        CREATE TABLE IF NOT EXISTS user_avatars (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            filename VARCHAR(255) NOT NULL,
            url TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            INDEX idx_user_avatars_user_id (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `, (err) => { if (err) console.error('Error creating user_avatars table:', err); });
}

if (isPg) {
    db.query(`
        CREATE TABLE IF NOT EXISTS call_sessions (
            secure_token TEXT PRIMARY KEY,
            conversation_id INT NOT NULL,
            customer_name TEXT,
            staff_id INT NOT NULL,
            staff_name TEXT NOT NULL,
            status VARCHAR(50) NOT NULL,
            started_at TIMESTAMP,
            answered_at TIMESTAMP,
            ended_at TIMESTAMP,
            duration INT,
            expires_at TIMESTAMP NOT NULL,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        );
    `, (err) => {
        if (err) console.error('Error creating call_sessions table (pg):', err);
    });
} else {
    db.query(`
        CREATE TABLE IF NOT EXISTS call_sessions (
            secure_token VARCHAR(255) PRIMARY KEY,
            conversation_id INT NOT NULL,
            customer_name TEXT,
            staff_id INT NOT NULL,
            staff_name VARCHAR(255) NOT NULL,
            status VARCHAR(50) NOT NULL,
            started_at DATETIME NULL,
            answered_at DATETIME NULL,
            ended_at DATETIME NULL,
            duration INT NULL,
            expires_at DATETIME NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `, (err) => {
        if (err) console.error('Error creating call_sessions table:', err);
    });
}



// ---------------------------
// Conversations & Messages
// ---------------------------
app.get("/api/conversations", (req, res) => {
    if (req.query.id) {
        db.query("SELECT * FROM conversations WHERE id = ?", [req.query.id], (err, result) => {
            if (err) throw err;
            res.json(result);
        });
    } else {
        const primarySql = `
            SELECT c.*, 
                (SELECT COUNT(*) FROM messages m2 
                    WHERE m2.conversation_id = c.id 
                      AND LOWER(m2.sender) NOT IN ('sent', 'sent_by_agent')
                      AND (c.last_viewed IS NULL OR m2.created_at > c.last_viewed)
                ) AS unread_count,
                (SELECT m.message FROM messages m
                    WHERE m.conversation_id = c.id
                    ORDER BY m.created_at DESC, m.id DESC
                    LIMIT 1) AS last_message,
                (SELECT m.created_at FROM messages m
                    WHERE m.conversation_id = c.id
                    ORDER BY m.created_at DESC, m.id DESC
                    LIMIT 1) AS last_message_at
            FROM conversations c
            ORDER BY GREATEST(COALESCE((SELECT m.created_at FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC, m.id DESC LIMIT 1), c.created_at), c.created_at) DESC
        `;

        // Try the primary query first. If it fails (e.g. missing `last_viewed` column on some databases),
        // fallback to a more compatible query that omits the last_viewed comparison.
        db.query(primarySql, (err, result) => {
            if (!err) {
                try {
                    const safe = JSON.parse(JSON.stringify(result, (_k, v) => typeof v === 'bigint' ? v.toString() : v));
                    return res.json(safe);
                } catch (e) {
                    console.warn('/api/conversations: failed to serialize result, converting bigints to strings', e && e.message);
                    const safe = result.map(r => {
                        const out = {};
                        Object.keys(r).forEach(k => {
                            const val = r[k];
                            out[k] = (typeof val === 'bigint') ? val.toString() : val;
                        });
                        return out;
                    });
                    return res.json(safe);
                }
            }

            console.warn('/api/conversations primary query failed, falling back to compatible query', err && err.message);

            const fallbackSql = `
                SELECT c.*, 
                    (SELECT COUNT(*) FROM messages m2 
                        WHERE m2.conversation_id = c.id 
                          AND LOWER(m2.sender) NOT IN ('sent', 'sent_by_agent')
                    ) AS unread_count,
                    (SELECT m.message FROM messages m
                        WHERE m.conversation_id = c.id
                        ORDER BY m.created_at DESC, m.id DESC
                        LIMIT 1) AS last_message,
                    (SELECT m.created_at FROM messages m
                        WHERE m.conversation_id = c.id
                        ORDER BY m.created_at DESC, m.id DESC
                        LIMIT 1) AS last_message_at
                FROM conversations c
                ORDER BY COALESCE((SELECT m.created_at FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC, m.id DESC LIMIT 1), c.created_at) DESC
            `;

            db.query(fallbackSql, (err2, result2) => {
                if (err2) {
                    console.error('/api/conversations fallback query also failed', err2 && err2.message);
                    // As a last resort, try a very simple query that should be compatible with any schema
                    console.warn('/api/conversations attempting ultimate simple fallback query');
                    const ultimateSql = `SELECT id, phone, name, platform, created_at FROM conversations ORDER BY created_at DESC`;
                    db.query(ultimateSql, (err3, result3) => {
                        if (err3) {
                            console.error('/api/conversations ultimate fallback failed', err3 && err3.message);
                            return res.status(500).json({ error: 'Database error' });
                        }
                        try {
                            const safe3 = JSON.parse(JSON.stringify(result3, (_k, v) => typeof v === 'bigint' ? v.toString() : v));
                            return res.json(safe3);
                        } catch (e3) {
                            const safe3 = result3.map(r => {
                                const out = {};
                                Object.keys(r).forEach(k => {
                                    const val = r[k];
                                    out[k] = (typeof val === 'bigint') ? val.toString() : val;
                                });
                                return out;
                            });
                            return res.json(safe3);
                        }
                    });
                }
                try {
                    const safe2 = JSON.parse(JSON.stringify(result2, (_k, v) => typeof v === 'bigint' ? v.toString() : v));
                    return res.json(safe2);
                } catch (e2) {
                    const safe2 = result2.map(r => {
                        const out = {};
                        Object.keys(r).forEach(k => {
                            const val = r[k];
                            out[k] = (typeof val === 'bigint') ? val.toString() : val;
                        });
                        return out;
                    });
                    return res.json(safe2);
                }
            });
        });
    }
});

app.put('/api/conversations/viewed', isAuthenticated, (req, res) => {
    const { id } = req.body || {};
    if (!id) {
        return res.status(400).json({ success: false, error: 'Missing conversation id' });
    }
    const sql = isPg
        ? 'UPDATE conversations SET last_viewed = CURRENT_TIMESTAMP WHERE id = ?'
        : 'UPDATE conversations SET last_viewed = NOW() WHERE id = ?';
    db.query(sql, [id], (err) => {
        if (err) {
            console.error('PUT /api/conversations/viewed error', err);
            return res.status(500).json({ success: false, error: 'Database error' });
        }
        res.json({ success: true });
    });
});

app.put('/api/conversations', isAuthenticated, (req, res) => {
    const { id, name } = req.body || {};
    if (!id) {
        return res.status(400).json({ success: false, error: 'Missing conversation id' });
    }
    db.query('UPDATE conversations SET name = ? WHERE id = ?', [name || null, id], (err, result) => {
        if (err) {
            console.error('PUT /api/conversations error', err);
            return res.status(500).json({ success: false, error: 'Database error' });
        }
        res.json({ success: true });
    });
});

app.post('/api/call-sessions', isAuthenticated, express.json(), (req, res) => {
    const staffId = req.session.userId;
    const staffName = req.session.user?.name || 'Support';
    const { conversationId, customerName } = req.body || {};
    if (!conversationId) {
        return res.status(400).json({ error: 'conversation_id_required' });
    }

    const secureToken = generateSecureToken(32);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + CALL_EXPIRY_MINUTES * 60000).toISOString();

    const callSession = {
        secureToken,
        conversationId,
        customerName: customerName || null,
        staffId,
        staffName,
        status: 'waiting',
        createdAt: now.toISOString(),
        expiresAt,
        startedAt: null,
        answeredAt: null,
        endedAt: null,
        duration: null,
        staffSocketId: null,
        customerSocketId: null,
        timeoutId: null
    };

    callSessions.set(secureToken, callSession);
    createCallTimeout(secureToken);

    res.json({
        secureToken,
        callLink: `${process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`}/call/${secureToken}`,
        expiresAt,
        status: callSession.status
    });
});

app.get('/api/call-sessions/:token', (req, res) => {
    const token = req.params.token;
    if (!token) {
        return res.status(400).json({ error: 'token_required' });
    }
    const session = callSessions.get(token);
    if (!session) {
        return res.status(404).json({ error: 'call_not_found' });
    }
    if (new Date(session.expiresAt) < new Date()) {
        return res.status(410).json({ error: 'call_link_expired' });
    }
    res.json({
        secureToken: session.secureToken,
        conversationId: session.conversationId,
        customerName: session.customerName,
        staffName: session.staffName,
        status: session.status,
        expiresAt: session.expiresAt
    });
});

app.put('/api/call-sessions/:token/status', express.json(), (req, res) => {
    const token = req.params.token;
    const { status } = req.body || {};
    const session = callSessions.get(token);
    if (!session) {
        return res.status(404).json({ error: 'call_not_found' });
    }
    if (!['ringing', 'answered', 'rejected', 'ended', 'missed', 'failed'].includes(status)) {
        return res.status(400).json({ error: 'invalid_status' });
    }
    if (new Date(session.expiresAt) < new Date() && status !== 'answered') {
        return res.status(410).json({ error: 'call_link_expired' });
    }

    session.status = status;
    if (status === 'ringing') {
        session.startedAt = session.startedAt || new Date().toISOString();
    }
    if (status === 'answered') {
        session.answeredAt = new Date().toISOString();
        session.startedAt = session.startedAt || session.answeredAt;
    }
    if (status === 'ended' || status === 'rejected' || status === 'missed' || status === 'failed') {
        session.endedAt = new Date().toISOString();
        session.duration = session.startedAt ? Math.max(0, Math.round((new Date(session.endedAt) - new Date(session.startedAt)) / 1000)) : 0;
        if (session.timeoutId) {
            clearTimeout(session.timeoutId);
            session.timeoutId = null;
        }
    }

    callSessions.set(token, session);
    if (session.staffSocketId) {
        io.to(session.staffSocketId).emit('call:status', { secureToken: token, status });
    }
    if (session.customerSocketId) {
        io.to(session.customerSocketId).emit('call:status', { secureToken: token, status });
    }
    res.json({ success: true, status });
});

app.get('/call/:token', (req, res) => {
    const token = req.params.token;
    const session = callSessions.get(token);
    if (!session) {
        const notFoundPath = path.join(__dirname, 'public', '404.html');
        if (fs.existsSync(notFoundPath)) {
            return res.status(404).sendFile(notFoundPath);
        }
        return res.status(404).send('Page not found');
    }
    if (new Date(session.expiresAt) < new Date()) {
        const expiredPath = path.join(__dirname, 'public', 'call-expired.html');
        if (fs.existsSync(expiredPath)) {
            return res.status(410).sendFile(expiredPath);
        }
        return res.status(410).send('Call link expired');
    }
    const callPagePath = path.join(__dirname, 'public', 'call.html');
    if (fs.existsSync(callPagePath)) {
        return res.sendFile(callPagePath);
    }
    return res.status(500).send('Call page is unavailable');
});

app.delete('/api/call-sessions/:token', isAuthenticated, (req, res) => {
    const token = req.params.token;
    const session = callSessions.get(token);
    if (!session) {
        return res.status(404).json({ error: 'call_not_found' });
    }
    cleanupCallSession(token);
    res.json({ success: true });
});

app.delete('/api/conversations', isAuthenticated, (req, res) => {
    const { id } = req.body || {};
    if (!id) {
        return res.status(400).json({ success: false, error: 'Missing conversation id' });
    }
    
    const conversationId = id;
    let deletedCount = 0;
    let totalTables = 0;
    let hasError = false;
    
    const tables = [
        'messages',
        'replies',
        'ai_messages',
        'staff_messages',
        'ai replies',
        'staff replies',
        'escalations',
        'resolved',
        'refunds',
        'ai_feedback',
        'delivery_issues'
    ];
    
    const deleteFromTable = (tableName, callback) => {
        const sqlSafe = `DELETE FROM \`${tableName}\` WHERE conversation_id = ?`;
        db.query(sqlSafe, [conversationId], (err, result) => {
            if (err && err.code !== 'ER_NO_REFERENCED_ROW') {
                // Silently ignore if table doesn't exist or other non-critical errors
                console.error(`Error deleting from ${tableName}:`, err.code, err.message);
            } else if (!err) {
                deletedCount++;
            }
            callback();
        });
    };
    
    let completed = 0;
    tables.forEach((tableName) => {
        totalTables++;
        deleteFromTable(tableName, () => {
            completed++;
            if (completed === tables.length) {
                // All related data deleted, now delete the conversation itself
                db.query('DELETE FROM conversations WHERE id = ?', [conversationId], (err) => {
                    if (err) {
                        console.error('DELETE /api/conversations - delete conversation error', err);
                        return res.status(500).json({ success: false, error: 'Failed to delete conversation' });
                    }
                    res.json({ success: true, message: 'Conversation deleted successfully' });
                });
            }
        });
    });
});

// Recent tickets endpoint used by dashboard (joins last message and status)
app.get('/api/recent-tickets', (req, res) => {
    const sql = `
        SELECT c.id, c.phone, c.name, c.platform, c.created_at,
            (SELECT m.message FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_message,
            (SELECT m.created_at FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_message_at,
            (CASE
                WHEN EXISTS(SELECT 1 FROM resolved r WHERE r.conversation_id = c.id) THEN 'Resolved'
                WHEN EXISTS(SELECT 1 FROM escalations e WHERE e.conversation_id = c.id) THEN 'Escalated'
                ELSE 'Open'
            END) AS status
        FROM conversations c
        ORDER BY GREATEST(COALESCE((SELECT m.created_at FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1), c.created_at), c.created_at) DESC
        LIMIT 20
    `;
    db.query(sql, (err, rows) => {
        if (err) {
            console.error('/api/recent-tickets db error', err);
            return res.status(500).json({ error: 'DB error' });
        }
        res.json(rows);
    });
});

    // Recent tickets widget for dashboard (reads from tickets table)
    app.get('/api/recent-tickets-tickets', (req, res) => {
        const sql = `
            SELECT id, subject, assignee, status, created_at, LEFT(content, 200) AS snippet
            FROM tickets
            ORDER BY created_at DESC
            LIMIT 4
        `;
        db.query(sql, (err, rows) => {
            if (err) {
                console.error('/api/recent-tickets-tickets db error', err);
                return res.status(500).json({ error: 'DB error' });
            }
            res.json(rows || []);
        });
    });

    // Recent customer messages for dashboard (last N customer messages)
    app.get('/api/recent-messages', (req, res) => {
        const limit = Math.min(100, parseInt(req.query.limit || '5', 10));
        const sql = `
            SELECT m.id, m.conversation_id, m.sender, m.message, m.created_at, c.name AS customer_name, c.phone
            FROM messages m
            JOIN conversations c ON c.id = m.conversation_id
            WHERE m.sender IS NULL OR LOWER(m.sender) NOT IN ('sent','sent_by_agent') AND m.sender <> 'sent'
            ORDER BY m.created_at DESC
            LIMIT ?
        `;
        db.query(sql, [limit], (err, rows) => {
            if (err) {
                console.error('/api/recent-messages db error', err);
                return res.status(500).json({ error: 'DB error' });
            }
            res.json(rows || []);
        });
    });

// Instagram conversations API removed

app.get("/api/messages/:id", (req, res) => {
    const id = req.params.id;
    db.query(
        `SELECT sender, message, created_at FROM messages WHERE conversation_id = ? 
         UNION ALL
         SELECT sender, message, created_at FROM replies WHERE conversation_id = ? 
         ORDER BY created_at ASC`,
        [id, id],
        (err, result) => {
            if (err) throw err;
            res.json(result);
        }
    );
});

app.get("/api/suggest-reply/:id", async (req, res) => {
    const conversationId = req.params.id;
    try {
        db.query(
            "SELECT c.phone FROM conversations c WHERE c.id = ? LIMIT 1",
            [conversationId],
            async (err, convResult) => {
                if (err) {
                    console.error('Error fetching conversation phone for suggestion:', err);
                    return res.status(500).json({ suggestion: "Unable to create AI suggestion." });
                }

                const phone = convResult && convResult[0] ? convResult[0].phone : null;
                db.query(
                    "SELECT message FROM messages WHERE conversation_id = ? AND sender != 'sent' ORDER BY created_at DESC LIMIT 1",
                    [conversationId],
                    async (err2, msgResult) => {
                        if (err2) {
                            console.error('Error fetching latest customer message for suggestion:', err2);
                            return res.status(500).json({ suggestion: "Unable to create AI suggestion." });
                        }

                        const latestCustomerMessage = msgResult && msgResult[0] ? msgResult[0].message : null;
                        if (!latestCustomerMessage) {
                            return res.json({ suggestion: "No customer message yet to suggest a reply." });
                        }

                        const suggestion = await getMistralReply(latestCustomerMessage, phone, conversationId);
                        return res.json({ suggestion });
                    }
                );
            }
        );
    } catch (error) {
        console.error('Suggestion endpoint error:', error);
        res.status(500).json({ suggestion: "Unable to create AI suggestion." });
    }
});

// ---------------------------
// Send Message (Agent)
// ---------------------------
async function sendAutoReply(phone, message) {
    try {
        // Ensure phone is in E.164 format for WhatsApp (add + if missing)
        let formattedPhone = phone;
        if (!formattedPhone.startsWith('+')) {
            formattedPhone = '+' + formattedPhone.replace(/\D/g, '');
        }

        const token = await getWhatsAppToken();
        const response = await fetch(
            `https://graph.facebook.com/v18.0/${process.env.PHONE_NUMBER_ID}/messages`,
            {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    messaging_product: "whatsapp",
                    to: formattedPhone,
                    type: "text",
                    text: { body: message }
                })
            }
        );

        // (previously emitted a playHandoffAudio event for some AI replies; removed per request)

        const data = await response.json();
        console.log("Auto-reply sent:", data);

        if (!response.ok || (data && data.error)) {
            throw new Error(JSON.stringify({ status: response.status, data }));
        }

        const conversation_id = await getOrCreateConversationByPhone(phone);
        db.query(
            "INSERT INTO replies (conversation_id, sender, message, user_id, created_at) VALUES (?, ?, ?, ?, NOW())",
            [conversation_id, 'sent', message, null],
            (err) => {
                if (err) {
                    console.log("AUTO-REPLY INSERT ERROR:", err);
                }
            }
        );

        db.query(
            "INSERT INTO ai_messages (conversation_id, sender, message, user_id, created_at) VALUES (?, ?, ?, ?, NOW())",
            [conversation_id, 'sent', message, null],
            (err) => {
                if (err) {
                    console.log("AUTO-REPLY AI_MESSAGE INSERT ERROR:", err);
                }
            }
        );

        const messageData = {
            conversation_id,
            sender: "sent",
            message,
            created_at: new Date().toISOString()
        };
        emitNewMessageEvent(conversation_id, messageData);

    } catch (error) {
        console.log("AUTO-REPLY ERROR:", error);
    }
}

function getOrCreateConversationByPhone(phone, platform = 'whatsapp') {
    return new Promise((resolve, reject) => {
        if (!phone) return reject(new Error('Missing phone'));

        db.query("SELECT id FROM conversations WHERE phone = ?", [phone], (err, result) => {
            if (err) return reject(err);
            if (result && result.length > 0) {
                return resolve(result[0].id);
            }

            const insertSql = isPg
                ? 'INSERT INTO conversations (phone, name, platform) VALUES (?, ?, ?) RETURNING id'
                : "INSERT INTO conversations (phone, name, platform) VALUES (?, ?, 'whatsapp')";

            db.query(insertSql, [phone, phone, platform], (insertErr, insertResult) => {
                if (insertErr) return reject(insertErr);
                const newId = isPg
                    ? (insertResult?.rows?.[0]?.id || insertResult?.[0]?.id)
                    : insertResult.insertId;
                if (!newId) return reject(new Error('Failed to create conversation'));
                resolve(newId);
            });
        });
    });
}

// Instagram Messaging Integration removed

function isOrderConfirmation(text) {
    const confirmKeywords = ['yes', 'yep', 'yup', 'confirm', 'ok', 'okay', 'sure', 'go', 'order it', 'proceed', 'do it'];
    const lowerText = text.toLowerCase().trim();
    return confirmKeywords.some(keyword => lowerText.includes(keyword));
}

function findMostRecentCustomerOrderMessage(messages) {
    const orderKeywords = ['pizza', 'burger', 'cheese burger', 'cheese burgers', 'large pizzas', 'large pizza', 'meal', 'combo', 'sandwich', 'taco', 'drink', 'food', 'package', 'fries', 'salad', 'sushi', 'pasta', 'rice', 'noodles', 'wrap'];
    for (const msg of messages) {
        if (msg.sender === 'received' || msg.sender === 'customer') {
            const messageText = String(msg.message || '').trim();
            const lowerText = messageText.toLowerCase();

            // Skip responses that are just confirmations, rejections, or short support replies.
            if (isOrderConfirmation(lowerText) || /^\s*(yes|no|yep|nope|sure|ok|okay|please|confirm|cancel|thanks?)\s*$/.test(lowerText)) {
                continue;
            }

            if (orderKeywords.some(keyword => lowerText.includes(keyword))) {
                return messageText;
            }
        }
    }
    return null;
}

function cleanOrderText(text) {
    if (!text) return text;
    return String(text)
        .replace(/(?:let me know if you'd like to make any changes|please let me know if you'd like to make any changes|if you'd like to make any changes.*|let me know if.*)/gi, '')
        .replace(/\s+$/g, '')
        .trim();
}

const MENU_PRICES = {
    pizza: { small: 10, medium: 15, large: 20 },
    burger: { classic: 8, cheese: 9, double: 12 }
};

function parseNumberWord(str) {
    if (!str) return 1;
    const num = parseInt(str, 10);
    if (!isNaN(num)) return num;
    const numberWords = {
        one: 1, two: 2, three: 3, four: 4, five: 5,
        six: 6, seven: 7, eight: 8, nine: 9, ten: 10
    };
    return numberWords[str.toLowerCase()] || 1;
}

function parseMenuOrderText(text) {
    if (!text) return { items: null, total: 0 };

    const lowerText = text.toLowerCase();
    const counts = { pizza: 0, burger: 0 };
    let total = 0;

    const pizzaPattern = /(\d+|one|two|three|four|five|six|seven|eight|nine|ten)?\s*(small|medium|large)\s*pizzas?\b/gi;
    let pizzaMatch;
    while ((pizzaMatch = pizzaPattern.exec(lowerText)) !== null) {
        const quantity = parseNumberWord(pizzaMatch[1]);
        const size = pizzaMatch[2];
        counts.pizza += quantity;
        total += quantity * MENU_PRICES.pizza[size];
    }

    const burgerPattern = /(\d+|one|two|three|four|five|six|seven|eight|nine|ten)?\s*(classic|cheese|double)\s*burgers?\b/gi;
    let burgerMatch;
    while ((burgerMatch = burgerPattern.exec(lowerText)) !== null) {
        const quantity = parseNumberWord(burgerMatch[1]);
        const type = burgerMatch[2];
        counts.burger += quantity;
        total += quantity * MENU_PRICES.burger[type];
    }

    if (counts.pizza === 0) {
        const genericPizzaPattern = /(\d+|one|two|three|four|five|six|seven|eight|nine|ten)?\s*pizzas?\b/gi;
        let genericPizzaMatch;
        while ((genericPizzaMatch = genericPizzaPattern.exec(lowerText)) !== null) {
            const quantity = parseNumberWord(genericPizzaMatch[1]);
            counts.pizza += quantity;
            total += quantity * MENU_PRICES.pizza.medium;
        }
    }

    if (counts.burger === 0) {
        const genericBurgerPattern = /(\d+|one|two|three|four|five|six|seven|eight|nine|ten)?\s*burgers?\b/gi;
        let genericBurgerMatch;
        while ((genericBurgerMatch = genericBurgerPattern.exec(lowerText)) !== null) {
            const quantity = parseNumberWord(genericBurgerMatch[1]);
            counts.burger += quantity;
            total += quantity * MENU_PRICES.burger.cheese;
        }
    }

    if (counts.pizza === 0 && counts.burger === 0) {
        return { items: null, total: 0 };
    }

    const itemParts = [];
    if (counts.pizza > 0) itemParts.push(`${counts.pizza} ${counts.pizza === 1 ? 'pizza' : 'pizzas'}`);
    if (counts.burger > 0) itemParts.push(`${counts.burger} ${counts.burger === 1 ? 'burger' : 'burgers'}`);

    return {
        items: itemParts.join(', '),
        total
    };
}

function extractOrderDetails(aiMessage, customerMessage = null) {
    const cleanCustomerMessage = cleanOrderText(customerMessage || '');
    const cleanAiMessage = cleanOrderText(aiMessage || '');

    const customerParsed = parseMenuOrderText(cleanCustomerMessage);
    const aiParsed = parseMenuOrderText(cleanAiMessage);

    // Extract explicit total from AI confirmation text first, then fallback to customer order text.
    const explicitTotal = extractOrderTotal(cleanAiMessage) || extractOrderTotal(cleanCustomerMessage);

    let total = explicitTotal || 0;
    if (customerParsed.total > 0) {
        if (!total || customerParsed.total !== total) {
            total = customerParsed.total;
        }
    } else if (aiParsed.total > 0 && !total) {
        total = aiParsed.total;
    }

    // Extract product information from customer order text first.
    let items = extractOrderItems(cleanCustomerMessage) || extractOrderItems(cleanAiMessage) || customerParsed.items || aiParsed.items;

    // Only use raw fallback as last resort, and only if it's a real customer order message
    if (!items && cleanCustomerMessage && /(pizza|burger|meal|combo|sandwich|taco|drink|food|fries|salad|sushi|pasta|rice|noodles|wrap)/i.test(cleanCustomerMessage)) {
        const shortMessage = cleanCustomerMessage.substring(0, 100);
        items = shortMessage.length > 3 ? shortMessage : null;
    }

    items = String(items || 'Order').trim();
    if (!items || items.length < 2) items = 'Order';

    return { items, total };
}

function extractOrderTotal(text) {
    if (!text) return null;
    const totalMatch = text.match(/\$(\d+(?:\.\d+)?)/);
    if (totalMatch) return parseFloat(totalMatch[1]);

    const totalAlt = text.match(/(?:total|comes to|is|amount|cost|price)\s*[:]?\s*\$?\s*(\d+(?:\.\d+)?)/i);
    return totalAlt ? parseFloat(totalAlt[1]) : null;
}

function extractOrderItems(text) {
    if (!text) return null;

    const normalizedText = String(text)
        .replace(/\s+and\s+/gi, ', ')
        .replace(/\s*&\s*/g, ', ');

    // Try specific order statement patterns first
    const itemPatterns = [
        /(?:i(?:'d| would)? like to order|i(?:'d| would)? like|i want to order|i want|can i get|please order|send me|i need|order|give me|add|deliver)\s+(.+?)(?:\s+(?:for|comes to|total|totals?|cost|price|amount)|\s*\$|\s*\(|$)/i,
        /(?:my order is|please can i have|please may i have)\s+(.+?)(?:\s+(?:for|comes to|total|totals?|cost|price|amount)|\s*\$|\s*\(|$)/i
    ];

    for (const pattern of itemPatterns) {
        const match = normalizedText.match(pattern);
        if (match && match[1]) {
            let itemText = match[1].trim();
            // Remove trailing phrases
            itemText = itemText.replace(/\s*(?:please|thanks|thank you|ok|okay).*$/i, '').trim();
            if (itemText && !/^yes|no|ok|okay|sure|confirm|cancel$/i.test(itemText) && itemText.length > 2) {
                return itemText;
            }
        }
    }

    // If patterns don't match, try to extract just the food items using a different approach
    const lowerText = text.toLowerCase();
    if (/(pizza|burger|meal|combo|sandwich|taco|drink|food|fries|salad|sushi|pasta|rice|noodles|wrap)/i.test(lowerText)) {
        // Extract quantity + food items pattern: "3 Cheese Burgers", "Large Pizza", etc.
        const foodPattern = /(\d+\s+)?(?:large|small|medium|extra|with)?\s*([a-zA-Z\s&]+(?:pizza|burger|meal|combo|sandwich|taco|drink|food|fries|salad|sushi|pasta|rice|noodles|wrap)[a-zA-Z\s&]*)/gi;
        const foodMatches = normalizedText.match(foodPattern);
        
        if (foodMatches && foodMatches.length > 0) {
            // Join all matched food items
            return foodMatches.map(item => item.trim()).join(', ');
        }

        // If pattern still doesn't work, extract up to the price marker
        const beforePrice = normalizedText.split(/\$|total|comes to|for a total|cost/i)[0];
        if (beforePrice && beforePrice.length < normalizedText.length - 5) {
            let cleaned = beforePrice.trim()
                .replace(/^(?:i(?:'d|'m)?\s+(?:want|like|need|order|order me|please|please order)\s+)/i, '')
                .replace(/\s*(?:please|thanks|thank you)\s*$/i, '')
                .trim();
            if (cleaned && cleaned.length > 2) {
                return cleaned;
            }
        }
    }

    return null;
}

function getConversationCustomerName(conversationId) {
    return new Promise((resolve) => {
        db.query('SELECT name FROM conversations WHERE id = ? LIMIT 1', [conversationId], (err, results) => {
            if (err || !results || results.length === 0) {
                resolve('Customer');
            } else {
                resolve(results[0].name || 'Customer');
            }
        });
    });
}

async function checkAndSaveOrderConfirmation(phone, conversationId, customerMessage) {
    if (!isOrderConfirmation(customerMessage)) {
        return false;
    }

    return new Promise(async (resolve) => {
        // Get last few messages to find AI's order suggestion
        db.query(
            `SELECT sender, message, created_at FROM messages WHERE conversation_id = ?
             UNION ALL
             SELECT sender, message, created_at FROM replies WHERE conversation_id = ?
             ORDER BY created_at DESC LIMIT 10`,
            [conversationId, conversationId],
            async (err, messages) => {
                if (err || !messages || messages.length === 0) {
                    resolve(false);
                    return;
                }

                // Find the AI's most recent message (sender = 'sent')
                const aiMessage = messages.find(m => m.sender === 'sent');
                if (!aiMessage) {
                    resolve(false);
                    return;
                }

                const customerOrderMessage = findMostRecentCustomerOrderMessage(messages);
                const { items, total } = extractOrderDetails(aiMessage.message, customerOrderMessage);

                if (!total || total === 0) {
                    console.log("Order confirmation detected but no valid order total found in AI message or customer order message:", {
                        aiMessage: aiMessage.message,
                        customerOrderMessage
                    });
                    resolve(false);
                    return;
                }

                const customerName = await getConversationCustomerName(conversationId);
                const orderId = `ORD-${Date.now()}`;
                const product = items;
                const amount = total;
                const status = 'confirmed';

                db.query(
                    'INSERT INTO orders (order_id, customer_name, phone, product, amount, total_amount, status, order_date, conversation_id) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?)',
                    [orderId, customerName, phone || null, product, amount, total, status, conversationId],
                    (err, result) => {
                        if (err) {
                            console.log("Order save error:", err);
                            resolve(false);
                        } else {
                            console.log(`Order confirmed and saved: ${product} - $${total} from ${phone}`);
                            // Emit order-created so connected dashboards update immediately
                            try {
                                const orderPayload = {
                                    id: orderId,
                                    customerName: customerName,
                                    product: product,
                                    amount: amount,
                                    status: status,
                                    date: new Date().toLocaleDateString()
                                };
                                if (typeof io !== 'undefined') io.emit('order-created', orderPayload);
                            } catch (emitErr) {
                                console.error('Failed to emit order-created for AI-created order', emitErr);
                            }
                            // Automatically start delivery simulation for this newly created order
                            try {
                                startDeliverySimulationForOrder(orderId, (startErr, rider) => {
                                    if (startErr) {
                                        console.error('Auto-start delivery failed for order', orderId, startErr);
                                    } else {
                                        console.log('Auto-started delivery for order', orderId, 'rider:', rider && rider.name);
                                    }
                                });
                            } catch (ex) {
                                console.error('Exception while auto-starting delivery for order', orderId, ex);
                            }

                            resolve({ orderId, product, amount, status });
                        }
                    }
                );
            }
        );
    });
}

app.post("/api/send-message", async (req, res) => {
    let { conversation_id, message, phone } = req.body;

    if (!message) {
        return res.status(400).json({ error: "Missing message." });
    }

    if (!conversation_id && phone) {
        try {
            conversation_id = await getOrCreateConversationByPhone(phone);
        } catch (err) {
            console.error("Failed to create conversation for phone:", phone, err);
            return res.status(500).json({ error: "Unable to create conversation." });
        }
    }

    if (!conversation_id) {
        return res.status(400).json({ error: "Missing conversation_id or phone." });
    }

    disableAIForConversation(conversation_id);
    console.log(`📤 Staff message detected for conversation ${conversation_id}, disabling AI immediately`);

    db.query("SELECT phone FROM conversations WHERE id = ?", [conversation_id], async (err, result) => {
        if (err) return res.sendStatus(500);
        if (!result || result.length === 0) {
            if (phone) {
                try {
                    conversation_id = await getOrCreateConversationByPhone(phone);
                } catch (createErr) {
                    console.error("Failed to create conversation by phone fallback:", createErr);
                    return res.status(500).json({ error: "Conversation not found." });
                }
            } else {
                return res.send("Conversation not found");
            }
        }

        let targetPhone = result && result.length > 0 ? result[0].phone : phone;
        if (!targetPhone) {
            return res.status(400).json({ error: "Missing phone for sending message." });
        }

        // Ensure phone is in E.164 format for WhatsApp (add + if missing)
        if (!targetPhone.startsWith('+')) {
            targetPhone = '+' + targetPhone.replace(/\D/g, '');
        }

        try {
            console.log("Sending WhatsApp message", { conversation_id, targetPhone, message: message.slice(0, 120) });
            const token = await getWhatsAppToken();
            const response = await fetch(
                `https://graph.facebook.com/v18.0/${process.env.PHONE_NUMBER_ID}/messages`,
                {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${token}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        messaging_product: "whatsapp",
                        to: targetPhone,
                        type: "text",
                        text: { body: message }
                    })
                }
            );

            const data = await response.json();
            console.log("WhatsApp response:", data);

            if (!response.ok || (data && data.error)) {
                console.error("WhatsApp API send-message error:", response.status, data);
                let errorMsg = 'WhatsApp API error';
                if (data && data.error) {
                    errorMsg = typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
                } else if (data) {
                    errorMsg = JSON.stringify(data);
                }
                return res.status(response.ok ? 500 : response.status).json({ error: errorMsg });
            }

            // Save to DB
            db.query(
                "INSERT INTO replies (conversation_id, sender, message, user_id, created_at) VALUES (?, ?, ?, ?, NOW())",
                [conversation_id, 'sent', message, req.session ? req.session.userId : null],
                (err) => {
                    if (err) {
                        console.log("MESSAGE INSERT ERROR:", err);
                        return res.status(500).send("Message save failed");
                    }

                    db.query(
                        "INSERT INTO staff_messages (conversation_id, sender, message, user_id, created_at) VALUES (?, ?, ?, ?, NOW())",
                        [conversation_id, 'sent', message, req.session ? req.session.userId : null],
                        (err) => {
                            if (err) {
                                console.log("STAFF_MESSAGE INSERT ERROR:", err);
                                return res.status(500).send("Message save failed");
                            }

                            const messageData = {
                                conversation_id,
                                sender: "sent",
                                message,
                                created_at: new Date().toISOString()
                            };

                            // Emit via Socket.IO with sender name attached
                            emitNewMessageEvent(conversation_id, messageData);
                            res.json({ success: true, message: messageData });
                        }
                    );
                }
            );

        } catch (error) {
            console.log("SEND ERROR:", error);
            res.status(500).json({ error: error.message || 'Send error' });
        }
    });
});

app.post("/api/send-media", upload.single("file"), (req, res) => {
    const { conversation_id, caption } = req.body;
    const file = req.file;
    if (!conversation_id || !file) {
        if (file && file.path) fs.unlink(file.path, () => {});
        return res.status(400).json({ error: "Missing conversation or file." });
    }

    disableAIForConversation(conversation_id);

    db.query("SELECT phone FROM conversations WHERE id = ?", [conversation_id], async (err, result) => {
        if (err) {
            if (file.path) fs.unlink(file.path, () => {});
            return res.sendStatus(500);
        }
        if (!result || result.length === 0) {
            if (file.path) fs.unlink(file.path, () => {});
            return res.status(404).json({ error: "Conversation not found" });
        }

        const phone = result[0].phone;

        // Ensure phone is in E.164 format for WhatsApp (add + if missing)
        let formattedPhone = phone;
        if (!formattedPhone.startsWith('+')) {
            formattedPhone = '+' + formattedPhone.replace(/\D/g, '');
        }

        try {
            const fileBuffer = await fs.promises.readFile(file.path);
            const boundary = "----WhatsAppFormBoundary" + Date.now();
            const parts = [];

            parts.push(Buffer.from(`--${boundary}\r\n`));
            parts.push(Buffer.from(`Content-Disposition: form-data; name="messaging_product"\r\n\r\n`));
            parts.push(Buffer.from(`whatsapp\r\n`));

            parts.push(Buffer.from(`--${boundary}\r\n`));
            parts.push(Buffer.from(`Content-Disposition: form-data; name="type"\r\n\r\n`));
            parts.push(Buffer.from(`${file.mimetype}\r\n`));

            parts.push(Buffer.from(`--${boundary}\r\n`));
            parts.push(Buffer.from(`Content-Disposition: form-data; name="file"; filename="${file.originalname}"\r\n`));
            parts.push(Buffer.from(`Content-Type: ${file.mimetype}\r\n\r\n`));
            parts.push(fileBuffer);
            parts.push(Buffer.from(`\r\n`));
            parts.push(Buffer.from(`--${boundary}--\r\n`));

            const multipartBody = Buffer.concat(parts);
            const token = await getWhatsAppToken();
            const uploadResponse = await fetch(`https://graph.facebook.com/v18.0/${process.env.PHONE_NUMBER_ID}/media`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": `multipart/form-data; boundary=${boundary}`
                },
                body: multipartBody
            });

            const uploadData = await uploadResponse.json();
            if (!uploadResponse.ok || !uploadData.id) {
                throw new Error(JSON.stringify(uploadData));
            }

            const mediaId = uploadData.id;
            const mediaType = file.mimetype.startsWith("image/") ? "image" : "document";
            const messageBody = {
                messaging_product: "whatsapp",
                to: formattedPhone,
                type: mediaType,
                [mediaType]: { id: mediaId }
            };

            if (caption) {
                messageBody[mediaType].caption = caption;
            }
            if (mediaType === "document") {
                messageBody[mediaType].filename = file.originalname;
            }

            const sendResponse = await fetch(`https://graph.facebook.com/v18.0/${process.env.PHONE_NUMBER_ID}/messages`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(messageBody)
            });

            const sendData = await sendResponse.json();
            if (!sendResponse.ok) {
                throw new Error(JSON.stringify(sendData));
            }

            const savedMessage = caption ? `${caption} [file: ${file.originalname}]` : `[file: ${file.originalname}]`;
            db.query(
                "INSERT INTO replies (conversation_id, sender, message, user_id, created_at) VALUES (?, ?, ?, ?, NOW())",
                [conversation_id, 'sent', savedMessage, req.session ? req.session.userId : null],
                (err) => {
                    if (err) {
                        if (file.path) fs.unlink(file.path, () => {});
                        console.log("MESSAGE INSERT ERROR:", err);
                        return res.status(500).json({ error: "Message save failed" });
                    }

                    db.query(
                        "INSERT INTO staff_messages (conversation_id, sender, message, user_id, created_at) VALUES (?, ?, ?, ?, NOW())",
                        [conversation_id, 'sent', savedMessage, req.session ? req.session.userId : null],
                        (err) => {
                            if (file.path) fs.unlink(file.path, () => {});
                            if (err) {
                                console.log("STAFF_MESSAGE INSERT ERROR:", err);
                                return res.status(500).json({ error: "Message save failed" });
                            }

                            const messageData = {
                                conversation_id,
                                sender: "sent",
                                message: savedMessage,
                                created_at: new Date().toISOString()
                            };

                            emitNewMessageEvent(conversation_id, messageData);
                            res.json({ success: true, message: messageData });
                        }
                    );
                }
            );
        } catch (error) {
            console.log("SEND MEDIA ERROR:", error);
            if (file.path) fs.unlink(file.path, () => {});
            res.status(500).json({ error: "Failed to send media." });
        }
    });
});

// ---------------------------
// Customer Webhook
// ---------------------------
app.post("/webhook", async (req, res) => {
    const msg = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!msg) return res.sendStatus(200);

    const metadataPhoneNumberId = req.body.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id;
    const businessPhoneNumberId = metadataPhoneNumberId || process.env.PHONE_NUMBER_ID;
    const msgFrom = msg.from || "";
    const msgTo = msg.to || "";
    const contactWaId = req.body.entry?.[0]?.changes?.[0]?.value?.contacts?.[0]?.wa_id || "";
    const isOutgoingWebhook = businessPhoneNumberId && msgFrom === businessPhoneNumberId;
    const sender = isOutgoingWebhook ? 'sent' : 'received';
    const phone = sender === 'sent' ? (msgTo || contactWaId || msgFrom) : msgFrom;

    let text = msg.text?.body || "";

    // Handle audio messages
    if (msg.audio && !text) {
        try {
            const audioId = msg.audio.id;
            const token = await getWhatsAppToken();
            const audioResponse = await fetch(`https://graph.facebook.com/v18.0/${audioId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const audioData = await audioResponse.json();
            if (audioData.url) {
                // Download audio file
                const audioFetch = await fetch(audioData.url, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const audioBuffer = await audioFetch.arrayBuffer();

                // Transcribe audio (placeholder - in production use Google Speech-to-Text)
                text = await transcribeAudio(audioBuffer);
                console.log(`🎵 Transcribed audio: "${text}"`);
            }
        } catch (error) {
            console.error('Audio transcription error:', error);
            text = "[Audio message - transcription failed]";
        }
    }

    if (!text) {
        text = msg.image?.caption || msg.document?.filename || msg.button?.text || msg.interactive?.type || "[Non-text message]";
    }

    console.log(`\n📩 WEBHOOK MESSAGE RECEIVED:`, {
        phone,
        text,
        sender,
        msgFrom: msg.from,
        msgTo: msg.to,
        contactWaId,
        metadataPhoneNumberId,
        phoneNumberId: process.env.PHONE_NUMBER_ID,
        businessPhoneNumberId,
        isSent: isOutgoingWebhook,
        hasAudio: !!msg.audio
    });

    db.query("SELECT * FROM conversations WHERE phone = ?", [phone], async (err, result) => {
        if (err) return console.log("🔥 REAL DB ERROR:", err);

        if (!result || result.length === 0) {
            // Create new conversation
            const insertConvSql = isPg
                ? 'INSERT INTO conversations (phone, name, platform) VALUES (?, ?, ?) RETURNING id'
                : "INSERT INTO conversations (phone, name, platform) VALUES (?, ?, 'whatsapp')";
            db.query(insertConvSql, [phone, phone, 'whatsapp'], async (err, newConv) => {
                if (err) return console.log("INSERT ERROR:", err);
                const convoId = newConv.insertId;
                if (sender === 'sent') {
                    db.query(
                        "INSERT INTO replies (conversation_id, sender, message, user_id, created_at) VALUES (?, ?, ?, ?, NOW())",
                        [convoId, 'sent', text, null],
                        (err) => {
                            if (err) console.log("MESSAGE INSERT ERROR:", err);
                        }
                    );
                    db.query(
                        "INSERT INTO staff_messages (conversation_id, sender, message, user_id, created_at) VALUES (?, ?, ?, ?, NOW())",
                        [convoId, 'sent', text, null],
                        async (err) => {
                            if (err) {
                                console.log("STAFF_MESSAGE INSERT ERROR:", err);
                                return;
                            }

                            emitNewMessageEvent(convoId, {
                                sender: sender,
                                message: text,
                                created_at: new Date().toISOString()
                            });

                            disableAIForConversation(convoId);
                            console.log(`Agent message received, AI disabled for conversation ${convoId}`);

                            if (text && text.toLowerCase().includes("refund")) {
                                db.query("INSERT INTO escalations (conversation_id, customer_name) VALUES (?, ?)", [convoId, phone], (err) => {
                                    if (err) console.log("ESCALATION INSERT ERROR:", err);
                                });
                            }
                        }
                    );
                } else {
                    db.query(
                        "INSERT INTO messages (conversation_id, sender, message, created_at) VALUES (?, ?, ?, NOW())",
                        [convoId, sender, text],
                        async (err) => {
                            if (err) console.log("MESSAGE INSERT ERROR:", err);
                            else {
                                emitNewMessageEvent(convoId, {
                                    sender: sender,
                                    message: text,
                                    created_at: new Date().toISOString()
                                });

                                if (isCustomerGreeting(text) && isStaffIdleForThreeMinutes(convoId)) {
                                    enableAIForConversation(convoId);
                                }
                                // Only process customer messages for AI response
                                // Check if this is an order confirmation
                                const orderConfirmed = await checkAndSaveOrderConfirmation(phone, convoId, text);
                                const aiAutoAllowed = isAIAutoSendEnabled(convoId);
                                if (orderConfirmed && orderConfirmed.orderId) {
                                    await sendAutoReply(phone, `Great! Your order has been placed. Order ID: ${orderConfirmed.orderId}. We'll prepare and deliver it soon. Thank you!`);
                                } else {
                                    const forceAI = isTicketCreationRequest(text) || isRequestingStaff(text);
                                    if (aiAutoAllowed && (forceAI || shouldAIRespond(convoId))) {
                                        const reply = await getMistralReply(text, phone, convoId);
                                        await sendAutoReply(phone, reply);
                                    } else {
                                        console.log(`AI response skipped for conversation ${convoId} - agent mode is not auto or agent recently active`);
                                    }
                                }

                                // Auto-escalate if refund is mentioned
                                if (text && text.toLowerCase().includes("refund")) {
                                    db.query("INSERT INTO escalations (conversation_id, customer_name) VALUES (?, ?)", [convoId, phone], (err) => {
                                        if (err) console.log("ESCALATION INSERT ERROR:", err);
                                    });
                                }

                                if (sender !== 'sent') {
                                    checkAndCreateTicket(convoId, phone, text);
                                }
                            }
                        }
                    );
                }
            });
        } else {
            const convoId = result[0].id;
            if (sender === 'sent') {
                db.query(
                    "INSERT INTO replies (conversation_id, sender, message, user_id, created_at) VALUES (?, ?, ?, ?, NOW())",
                    [convoId, 'sent', text, null],
                    (err) => {
                        if (err) console.log("MESSAGE INSERT ERROR:", err);
                    }
                );
                db.query(
                    "INSERT INTO staff_messages (conversation_id, sender, message, user_id, created_at) VALUES (?, ?, ?, ?, NOW())",
                    [convoId, 'sent', text, null],
                    async (err) => {
                        if (err) {
                            console.log("STAFF_MESSAGE INSERT ERROR:", err);
                            return;
                        }

                        emitNewMessageEvent(convoId, {
                            sender: sender,
                            message: text,
                            created_at: new Date().toISOString()
                        });

                        disableAIForConversation(convoId);
                        console.log(`Agent message received, AI disabled for conversation ${convoId}`);

                        if (text && text.toLowerCase().includes("refund")) {
                            db.query("INSERT INTO escalations (conversation_id, customer_name) VALUES (?, ?)", [convoId, phone], (err) => {
                                if (err) console.log("ESCALATION INSERT ERROR:", err);
                            });
                        }
                    }
                );
            } else {
                db.query(
                    "INSERT INTO messages (conversation_id, sender, message, created_at) VALUES (?, ?, ?, NOW())",
                    [convoId, sender, text],
                    async (err) => {
                        if (err) console.log("MESSAGE INSERT ERROR:", err);
                        else {
                            emitNewMessageEvent(convoId, {
                                sender: sender,
                                message: text,
                                created_at: new Date().toISOString()
                            });

                            if (isCustomerGreeting(text)) {
                                enableAIForConversation(convoId);
                            }
                            // Only process customer messages for AI response
                            // Check if this is an order confirmation
                            const orderConfirmed = await checkAndSaveOrderConfirmation(phone, convoId, text);
                            const aiAutoAllowed = isAIAutoSendEnabled(convoId);
                            if (orderConfirmed && orderConfirmed.orderId) {
                                await sendAutoReply(phone, `Great! Your order has been placed. Order ID: ${orderConfirmed.orderId}. We'll prepare and deliver it soon. Thank you!`);
                            } else {
                                const forceAI = isTicketCreationRequest(text) || isRequestingStaff(text);
                                if (aiAutoAllowed && (forceAI || shouldAIRespond(convoId))) {
                                    const reply = await getMistralReply(text, phone, convoId);
                                    await sendAutoReply(phone, reply);
                                } else {
                                    console.log(`AI response skipped for conversation ${convoId} - agent mode is not auto or agent recently active`);
                                }
                            }

                            if (text && text.toLowerCase().includes("refund")) {
                                db.query("INSERT INTO escalations (conversation_id, customer_name) VALUES (?, ?)", [convoId, phone], (err) => {
                                    if (err) console.log("ESCALATION INSERT ERROR:", err);
                                });
                            }

                            if (sender !== 'sent') {
                                checkAndCreateTicket(convoId, phone, text);
                            }
                        }
                    }
                );
            }
        }
    });

    res.sendStatus(200);
});

// ---------------------------
// Test endpoint to simulate incoming message
// ---------------------------
// POST /api/test-message?phone=1234567890&message=Hello
app.post("/api/test-message", (req, res) => {
    const phone = req.query.phone || "1234567890";
    const text = req.query.message || "Test message";

    db.query("SELECT * FROM conversations WHERE phone = ?", [phone], async (err, result) => {
        if (err) return res.sendStatus(500);

        if (!result || result.length === 0) {
            // Create new conversation
            const insertConvSql = isPg
                ? 'INSERT INTO conversations (phone, name, platform) VALUES (?, ?, ?) RETURNING id'
                : "INSERT INTO conversations (phone, name, platform) VALUES (?, ?, 'whatsapp')";
            db.query(insertConvSql, [phone, phone, 'whatsapp'], (err, newConv) => {
                if (err) return res.sendStatus(500);
                const convoId = newConv.insertId;
                db.query(
                    "INSERT INTO messages (conversation_id, sender, message, created_at) VALUES (?, 'customer', ?, NOW())",
                    [convoId, text],
                    async (err) => {
                        if (err) return res.sendStatus(500);
                        const messageData = {
                            conversation_id: convoId,
                            sender: "received",
                            message: text,
                            created_at: new Date().toISOString()
                        };
                        emitNewMessageEvent(convoId, messageData);

                        // Check if this is an order confirmation
                        const orderConfirmed = await checkAndSaveOrderConfirmation(phone, convoId, text);
                        const aiAutoAllowed = isAIAutoSendEnabled(convoId);
                        if (orderConfirmed && orderConfirmed.orderId) {
                            await sendAutoReply(phone, `Great! Your order has been placed. Order ID: ${orderConfirmed.orderId}. We'll prepare and deliver it soon. Thank you!`);
                        } else {
                            // Check if AI should respond
                            if (aiAutoAllowed && shouldAIRespond(convoId)) {
                                const reply = await getMistralReply(text, phone, convoId);
                                await sendAutoReply(phone, reply);
                            } else {
                                console.log(`AI response skipped for conversation ${convoId} - agent mode is not auto or agent recently active`);
                            }
                        }
                        res.json({ success: true, conversation_id: convoId });
                    }
                );
            });
        } else {
            const convoId = result[0].id;
            db.query(
                "INSERT INTO messages (conversation_id, sender, message, created_at) VALUES (?, 'customer', ?, NOW())",
                [convoId, text],
                async (err) => {
                    if (err) return res.sendStatus(500);
                    const messageData = {
                        conversation_id: convoId,
                        sender: "received",
                        message: text,
                        created_at: new Date().toISOString()
                    };
                    emitNewMessageEvent(convoId, messageData);

                    if (isCustomerGreeting(text) && isStaffIdleForThreeMinutes(convoId)) {
                        enableAIForConversation(convoId);
                    }
                    const orderConfirmed = await checkAndSaveOrderConfirmation(phone, convoId, text);
                    const aiAutoAllowed = isAIAutoSendEnabled(convoId);
                    if (orderConfirmed && orderConfirmed.orderId) {
                        await sendAutoReply(phone, `Great! Your order has been placed. Order ID: ${orderConfirmed.orderId}. We'll prepare and deliver it soon. Thank you!`);
                    } else {
                        const forceAI = isTicketCreationRequest(text) || isRequestingStaff(text);
                        if (aiAutoAllowed && (forceAI || shouldAIRespond(convoId))) {
                            const reply = await getMistralReply(text, phone, convoId);
                            await sendAutoReply(phone, reply);
                        } else {
                            console.log(`AI response skipped for conversation ${convoId} - agent mode is not auto or agent recently active`);
                        }
                    }
                    res.json({ success: true, conversation_id: convoId });
                }
            );
        }
    });
});

// ---------------------------
// Webhook GET for verification
// ---------------------------
app.get("/webhook", (req, res) => {
    const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode && token === VERIFY_TOKEN) return res.status(200).send(challenge);
    return res.sendStatus(403);
});

// ---------------------------
// Receipts
// ---------------------------
app.post("/api/receipts", (req, res) => {
    const { content } = req.body;
    const insertSql = isPg
        ? 'INSERT INTO receipts (content) VALUES (?) RETURNING id'
        : 'INSERT INTO receipts (content) VALUES (?)';
    db.query(insertSql, [content], (err, result) => {
        if (err) {
            console.error('Error inserting receipt:', err);
            return res.status(500).json({ error: 'Failed to save receipt' });
        }
        const receipt = {
            id: result.insertId,
            content,
            created_at: new Date().toISOString()
        };
        // Emit a socket event so any connected dashboard can display an update instantly
        io.emit("receiptCreated", receipt);
        res.json({ id: result.insertId, success: true });
    });
});

app.get("/api/receipts", (req, res) => {
    db.query("SELECT * FROM receipts ORDER BY created_at DESC", (err, results) => {
        if (err) {
            console.error('Error fetching receipts:', err);
            return res.status(500).json({ error: 'Failed to fetch receipts' });
        }
        res.json(results);
    });
});

// Delete receipt
app.delete("/api/receipts/:id", (req, res) => {
    const { id } = req.params;
    db.query("DELETE FROM receipts WHERE id = ?", [id], (err) => {
        if (err) {
            console.error('Error deleting receipt:', err);
            return res.status(500).json({ error: 'Failed to delete receipt' });
        }
        io.emit("receiptDeleted", { id: Number(id) });
        res.json({ success: true });
    });
});

// ---------------------------
// Tickets
// ---------------------------
// Multipart handler for file uploads from ticket modal (registered first so multer handles multipart requests)
app.post('/api/tickets', upload.array('files'), (req, res, next) => {
    // multer will populate req.body (text fields) and req.files
    if (!req.files || req.files.length === 0) return next();
    try{
        const { ticket_type, subject, customer_name, customer_phone, assignee, priority, status, content, tags } = req.body || {};
        const tagsText = tags ? (Array.isArray(tags) ? JSON.stringify(tags) : tags) : null;
        const slaDueDate = req.body.sla_due ? new Date(req.body.sla_due) : computeSlaDue(assignee, ticket_type);
        const slaDue = slaDueDate.toISOString().slice(0, 19).replace('T', ' ');
        const attachments = (req.files || []).map(f => ({ originalname: f.originalname, filename: f.filename, path: f.path, size: f.size }));
        const insertSql = isPg
            ? `INSERT INTO tickets (ticket_type, subject, customer_name, customer_phone, assignee, priority, status, content, tags, attachments, sla_due) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`
            : `INSERT INTO tickets (ticket_type, subject, customer_name, customer_phone, assignee, priority, status, content, tags, attachments, sla_due) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        db.query(
            insertSql,
            [ticket_type || null, subject || null, customer_name || null, customer_phone || null, assignee || null, priority || null, status || 'Open', content || null, tagsText, JSON.stringify(attachments), slaDue],
            (err, result) => {
                if (err) {
                    console.error('Error inserting ticket with attachments:', err);
                    return res.status(500).json({ error: 'Failed to save ticket' });
                }
                const ticketId = result?.insertId ?? (Array.isArray(result) && result[0]?.id) ?? result?.id ?? null;
                const ticket = { id: ticketId, ticket_type: ticket_type || null, subject, customer_name, customer_phone, assignee, priority, status: status || 'Open', content, tags: tagsText, attachments, sla_due: slaDueDate.toISOString(), created_at: new Date().toISOString() };
                io.emit('ticketCreated', ticket);
                res.json({ id: ticketId, success: true });
            }
        );
    }catch(err){
        console.error('Multipart ticket handler error', err);
        res.status(500).json({ error: 'Failed to save ticket' });
    }
});

// JSON handler for tickets (no files)
app.post("/api/tickets", (req, res) => {
    // Accept richer ticket fields from the dashboard modal (JSON submission)
    const { ticket_type, subject, customer_name, customer_phone, assignee, priority, status, content, tags } = req.body || {};
    const tagsText = Array.isArray(tags) ? JSON.stringify(tags) : (tags || null);
    const slaDueDate = req.body.sla_due ? new Date(req.body.sla_due) : computeSlaDue(assignee, ticket_type);
    const slaDue = slaDueDate.toISOString().slice(0, 19).replace('T', ' ');
    const insertSql = isPg
        ? `INSERT INTO tickets (ticket_type, subject, customer_name, customer_phone, assignee, priority, status, content, tags, sla_due) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`
        : `INSERT INTO tickets (ticket_type, subject, customer_name, customer_phone, assignee, priority, status, content, tags, sla_due) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    db.query(
        insertSql,
        [ticket_type || null, subject || null, customer_name || null, customer_phone || null, assignee || null, priority || null, status || 'Open', content || null, tagsText, slaDue],
        (err, result) => {
            if (err) {
                console.error('Error inserting ticket:', err);
                return res.status(500).json({ error: 'Failed to save ticket' });
            }
            const ticketId = result?.insertId ?? (Array.isArray(result) && result[0]?.id) ?? result?.id ?? null;
            const ticket = {
                id: ticketId,
                ticket_type: ticket_type || null,
                subject: subject || null,
                customer_name: customer_name || null,
                customer_phone: customer_phone || null,
                assignee: assignee || null,
                priority: priority || null,
                status: status || 'Open',
                content: content || null,
                tags: tagsText,
                sla_due: slaDueDate.toISOString(),
                created_at: new Date().toISOString(),
                escalated: 0
            };
            io.emit("ticketCreated", ticket);
            res.json({ id: ticketId, success: true });
        }
    );
});

app.get("/api/tickets", (req, res) => {
    db.query("SELECT * FROM tickets ORDER BY created_at DESC", (err, results) => {
        if (err) {
            console.error('Error fetching tickets:', err);
            return res.status(500).json({ error: 'Failed to fetch tickets' });
        }
        res.json(results);
    });
});

app.delete("/api/tickets/:id", (req, res) => {
    const { id } = req.params;
    db.query("DELETE FROM tickets WHERE id = ?", [id], (err) => {
        if (err) {
            console.error('Error deleting ticket:', err);
            return res.status(500).json({ error: 'Failed to delete ticket' });
        }
        io.emit("ticketDeleted", { id: Number(id) });
        res.json({ success: true });
    });
});

// Bulk delete tickets by IDs
app.post('/api/tickets/delete', (req, res) => {
    const ids = req.body && req.body.ids ? req.body.ids : null;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'No ids provided' });
    // ensure numeric ids
    const nums = ids.map(i => Number(i)).filter(n => !Number.isNaN(n));
    if (nums.length === 0) return res.status(400).json({ error: 'No valid ids' });
    const placeholders = nums.map(() => '?').join(',');
    db.query(`DELETE FROM tickets WHERE id IN (${placeholders})`, nums, (err, result) => {
        if (err) {
            console.error('Error bulk deleting tickets:', err);
            return res.status(500).json({ error: 'Failed to delete tickets' });
        }
        // emit an event for each deleted id
        nums.forEach(id => io.emit('ticketDeleted', { id }));
        res.json({ success: true, deleted: result.affectedRows });
    });
});

// ---------------------------
// Escalate Ticket
// ---------------------------
app.post("/api/escalate-ticket", (req, res) => {
    const { ticket_id, ticket_ids } = req.body || {};
    const ids = Array.isArray(ticket_ids)
        ? ticket_ids.map(id => Number(id)).filter(id => Number.isFinite(id))
        : ticket_id !== undefined && ticket_id !== null
            ? [Number(ticket_id)].filter(id => Number.isFinite(id))
            : [];

    if (ids.length === 0) {
        return res.status(400).json({ error: 'Missing ticket_id or ticket_ids' });
    }

    const placeholders = ids.map(() => '?').join(',');
    db.query(`UPDATE tickets SET escalated = TRUE WHERE id IN (${placeholders})`, ids, (err) => {
        if (err) {
            console.error('Error escalating ticket(s):', err);
            return res.status(500).json({ error: 'Failed to escalate ticket(s)' });
        }
        const notificationPayload = {
            message: ids.length === 1
                ? `Ticket #${ids[0]} escalated and needs attention.`
                : `Tickets ${ids.join(', ')} escalated and need attention.`,
            from: 'System',
            type: 'ticket-escalation',
            ticket_ids: ids,
            time: new Date().toISOString()
        };
        io.emit('staffNotification', notificationPayload);
        ids.forEach(ticket_id => io.emit('ticketEscalated', { ticket_id }));
        res.json({ success: true, escalated_ids: ids });
    });
});

// ---------------------------
// Resolve Ticket
// ---------------------------
app.post("/api/resolve-ticket", (req, res) => {
    const { ticket_id } = req.body;
    if (!req.session || !req.session.user) return res.status(401).json({ error: 'not_logged_in' });
    const resolverName = req.session.user && req.session.user.name ? req.session.user.name : 'Staff';
    db.query("UPDATE tickets SET status = 'Resolved', sla_due = NULL, escalated = ? WHERE id = ?", [false, ticket_id], (err) => {
        if (err) {
            console.error('Error resolving ticket:', err);
            return res.status(500).json({ error: 'Failed to resolve ticket' });
        }
        io.emit("ticketResolved", { ticket_id, resolved_by: resolverName });
        res.json({ success: true, resolved_by: resolverName });
    });
});

// ---------------------------
// Broadcast a staff notification to other online agents (excluding the sender)
// ---------------------------
app.post('/api/broadcast-notification', (req, res) => {
    if (!req.session || !req.session.user) return res.status(401).json({ error: 'not_logged_in' });
    const message = req.body && req.body.message ? String(req.body.message) : '';
    const from = req.session.user && req.session.user.name ? req.session.user.name : 'Staff';
    const payload = { message, from, time: new Date().toISOString() };

    try{
        // Send to all connected onlineAgents except the sender
        const recipients = [];
        for (const [socketId, rec] of onlineAgents.entries()){
            try{
                if (String(rec.userId) === String(req.session.userId)) continue; // skip sender
                io.to(socketId).emit('staffNotification', payload);
                recipients.push({ socketId, userId: rec.userId, name: rec.name });
            }catch(e){ console.error('notify emit error to', socketId, e); }
        }
        console.log('Broadcast notification from', from, 'message="' + message + '" sent to', recipients.length, 'recipients');
        if (recipients.length) console.log('Recipients:', recipients);
        res.json({ success: true, recipients: recipients.length });
    }catch(e){
        console.error('Broadcast notification error', e);
        res.status(500).json({ error: 'broadcast_failed' });
    }
});

// ---------------------------
// Escalate Receipt
// ---------------------------
app.post("/api/escalate-receipt", (req, res) => {
    const { receipt_id } = req.body;
    db.query("UPDATE receipts SET escalated = TRUE WHERE id = ?", [receipt_id], (err) => {
        if (err) {
            console.error('Error escalating receipt:', err);
            return res.status(500).json({ error: 'Failed to escalate receipt' });
        }
        io.emit("receiptEscalated", { receipt_id });
        res.json({ success: true });
    });
});

// ---------------------------
// Escalations
// ---------------------------
app.post("/api/escalate", (req, res) => {
    const { conversation_id, name } = req.body;
    const checkSql = "SELECT * FROM escalations WHERE conversation_id = ?";
    db.query(checkSql, [conversation_id], (err, result) => {
        if (result.length > 0) return res.json({ success: true, message: "Already escalated" });

        const insertSql = "INSERT INTO escalations (conversation_id, customer_name) VALUES (?, ?)";
        db.query(insertSql, [conversation_id, name], (err) => {
            if (err) return res.status(500).send("DB error");
            res.json({ success: true });
        });
    });
});

// Claim an escalation (staff accepts the conversation)
app.post('/api/claim-escalation', (req, res) => {
    const { conversation_id, staff_name } = req.body;
    const sql = "UPDATE escalations SET claimed_by = ?, claim_time = CURRENT_TIMESTAMP, alarm_active = 0 WHERE conversation_id = ?";
    db.query(sql, [staff_name || null, conversation_id], (err) => {
        if (err) return res.status(500).json({ error: 'DB error' });
        // clear any existing snooze timers
        if (escalationTimers.has(conversation_id)) {
            clearTimeout(escalationTimers.get(conversation_id));
            escalationTimers.delete(conversation_id);
        }
        io.emit('escalationClaimed', { conversation_id, claimed_by: staff_name });
        io.emit('stopAlarm', { conversation_id });
        res.json({ success: true });
    });
});

// Snooze an escalation for N seconds (stop alarm temporarily)
app.post('/api/snooze-escalation', (req, res) => {
    const { conversation_id, staff_name, seconds } = req.body;
    const snoozeSeconds = Number(seconds) || 60;
    const updateSql = "UPDATE escalations SET snoozed_until = DATE_ADD(NOW(), INTERVAL ? SECOND), alarm_active = 0 WHERE conversation_id = ?";
    db.query(updateSql, [snoozeSeconds, conversation_id], (err) => {
        if (err) return res.status(500).json({ error: 'DB error' });
        // clear any existing timer first
        if (escalationTimers.has(conversation_id)) {
            clearTimeout(escalationTimers.get(conversation_id));
            escalationTimers.delete(conversation_id);
        }
        // set timer to reactivate alarm after snooze
        const t = setTimeout(() => {
            // Reactivate alarm if still not claimed
            db.query('SELECT claimed_by FROM escalations WHERE conversation_id = ?', [conversation_id], (qErr, rows) => {
                if (qErr) return console.log('Error checking claimed status after snooze:', qErr);
                if (rows && rows[0] && !rows[0].claimed_by) {
                    db.query('UPDATE escalations SET alarm_active = 1, snoozed_until = NULL WHERE conversation_id = ?', [conversation_id], (uErr) => {
                        if (uErr) return console.log('Error reactivating escalation alarm:', uErr);
                        io.emit('escalationRaised', { conversationId: conversation_id });
                        io.emit('handoffAlert', { conversationId: conversation_id });
                    });
                }
            });
            escalationTimers.delete(conversation_id);
        }, snoozeSeconds * 1000);
        escalationTimers.set(conversation_id, t);

        io.emit('escalationSnoozed', { conversation_id, by: staff_name, seconds: snoozeSeconds });
        io.emit('stopAlarm', { conversation_id });
        res.json({ success: true });
    });
});

app.get("/api/escalations", (req, res) => {
    db.query(`
        SELECT e.*, c.phone, c.name, c.created_at
        FROM escalations e
        JOIN conversations c ON e.conversation_id = c.id
        ORDER BY e.escalated_at DESC
    `, (err, results) => {
        if (err) return res.status(500).json({ error: "Database error" });
        res.json(results);
    });
});

app.delete("/api/escalate/:conversation_id", (req, res) => {
    const convoId = req.params.conversation_id;
    db.query("DELETE FROM escalations WHERE conversation_id = ?", [convoId], (err) => {
        if (err) return res.status(500).send("DB error");
        res.json({ success: true });
    });
});

// Resolve escalation
app.post("/api/resolve", (req, res) => {
    const { conversation_id } = req.body;
    // Delete from escalations
    db.query("DELETE FROM escalations WHERE conversation_id = ?", [conversation_id], (err) => {
        if (err) return res.status(500).json({ error: "DB error" });
        // Insert into resolved
        db.query("INSERT INTO resolved (conversation_id) VALUES (?)", [conversation_id], (err) => {
            if (err) return res.status(500).json({ error: "DB error" });
            res.json({ success: true });
        });
    });
});

app.get("/api/resolved", (req, res) => {
    db.query(`
        SELECT r.*, c.phone, c.name, c.created_at
        FROM resolved r
        JOIN conversations c ON r.conversation_id = c.id
        ORDER BY r.resolved_at DESC
    `, (err, results) => {
        if (err) return res.status(500).json({ error: "Database error" });
        res.json(results);
    });
});

app.post("/api/refund", (req, res) => {
    const { conversation_id, name } = req.body;
    db.query("DELETE FROM escalations WHERE conversation_id = ?", [conversation_id], (err) => {
        if (err) return res.status(500).json({ error: "DB error" });
        db.query("INSERT INTO resolved (conversation_id) VALUES (?)", [conversation_id], (resolvedErr) => {
            if (resolvedErr) {
                console.warn('Resolved insert failed, continuing to refund insert:', resolvedErr);
            }
            db.query(
                "INSERT INTO refunds (conversation_id, customer_name) VALUES (?, ?)",
                [conversation_id, name || null],
                (err) => {
                    if (err) return res.status(500).json({ error: "DB error" });
                    res.json({ success: true });
                }
            );
        });
    });
});

app.post("/api/delivery-issue", (req, res) => {
    const { conversation_id, name } = req.body;
    db.query("DELETE FROM escalations WHERE conversation_id = ?", [conversation_id], (err) => {
        if (err) return res.status(500).json({ error: "DB error" });
        db.query("INSERT INTO resolved (conversation_id) VALUES (?)", [conversation_id], (resolvedErr) => {
            if (resolvedErr) {
                console.warn('Resolved insert failed, continuing to delivery insert:', resolvedErr);
            }
            db.query(
                "INSERT INTO delivery_issues (conversation_id, customer_name) VALUES (?, ?)",
                [conversation_id, name || null],
                (err) => {
                    if (err) return res.status(500).json({ error: "DB error" });
                    res.json({ success: true });
                }
            );
        });
    });
});

app.get("/api/refunds", (req, res) => {
    db.query(`
        SELECT f.*, c.phone, c.name, c.platform
        FROM refunds f
        LEFT JOIN conversations c ON f.conversation_id = c.id
        ORDER BY f.refunded_at DESC
    `, (err, results) => {
        if (err) {
            console.error('Refunds query error:', err);
            return res.status(500).json({ error: err.message || "Database error" });
        }
        res.json(results);
    });
});

app.get("/api/delivery-issues", (req, res) => {
    db.query(`
        SELECT d.*, c.phone, c.name, c.platform
        FROM delivery_issues d
        LEFT JOIN conversations c ON d.conversation_id = c.id
        ORDER BY d.reported_at DESC
    `, (err, results) => {
        if (err) {
            console.error('Delivery issues query error:', err);
            return res.status(500).json({ error: err.message || "Database error" });
        }
        res.json(results);
    });
});

// ---------------------------
// Orders
// ---------------------------
app.get('/api/orders/:phone', (req, res) => {
    const phone = req.params.phone;
    
    db.query(
        'SELECT * FROM orders WHERE phone = ? ORDER BY order_date DESC LIMIT 10',
        [phone],
        (err, results) => {
            if (err) return res.status(500).json({ error: "Database error" });
            res.json(results);
        }
    );
});

app.get('/api/orders-summary/:phone', (req, res) => {
    const phone = req.params.phone;
    
    db.query(
        'SELECT COUNT(*) as total_orders, SUM(total_amount) as total_spent FROM orders WHERE phone = ?',
        [phone],
        (err, results) => {
            if (err) return res.status(500).json({ error: "Database error" });
            res.json(results[0]);
        }
    );
});

app.get('/api/dashboard-stats', (req, res) => {
    db.query('SELECT COUNT(*) AS orders FROM orders', (err, results) => {
        if (err) {
            console.error('Error fetching dashboard stats:', err);
            return res.status(500).json({ error: "Database error" });
        }
        res.json({ orders: Number(results[0]?.orders || 0) });
    });
});

app.get('/api/dashboard-revenue', (req, res) => {
    const query = isPg
        ? `
            SELECT
              COALESCE(SUM(CASE WHEN order_date >= DATE_TRUNC('month', CURRENT_DATE) THEN COALESCE(total_amount, amount, 0) ELSE 0 END), 0) AS revenue,
              COALESCE(SUM(CASE WHEN order_date >= CURRENT_DATE THEN COALESCE(total_amount, amount, 0) ELSE 0 END), 0) AS today,
              COALESCE(SUM(CASE WHEN order_date >= CURRENT_DATE - INTERVAL '1 day' AND order_date < CURRENT_DATE THEN COALESCE(total_amount, amount, 0) ELSE 0 END), 0) AS yesterday
            FROM orders
        `
        : `
            SELECT
              COALESCE(SUM(CASE WHEN order_date >= DATE_FORMAT(CURDATE(), '%Y-%m-01') THEN COALESCE(total_amount, amount, 0) ELSE 0 END), 0) AS revenue,
              COALESCE(SUM(CASE WHEN order_date >= CURDATE() THEN COALESCE(total_amount, amount, 0) ELSE 0 END), 0) AS today,
              COALESCE(SUM(CASE WHEN order_date >= DATE_SUB(CURDATE(), INTERVAL 1 DAY) AND order_date < CURDATE() THEN COALESCE(total_amount, amount, 0) ELSE 0 END), 0) AS yesterday
            FROM orders
        `;

    db.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching dashboard revenue:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        const row = Array.isArray(results) ? results[0] : results?.rows?.[0] || {};
        res.json({
            revenue: Number(row.revenue || row.amount || 0),
            today: Number(row.today || 0),
            yesterday: Number(row.yesterday || 0)
        });
    });
});

app.get('/api/dashboard-snapshot/instant', (req, res) => {
    res.json({ data: dashboardSnapshots.get('instant') || null });
});

app.post('/api/dashboard-snapshot', express.json(), (req, res) => {
    const { name, data } = req.body;
    if (!name || !data) {
        return res.status(400).json({ error: 'Missing snapshot name or data' });
    }
    dashboardSnapshots.set(name, { ...data, saved_at: new Date().toISOString() });
    res.json({ success: true, data: dashboardSnapshots.get(name) });
});

// Get all orders (for Orders page)
app.get('/api/orders', (req, res) => {
    db.query(
        'SELECT id, order_id, customer_name, phone, product, amount, COALESCE(total_amount, amount) AS total_amount, status, order_date FROM orders ORDER BY order_date DESC',
        (err, results) => {
            if (err) {
                console.error('Error fetching orders:', err);
                return res.status(500).json({ error: "Database error" });
            }
            // Format results for frontend
            const formattedResults = results.map(order => ({
                id: order.order_id,
                customerName: order.customer_name,
                product: order.product,
                amount: parseFloat(order.total_amount) || 0,
                status: order.status,
                date: order.order_date ? new Date(order.order_date).toISOString() : null
            }));
            res.json(formattedResults);
        }
    );
});

// Create new order
app.post('/api/orders', (req, res) => {
    // Accept both legacy single-item payloads and new multi-item payloads
    const { customerName, product, menuItemId, quantity, amount, status, items } = req.body;

    // Basic validation: require customerName and amount (amount can be 0)
    if (!customerName || (amount === undefined || amount === null)) {
        return res.status(400).json({ error: "Missing required fields: customerName, amount" });
    }

    // Generate order ID
    const orderId = `ORD-${Date.now()}`;

    // If `items` array provided, format a combined product display and compute total quantity
    let productDisplay = '';
    let totalQuantity = 0;
    if (Array.isArray(items) && items.length > 0) {
        productDisplay = items.map(it => {
            const q = Number(it.quantity || 1);
            totalQuantity += q;
            // Format: "2x Small Pizza" for qty > 1, "Small Pizza" for qty === 1
            return q > 1 ? `${q}x ${it.name}` : it.name;
        }).join(', ');
    } else {
        totalQuantity = Number(quantity) || 0;
        productDisplay = totalQuantity ? `${product} x${totalQuantity}` : (product || '');
    }

    const now = new Date();
    const insertSql = isPg
        ? 'INSERT INTO orders (order_id, customer_name, phone, product, amount, total_amount, status, order_date) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id'
        : 'INSERT INTO orders (order_id, customer_name, phone, product, amount, total_amount, status, order_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';

    db.query(
        insertSql,
        [orderId, customerName, null, productDisplay, amount, amount, status || 'pending', now],
        (err, result) => {
            if (err) {
                console.error('Error creating order:', err);
                return res.status(500).json({ error: "Database error" });
            }

            const responsePayload = { success: true, orderId, id: result.insertId || result.rows?.[0]?.id };

            reduceMenuStock(items, (stockErr) => {
                if (stockErr) {
                    console.error('Error reducing stock for order:', stockErr);
                }
                startDeliverySimulationForOrder(orderId, (deliveryErr) => {
                    if (deliveryErr) {
                        console.error('Failed to auto-start delivery for order:', orderId, deliveryErr);
                    }
                    res.json(responsePayload);
                });
            });
        }
    );
});

// Update order status
app.put('/api/orders/:orderId', isAuthenticated, (req, res) => {
    const { orderId } = req.params;
    const { status } = req.body;
    
    if (!status) {
        return res.status(400).json({ error: "Status is required" });
    }

    db.query(
        'UPDATE orders SET status = ? WHERE order_id = ?',
        [status, orderId],
        (err, result) => {
            if (err) {
                console.error('Error updating order:', err);
                return res.status(500).json({ error: "Database error" });
            }
            res.json({ success: true, message: "Order updated" });
        }
    );
});

// Debug endpoint - see all orders in database
app.get('/api/debug/all-orders', (req, res) => {
    db.query('SELECT * FROM orders ORDER BY order_date DESC LIMIT 20', (err, results) => {
        if (err) return res.status(500).json({ error: "Database error" });
        res.json(results);
    });
});

// ---------------------------
// Delivery Tracking System
// ---------------------------

// Get tracking info for an order
app.get('/api/tracking/:orderId', (req, res) => {
    const orderId = req.params.orderId;
    
    db.query(
        `SELECT o.id as order_id_num, o.order_id, o.customer_name, o.phone, o.product, o.amount, o.total_amount, o.status, o.order_date, o.conversation_id,
         d.id as delivery_id, d.rider_name, d.vehicle, d.current_lat, d.current_lng, d.customer_lat, d.customer_lng, d.delivery_status, 
         d.order_confirmed_time, d.rider_assigned_time, d.picked_up_time, d.in_transit_time, d.arriving_time, d.delivered_time
         FROM orders o 
         LEFT JOIN deliveries d ON o.id = d.order_id 
         WHERE o.order_id = ?`,
        [orderId],
        (err, results) => {
            if (err) {
                console.error('Tracking query error:', err);
                return res.status(500).json({ error: "Database error" });
            }
            
            if (!results || results.length === 0) {
                return res.status(404).json({ error: "Order not found" });
            }
            
            const order = results[0];
            res.json({
                id: order.order_id_num,
                order_id: order.order_id,
                customer_name: order.customer_name,
                phone: order.phone,
                product: order.product,
                total_amount: order.total_amount,
                status: order.status,
                order_date: order.order_date,
                delivery: order.delivery_status ? {
                    id: order.delivery_id,
                    status: order.delivery_status || 'pending',
                    rider_name: order.rider_name || 'Assigned Rider',
                    vehicle: order.vehicle || 'Motorcycle',
                    current_lat: order.current_lat,
                    current_lng: order.current_lng,
                    customer_lat: order.customer_lat,
                    customer_lng: order.customer_lng,
                    order_confirmed_time: order.order_confirmed_time,
                    rider_assigned_time: order.rider_assigned_time,
                    picked_up_time: order.picked_up_time,
                    in_transit_time: order.in_transit_time,
                    arriving_time: order.arriving_time,
                    delivered_time: order.delivered_time
                } : null
            });
        }
    );
});

// Get all active deliveries
app.get('/api/deliveries/active', (req, res) => {
    db.query(
        `SELECT d.id, d.order_id, o.order_id as order_code, o.status as order_status, d.rider_name, d.vehicle, d.current_lat, d.current_lng, d.customer_lat, d.customer_lng, d.delivery_status 
         FROM deliveries d 
         LEFT JOIN orders o ON d.order_id = o.id 
         WHERE d.delivery_status != 'delivered' AND d.delivery_status != 'cancelled'
         ORDER BY d.updated_at DESC`,
        (err, results) => {
            if (err) {
                console.error('Active deliveries query error:', err);
                return res.status(500).json({ error: "Database error" });
            }
            
            const deliveries = (results || []).map(d => ({
                id: d.id,
                order_id: d.order_code,
                rider_name: d.rider_name,
                vehicle: d.vehicle,
                current_lat: parseFloat(d.current_lat),
                current_lng: parseFloat(d.current_lng),
                customer_lat: parseFloat(d.customer_lat),
                customer_lng: parseFloat(d.customer_lng),
                delivery_status: d.delivery_status || 'pending',
                order_status: d.order_status || 'pending'
            }));
            
            res.json(deliveries);
        }
    );
});

const deliveryTimers = new Map();

function clearDeliveryTimers(deliveryId) {
    const timers = deliveryTimers.get(deliveryId);
    if (timers) {
        timers.forEach((timer) => clearTimeout(timer));
        deliveryTimers.delete(deliveryId);
    }
}

function broadcastDeliveryUpdate(orderId, callback) {
    db.query(`SELECT o.*, d.* FROM orders o LEFT JOIN deliveries d ON o.id = d.order_id WHERE o.order_id = ?`, [orderId], (err, results) => {
        if (err) return callback(err);
        if (!results || results.length === 0) return callback(new Error('Order not found'));
        const order = results[0];
        const responseData = {
            id: order.id,
            order_id: order.order_id,
            customer_name: order.customer_name,
            total_amount: order.total_amount,
            items: order.items,
            delivery: order.delivery_status ? {
                status: order.delivery_status,
                rider_name: order.rider_name,
                vehicle: order.vehicle,
                current_lat: order.current_lat,
                current_lng: order.current_lng,
                customer_lat: order.customer_lat,
                customer_lng: order.customer_lng,
                order_confirmed_time: order.order_confirmed_time,
                rider_assigned_time: order.rider_assigned_time,
                picked_up_time: order.picked_up_time,
                in_transit_time: order.in_transit_time,
                arriving_time: order.arriving_time,
                delivered_time: order.delivered_time
            } : null
        };
        io.emit('delivery-update', responseData);
        callback(null, responseData);
    });
}

function updateDeliveryStatus(deliveryId, orderDbId, orderId, newStatus, timeField, callback) {
    const queries = [];
    const params = [];

    if (timeField) {
        queries.push(`${timeField} = NOW()`);
    }
    queries.push(`delivery_status = ?`);
    params.push(newStatus, deliveryId);

    const sql = `UPDATE deliveries SET ${queries.join(', ')} WHERE id = ?`;
    db.query(sql, params, (err) => {
        if (err) return callback(err);
        db.query(`UPDATE orders SET status = ? WHERE id = ?`, [newStatus, orderDbId], (err) => {
            if (err) console.error('Failed to update order status:', err);
            broadcastDeliveryUpdate(orderId, () => callback(null));
        });
    });
}

function moveRiderTowardsCustomer(deliveryId, orderId, intervalRef) {
    db.query('SELECT * FROM deliveries WHERE id = ?', [deliveryId], (err, results) => {
        if (err || !results || results.length === 0) {
            clearInterval(intervalRef);
            return;
        }

        const delivery = results[0];
        const currentLat = parseFloat(delivery.current_lat);
        const currentLng = parseFloat(delivery.current_lng);
        const customerLat = parseFloat(delivery.customer_lat);
        const customerLng = parseFloat(delivery.customer_lng);
        const distance = Math.sqrt(Math.pow(customerLat - currentLat, 2) + Math.pow(customerLng - currentLng, 2));
        const step = 0.0004;

        if (distance <= step) {
            db.query(`UPDATE deliveries SET current_lat = ?, current_lng = ? WHERE id = ?`, [customerLat, customerLng, deliveryId], (err) => {
                if (err) console.error('Failed to update rider location:', err);
                broadcastDeliveryUpdate(orderId, () => {});
            });
            clearInterval(intervalRef);
            return;
        }

        const newLat = currentLat + ((customerLat - currentLat) * (step / distance));
        const newLng = currentLng + ((customerLng - currentLng) * (step / distance));
        db.query(`UPDATE deliveries SET current_lat = ?, current_lng = ? WHERE id = ?`, [newLat, newLng, deliveryId], (err) => {
            if (err) {
                console.error('Failed to update rider location:', err);
                return;
            }
            broadcastDeliveryUpdate(orderId, () => {});
        });
    });
}

function scheduleDeliveryLifecycle(deliveryId, orderId, orderDbId, customerLat, customerLng) {
    clearDeliveryTimers(deliveryId);
    const timers = [];
    deliveryTimers.set(deliveryId, timers);

    const assignDelay = 20 + Math.floor(Math.random() * 15); // 20-35 seconds
    const pickupDelay = assignDelay + 90 + Math.floor(Math.random() * 45); // 1.5-2.25 min after assign
    const transitDelay = pickupDelay + 35 + Math.floor(Math.random() * 25); // 35-60 sec after pickup
    const arrivingDelay = transitDelay + 180 + Math.floor(Math.random() * 80); // 3-4.5 min after in transit
    const deliveredDelay = arrivingDelay + 80 + Math.floor(Math.random() * 40); // 1.5-2.5 min after arriving

    // Rider assigned
    timers.push(setTimeout(() => {
        updateDeliveryStatus(deliveryId, orderDbId, orderId, 'rider_assigned', 'rider_assigned_time', () => {});
    }, assignDelay * 1000));

    // Food picked up after rider assignment
    timers.push(setTimeout(() => {
        updateDeliveryStatus(deliveryId, orderDbId, orderId, 'picked_up', 'picked_up_time', () => {});
    }, pickupDelay * 1000));

    // In transit after pickup
    timers.push(setTimeout(() => {
        updateDeliveryStatus(deliveryId, orderDbId, orderId, 'in_transit', 'in_transit_time', () => {
            const movementInterval = setInterval(() => moveRiderTowardsCustomer(deliveryId, orderId, movementInterval), 2500);
            timers.push(movementInterval);
        });
    }, transitDelay * 1000));

    // Arriving soon
    timers.push(setTimeout(() => {
        updateDeliveryStatus(deliveryId, orderDbId, orderId, 'arriving', 'arriving_time', () => {});
    }, arrivingDelay * 1000));

    // Delivered
    timers.push(setTimeout(() => {
        updateDeliveryStatus(deliveryId, orderDbId, orderId, 'delivered', 'delivered_time', () => {
            clearDeliveryTimers(deliveryId);
        });
    }, deliveredDelay * 1000));
}

function startDeliverySimulationForOrder(orderId, callback) {
    db.query('SELECT * FROM orders WHERE order_id = ?', [orderId], (err, results) => {
        if (err || !results || results.length === 0) {
            return callback(err || new Error('Order not found'));
        }

        const order = results[0];
        const restaurantLat = 9.0765;
        const restaurantLng = 7.3986;
        const customerLat = 9.0865 + (Math.random() - 0.5) * 0.1;
        const customerLng = 7.4086 + (Math.random() - 0.5) * 0.1;

        const riders = [
            { name: 'Chioma Adeyemi', vehicle: 'Motorcycle' },
            { name: 'Tunde Okafor', vehicle: 'Motorcycle' },
            { name: 'Zainab Hassan', vehicle: 'Motorcycle' }
        ];
        const rider = riders[Math.floor(Math.random() * riders.length)];

        const insertSql = isPg
            ? `INSERT INTO deliveries (order_id, rider_name, vehicle, current_lat, current_lng, customer_lat, customer_lng, delivery_status, order_confirmed_time) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW()) RETURNING id`
            : `INSERT INTO deliveries (order_id, rider_name, vehicle, current_lat, current_lng, customer_lat, customer_lng, delivery_status, order_confirmed_time) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`;
        db.query(
            insertSql,
            [order.id, rider.name, rider.vehicle, restaurantLat, restaurantLng, customerLat, customerLng, 'order_confirmed'],
            (err, result) => {
                if (err) {
                    console.error('Delivery start error:', err);
                    return callback(err);
                }
                const deliveryId = result.insertId;
                scheduleDeliveryLifecycle(deliveryId, orderId, order.id, customerLat, customerLng);
                callback(null, rider);
            }
        );
    });
}

// Start delivery simulation for an order
app.post('/api/delivery/start', (req, res) => {
    const orderId = req.body.order_id;

    startDeliverySimulationForOrder(orderId, (err, rider) => {
        if (err) {
            if (err.message === 'Order not found') {
                return res.status(404).json({ error: 'Order not found' });
            }
            return res.status(500).json({ error: 'Database error' });
        }

        res.json({ success: true, message: 'Delivery started', rider });
    });
});

// Update rider location during delivery
app.post('/api/delivery/update-location', (req, res) => {
    const orderId = req.body.order_id;
    
    db.query('SELECT * FROM deliveries WHERE order_id = (SELECT id FROM orders WHERE order_id = ?)', [orderId], (err, results) => {
        if (err || !results || results.length === 0) {
            return res.status(404).json({ error: "Delivery not found" });
        }
        
        const delivery = results[0];
        const currentLat = parseFloat(delivery.current_lat);
        const currentLng = parseFloat(delivery.current_lng);
        const customerLat = parseFloat(delivery.customer_lat);
        const customerLng = parseFloat(delivery.customer_lng);
        
        // Move rider toward customer location
        const distance = Math.sqrt(Math.pow(customerLat - currentLat, 2) + Math.pow(customerLng - currentLng, 2));
        const step = Math.max(0.0003, Math.min(0.0015, distance * 0.18));

        let newLat = currentLat;
        let newLng = currentLng;
        let newStatus = delivery.delivery_status;
        let updateFields = [];

        if (delivery.delivery_status === 'picked_up' || delivery.delivery_status === 'in_transit' || delivery.delivery_status === 'arriving') {
            if (distance > step) {
                newLat = currentLat + (customerLat - currentLat) * (step / distance);
                newLng = currentLng + (customerLng - currentLng) * (step / distance);

                if (delivery.delivery_status === 'picked_up') {
                    newStatus = 'in_transit';
                    updateFields.push(`in_transit_time = NOW()`);
                } else if (delivery.delivery_status === 'in_transit' && distance < 1.2) {
                    newStatus = 'arriving';
                    if (delivery.delivery_status !== 'arriving') {
                        updateFields.push(`arriving_time = NOW()`);
                    }
                } else {
                    newStatus = delivery.delivery_status;
                }
            } else {
                newLat = customerLat;
                newLng = customerLng;
                newStatus = 'delivered';
                if (delivery.delivery_status !== 'delivered') {
                    updateFields.push(`arriving_time = NOW()`);
                    updateFields.push(`delivered_time = NOW()`);
                }
            }
        } else {
            // Rider waiting for assignment or pickup
            newStatus = delivery.delivery_status;
        }

        // Update only if changed
        if (newStatus !== delivery.delivery_status && !updateFields.includes(`${newStatus}_time = NOW()`)) {
            if (newStatus === 'in_transit' && delivery.delivery_status !== 'in_transit') {
                updateFields.push(`in_transit_time = NOW()`);
            } else if (newStatus === 'arriving' && delivery.delivery_status !== 'arriving') {
                updateFields.push(`arriving_time = NOW()`);
            }
        }
        
        const fieldsStr = updateFields.length > 0 ? ', ' + updateFields.join(', ') : '';
        
        db.query(
            `UPDATE deliveries SET current_lat = ?, current_lng = ?, delivery_status = ? ${fieldsStr} 
             WHERE id = ?`,
            [newLat, newLng, newStatus, delivery.id],
            (err) => {
                if (err) {
                    console.error('Location update error:', err);
                    return res.status(500).json({ error: "Database error" });
                }
                
                // Fetch updated delivery
                db.query(`SELECT o.*, d.* FROM orders o LEFT JOIN deliveries d ON o.id = d.order_id WHERE o.order_id = ?`, [orderId], (err, updated) => {
                    if (err) return res.status(500).json({ error: "Database error" });
                    
                    const order = updated[0];
                    const responseData = {
                        id: order.id,
                        order_id: order.order_id,
                        customer_name: order.customer_name,
                        total_amount: order.total_amount,
                        items: order.items,
                        delivery: {
                            status: order.delivery_status,
                            rider_name: order.rider_name,
                            current_lat: order.current_lat,
                            current_lng: order.current_lng,
                            customer_lat: order.customer_lat,
                            customer_lng: order.customer_lng
                        }
                    };
                    
                    // Broadcast update via Socket.io
                    io.emit('delivery-update', responseData);
                    res.json(responseData);
                });
            }
        );
    });
});

// Complete delivery
app.post('/api/delivery/complete', (req, res) => {
    const orderId = req.body.order_id;
    
    db.query('SELECT id FROM orders WHERE order_id = ?', [orderId], (err, results) => {
        if (err || !results || results.length === 0) {
            return res.status(404).json({ error: "Order not found" });
        }
        
        const orderId_db = results[0].id;
        
        db.query(
            `UPDATE deliveries SET delivery_status = ?, delivered_time = NOW() WHERE order_id = ?`,
            ['delivered', orderId_db],
            (err) => {
                if (err) {
                    return res.status(500).json({ error: "Database error" });
                }
                
                // Also update order status
                db.query(`UPDATE orders SET status = ? WHERE id = ?`, ['delivered', orderId_db], (err) => {
                    if (err) console.error('Order status update error:', err);
                });
                
                res.json({ success: true, message: "Delivery completed" });
            }
        );
    });
});

// ---------------------------
// Settings
// ---------------------------
app.get('/api/settings', (req, res) => {
    const userId = req.session.userId;
    if (!userId) return res.json({});
    
    // Get settings
    db.query('SELECT * FROM settings WHERE user_id = ?', [userId], (err, settings) => {
        if (err) {
            console.error('GET /api/settings error:', err);
            return res.json({});
        }
        
        const settingsData = settings && settings[0] ? settings[0] : {};
        
        // Get latest avatar URL
        const avatarQuery = isPg
            ? 'SELECT url FROM user_avatars WHERE user_id = ? ORDER BY created_at DESC LIMIT 1'
            : 'SELECT url FROM user_avatars WHERE user_id = ? ORDER BY created_at DESC LIMIT 1';
        
        db.query(avatarQuery, [userId], (err2, avatarResult) => {
            if (err2) {
                console.error('Error fetching avatar:', err2);
                return res.json(settingsData);
            }
            
            if (avatarResult && avatarResult[0] && avatarResult[0].url) {
                settingsData.avatar_url = avatarResult[0].url;
            }
            
            res.json(settingsData);
        });
    });
});

app.post('/api/settings', (req, res) => {
    const userId = req.session.userId;
    const data = req.body;
    const query = `
        INSERT INTO settings 
        (user_id, displayName, email, autoReply, chatEnabled, msgAlert, ticketAlert, soundAlert, autopilotMode, priority, autoAssign, theme)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          displayName = VALUES(displayName),
          email = VALUES(email),
          autoReply = VALUES(autoReply),
          chatEnabled = VALUES(chatEnabled),
          msgAlert = VALUES(msgAlert),
          ticketAlert = VALUES(ticketAlert),
          soundAlert = VALUES(soundAlert),
          autopilotMode = VALUES(autopilotMode),
          priority = VALUES(priority),
          autoAssign = VALUES(autoAssign),
          theme = VALUES(theme)
    `;
    db.query(query, [
        userId,
        data.displayName,
        data.email,
        data.autoReply,
        data.chatEnabled,
        data.msgAlert,
        data.ticketAlert,
        data.soundAlert,
        data.autopilotMode,
        data.priority,
        data.autoAssign,
        data.theme || 'Light'
    ], (err) => {
        if (err) return res.sendStatus(500);
        res.sendStatus(200);
    });
});

// Upload avatar image for current user
function handleAvatarUpload(req, res, next) {
    upload.single('avatar')(req, res, (err) => {
        if (err) {
            console.error('Multer avatar upload error', err);
            return res.status(500).json({ error: 'upload_error', message: err.message });
        }
        next();
    });
}

app.post('/api/settings/avatar', isAuthenticated, handleAvatarUpload, (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'no_file' });
        const url = `/uploads/${req.file.filename}`;
        const userId = req.session.userId || (req.session.user && req.session.user.id);
        if (!userId) return res.status(401).json({ error: 'not_logged_in' });
        // store avatar metadata in user_avatars table
        const insertSql = isPg
            ? 'INSERT INTO user_avatars (user_id, filename, url) VALUES (?, ?, ?) RETURNING id'
            : 'INSERT INTO user_avatars (user_id, filename, url) VALUES (?, ?, ?)';
        db.query(insertSql, [userId, req.file.filename, url], (err, result) => {
            if (err) {
                console.error('Error inserting into user_avatars', err);
                return res.status(500).json({ error: 'db_error', message: err.message || 'Failed to save avatar metadata' });
            }
            const avatarId = result?.insertId ?? (Array.isArray(result) && result[0] && result[0].id) ?? null;
            // Return success - avatar is stored in user_avatars table
            // GET /api/settings will fetch it from there
            res.json({ success: true, url, avatarId });
        });
    } catch (e) {
        console.error('avatar upload error', e);
        res.status(500).json({ error: 'internal', message: e.message });
    }
});

// ---------------------------
// Create HTTP server & Socket.IO
// ---------------------------
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5
});

io.on("connection", (socket) => {
    console.log("New client connected:", socket.id);
    socket.join("inbox");

    socket.on("conversation:join", (data) => {
        if (!data || !data.conversationId) return;
        socket.join(`conversation:${data.conversationId}`);
    });

    socket.on("conversation:leave", (data) => {
        if (!data || !data.conversationId) return;
        socket.leave(`conversation:${data.conversationId}`);
    });

    // Agent registers after connecting with their user info
    socket.on("agent:register", (agent) => {
        // agent: { userId, name, role }
        try {
            const role = agent && agent.role ? String(agent.role).toLowerCase() : null;
            // Do NOT register viewers as agents (they are read-only)
            if (role === 'viewer') {
                console.log("Viewer connected via socket, not registering as agent:", socket.id);
                return;
            }
        } catch (e) {}

        const record = Object.assign({}, agent, { socketId: socket.id, lastActive: Date.now(), activeConversation: null, autopilotMode: agent.autopilotMode || 'auto', status: 'online' });
        onlineAgents.set(socket.id, record);
        // Broadcast presence list to all clients
        const list = Array.from(onlineAgents.values()).map(a => ({ userId: a.userId, name: a.name, role: a.role, status: a.status || 'online', activeConversation: a.activeConversation }));
        io.emit("presenceUpdate", list);
        console.log("Agent registered for presence:", record);
    });

    socket.on('agent:updateStatus', (data) => {
        const record = onlineAgents.get(socket.id);
        if (record && data && data.status) {
            const validStatuses = ['online', 'away', 'busy', 'offline'];
            const newStatus = String(data.status).toLowerCase();
            if (validStatuses.includes(newStatus)) {
                record.status = newStatus;
                record.lastActive = Date.now();
                onlineAgents.set(socket.id, record);
                // Broadcast updated presence to all clients
                const list = Array.from(onlineAgents.values()).map(a => ({ userId: a.userId, name: a.name, role: a.role, status: a.status || 'online', activeConversation: a.activeConversation }));
                io.emit("presenceUpdate", list);
                console.log(`Agent ${record.userId} (${record.name}) updated status to ${newStatus}`);
            }
        }
    });

    socket.on('agent:updateAutopilotMode', (data) => {
        const record = onlineAgents.get(socket.id);
        if (record && data && data.autopilotMode) {
            record.autopilotMode = String(data.autopilotMode).toLowerCase();
            record.lastActive = Date.now();
            onlineAgents.set(socket.id, record);
            console.log(`Agent ${record.userId} updated autopilotMode to ${record.autopilotMode}`);
        }
    });

    // Agent notifies which conversation they're viewing/active on
    socket.on("agent:activeConversation", (data) => {
        const rec = onlineAgents.get(socket.id);
        if (rec) {
            rec.activeConversation = data && data.conversationId ? data.conversationId : null;
            rec.lastActive = Date.now();
            onlineAgents.set(socket.id, rec);
        }
        const list = Array.from(onlineAgents.values()).map(a => ({ userId: a.userId, name: a.name, role: a.role, activeConversation: a.activeConversation }));
        io.emit("presenceUpdate", list);
    });

    // Typing indicators
    socket.on("typing", (data) => {
        // data: { conversationId, userId, name }
        if (!data || !data.conversationId) return;
        socket.broadcast.emit("typing", data);
    });

    socket.on("stopTyping", (data) => {
        if (!data || !data.conversationId) return;
        socket.broadcast.emit("stopTyping", data);
    });

    // Message refresh request (for client-side polling fallback)
    socket.on("messages:refresh", (data) => {
        if (!data || !data.conversationId) return;
        const conversationId = data.conversationId;
        // Fetch latest messages for this conversation
        const sql = isPg
            ? `SELECT * FROM replies WHERE conversation_id = $1 ORDER BY created_at DESC LIMIT 50`
            : `SELECT * FROM replies WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 50`;
        db.query(sql, isPg ? [conversationId] : [conversationId], (err, messages) => {
            if (err) {
                console.error('Failed to fetch messages for refresh:', err);
                return;
            }
            if (Array.isArray(messages)) {
                socket.emit("messages:refreshed", {
                    conversationId,
                    messages: messages.reverse()
                });
            }
        });
    });

    socket.on('voice:register', (data, ack) => {
        const record = normalizeVoiceUser(socket, Object.assign({}, data, { status: 'online', socketId: socket.id }));
        if (!record || !record.userId) {
            if (typeof ack === 'function') ack({ ok: false, error: 'Missing userId' });
            return;
        }
        voiceUsers.set(socket.id, record);
        broadcastVoicePresence();
        socket.emit('voice:channels', getVoiceChannelList());
        if (typeof ack === 'function') ack({ ok: true, userId: record.userId, socketId: socket.id });
    });

    socket.on('voice:getChannels', () => {
        socket.emit('voice:channels', getVoiceChannelList());
    });

    socket.on('call:register', (data) => {
        if (!data || !data.secureToken || !data.role) return;
        const session = callSessions.get(data.secureToken);
        if (!session) return;
        if (new Date(session.expiresAt) < new Date()) return;

        if (data.role === 'staff') {
            session.staffSocketId = socket.id;
            session.staffId = session.staffId || data.userId;
            session.staffName = session.staffName || data.name;
        }
        if (data.role === 'customer') {
            if (session.customerSocketId && session.customerSocketId !== socket.id) {
                socket.emit('call:error', { message: 'This call has already been joined by another customer.' });
                return;
            }
            session.customerSocketId = socket.id;
        }
        callSessions.set(data.secureToken, session);
        socket.join(`call:${data.secureToken}`);
        socket.emit('call:status', { secureToken: data.secureToken, status: session.status });
        if (session.staffSocketId && session.customerSocketId && session.status === 'waiting') {
            session.status = 'ringing';
            callSessions.set(data.secureToken, session);
            createCallTimeout(data.secureToken);
            if (session.staffSocketId) {
                io.to(session.staffSocketId).emit('call:ringing', { secureToken: data.secureToken, status: session.status });
            }
            if (session.customerSocketId) {
                io.to(session.customerSocketId).emit('call:ringing', { secureToken: data.secureToken, status: session.status });
            }
            persistCallSession(session).catch(() => {});
        }
    });

    socket.on('call:start', (data) => {
        if (!data || !data.secureToken) return;
        const session = callSessions.get(data.secureToken);
        if (!session) return;
        session.status = 'ringing';
        session.startedAt = session.startedAt || new Date().toISOString();
        callSessions.set(data.secureToken, session);
        createCallTimeout(data.secureToken);
        if (session.staffSocketId) {
            io.to(session.staffSocketId).emit('call:ringing', { secureToken: data.secureToken, customerName: session.customerName, staffName: session.staffName });
        }
        persistCallSession(session).catch(() => {});
    });

    socket.on('call:ringing', (data) => {
        if (!data || !data.secureToken) return;
        const session = callSessions.get(data.secureToken);
        if (!session) return;
        session.status = 'ringing';
        callSessions.set(data.secureToken, session);
        if (session.staffSocketId) {
            io.to(session.staffSocketId).emit('call:ringing', { secureToken: data.secureToken });
        }
        persistCallSession(session).catch(() => {});
    });

    socket.on('call:answer', async (data) => {
        if (!data || !data.secureToken) return;
        const session = callSessions.get(data.secureToken);
        if (!session) return;
        session.status = 'answered';
        session.answeredAt = new Date().toISOString();
        session.startedAt = session.startedAt || session.answeredAt;
        callSessions.set(data.secureToken, session);
        if (session.staffSocketId) {
            io.to(session.staffSocketId).emit('call:answered', { secureToken: data.secureToken });
        }
        if (session.customerSocketId) {
            io.to(session.customerSocketId).emit('call:answered', { secureToken: data.secureToken });
        }
        persistCallSession(session).catch(() => {});
    });

    socket.on('call:reject', (data) => {
        if (!data || !data.secureToken) return;
        const session = callSessions.get(data.secureToken);
        if (!session) return;
        session.status = 'rejected';
        session.endedAt = new Date().toISOString();
        session.duration = 0;
        callSessions.set(data.secureToken, session);
        if (session.staffSocketId) {
            io.to(session.staffSocketId).emit('call:rejected', { secureToken: data.secureToken });
        }
        if (session.customerSocketId) {
            io.to(session.customerSocketId).emit('call:rejected', { secureToken: data.secureToken });
        }
        persistCallSession(session).catch(() => {});
        cleanupCallSession(data.secureToken);
    });

    socket.on('call:end', (data) => {
        if (!data || !data.secureToken) return;
        const session = callSessions.get(data.secureToken);
        if (!session) return;
        session.status = 'ended';
        session.endedAt = new Date().toISOString();
        session.duration = session.startedAt ? Math.max(0, Math.round((new Date(session.endedAt) - new Date(session.startedAt)) / 1000)) : 0;
        callSessions.set(data.secureToken, session);
        const targetSocketId = getOppositeSocket(data.secureToken, socket.id);
        if (targetSocketId) {
            io.to(targetSocketId).emit('call:ended', { secureToken: data.secureToken });
        }
        io.to(`call:${data.secureToken}`).emit('call:ended', { secureToken: data.secureToken });
        persistCallSession(session).catch(() => {});
        cleanupCallSession(data.secureToken);
    });

    socket.on('call:offer', (data) => {
        if (!data || !data.secureToken || !data.offer) return;
        const targetSocketId = getOppositeSocket(data.secureToken, socket.id);
        if (!targetSocketId) return;
        io.to(targetSocketId).emit('call:offer', {
            secureToken: data.secureToken,
            offer: data.offer
        });
    });

    socket.on('call:answer', (data) => {
        if (!data || !data.secureToken || !data.answer) return;
        const targetSocketId = getOppositeSocket(data.secureToken, socket.id);
        if (!targetSocketId) return;
        io.to(targetSocketId).emit('call:answer', {
            secureToken: data.secureToken,
            answer: data.answer
        });
    });

    socket.on('call:ice', (data) => {
        if (!data || !data.secureToken || !data.candidate) return;
        const targetSocketId = getOppositeSocket(data.secureToken, socket.id);
        if (!targetSocketId) return;
        io.to(targetSocketId).emit('call:ice', {
            secureToken: data.secureToken,
            candidate: data.candidate
        });
    });

    socket.on('connection:status', (data) => {
        if (!data || !data.secureToken) return;
        const targetSocketId = getOppositeSocket(data.secureToken, socket.id);
        if (!targetSocketId) return;
        io.to(targetSocketId).emit('connection:status', {
            secureToken: data.secureToken,
            state: data.state
        });
    });

    socket.on('disconnect', () => {
        onlineAgents.delete(socket.id);
        voiceUsers.delete(socket.id);
        for (const channel of voiceChannels.values()) {
            if (channel.members.has(socket.id)) {
                channel.members.delete(socket.id);
            }
        }
        broadcastVoicePresence();
        const list = Array.from(onlineAgents.values()).map(a => ({ userId: a.userId, name: a.name, role: a.role, activeConversation: a.activeConversation }));
        io.emit('presenceUpdate', list);
        const callSession = findCallSessionBySocket(socket.id);
        if (callSession) {
            callSession.status = 'ended';
            callSession.endedAt = new Date().toISOString();
            callSession.duration = callSession.startedAt ? Math.max(0, Math.round((new Date(callSession.endedAt) - new Date(callSession.startedAt)) / 1000)) : 0;
            persistCallSession(callSession).catch(() => {});
            const otherSocket = getOppositeSocket(callSession.secureToken, socket.id);
            if (otherSocket) {
                io.to(otherSocket).emit('call:ended', { secureToken: callSession.secureToken });
            }
            cleanupCallSession(callSession.secureToken);
        }
        console.log("Client disconnected:", socket.id);
    });

    const handlePrivateCallRequest = (data) => {
        if (!data || !data.targetUserId || !data.sessionId) return;
        const caller = voiceUsers.get(socket.id) || (data.caller ? {
            userId: data.caller.userId || data.caller.id || null,
            name: data.caller.name || data.caller.displayName || 'Staff',
            role: data.caller.role || 'agent'
        } : null);
        const targetSocketId = getSocketByUserId(data.targetUserId);
        if (!caller?.userId || !targetSocketId) {
            console.warn('Private voice call could not be routed', {
                targetUserId: data.targetUserId,
                callerUserId: caller?.userId || null,
                targetSocketId: targetSocketId || null,
                sessionId: data.sessionId
            });
            socket.emit('voice:private:error', {
                sessionId: data.sessionId,
                message: 'The selected staff is not online or not registered for voice calls.'
            });
            return;
        }
        const sessionId = data.sessionId;
        const session = {
            id: sessionId,
            type: 'private',
            createdBy: caller.userId,
            status: 'pending',
            room: getRoomName(sessionId),
            channelId: null,
            participants: new Map(),
            startedAt: null,
            endedAt: null
        };
        session.participants.set(socket.id, { userId: caller.userId, name: caller.name, role: caller.role, muted: false, speaking: false, joinedAt: new Date().toISOString() });
        voiceSessions.set(sessionId, session);
        io.to(targetSocketId).emit('voice:private:incoming', {
            sessionId,
            from: { userId: caller.userId, name: caller.name, role: caller.role }
        });
    };

    socket.on('voice:private:request', (data) => handlePrivateCallRequest(data));
    socket.on('voice:private:initiate', (data) => handlePrivateCallRequest(data));

    socket.on('voice:private:response', async (data) => {
        if (!data || !data.sessionId || typeof data.accepted === 'undefined') return;
        const session = getVoiceSessionById(data.sessionId);
        if (!session || session.type !== 'private' || session.status !== 'pending') return;
        const responder = voiceUsers.get(socket.id) || (data.responder ? {
            userId: data.responder.userId || data.responder.id || null,
            name: data.responder.name || data.responder.displayName || 'Staff',
            role: data.responder.role || 'agent'
        } : null);
        if (!responder?.userId) return;
        const callerSocketId = Array.from(session.participants.keys())[0];
        const caller = voiceUsers.get(callerSocketId);
        if (!caller) return;

        if (data.accepted) {
            session.status = 'active';
            session.startedAt = new Date().toISOString();
            session.participants.set(socket.id, { userId: responder.userId, name: responder.name, role: responder.role, muted: false, speaking: false, joinedAt: new Date().toISOString() });
            voiceSessions.set(session.id, session);
            [callerSocketId, socket.id].forEach(id => {
                const user = voiceUsers.get(id);
                if (user) {
                    user.voiceSessionId = session.id;
                    user.status = 'in voice chat';
                    voiceUsers.set(id, user);
                }
            });
            broadcastVoicePresence();
            io.to(callerSocketId).emit('voice:private:accepted', { sessionId: session.id, peer: { userId: responder.userId, name: responder.name } });
            io.to(socket.id).emit('voice:private:started', { sessionId: session.id, peer: { userId: caller.userId, name: caller.name } });
            const dbSession = await persistVoiceSession(session);
            if (dbSession) {
                await persistVoiceParticipants(dbSession.id, Array.from(session.participants.values()));
            }
        } else {
            io.to(callerSocketId).emit('voice:private:rejected', { sessionId: session.id, by: responder.userId });
            voiceSessions.delete(session.id);
        }
    });

    socket.on('voice:signal', (data) => {
        if (!data || !data.targetUserId || !data.sessionId || !data.signal) return;
        const targetSocketId = getSocketByUserId(data.targetUserId);
        if (!targetSocketId) return;
        io.to(targetSocketId).emit('voice:signal', {
            sessionId: data.sessionId,
            fromUserId: voiceUsers.get(socket.id)?.userId || null,
            signal: data.signal,
            type: data.type || 'offer'
        });
    });

    socket.on('voice:end', (data) => {
        if (!data || !data.sessionId) return;
        const session = getVoiceSessionById(data.sessionId);
        if (!session) return;
        session.participants.forEach((participant, participantSocketId) => {
            io.to(participantSocketId).emit('voice:ended', { sessionId: session.id, by: voiceUsers.get(socket.id)?.userId || null });
        });
        endVoiceSession(session.id);
    });

    socket.on('voice:activity', (data) => {
        if (!data) return;
        saveVoiceActivity(socket.id, data);
    });

    socket.on('voice:broadcast:start', (data) => {
        const host = voiceUsers.get(socket.id);
        if (!host) return;
        const sessionId = data.sessionId || randomUUID();
        const session = {
            id: sessionId,
            type: 'broadcast',
            createdBy: host.userId,
            status: 'active',
            room: getRoomName(sessionId),
            channelId: null,
            participants: new Map(),
            startedAt: new Date().toISOString(),
            endedAt: null
        };
        session.participants.set(socket.id, { userId: host.userId, name: host.name, role: host.role, muted: false, speaking: false, joinedAt: new Date().toISOString() });
        voiceSessions.set(sessionId, session);
        host.voiceSessionId = sessionId;
        host.status = 'broadcasting';
        voiceUsers.set(socket.id, host);
        broadcastVoicePresence();
        Array.from(voiceUsers.values()).forEach(user => {
            if (user.socketId === socket.id) return;
            io.to(user.socketId).emit('voice:broadcast:incoming', { sessionId, from: { userId: host.userId, name: host.name } });
        });
    });

    socket.on('voice:broadcast:invite', (data) => {
        if (!data || !data.targetUserId || !data.sessionId) return;
        const session = getVoiceSessionById(data.sessionId);
        if (!session || session.type !== 'broadcast' || session.status !== 'active') return;
        const inviter = voiceUsers.get(socket.id);
        if (!inviter || String(inviter.userId) !== String(session.createdBy)) return;
        const targetSocketId = getSocketByUserId(data.targetUserId);
        if (!targetSocketId || targetSocketId === socket.id) return;
        io.to(targetSocketId).emit('voice:broadcast:incoming', { sessionId: session.id, from: { userId: inviter.userId, name: inviter.name } });
    });

    socket.on('voice:broadcast:join', (data) => {
        if (!data || !data.sessionId) return;
        const session = getVoiceSessionById(data.sessionId);
        if (!session || session.type !== 'broadcast' || session.status !== 'active') return;
        const listener = voiceUsers.get(socket.id);
        if (!listener) return;
        session.participants.set(socket.id, { userId: listener.userId, name: listener.name, role: listener.role, muted: false, speaking: false, joinedAt: new Date().toISOString() });
        voiceSessions.set(session.id, session);
        listener.voiceSessionId = session.id;
        listener.status = 'in voice chat';
        voiceUsers.set(socket.id, listener);
        broadcastVoicePresence();
        const hostSocketId = getSocketByUserId(session.createdBy);
        if (hostSocketId) {
            io.to(hostSocketId).emit('voice:broadcast:joinRequest', { sessionId: session.id, user: { userId: listener.userId, name: listener.name } });
        }
        socket.emit('voice:broadcast:joined', { sessionId: session.id, hostUserId: session.createdBy });
    });

    socket.on('voice:broadcast:leave', (data) => {
        if (!data || !data.sessionId) return;
        const session = getVoiceSessionById(data.sessionId);
        if (!session) return;
        session.participants.delete(socket.id);
        const user = voiceUsers.get(socket.id);
        if (user) {
            user.voiceSessionId = null;
            user.status = 'online';
            voiceUsers.set(socket.id, user);
        }
        voiceSessions.set(session.id, session);
        broadcastVoicePresence();
        if (session.participants.size === 0) {
            endVoiceSession(session.id);
        }
    });

    socket.on('voice:channel:join', (data) => {
        if (!data || !data.channelId) return;
        const user = voiceUsers.get(socket.id);
        const channel = voiceChannels.get(data.channelId);
        if (!user || !channel) return;
        channel.members.add(socket.id);
        voiceChannels.set(data.channelId, channel);
        user.currentChannelId = data.channelId;
        user.status = 'in channel';
        voiceUsers.set(socket.id, user);
        broadcastVoicePresence();
        socket.emit('voice:channel:joined', {
            channel: { id: channel.id, name: channel.name, description: channel.description },
            members: Array.from(channel.members).map(id => {
                const m = voiceUsers.get(id);
                return m ? { userId: m.userId, name: m.name, role: m.role, muted: m.muted, speaking: m.speaking } : null;
            }).filter(Boolean)
        });
        channel.members.forEach(memberSocketId => {
            if (memberSocketId !== socket.id) {
                io.to(memberSocketId).emit('voice:channel:memberUpdate', { channelId: channel.id, user: { userId: user.userId, name: user.name, role: user.role, muted: user.muted, speaking: user.speaking } });
            }
        });
    });

    socket.on('voice:channel:leave', (data) => {
        if (!data || !data.channelId) return;
        const user = voiceUsers.get(socket.id);
        const channel = voiceChannels.get(data.channelId);
        if (!user || !channel) return;
        channel.members.delete(socket.id);
        voiceChannels.set(data.channelId, channel);
        user.currentChannelId = null;
        user.status = 'online';
        voiceUsers.set(socket.id, user);
        broadcastVoicePresence();
        channel.members.forEach(memberSocketId => {
            io.to(memberSocketId).emit('voice:channel:memberLeft', { channelId: channel.id, userId: user.userId });
        });
    });

    socket.on('voice:channel:signal', (data) => {
        if (!data || !data.targetUserId || !data.signal || !data.channelId) return;
        const targetSocketId = getSocketByUserId(data.targetUserId);
        if (!targetSocketId) return;
        io.to(targetSocketId).emit('voice:channel:signal', {
            channelId: data.channelId,
            fromUserId: voiceUsers.get(socket.id)?.userId || null,
            signal: data.signal
        });
    });

    socket.on("disconnect", () => {
        onlineAgents.delete(socket.id);
        voiceUsers.delete(socket.id);
        for (const channel of voiceChannels.values()) {
            if (channel.members.has(socket.id)) {
                channel.members.delete(socket.id);
            }
        }
        broadcastVoicePresence();
        const list = Array.from(onlineAgents.values()).map(a => ({ userId: a.userId, name: a.name, role: a.role, activeConversation: a.activeConversation }));
        io.emit("presenceUpdate", list);
        console.log("Client disconnected:", socket.id);
    });
});

// Debug route: emit a newMessage event (useful for testing the UI/websocket)
// POST JSON: { conversation_id: 123, sender: 'instagram', message: 'hello' }
// GET query: /debug/emit-new-message?conversation_id=123&message=hello
app.all('/debug/emit-new-message', (req, res) => {
    const data = Object.assign({}, req.method === 'GET' ? req.query : req.body || {});
    const conversation_id = data.conversation_id || data.conversationId || data.id;
    if (!conversation_id) return res.status(400).json({ error: 'conversation_id required' });
    const payload = {
        conversation_id: conversation_id,
        sender: data.sender || 'instagram',
        message: data.message || data.msg || 'Debug message',
        created_at: new Date().toISOString()
    };
    try {
        io.emit('newMessage', payload);
        console.log('Debug emit newMessage', payload);
        res.json({ ok: true, emitted: payload });
    } catch (err) {
        console.error('Debug emit failed', err);
        res.status(500).json({ error: 'emit failed', details: String(err) });
    }
});

// Find the best available staff member for a conversation based on skills and workload
function findBestStaffForConversation(conversationId, callback) {
    // Get conversation details to determine required skills
    db.query(`
        SELECT c.phone, m.message, m.created_at
        FROM conversations c
        LEFT JOIN messages m ON c.id = m.conversation_id AND m.sender = 'received'
        WHERE c.id = ?
        ORDER BY m.created_at DESC
        LIMIT 5
    `, [conversationId], (err, messages) => {
        if (err) {
            console.log('Error fetching conversation for staff assignment:', err);
            return callback(null); // No assignment
        }

        // Analyze conversation for required skills
        const conversationText = messages.map(m => m.message || '').join(' ').toLowerCase();
        let requiredSkills = [];

        if (conversationText.includes('refund') || conversationText.includes('cancel') || conversationText.includes('money')) {
            requiredSkills.push('refunds');
        }
        if (conversationText.includes('order') || conversationText.includes('delivery') || conversationText.includes('food')) {
            requiredSkills.push('orders');
        }
        if (conversationText.includes('technical') || conversationText.includes('bug') || conversationText.includes('error')) {
            requiredSkills.push('technical');
        }
        if (conversationText.includes('complain') || conversationText.includes('angry') || conversationText.includes('escalate')) {
            requiredSkills.push('escalations', 'complaints');
        }

        // Default to general if no specific skills identified
        if (requiredSkills.length === 0) {
            requiredSkills = ['general'];
        }

        // Find available staff with matching skills
        const onlineStaffIds = Array.from(onlineAgents.keys()).filter(socketId => {
            const agent = onlineAgents.get(socketId);
            return agent && agent.role === 'agent' && agent.activeConversation === null;
        }).map(socketId => onlineAgents.get(socketId).userId);

        if (onlineStaffIds.length === 0) {
            console.log('No online staff available for assignment');
            return callback(null);
        }

        // Query staff with skills
        const placeholders = onlineStaffIds.map(() => '?').join(',');
        db.query(`SELECT id, name, skills FROM users WHERE id IN (${placeholders}) AND role = 'agent'`, onlineStaffIds, (err, staff) => {
            if (err) {
                console.log('Error fetching staff skills:', err);
                return callback(null);
            }

            // Score staff based on skill match and current workload
            let bestStaff = null;
            let bestScore = -1;

            staff.forEach(agent => {
                if (!agent.skills) return;

                const agentSkills = agent.skills.split(',').map(s => s.trim().toLowerCase());
                let skillMatch = 0;

                requiredSkills.forEach(reqSkill => {
                    if (agentSkills.includes(reqSkill.toLowerCase())) {
                        skillMatch++;
                    }
                });

                // Calculate score: skill match + availability bonus
                const score = skillMatch * 10; // Prioritize skill match

                if (score > bestScore) {
                    bestScore = score;
                    bestStaff = agent.id;
                }
            });

            console.log(`Assigned conversation ${conversationId} to staff ${bestStaff} (skills: ${requiredSkills.join(',')})`);
            callback(bestStaff);
        });
    });
}

setHandoffCallback((conversationId) => {
    disableAIForConversation(conversationId);
    // Insert or update escalations table and emit an escalation event with details
    db.query("SELECT c.phone, c.id FROM conversations c WHERE c.id = ?", [conversationId], (err, results) => {
        const phone = (results && results[0] && results[0].phone) ? results[0].phone : null;
        const customerName = phone || 'Unknown';

        // Find best available staff for this conversation
        findBestStaffForConversation(conversationId, (assignedStaffId) => {
            const upsertSql = isPg
                ? `INSERT INTO escalations (conversation_id, customer_name, alarm_active, assigned_staff_id) VALUES (?, ?, TRUE, ?) ON CONFLICT (conversation_id) DO UPDATE SET escalated_at = CURRENT_TIMESTAMP, alarm_active = TRUE, snoozed_until = NULL, claimed_by = NULL, claim_time = NULL, assigned_staff_id = ?`
                : `INSERT INTO escalations (conversation_id, customer_name, alarm_active, assigned_staff_id) VALUES (?, ?, 1, ?) ON DUPLICATE KEY UPDATE escalated_at = CURRENT_TIMESTAMP, alarm_active = 1, snoozed_until = NULL, claimed_by = NULL, claim_time = NULL, assigned_staff_id = ?`;
            db.query(upsertSql, [conversationId, customerName, assignedStaffId, assignedStaffId], (uErr) => {
                if (uErr) console.log('Escalation upsert error:', uErr);
                io.emit("escalationRaised", { conversationId, customerName, assignedStaffId });
                // Notify specifically assigned staff (if online)
                if (assignedStaffId) {
                    let assignedSocketId = null;
                    for (const [sockId, rec] of onlineAgents.entries()) {
                        if (rec && rec.userId === assignedStaffId) {
                            assignedSocketId = sockId;
                            break;
                        }
                    }
                    if (assignedSocketId) {
                                io.to(assignedSocketId).emit('escalationAssigned', { conversationId, customerName, assignedStaffId });
                    } else {
                        // Assigned staff not currently connected -- broadcast to all online agents as a fallback
                        console.log(`Assigned staff ${assignedStaffId} not connected; broadcasting escalationAssigned to all agents for conversation ${conversationId}`);
                        for (const [sockId, rec] of onlineAgents.entries()) {
                            if (rec && rec.role === 'agent') {
                                        io.to(sockId).emit('escalationAssigned', { conversationId, customerName, assignedStaffId });
                            }
                        }
                    }
                }
                // legacy event for other clients
                io.emit("handoffAlert", { conversationId });
            });
        });
    });
});

// Add endpoint to fetch analytics data
app.get('/api/analytics', isAuthenticated, async (req, res) => {
    try {
        const [countsRows] = await db.promise().query(`
            SELECT
                (SELECT COUNT(*) FROM conversations) AS chats,
                (SELECT COUNT(*) FROM tickets) AS tickets,
                (SELECT COUNT(*) FROM tickets WHERE escalated = TRUE) AS escalatedTickets,
                (SELECT COUNT(*) FROM receipts) AS receipts,
                (SELECT COUNT(*) FROM receipts WHERE escalated = TRUE) AS escalatedReceipts
        `);

        const [feedbackRows] = await db.promise().query(`
            SELECT
                COUNT(*) AS count,
                AVG(rating) AS avg_rating,
                SUM(CASE WHEN rating >= 4 THEN 1 ELSE 0 END) AS positive
            FROM ai_feedback
            WHERE rating IS NOT NULL
        `);

        let avgResp = { avg_response_seconds: null };
        try {
            const [avgResponseRows] = await db.promise().query(isPg ? `
                SELECT AVG(EXTRACT(EPOCH FROM (r.created_at - r.prev_created))) AS avg_response_seconds
                FROM (
                    SELECT r.id, r.conversation_id, r.created_at,
                           (SELECT MAX(m2.created_at) FROM messages m2 WHERE m2.conversation_id = r.conversation_id AND m2.created_at < r.created_at) AS prev_created
                    FROM replies r
                ) r
                WHERE r.prev_created IS NOT NULL
            ` : `
                SELECT AVG(TIMESTAMPDIFF(SECOND,
                    (SELECT MAX(m2.created_at) FROM messages m2 WHERE m2.conversation_id = r.conversation_id AND m2.created_at < r.created_at),
                    r.created_at
                )) AS avg_response_seconds
                FROM replies r
                WHERE EXISTS (
                    SELECT 1 FROM messages m2 WHERE m2.conversation_id = r.conversation_id AND m2.created_at < r.created_at
                )
            `);
            avgResp = (Array.isArray(avgResponseRows) ? avgResponseRows[0] : avgResponseRows) || avgResp;
        } catch (err) {
            console.warn('Warning: avg response query failed', err);
        }

        let avgRes = { avg_resolution_seconds: null };
        try {
            const [avgResolutionRows] = await db.promise().query(isPg ? `
                SELECT AVG(EXTRACT(EPOCH FROM (res.resolved_at - c.created_at))) AS avg_resolution_seconds
                FROM resolved res
                JOIN conversations c ON c.id = res.conversation_id
            ` : `
                SELECT AVG(TIMESTAMPDIFF(SECOND, c.created_at, res.resolved_at)) AS avg_resolution_seconds
                FROM resolved res
                JOIN conversations c ON c.id = res.conversation_id
            `);
            avgRes = (Array.isArray(avgResolutionRows) ? avgResolutionRows[0] : avgResolutionRows) || avgRes;
        } catch (err) {
            console.warn('Warning: avg resolution query failed', err);
        }

        const summary = (Array.isArray(countsRows) ? countsRows[0] : countsRows) || {};
        const fb = (Array.isArray(feedbackRows) ? feedbackRows[0] : feedbackRows) || {};

        const numChats = Number(summary.chats) || 0;
        const numResolvedChats = Number(summary.resolvedChats) || 0;

        res.json({
            numChats,
            numTickets: Number(summary.tickets) || 0,
            numEscalatedTickets: Number(summary.escalatedTickets) || 0,
            numReceipts: Number(summary.receipts) || 0,
            numEscalatedReceipts: Number(summary.escalatedReceipts) || 0,
            numEscalatedChats: Number(summary.escalatedChats) || 0,
            numResolvedChats,
            activeChats: Math.max(0, numChats - numResolvedChats),
            avgResponseSeconds: avgResp.avg_response_seconds != null ? Number(avgResp.avg_response_seconds) : null,
            avgResolutionSeconds: avgRes.avg_resolution_seconds != null ? Number(avgRes.avg_resolution_seconds) : null,
            resolutionRate: numChats ? (numResolvedChats / numChats) : 0,
            aiFeedbackCount: Number(fb.count) || 0,
            aiFeedbackAvg: fb.avg_rating != null ? Number(fb.avg_rating) : null,
            aiFeedbackPositive: Number(fb.positive) || 0
        });
    } catch (error) {
        console.error('Error fetching analytics data:', error);
        res.status(500).json({ error: 'Failed to fetch analytics data' });
    }
});

app.get('/api/my-metrics', isAuthenticated, async (req, res) => {
    try {
        const statsRows = await db.promise().query(`
            SELECT
                COUNT(*) AS tickets,
                SUM(CASE WHEN LOWER(status) = 'resolved' THEN 1 ELSE 0 END) AS resolvedChats
            FROM tickets
        `);

        const stats = (Array.isArray(statsRows) ? statsRows[0] : statsRows) || { tickets: 0, resolvedChats: 0 };
        const tickets = Number(stats.tickets) || 0;
        const resolvedChats = Number(stats.resolvedChats) || 0;

        res.json({
            avgResponseSeconds: 0,
            resolutionRate: tickets ? resolvedChats / tickets : 0
        });
    } catch (error) {
        console.error('Error fetching my-metrics data:', error);
        res.status(500).json({ error: 'Failed to fetch my-metrics data' });
    }
});

// API endpoint for ticket counts by time period
app.get('/api/tickets-by-period', async (req, res) => {
    try {
        const ticketCountsSql = isPg
            ? `SELECT
                    COUNT(*) FILTER (WHERE created_at >= date_trunc('day', now())) AS daily,
                    COUNT(*) FILTER (WHERE created_at >= date_trunc('week', now())) AS weekly,
                    COUNT(*) FILTER (WHERE created_at >= date_trunc('month', now())) AS monthly
                FROM tickets`
            : `SELECT
                    SUM(created_at >= CURDATE()) AS daily,
                    SUM(created_at >= DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY)) AS weekly,
                    SUM(created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')) AS monthly
                FROM tickets`;
        const rows = await db.promise().query(ticketCountsSql);

        const counts = (Array.isArray(rows) ? rows[0] : rows) || { daily: 0, weekly: 0, monthly: 0 };
        console.log('tickets-by-period counts', counts);

        res.json({
            daily: Number(counts.daily) || 0,
            weekly: Number(counts.weekly) || 0,
            monthly: Number(counts.monthly) || 0
        });
    } catch (error) {
        console.error('Error fetching tickets by period:', error);
        res.status(500).json({ error: 'Failed to fetch tickets by period' });
    }
});

app.get('/api/tickets-monthly', async (req, res) => {
    try {
        const now = new Date();
        const year = now.getFullYear();

        const sql = isPg
            ? `SELECT TO_CHAR(created_at, 'YYYY-MM') AS ym, COUNT(*) AS total FROM tickets WHERE created_at >= DATE_TRUNC('year', CURRENT_DATE) AND created_at < DATE_TRUNC('year', CURRENT_DATE) + INTERVAL '1 year' GROUP BY ym ORDER BY ym`
            : `SELECT DATE_FORMAT(created_at, '%Y-%m') AS ym, COUNT(*) AS total FROM tickets WHERE created_at >= DATE_FORMAT(CURDATE(), '%Y-01-01') AND created_at < DATE_ADD(DATE_FORMAT(CURDATE(), '%Y-01-01'), INTERVAL 1 YEAR) GROUP BY ym ORDER BY ym`;

        const rows = await db.promise().query(sql);
        const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        const rowMap = {};
        (rows || []).forEach(r => { rowMap[String(r.ym)] = r; });

        const labels = [];
        const counts = [];
        for (let month = 0; month < 12; month++) {
            const d = new Date(year, month, 1);
            const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            labels.push(monthNames[d.getMonth()]);
            const row = rowMap[ym] || {};
            counts.push(Number(row.total || 0));
        }

        res.json({ labels, counts });
    } catch (error) {
        console.error('Error fetching tickets-monthly:', error);
        res.status(500).json({ error: 'Failed to fetch tickets monthly' });
    }
});

// API endpoint for message counts by time period (received messages only)
app.get('/api/messages-by-period', isAuthenticated, async (req, res) => {
    try {
        const messageCountsSql = isPg
            ? `SELECT
                    SUM(CASE WHEN sender <> 'sent' AND created_at::date = CURRENT_DATE THEN 1 ELSE 0 END) AS daily,
                    SUM(CASE WHEN sender <> 'sent' AND DATE_TRUNC('week', created_at) = DATE_TRUNC('week', CURRENT_DATE) THEN 1 ELSE 0 END) AS weekly,
                    SUM(CASE WHEN sender <> 'sent' AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE) THEN 1 ELSE 0 END) AS monthly
                FROM messages`
            : `SELECT
                    SUM(CASE WHEN sender <> 'sent' AND DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) AS daily,
                    SUM(CASE WHEN sender <> 'sent' AND YEARWEEK(created_at, 1) = YEARWEEK(CURDATE(), 1) THEN 1 ELSE 0 END) AS weekly,
                    SUM(CASE WHEN sender <> 'sent' AND YEAR(created_at) = YEAR(CURDATE()) AND MONTH(created_at) = MONTH(CURDATE()) THEN 1 ELSE 0 END) AS monthly
                FROM messages`;

        const rows = await db.promise().query(messageCountsSql);
        const counts = rows[0] || { daily: 0, weekly: 0, monthly: 0 };

        res.json({
            daily: Number(counts.daily) || 0,
            weekly: Number(counts.weekly) || 0,
            monthly: Number(counts.monthly) || 0
        });
    } catch (error) {
        console.error('Error fetching messages by period:', error);
        res.status(500).json({ error: 'Failed to fetch messages by period' });
    }
});

app.get('/api/outward-messages-by-period', isAuthenticated, async (req, res) => {
    try {
        const messageCountsSql = isPg
            ? `SELECT
                    SUM(CASE WHEN sender = 'sent' AND created_at::date = CURRENT_DATE THEN 1 ELSE 0 END) AS daily,
                    SUM(CASE WHEN sender = 'sent' AND DATE_TRUNC('week', created_at) = DATE_TRUNC('week', CURRENT_DATE) THEN 1 ELSE 0 END) AS weekly,
                    SUM(CASE WHEN sender = 'sent' AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE) THEN 1 ELSE 0 END) AS monthly
                FROM messages`
            : `SELECT
                    SUM(CASE WHEN sender = 'sent' AND DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) AS daily,
                    SUM(CASE WHEN sender = 'sent' AND YEARWEEK(created_at, 1) = YEARWEEK(CURDATE(), 1) THEN 1 ELSE 0 END) AS weekly,
                    SUM(CASE WHEN sender = 'sent' AND YEAR(created_at) = YEAR(CURDATE()) AND MONTH(created_at) = MONTH(CURDATE()) THEN 1 ELSE 0 END) AS monthly
                FROM messages`;

        const rows = await db.promise().query(messageCountsSql);
        const counts = rows[0] || { daily: 0, weekly: 0, monthly: 0 };

        res.json({
            daily: Number(counts.daily) || 0,
            weekly: Number(counts.weekly) || 0,
            monthly: Number(counts.monthly) || 0
        });
    } catch (error) {
        console.error('Error fetching outward messages by period:', error);
        res.status(500).json({ error: 'Failed to fetch outward messages by period' });
    }
});

app.get('/api/messages-monthly', isAuthenticated, async (req, res) => {
    try {
        const sql = isPg ? `
            SELECT TO_CHAR(created_at, 'YYYY-MM') AS ym,
                SUM(CASE WHEN LOWER(sender) ~ 'ai|bot|assistant' OR (user_id IS NULL AND LOWER(sender) = 'sent') THEN 1 ELSE 0 END) AS ai_count,
                SUM(CASE WHEN user_id IS NOT NULL OR LOWER(sender) ~ 'agent|staff|sent_by_agent' THEN 1 ELSE 0 END) AS staff_count
            FROM (
                SELECT sender, created_at, NULL AS user_id FROM messages
                UNION
                SELECT sender, created_at, user_id FROM replies
                UNION
                SELECT sender, created_at, user_id FROM ai_messages
                UNION
                SELECT sender, created_at, user_id FROM staff_messages
                UNION
                SELECT sender, created_at, user_id FROM "ai replies"
                UNION
                SELECT sender, created_at, user_id FROM "staff replies"
            ) AS all_msgs
            WHERE created_at >= DATE_TRUNC('year', CURRENT_DATE)
                AND created_at < DATE_TRUNC('year', CURRENT_DATE) + INTERVAL '1 year'
            GROUP BY ym
            ORDER BY ym;
        ` : `
            SELECT DATE_FORMAT(created_at, '%Y-%m') AS ym,
                SUM(CASE WHEN LOWER(sender) REGEXP 'ai|bot|assistant' OR (user_id IS NULL AND LOWER(sender) = 'sent') THEN 1 ELSE 0 END) AS ai_count,
                SUM(CASE WHEN user_id IS NOT NULL OR LOWER(sender) REGEXP 'agent|staff|sent_by_agent' THEN 1 ELSE 0 END) AS staff_count
            FROM (
                SELECT sender, created_at, NULL AS user_id FROM messages
                UNION
                SELECT sender, created_at, user_id FROM replies
                UNION
                SELECT sender, created_at, user_id FROM ai_messages
                UNION
                SELECT sender, created_at, user_id FROM staff_messages
                UNION ALL
                SELECT sender, created_at, user_id FROM \`ai replies\`
                UNION ALL
                SELECT sender, created_at, user_id FROM \`staff replies\`
            ) AS all_msgs
            WHERE created_at >= DATE_FORMAT(CURDATE(), '%Y-01-01')
                AND created_at < DATE_ADD(DATE_FORMAT(CURDATE(), '%Y-01-01'), INTERVAL 1 YEAR)
            GROUP BY ym
            ORDER BY ym;
        `;

        db.query(sql, (err, rows) => {
            if (err) {
                console.error('/api/messages-monthly db error', err);
                return res.status(500).json({ error: 'DB error' });
            }

            const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
            const now = new Date();
            const rowMap = {};
            (rows || []).forEach(r => { rowMap[String(r.ym)] = r; });

            const labels = [];
            const ai = [];
            const staff = [];

            for (let month = 0; month < 12; month++) {
                const d = new Date(now.getFullYear(), month, 1);
                const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                labels.push(monthNames[d.getMonth()]);
                const row = rowMap[ym] || {};
                ai.push(Number(row.ai_count || 0));
                staff.push(Number(row.staff_count || 0));
            }

            res.json({ labels, ai, staff, data: labels.map((_, idx) => ai[idx] + staff[idx]) });
        });
    } catch (error) {
        console.error('Error fetching monthly messages:', error);
        res.status(500).json({ error: 'Failed to fetch monthly messages' });
    }
});

// Daily AI vs staff messages for the current month (or specific month via ?month=YYYY-MM)
app.get('/api/messages-daily', isAuthenticated, async (req, res) => {
    try {
        const monthParam = (req.query.month || '').trim();
        const now = new Date();
        const year = monthParam ? Number(monthParam.split('-')[0]) : now.getFullYear();
        const month = monthParam ? Number(monthParam.split('-')[1]) - 1 : now.getMonth();
        const startDate = new Date(year, month, 1);
        const endDate = new Date(year, month + 1, 1);

        const startStr = startDate.toISOString();
        const endStr = endDate.toISOString();

        const sql = isPg ? `
            SELECT DATE(created_at) AS dt,
                SUM(CASE WHEN table_source = 'ai' THEN 1 ELSE 0 END) AS ai_count,
                SUM(CASE WHEN table_source = 'staff' THEN 1 ELSE 0 END) AS staff_count
            FROM (
                SELECT created_at, 'ai' AS table_source FROM ai_messages
                UNION ALL
                SELECT created_at, 'staff' AS table_source FROM staff_messages
            ) AS all_msgs
            WHERE created_at >= $1 AND created_at < $2
            GROUP BY DATE(created_at)
            ORDER BY DATE(created_at)
        ` : `
            SELECT DATE(created_at) AS dt,
                SUM(CASE WHEN table_source = 'ai' THEN 1 ELSE 0 END) AS ai_count,
                SUM(CASE WHEN table_source = 'staff' THEN 1 ELSE 0 END) AS staff_count
            FROM (
                SELECT created_at, 'ai' AS table_source FROM ai_messages
                UNION ALL
                SELECT created_at, 'staff' AS table_source FROM staff_messages
            ) AS all_msgs
            WHERE created_at >= ? AND created_at < ?
            GROUP BY DATE(created_at)
            ORDER BY DATE(created_at)
        `;

        db.query(sql, [startStr, endStr], (err, rows) => {
            if (err) {
                console.error('/api/messages-daily db error', err);
                return res.status(500).json({ error: 'DB error' });
            }
            const dayCount = new Date(year, month + 1, 0).getDate();
            const labels = [];
            const ai = [];
            const staff = [];
            const map = {};
            (rows || []).forEach(r => { 
                const dateKey = isPg ? String(r.dt) : String(r.dt);
                map[dateKey] = r; 
            });

            for (let d = 1; d <= dayCount; d++) {
                const dateObj = new Date(year, month, d);
                const key = dateObj.toISOString().slice(0,10);
                labels.push(String(d));
                const row = map[key] || {};
                ai.push(Number(row.ai_count || 0));
                staff.push(Number(row.staff_count || 0));
            }
            res.json({ labels, ai, staff });
        });

    } catch (error) {
        console.error('Error fetching daily messages:', error);
        res.status(500).json({ error: 'Failed to fetch daily messages' });
    }
});

// ---------------------------
// Start server
// ---------------------------
const PORT = process.env.PORT || 3000;
// Ensure `deliveries` table exists for delivery simulation
if (isPg) {
    db.query(`
        CREATE TABLE IF NOT EXISTS deliveries (
            id SERIAL PRIMARY KEY,
            order_id INT NOT NULL,
            rider_name VARCHAR(255),
            vehicle VARCHAR(128),
            current_lat DOUBLE PRECISION,
            current_lng DOUBLE PRECISION,
            customer_lat DOUBLE PRECISION,
            customer_lng DOUBLE PRECISION,
            delivery_status VARCHAR(64) DEFAULT 'pending',
            order_confirmed_time TIMESTAMP,
            rider_assigned_time TIMESTAMP,
            picked_up_time TIMESTAMP,
            in_transit_time TIMESTAMP,
            arriving_time TIMESTAMP,
            delivered_time TIMESTAMP,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW(),
            FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
        );
    `, (err) => {
        if (err) console.error('Could not create deliveries table (pg):', err);
        else {
            db.query('CREATE INDEX IF NOT EXISTS idx_deliveries_order_id ON deliveries(order_id)', (ie) => {});
            console.log('Deliveries table ready (pg)');
        }
    });
} else {
    db.query(`
        CREATE TABLE IF NOT EXISTS deliveries (
            id INT AUTO_INCREMENT PRIMARY KEY,
            order_id INT NOT NULL,
            rider_name VARCHAR(255),
            vehicle VARCHAR(128),
            current_lat DOUBLE,
            current_lng DOUBLE,
            customer_lat DOUBLE,
            customer_lng DOUBLE,
            delivery_status VARCHAR(64) DEFAULT 'pending',
            order_confirmed_time DATETIME,
            rider_assigned_time DATETIME,
            picked_up_time DATETIME,
            in_transit_time DATETIME,
            arriving_time DATETIME,
            delivered_time DATETIME,
            created_at DATETIME DEFAULT NOW(),
            updated_at DATETIME DEFAULT NOW() ON UPDATE NOW(),
            INDEX (order_id),
            FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `, (err) => {
        if (err) {
            console.error('Could not create deliveries table:', err);
        } else {
            console.log('Deliveries table ready');
        }
    });
}
httpServer.on('error', (err) => {
    if (err && err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Stop the process using it or set a different PORT environment variable.`);
        process.exit(1);
    }
    console.error('HTTP server error:', err);
    process.exit(1);
});

httpServer.listen(PORT, () => {
        // Print non-sensitive DB info for debugging (do NOT log passwords)
        try {
            const dbHost = (dbConfig && dbConfig.host) || process.env.DB_HOST || 'unknown';
            const dbPort = (dbConfig && dbConfig.port) || process.env.DB_PORT || 'unknown';
            const dbName = (dbConfig && dbConfig.database) || process.env.DB_NAME || 'unknown';
            console.log(`✅🎲Server running on port ${PORT}🎲`);
            console.log(`DB host: ${dbHost}, port: ${dbPort}, database: ${dbName}`);
        if (connectDatabase) {
            connectDatabase((err) => {
                if (err) {
                    // Sanitize DB errors to avoid printing SQL internals or password-related details
                    if (err && err.code === 'ER_ACCESS_DENIED_ERROR') {
                        console.error('DB connection test failed at startup: access denied (check DB_USER/DB_PASSWORD/DB_HOST)');
                    } else {
                        // Print limited, non-sensitive fields for other errors
                        const safe = { code: err.code || 'UNKNOWN', errno: err.errno || null, message: err.message || 'DB error' };
                        console.error('DB connection test failed at startup:', safe);
                    }
                } else {
                    console.log('DB connection test succeeded');
                }
                initVoiceChannelsFromDb().catch(err => {
                    console.warn('Voice channel initialization failed:', err?.message || err);
                });
            });
        } else {
            initVoiceChannelsFromDb().catch(err => {
                console.warn('Voice channel initialization failed:', err?.message || err);
            });
        }

        // Ensure optional AI/staff message tables exist to avoid runtime query errors
        if (isPg) {
            db.query(`
                CREATE TABLE IF NOT EXISTS ai_messages (
                    id SERIAL PRIMARY KEY,
                    conversation_id INT,
                    sender VARCHAR(255),
                    message TEXT,
                    user_id INT,
                    created_at TIMESTAMP DEFAULT NOW()
                );
            `, (err) => { if (err) console.error('Error ensuring ai_messages table at startup:', err); else console.log('ai_messages table ensured at startup'); });

            db.query(`
                CREATE TABLE IF NOT EXISTS staff_messages (
                    id SERIAL PRIMARY KEY,
                    conversation_id INT,
                    sender VARCHAR(255),
                    message TEXT,
                    user_id INT,
                    created_at TIMESTAMP DEFAULT NOW()
                );
            `, (err) => { if (err) console.error('Error ensuring staff_messages table at startup:', err); else console.log('staff_messages table ensured at startup'); });
        } else {
            db.query(`
                CREATE TABLE IF NOT EXISTS ai_messages (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    conversation_id INT,
                    sender VARCHAR(255),
                    message TEXT,
                    user_id INT,
                    created_at DATETIME DEFAULT NOW()
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            `, (err) => { if (err) console.error('Error ensuring ai_messages table at startup:', err); else console.log('ai_messages table ensured at startup'); });

            db.query(`
                CREATE TABLE IF NOT EXISTS staff_messages (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    conversation_id INT,
                    sender VARCHAR(255),
                    message TEXT,
                    user_id INT,
                    created_at DATETIME DEFAULT NOW()
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            `, (err) => { if (err) console.error('Error ensuring staff_messages table at startup:', err); else console.log('staff_messages table ensured at startup'); });
        }
    } catch (e) {
        console.log(`✅🎲Server running on port ${PORT}🎲`);
    }
});

// Auto-sync Gmail emails on a timer
const GMAIL_SYNC_INTERVAL = parseInt(process.env.GMAIL_SYNC_INTERVAL || '6000', 10); // Default: 6 seconds
let gmailSyncTimer = null;

async function startAutoSync() {
    try {
        console.log('⏳ startAutoSync called, about to run first sync...');
        // Run first sync immediately
        const firstSyncResult = await syncGmailEmails(true);
        console.log('✅ First sync completed:', firstSyncResult);
        
        // Then set up periodic sync
        gmailSyncTimer = setInterval(async () => {
            console.log('🔄 Running periodic email sync...');
            await syncGmailEmails(true);
        }, GMAIL_SYNC_INTERVAL);
        
        console.log(`✅ Auto-sync enabled: Every ${GMAIL_SYNC_INTERVAL / 1000}s (${(GMAIL_SYNC_INTERVAL / 60000).toFixed(1)} min)`);
    } catch (err) {
        console.error('❌ Failed to start auto-sync:', err.message);
        console.error('Full error:', err);
    }
}

// Start auto-sync after server is ready (give it a moment to stabilize)
// Delay to ensure Prisma client is fully initialized
setTimeout(startAutoSync, 5000);

// Debug: force assign an escalation to a staff member (for testing handoff audio)
// POST /debug/assign-escalation  JSON: { conversationId, assignedStaffId, customerName }
app.post('/debug/assign-escalation', (req, res) => {
    const data = Object.assign({}, req.body || {}, req.query || {});
    const conversationId = data.conversationId || data.conversation_id;
    if (!conversationId) return res.status(400).json({ error: 'conversationId required' });

    let assignedStaffId = data.assignedStaffId || data.assigned_staff_id || null;
    // pick first available online staff if none provided
    if (!assignedStaffId) {
        const firstRec = Array.from(onlineAgents.values()).find(a => a && a.role === 'agent');
        assignedStaffId = firstRec ? firstRec.userId : null;
    }

    const customerName = data.customerName || `Debug:${conversationId}`;

    // (previously selected an audio file to play for handoffs; removed per request)

    // Upsert escalation row for visibility (best-effort)
    const upsertSql = isPg
        ? `INSERT INTO escalations (conversation_id, customer_name, alarm_active, assigned_staff_id) VALUES (?, ?, TRUE, ?) ON CONFLICT (conversation_id) DO UPDATE SET escalated_at = CURRENT_TIMESTAMP, alarm_active = TRUE, snoozed_until = NULL, claimed_by = NULL, claim_time = NULL, assigned_staff_id = ?`
        : `INSERT INTO escalations (conversation_id, customer_name, alarm_active, assigned_staff_id) VALUES (?, ?, 1, ?) ON DUPLICATE KEY UPDATE escalated_at = CURRENT_TIMESTAMP, alarm_active = 1, snoozed_until = NULL, claimed_by = NULL, claim_time = NULL, assigned_staff_id = ?`;

    db.query(upsertSql, [conversationId, customerName, assignedStaffId, assignedStaffId], (uErr) => {
        if (uErr) console.log('Debug escalation upsert error:', uErr);

        // Emit global escalationRaised and legacy handoffAlert
        io.emit('escalationRaised', { conversationId, customerName, assignedStaffId });
        io.emit('handoffAlert', { conversationId });

        // Notify assigned staff socket if online; otherwise broadcast to all online agents
        let assignedSocketId = null;
        if (assignedStaffId) {
            for (const [sockId, rec] of onlineAgents.entries()) {
                if (rec && String(rec.userId) === String(assignedStaffId)) {
                    assignedSocketId = sockId;
                    break;
                }
            }
                if (assignedSocketId) {
                    io.to(assignedSocketId).emit('escalationAssigned', { conversationId, customerName, assignedStaffId });
                } else {
                    // fallback: broadcast to all online agents
                    for (const [sockId, rec] of onlineAgents.entries()) {
                        if (rec && rec.role === 'agent') {
                            io.to(sockId).emit('escalationAssigned', { conversationId, customerName, assignedStaffId });
                        }
                    }
                }
        } else {
            // no assigned staff provided: broadcast to all online agents
            for (const [sockId, rec] of onlineAgents.entries()) {
                if (rec && rec.role === 'agent') {
                    io.to(sockId).emit('escalationAssigned', { conversationId, customerName, assignedStaffId: null });
                }
            }
        }

        return res.json({ ok: true, conversationId, assignedStaffId, assignedSocketId });
    });
});



// my own chart//
app.get('/api/ticket-stats', async (req, res) => {
    try {
        const tickets = await db.promise().query('SELECT created_at FROM tickets');
        const now = new Date();

        const today = tickets.filter(ticket => {
            const d = new Date(ticket.created_at || ticket.createdAt);
            return (
                d.getDate() === now.getDate() &&
                d.getMonth() === now.getMonth() &&
                d.getFullYear() === now.getFullYear()
            );
        }).length;

        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        startOfWeek.setHours(0,0,0,0);

        const week = tickets.filter(ticket =>
            new Date(ticket.created_at || ticket.createdAt) >= startOfWeek
        ).length;

        const month = tickets.filter(ticket => {
            const d = new Date(ticket.created_at || ticket.createdAt);
            return (
                d.getMonth() === now.getMonth() &&
                d.getFullYear() === now.getFullYear()
            );
        }).length;

        res.json({ today, week, month });
    } catch (err) {
        console.error('/api/ticket-stats error', err);
        res.status(500).json({ error: 'Unable to fetch ticket stats' });
    }
});

// Translation endpoint used by inbox UI. Accepts { text, target }
app.post('/api/translate', express.json(), async (req, res) => {
    try {
        const { text, target } = req.body || {};
        if (!text || typeof text !== 'string' || !text.trim()) {
            return res.status(400).json({ error: 'Missing text' });
        }

        const trimmed = text.trim().slice(0, 5000); // limit length

        // If Google Cloud Translate API key is provided, prefer it
        const googleKey = process.env.GOOGLE_TRANSLATE_API_KEY;
        if (googleKey) {
            try {
                const url = `https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(googleKey)}`;
                const body = { q: trimmed, target: (target && target !== 'auto') ? target : 'en', format: 'text' };
                const gRes = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });
                const gData = await gRes.json();
                if (gRes.ok && gData && gData.data && Array.isArray(gData.data.translations) && gData.data.translations.length > 0) {
                    const t = gData.data.translations[0];
                    return res.json({ translatedText: t.translatedText, detectedSource: t.detectedSourceLanguage || null });
                }
            } catch (err) {
                console.warn('Google Translate call failed, falling back:', err?.message || err);
            }
        }

        // Fallback to LibreTranslate (self-hosted URL via LIBRETRANSLATE_URL or public instance)
        const libreHost = process.env.LIBRETRANSLATE_URL || 'https://libretranslate.de';
        // Libre accepts source='auto'
        const desiredTarget = (target && target !== 'auto') ? target : 'en';
        const translateRes = await fetch(libreHost + '/translate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ q: trimmed, source: 'auto', target: desiredTarget, format: 'text' })
        });
        if (!translateRes.ok) {
            const txt = await translateRes.text().catch(()=>null);
            console.error('/translate fallback failed', translateRes.status, txt);
            return res.status(502).json({ error: 'translator_unavailable' });
        }
        const tData = await translateRes.json();
        // LibreTranslate returns { translatedText }
        return res.json({ translatedText: tData.translatedText || tData.translated || null });
    } catch (err) {
        console.error('POST /api/translate error', err);
        res.status(500).json({ error: 'internal_error' });
    }
});