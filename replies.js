import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { config as dbConfig, prisma } from './db/database.js';
import { resolveMenuItemMatches, calculateOrderPricing, validateCreatedOrder, buildOrderConfirmationMessage } from './utils/orderPipeline.js';
import { detectConversationIntent, shouldInjectBusinessContext, buildPromptContext, createGreetingReply, isAddressReplyForPendingQuestion } from './utils/aiConversationFlow.js';
import { getActiveBranchContext } from './utils/branchSelection.js';
import { retrieveRelevantKnowledge, safeAiLog, logAiActivity, recordDecision, recordAction } from './services/aiLearningService.js';
import { createStructuredOrderConfirmation, validateStructuredConfirmation, validateCreatedOrderRecord, createPostOrderConversationState } from './utils/orderStateManagement.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const isPg = dbConfig && dbConfig.usePostgres;
const MISTRAL_API_URL = "https://api.mistral.ai/v1/chat/completions";
const FAST_AI_MODEL = process.env.MISTRAL_FAST_MODEL || 'mistral-small-latest';
const MENU_CACHE_TTL_MS = 60 * 1000;

export function resolveAiRequestConfig({ modelOverride = null, maxTokens = 140, timeoutMs = null } = {}) {
    const resolvedModel = String(modelOverride || process.env.MISTRAL_MODEL || FAST_AI_MODEL).trim() || FAST_AI_MODEL;
    const resolvedTimeout = Number.isFinite(Number(timeoutMs)) ? Number(timeoutMs) : Number(process.env.AI_TIMEOUT_MS || 4200);
    const boundedTimeout = Math.min(Math.max(resolvedTimeout, 1800), 4500);
    const boundedTokens = Math.min(Math.max(Number(maxTokens) || 140, 80), 180);

    return {
        model: resolvedModel,
        timeoutMs: boundedTimeout,
        maxTokens: boundedTokens,
        temperature: 0.2
    };
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 4200) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        return await fetch(url, {
            ...options,
            signal: controller.signal
        });
    } finally {
        clearTimeout(timeoutId);
    }
}

function logLatencySummary(latencyState = {}) {
    const summary = {
        'Webhook': latencyState.webhookMs ?? 0,
        'Database': latencyState.databaseMs ?? 0,
        'External APIs': latencyState.externalMs ?? 0,
        'AI': latencyState.aiMs ?? 0,
        'Messenger send': latencyState.messengerSendMs ?? 0,
        'Total': latencyState.totalMs ?? 0
    };
    console.log('[AI LATENCY]', summary);
}

// Friendly fallback and conversational guidance used when the model/API fails
const FALLBACK_REPLY = "Sorry, I'm having trouble processing that right now. Please try again in a moment or type 'help' for assistance.";
const CLARIFICATION_OPTIONS = "Tell me what you'd like help with, and I'll guide you from there.";
const AI_TONE_PRESETS = {
    warm: 'Use a warm, empathetic, customer-first tone. Be friendly, reassuring, and conversational without being overly casual.',
    professional: 'Use a polished, professional tone. Be clear, efficient, and confident while staying calm and courteous.',
    friendly: 'Use a friendly and conversational tone. Keep it approachable and upbeat while still sounding trustworthy and helpful.',
    concise: 'Use a concise tone. Keep replies short, direct, and easy to scan, with minimal fluff and clear action steps.'
};

export function resolveAiTone(tone = process.env.AI_TONE || 'warm') {
    const selected = String(tone || 'warm').trim().toLowerCase();
    return AI_TONE_PRESETS[selected] || AI_TONE_PRESETS.warm;
}

async function getConfiguredAiTone() {
    const envTone = process.env.AI_TONE;
    const envKey = typeof envTone === 'string' ? envTone.trim().toLowerCase() : '';
    if (envKey && AI_TONE_PRESETS[envKey]) {
        return envKey;
    }

    try {
        if (prisma && typeof prisma.setting?.findFirst === 'function') {
            const latestSetting = await prisma.setting.findFirst({
                orderBy: { id: 'desc' },
                select: { aiTone: true }
            });
            const dbTone = typeof latestSetting?.aiTone === 'string' ? latestSetting.aiTone.trim().toLowerCase() : '';
            if (dbTone && AI_TONE_PRESETS[dbTone]) {
                return dbTone;
            }
        }
    } catch (error) {
        console.warn('Unable to read persisted AI tone:', error.message);
    }

    return 'warm';
}

let knowledgeBase = [];
let cannedResponses = [];
let db = null;
let kbWatchTimeout = null;
let cannedWatchTimeout = null;

function getInsertedId(result) {
    if (!result) return null;
    if (typeof result.insertId === 'number') return result.insertId;
    if (result?.rows && Array.isArray(result.rows) && result.rows[0] && typeof result.rows[0].id !== 'undefined') {
        return result.rows[0].id;
    }
    if (Array.isArray(result) && result[0] && typeof result[0].id !== 'undefined') {
        return result[0].id;
    }
    if (typeof result.id !== 'undefined') return result.id;
    return null;
}

// Initialize database connection
function initDatabase(database) {
    db = database;
}

function loadKnowledgeBase() {
    try {
        const kbPath = path.join(__dirname, 'knowledge-base.json');
        const data = fs.readFileSync(kbPath, 'utf8');
        const parsed = JSON.parse(data);
        knowledgeBase = Array.isArray(parsed) ? parsed : [];
        console.log(`✅ Knowledge base loaded: ${knowledgeBase.length} articles`);
    } catch (error) {
        console.log("Error loading knowledge base:", error.message);
        knowledgeBase = [];
    }
}

function loadCannedResponses() {
    try {
        const responsesPath = path.join(__dirname, 'canned-responses.json');
        if (!fs.existsSync(responsesPath)) {
            cannedResponses = [];
            return;
        }
        const data = fs.readFileSync(responsesPath, 'utf8');
        const parsed = JSON.parse(data);
        cannedResponses = Array.isArray(parsed) ? parsed : [];
        console.log(`✅ Canned responses loaded: ${cannedResponses.length} items`);
    } catch (error) {
        console.log("Error loading canned responses:", error.message);
        cannedResponses = [];
    }
}

// Watch for KB file changes and auto-reload
function watchKnowledgeBaseFile() {
    try {
        const kbPath = path.join(__dirname, 'knowledge-base.json');
        fs.watchFile(kbPath, (curr, prev) => {
            if (curr.mtime > prev.mtime) {
                console.log('📖 Knowledge base file changed, reloading...');
                if (kbWatchTimeout) clearTimeout(kbWatchTimeout);
                kbWatchTimeout = setTimeout(() => {
                    loadKnowledgeBase();
                }, 500);
            }
        });
    } catch (err) {
        console.warn('Could not watch KB file:', err.message);
    }
}

function watchCannedResponsesFile() {
    try {
        const responsesPath = path.join(__dirname, 'canned-responses.json');
        fs.watchFile(responsesPath, (curr, prev) => {
            if (curr.mtime > prev.mtime) {
                console.log('📩 Canned responses file changed, reloading...');
                if (cannedWatchTimeout) clearTimeout(cannedWatchTimeout);
                cannedWatchTimeout = setTimeout(() => {
                    loadCannedResponses();
                }, 500);
            }
        });
    } catch (err) {
        console.warn('Could not watch canned responses file:', err.message);
    }
}

// Load KB on startup
loadKnowledgeBase();
loadCannedResponses();
watchKnowledgeBaseFile();
watchCannedResponsesFile();

const MENU_ITEMS = {
    pizza: {
        small: { name: 'Small Pizza', price: 10, available: 12 },
        medium: { name: 'Medium Pizza', price: 15, available: 8 },
        large: { name: 'Large Pizza', price: 20, available: 4 }
    },
    burger: {
        classic: { name: 'Classic Burger', price: 8, available: 10 },
        cheese: { name: 'Cheese Burger', price: 9, available: 6 },
        double: { name: 'Double Burger', price: 12, available: 3 }
    },
    ordersPageMenu: {
        Pizza: {
            margherita: { name: 'Margherita', price: 8.99, available: 24, description: 'Tomato sauce, fresh mozzarella, basil' },
            pepperoni: { name: 'Pepperoni', price: 9.99, available: 18, description: 'Pepperoni, mozzarella' },
            bbq_chicken: { name: 'BBQ Chicken', price: 12.50, available: 15, description: 'Smoky barbecue sauce, chicken, red onion' },
            four_cheese: { name: 'Four Cheese', price: 11.75, available: 14, description: 'Mozzarella, cheddar, parmesan, goat cheese' },
            hawaiian: { name: 'Hawaiian', price: 10.99, available: 12, description: 'Ham, pineapple, mozzarella' },
            spicy_thai: { name: 'Spicy Thai', price: 13.50, available: 10, description: 'Peanut sauce, chicken, chili, cilantro' }
        },
        Burgers: {
            classic_burger: { name: 'Classic Burger', price: 8.99, available: 25, description: 'Beef patty, lettuce, tomato, onion, pickles' },
            cheese_burger: { name: 'Cheese Burger', price: 9.99, available: 22, description: 'Beef patty, cheddar, caramelized onions' },
            double_burger: { name: 'Double Burger', price: 12.99, available: 16, description: 'Two beef patties, cheese, bacon, secret sauce' },
            veggie_deluxe: { name: 'Veggie Deluxe', price: 10.50, available: 18, description: 'Grilled veggie patty, avocado, sprouts, aioli' },
            crispy_chicken: { name: 'Crispy Chicken', price: 11.25, available: 20, description: 'Fried chicken, slaw, spicy mayo' }
        },
        Sandwiches: {
            avocado_wrap: { name: 'Avocado Wrap', price: 9.50, available: 18, description: 'Avocado, spinach, hummus, tomato in a tortilla' },
            blt_sandwich: { name: 'BLT Sandwich', price: 9.99, available: 17, description: 'Bacon, lettuce, tomato, mayo on sourdough' },
            steak_sandwich: { name: 'Steak Sandwich', price: 13.75, available: 9, description: 'Sliced steak, caramelized onions, peppercorn sauce' },
            chicken_caesar_wrap: { name: 'Chicken Caesar Wrap', price: 10.25, available: 19, description: 'Grilled chicken, romaine, parmesan, Caesar dressing' }
        },
        Salads: {
            greek_salad: { name: 'Greek Salad', price: 10.99, available: 20, description: 'Cucumber, feta, olives, tomato, oregano dressing' },
            cobb_salad: { name: 'Cobb Salad', price: 11.50, available: 18, description: 'Chicken, bacon, egg, avocado, blue cheese' }
        },
        Bowls: {
            harvest_bowl: { name: 'Harvest Bowl', price: 12.75, available: 15, description: 'Quinoa, roasted vegetables, grilled chicken, tahini' }
        },
        Pasta: {
            pesto_pasta: { name: 'Pesto Pasta', price: 11.99, available: 16, description: 'Penne tossed with basil pesto and parmesan' },
            shrimp_alfredo: { name: 'Shrimp Alfredo', price: 14.50, available: 12, description: 'Fettuccine in creamy Alfredo with sautéed shrimp' },
            mushroom_risotto: { name: 'Mushroom Risotto', price: 13.25, available: 14, description: 'Creamy arborio rice with wild mushrooms and parmesan' }
        },
        Sides: {
            loaded_fries: { name: 'Loaded Fries', price: 7.50, available: 26, description: 'Crispy fries topped with cheese, bacon, and jalapeños' },
            garlic_bread: { name: 'Garlic Bread', price: 5.99, available: 28, description: 'Toasted baguette with garlic butter and herbs' },
            onion_rings: { name: 'Onion Rings', price: 6.50, available: 24, description: 'Beer-battered onion rings with dipping sauce' },
            cheese_sticks: { name: 'Cheese Sticks', price: 7.25, available: 22, description: 'Breaded mozzarella sticks with marinara' }
        },
        Desserts: {
            chocolate_lava_cake: { name: 'Chocolate Lava Cake', price: 8.50, available: 15, description: 'Warm chocolate cake with molten core' },
            tiramisu: { name: 'Tiramisu', price: 8.99, available: 14, description: 'Coffee-soaked ladyfingers, mascarpone cream' },
            berry_parfait: { name: 'Berry Parfait', price: 7.99, available: 18, description: 'Greek yogurt layered with berries and granola' }
        },
        Drinks: {
            iced_lemon_tea: { name: 'Iced Lemon Tea', price: 3.99, available: 40, description: 'Lemon iced tea with mint and honey' },
            sparkling_water: { name: 'Sparkling Water', price: 2.99, available: 50, description: 'Chilled sparkling mineral water' }
        }
    }
};

const DELIVERY_FEE = 3.50;
const FREE_DELIVERY_THRESHOLD = 25.00;

function formatQuickPricingInfo(menuItems) {
    const lines = [
        `Delivery fee: $${DELIVERY_FEE.toFixed(2)} per order.`,
        `Free delivery for orders above $${FREE_DELIVERY_THRESHOLD.toFixed(2)}.`
    ];
    lines.push('Current menu:');
    lines.push(formatMenuItemsForPrompt(menuItems));
    return lines.join('\n');
}

function findCannedResponse(message) {
    if (!message || cannedResponses.length === 0) return null;
    const lowerMessage = message.toString().toLowerCase();

    for (const item of cannedResponses) {
        if (!item || !item.trigger || !item.content) continue;
        const triggers = Array.isArray(item.trigger) ? item.trigger : [item.trigger];
        const normalizedTriggers = triggers
            .map(t => (typeof t === 'string' ? t.toLowerCase().trim() : ''))
            .filter(Boolean);

        const matched = normalizedTriggers.some(trigger => {
            if (!trigger) return false;
            if (lowerMessage === trigger) return true;
            if (lowerMessage.includes(trigger)) return true;
            const words = lowerMessage.split(/\W+/);
            return words.includes(trigger);
        });

        if (matched) {
            return item.content;
        }
    }

    return null;
}

function parseQuickOption(message) {
    if (!message) return null;
    const normalized = message.toString().trim().toLowerCase();
    if (normalized === '0' || normalized.includes('menu')) return 'menu';
    if (normalized === '1' || normalized.includes('last order') || normalized.includes('previous order') || normalized.includes('past order')) return 'last_order';
    if (normalized === '2' || normalized.includes('staff') || normalized.includes('agent') || normalized.includes('support team') || normalized.includes('human')) return 'staff';
    return null;
}

async function handleQuickOption(choice, phone, conversationId) {
    if (choice === 'menu') {
        const menuItemsFromDb = await getMenuItemsFromDb();
        const menuItems = menuItemsFromDb.length > 0 ? menuItemsFromDb : getFallbackMenuItems();
        const formatted = formatMenuItemsForPrompt(menuItems);
        return `Here is a quick menu overview:\n${formatted}\n\nTell me what you'd like to order, or ask me anything about the menu.`;
    }

    if (choice === 'last_order') {
        if (!phone) {
            return `I don't have your phone number yet. Please send your phone number or your order ID, and I'll look up your last order for you.`;
        }
        const orderHistory = await getOrderHistory(phone);
        if (orderHistory && orderHistory.count > 0) {
            return `Here is your recent order summary:\n${orderHistory.summary}`;
        }
        return `I couldn't find any recent orders for this number. Please provide your order ID or phone number again so I can check.`;
    }

    if (choice === 'staff') {
        if (conversationId && disableAICallback) {
            disableAICallback(conversationId);
        }
        if (conversationId && handoffCallback) {
            handoffCallback(conversationId);
        }
        if (conversationId && playHandoffAudioCallback) {
            playHandoffAudioCallback(conversationId);
        }
        return `I am connecting you with our staff now. One of our agents will assist you shortly.`;
    }

}

function buildPolicyGuidance(message = '') {
    const lowerMessage = String(message || '').toLowerCase();
    const rules = [];

    const hasAllergy = /allergy|allergic|peanut|nuts|gluten|dairy|shellfish|sesame|celiac|cross contamination/.test(lowerMessage);
    const hasRefund = /refund|refunds|reimburse|compensation|voucher|credit|money back|discount/.test(lowerMessage);
    const hasDelayedOrder = /late|delay|delayed|overdue|missing items|cold food|driver delay|weather/.test(lowerMessage);
    const hasPaymentFailure = /payment failed|declined|card declined|charge failed|failed payment|transaction failed|payment issue/.test(lowerMessage);

    if (hasAllergy) {
        rules.push(
            'Food Allergy Policy: customer allergy confirmation is mandatory before any food recommendation or resolution. If the customer reports an allergy, such as a peanut allergy, or possible contamination, escalate to the supervisor/kitchen immediately, use medically cautious wording, and avoid guaranteeing food safety without kitchen confirmation.'
        );
    }

    if (hasRefund) {
        rules.push(
            'Refund Policy: only approved eligible reasons can trigger a refund or compensation. Always collect evidence, document the issue, and do not promise a refund or voucher without confirming the eligibility and approval threshold. For severe service failures, escalate to a manager and prefer documented compensation paths only.'
        );
    }

    if (hasDelayedOrder) {
        rules.push(
            'Delivery Delay Policy: keep the message proactive and transparent, confirm the order status, and provide the latest ETA when available. If the delay is severe, escalate to the delivery or operations lead and offer the documented recovery path only.'
        );
    }

    if (hasPaymentFailure) {
        rules.push(
            'Payment Failure Policy: validate the payment status before offering a refund or retry. Do not promise a reimbursement or claim a charge was successful without checking the transaction state, and guide the customer toward the supported retry or manual review flow.'
        );
    }

    if (rules.length === 0) {
        return 'No policy-specific issue detected. Reply with the standard customer support guidance and stay within the approved response posture for the conversation.';
    }

    return `Policy guardrails for this reply:\n- ${rules.join('\n- ')}`;
}

let menuCache = {
    items: null,
    cachedAt: 0
};

async function getMenuItemsFromDb() {
    const now = Date.now();
    if (menuCache.items && now - menuCache.cachedAt < MENU_CACHE_TTL_MS) {
        return menuCache.items;
    }

    try {
        if (!prisma || !prisma.menu) {
            return [];
        }
        const items = await prisma.menu.findMany({
            select: {
                category: true,
                name: true,
                key_name: true,
                price: true,
                available: true
            },
            orderBy: [
                { category: 'asc' },
                { name: 'asc' }
            ]
        });
        const mapped = Array.isArray(items) ? items.map(item => ({
            category: item.category || 'Menu',
            name: item.name || item.key_name || 'Unknown item',
            price: Number(item.price || 0),
            available: typeof item.available === 'number' ? item.available : 0
        })) : [];

        // Also attempt to read from a possibly separately-created quoted table "Menu" (capital M)
        try {
            const raw = await prisma.$queryRawUnsafe('SELECT category, name, key_name, price, available FROM "Menu" ORDER BY category ASC, name ASC');
            if (Array.isArray(raw) && raw.length > 0) {
                const mappedRaw = raw.map(item => ({
                    category: item.category || 'Menu',
                    name: item.name || item.key_name || 'Unknown item',
                    price: Number(item.price || 0),
                    available: typeof item.available === 'number' ? item.available : 0
                }));

                // Merge, preferring non-empty names and deduplicate by name+category
                const seen = new Map();
                for (const it of [...mapped, ...mappedRaw]) {
                    const key = `${(it.category||'').toLowerCase()}::${(it.name||'').toLowerCase()}`;
                    if (!seen.has(key)) seen.set(key, it);
                }
                menuCache = { items: Array.from(seen.values()), cachedAt: Date.now() };
                return menuCache.items;
            }
        } catch (err) {
            console.warn('getMenuItemsFromDb quoted "Menu" read failed:', err?.message || err);
        }

        menuCache = { items: mapped, cachedAt: Date.now() };
        return mapped;
    } catch (error) {
        console.log('getMenuItemsFromDb error:', error?.message || error);
        return [];
    }
}

function getFallbackMenuItems() {
    const items = [];
    const menuSource = MENU_ITEMS.ordersPageMenu ? MENU_ITEMS.ordersPageMenu : MENU_ITEMS;
    for (const [category, group] of Object.entries(menuSource)) {
        if (typeof group !== 'object' || group === null) continue;
        const categoryName = category.charAt(0).toUpperCase() + category.slice(1);
        for (const item of Object.values(group)) {
            items.push({
                category: categoryName,
                name: item.name,
                price: item.price,
                available: item.available || 0
            });
        }
    }
    return items;
}

function formatMenuItemsForPrompt(menuItems) {
    if (!Array.isArray(menuItems) || menuItems.length === 0) {
        return '';
    }

    const grouped = menuItems.reduce((acc, item) => {
        const category = item.category || 'Menu';
        if (!acc[category]) acc[category] = [];
        acc[category].push(item);
        return acc;
    }, {});

    const lines = [];
    for (const category of Object.keys(grouped)) {
        lines.push(`${category}:`);
        grouped[category].forEach(item => {
            const availableText = typeof item.available === 'number' ? ` (${item.available} available)` : '';
            const descriptionText = item.description ? ` - ${item.description}` : '';
            lines.push(`- ${item.name}: $${item.price.toFixed(2)}${availableText}${descriptionText}`);
        });
        lines.push('');
    }
    return lines.join('\n').trim();
}

function normalizeMenuSearchText(value = '') {
    return String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

function isMenuAvailabilityInquiry(message = '') {
    const lowerMessage = String(message || '').toLowerCase();
    return /\b(?:do you have|have you got|is there|are there|can i get|can i order)\b/.test(lowerMessage)
        || /\b(?:is|are)\b.+\b(?:available|in stock)\b/.test(lowerMessage);
}

function extractMenuAvailabilityName(message = '') {
    const text = String(message || '').trim();
    const match = text.match(/(?:do you have|have you got|is there|are there|can i get|can i order)\s+(?:(?:a|an|some)\s+)?(.+?)(?:\?|$)/i)
        || text.match(/(?:is|are)\s+(.+?)\s+(?:available|in stock)(?:\?|$)/i);
    return match?.[1]?.replace(/\b(?:please|right now|today)\b/gi, '').trim() || '';
}

export function formatMenuAvailabilityReply(message, menuItems = []) {
    if (!isMenuAvailabilityInquiry(message)) return null;
    if (!Array.isArray(menuItems) || menuItems.length === 0) {
        return "I can't verify that item against the current menu right now. Please try again in a moment.";
    }

    const normalizedMessage = normalizeMenuSearchText(message);
    const requestedName = extractMenuAvailabilityName(message);
    const normalizedRequestedName = normalizeMenuSearchText(requestedName);
    const match = menuItems
        .filter(item => item && item.name)
        .sort((left, right) => normalizeMenuSearchText(right.name).length - normalizeMenuSearchText(left.name).length)
        .find(item => {
            const normalizedName = normalizeMenuSearchText(item.name);
            return normalizedName === normalizedRequestedName
                || (normalizedName.length > 2 && normalizedMessage.includes(normalizedName))
                || (normalizedRequestedName.length > 2 && normalizedName.includes(normalizedRequestedName));
        });

    if (!match) {
        const displayName = requestedName || 'that item';
        return `I couldn't find ${displayName} on the current menu.`;
    }

    const available = Number(match.available || 0);
    if (available <= 0) {
        return `${match.name} is currently unavailable.`;
    }

    return `Yes, ${match.name} is on the current menu and available now${available > 0 ? ` (${available} available)` : ''}.`;
}

function isMenuInquiry(message) {
    if (!message) return false;
    const lowerMessage = message.toLowerCase();
    const menuKeywords = [
        'menu',
        'show me the menu',
        'what do you have',
        'do you have',
        'have you got',
        'is there',
        'are there',
        'can i get',
        'can i order',
        'what can i order',
        'available items',
        'food options',
        'price list',
        'what are your pizzas',
        'what are your burgers',
        'see the menu',
        'menu items',
        'order from menu',
        'dishes',
        'specials',
        'what is on the menu',
        'what do you serve',
        'price',
        'delivery fee',
        'delivery charge'
    ];
    return menuKeywords.some(keyword => lowerMessage.includes(keyword));
}

function isReservationInquiry(message) {
    if (!message) return false;
    const lowerMessage = message.toLowerCase();
    const reservationKeywords = [
        'book',
        'reserve',
        'reservation',
        'table for',
        'book for',
        'can i book',
        'can i reserve',
        'booking',
        'table availability',
        'reserve a table'
    ];
    return reservationKeywords.some(keyword => lowerMessage.includes(keyword));
}

function isModificationRequest(message, conversationState = null) {
    if (!message) return false;
    if (isAddressReplyForPendingQuestion(message, conversationState)) {
        return false;
    }
    const lowerMessage = message.toLowerCase();
    const modificationPatterns = [
        /\bremove\b/i,
        /\badd\b/i,
        /\bextra\b/i,
        /\bsubstitute\b/i,
        /\bwithout\b/i,
        /\bhold the\b/i,
        /\bactually make that\b/i,
        /\bmake that\b/i,
        /\bchange it to\b/i,
        /\bchange my order\b/i,
        /\bupdate my order\b/i
    ];
    return modificationPatterns.some(pattern => pattern.test(lowerMessage));
}

function isMissingItemRequest(message) {
    if (!message) return false;
    const lowerMessage = message.toLowerCase();
    const missingKeywords = [
        'forgot',
        'missing',
        'did not receive',
        'didn\'t receive',
        'no drink',
        'no side',
        'drink is missing',
        'item is missing',
        'missing item',
        'not included'
    ];
    return missingKeywords.some(keyword => lowerMessage.includes(keyword));
}

async function findRelevantKB(message) {
    try {
        if (!message || !knowledgeBase || knowledgeBase.length === 0) return [];
        
        const lowerMessage = (message || '').toLowerCase();
        const relevantArticles = [];
        
        // Check each knowledge base article for keyword matches
        for (const article of knowledgeBase) {
            if (article.keywords && Array.isArray(article.keywords)) {
                const hasKeywordMatch = article.keywords.some(keyword => 
                    lowerMessage.includes(keyword.toLowerCase())
                );
                
                if (hasKeywordMatch) {
                    relevantArticles.push({
                        title: article.title,
                        content: article.content,
                        category: article.category
                    });
                }
            }
        }
        
        // If no keyword matches, try content search as fallback
        if (relevantArticles.length === 0) {
            for (const article of knowledgeBase) {
                if (article.content && article.content.toLowerCase().includes(lowerMessage)) {
                    relevantArticles.push({
                        title: article.title,
                        content: article.content,
                        category: article.category
                    });
                }
            }
        }
        
        // Limit to top 3 most relevant articles to avoid overwhelming the AI
        return relevantArticles.slice(0, 3);
        
    } catch (e) {
        console.warn('findRelevantKB failed', e?.message || e);
        return [];
    }
}

function analyzeSentiment(message) {
    const lowerMessage = message.toLowerCase();
    const positiveWords = ['thank', 'good', 'great', 'excellent', 'awesome', 'perfect', 'love', 'happy', 'satisfied'];
    const negativeWords = ['angry', 'frustrated', 'bad', 'terrible', 'hate', 'disappointed', 'worst', 'stupid', 'useless', 'refund', 'cancel'];
    const urgentWords = ['urgent', 'emergency', 'asap', 'immediately', 'now', 'quickly', 'help', 'problem', 'issue', 'broken'];

    let positive = 0, negative = 0, urgent = 0;
    const words = lowerMessage.split(/\s+/);

    words.forEach(word => {
        if (positiveWords.includes(word)) positive++;
        if (negativeWords.includes(word)) negative++;
        if (urgentWords.includes(word)) urgent++;
    });

    let sentiment = 'neutral';
    if (negative > positive) sentiment = 'negative';
    else if (positive > negative) sentiment = 'positive';

    return { sentiment, score: positive - negative, urgent: urgent > 0 };
}

function normalizePhone(phone) {
    // Remove all non-digit characters
    return phone.replace(/\D/g, '');
}

async function getOrderHistory(phone) {
    if (!phone) {
        console.log("getOrderHistory: No phone", { phone });
        return null;
    }

    const normalizedPhone = normalizePhone(phone);
    console.log("getOrderHistory: Querying for phone:", phone, "normalized:", normalizedPhone);

    try {
        const orders = await prisma.order.findMany({
            where: { phone: { not: null } },
            orderBy: { order_date: 'desc' },
            take: 200
        });

        const matchNormalized = orders.filter(order => normalizePhone(order.phone || '') === normalizedPhone);
        const results = matchNormalized.length > 0 ? matchNormalized : orders.filter(order => order.phone === phone);

        if (results.length === 0) {
            console.log("getOrderHistory: No orders found for phone:", phone);
            const samples = orders.slice(0, 5).map(o => o.phone);
            console.log("getOrderHistory: Sample phone formats in DB:", samples);
            return null;
        }

        const ordered = results.slice(0, 5);
        const orderSummary = ordered.map(order =>
            `- Order ${order.order_id}: ${order.product} ($${order.total_amount ?? order.amount ?? 0}) on ${order.order_date ? new Date(order.order_date).toLocaleDateString() : 'unknown date'}`
        ).join('\n');

        const totalSpent = ordered.reduce((sum, order) => sum + parseFloat((order.total_amount ?? order.amount ?? 0).toString()), 0);

        const response = {
            summary: orderSummary,
            totalSpent: totalSpent.toFixed(2),
            count: ordered.length
        };
        console.log("getOrderHistory: Resolved with:", response);
        return response;
    } catch (err) {
        console.log("getOrderHistory: Database error:", err);
        return null;
    }
}

let disableAICallback = null;
let handoffCallback = null;
let playHandoffAudioCallback = null;

// Set the callback to disable AI (called from server.js)
function setDisableAICallback(callback) {
    disableAICallback = callback;
}

// Set the callback to notify the server when the AI hands off to staff
function setHandoffCallback(callback) {
    handoffCallback = callback;
}

// Set the callback to play handoff audio
function setPlayHandoffAudioCallback(callback) {
    playHandoffAudioCallback = callback;
}

function isRequestingStaff(message) {
    const staffKeywords = [
        'agent', 'staff', 'human', 'representative', 'speak to', 'talk to', 'connect me', 'call me',
        'support team', 'human agent', 'live agent', 'customer service', 'customer support', 'real person',
        'someone from support', 'i want to talk to', 'i need to talk to', 'transfer me', 'transfer to', 'manager',
        'supervisor', 'escalate', 'speak with', 'speak to a', 'talk with', 'talk to someone', 'talk to support',
        'get me to', 'put me through to'
    ];
    const lowerMessage = (message || '').toLowerCase();
    return staffKeywords.some(keyword => lowerMessage.includes(keyword));
}

function isCashPaymentRequest(message) {
    const lowerMessage = String(message || '').toLowerCase();
    return /\b(?:pay|payment|paying|purchase|order)\b[\s\S]{0,40}\bcash\b|\bcash\b[\s\S]{0,40}\b(?:pay|payment|paying|purchase|order)\b/i.test(lowerMessage)
        || /\b(?:with|by|using|in)\s+cash\b/i.test(lowerMessage)
        || /\bcash\s+(?:payment|purchase)\b/i.test(lowerMessage);
}

function extractOrderId(message) {
    if (!message) return null;
    const match = message.toUpperCase().match(/\bORD[-_\s]?\d+\b/);
    if (!match) return null;
    return match[0].replace(/[_\s]/g, '');
}

function isOrderIdOnlyMessage(message) {
    if (!message) return false;
    const trimmed = message.trim().toUpperCase();
    return /^ORD[-]?\d+$/.test(trimmed);
}

function isOrderStatusInquiry(message) {
    if (!message) return false;
    const lowerMessage = message.toLowerCase();
    const orderStatusKeywords = [
        'order status',
        'status of my order',
        'where is my order',
        'have not seen my order',
        "haven't seen my order",
        'not received my order',
        'track my order',
        'track order',
        'order update',
        'order tracking',
        'check my order',
        'delivery status',
        'where is order',
        'order is',
        'status for order',
        'eta',
        'estimated time',
        'delivery time',
        'delay',
        'late'
    ];
    return orderStatusKeywords.some(keyword => lowerMessage.includes(keyword));
}

function isRefundInquiry(message) {
    if (!message) return false;
    const lowerMessage = message.toLowerCase();
    const refundKeywords = [
        'refund',
        'money back',
        'return my money',
        'cancel order',
        'cancel my order',
        'chargeback',
        'refund request',
        'reimburse',
        'compensation',
        'get my money back',
        'want my money back'
    ];
    return refundKeywords.some(keyword => lowerMessage.includes(keyword));
}

function isColdFoodComplaint(message) {
    if (!message) return false;
    const lowerMessage = message.toLowerCase();
    const coldKeywords = [
        'cold food',
        'food arrived cold',
        'cold order',
        'food is cold',
        'my food is cold',
        'cold meal'
    ];
    return coldKeywords.some(keyword => lowerMessage.includes(keyword));
}

function extractPartySize(message) {
    if (!message) return null;
    const lower = message.toLowerCase();
    const match = lower.match(/(?:for|party of|party|table for|book for)\s*(\d{1,2})/i) || lower.match(/(\d{1,2})\s*(?:people|persons|guests|pax)/i);
    if (!match) return null;
    const value = parseInt(match[1], 10);
    return Number.isFinite(value) ? value : null;
}

function getBranchDisplayName(branchId = null) {
    const branchMap = {
        1: 'Ikeja',
        2: 'Lekki',
        3: 'Victoria Island'
    };
    const normalizedBranchId = Number(branchId || 0);
    return branchMap[normalizedBranchId] || 'your branch';
}

async function buildSupportReply(message = '', options = {}) {
    const lowerMessage = String(message || '').toLowerCase();
    const branchId = options?.branchId;
    const intent = options?.intent || 'Unknown';
    const branchLabel = getBranchDisplayName(branchId);
    const branchContext = branchId ? `For ${branchLabel}, ` : '';

    // NEW_ORDER requests must go to AI for proper ordering flow.
    // Never use canned responses for new order attempts.
    if (intent === 'New Order') {
        return null;
    }

    if (isMenuInquiry(message)) {
        if (isMenuAvailabilityInquiry(message)) {
            const menuItems = await getMenuItemsFromDb();
            return formatMenuAvailabilityReply(message, menuItems);
        }

        // Try reading live menu from the database first; fall back to canned text when unavailable
        try {
            const menuItems = await getMenuItemsFromDb();
            if (Array.isArray(menuItems) && menuItems.length > 0) {
                const quick = formatQuickPricingInfo(menuItems);
                return `${branchContext}${quick}`;
            }
        } catch (err) {
            console.warn('buildSupportReply getMenuItemsFromDb failed:', err?.message || err);
        }

        // Fallback canned message
        return `${branchContext}I can share our current menu and pricing. Our delivery fee is $${DELIVERY_FEE.toFixed(2)} per order, and orders above $${FREE_DELIVERY_THRESHOLD.toFixed(2)} qualify for free delivery. I can also highlight featured dishes or the full menu for you.`;
    }

    if (isOrderStatusInquiry(message)) {
        return `${branchContext}I can help with your order status and ETA. Please send your order ID (for example ORD-12345) so I can check the latest status, estimated arrival time, and any delays for you.`;
    }

    if (isColdFoodComplaint(message)) {
        return `I’m very sorry your food arrived cold. I sincerely apologize for the inconvenience. I can offer a replacement, expedited redelivery, or a manager review right away. Please tell me which option you prefer and I’ll start the resolution process.`;
    }

    if (isModificationRequest(message, options?.conversationState)) {
        return `${branchContext}I can help update your order if the change is still within the allowed modification window. Please send your order ID and the exact change you want, such as removing onions or adding extra chicken.`;
    }

    if (isRefundInquiry(message)) {
        return `I understand you want a refund. I can check eligibility first, and if the request qualifies, I’ll escalate it to a manager for approval and keep you updated throughout the process.`;
    }

    if (isReservationInquiry(message)) {
        const partySize = extractPartySize(message);
        const partyText = partySize ? `for ${partySize}` : 'for your party';
        return `${branchContext}I can help check availability ${partyText}. Please share your preferred date, time, and party size so I can confirm the reservation options.`;
    }

    if (isMissingItemRequest(message)) {
        return `I’m sorry something was missing from your order. I can arrange a quick replacement for the missing item or offer a voucher or store credit if that is the better resolution.`;
    }

    if (/(help|assist|issue|problem|order)/.test(lowerMessage) && branchId) {
        return `${branchContext}I can help with your order, delivery, reservation, or refund request. Please share your order ID or a brief description of the issue so I can route it correctly.`;
    }

    return null;
}

async function getOrderById(orderId) {
    if (!orderId) return null;

    try {
        const order = await prisma.order.findUnique({
            where: { order_id: orderId },
            include: { deliveries: true }
        });

        if (!order) return null;

        const delivery = order.deliveries?.[0] || {};
        return {
            order_id: order.order_id,
            customer_name: order.customer_name,
            items: order.product,
            total_amount: order.total_amount ?? order.amount,
            order_status: order.status,
            order_date: order.order_date,
            delivery_status: delivery.delivery_status,
            rider_name: delivery.rider_name,
            vehicle: delivery.vehicle
        };
    } catch (err) {
        console.log('getOrderById error:', err);
        return null;
    }
}

function formatOrderStatusResponse(order) {
    const orderId = order.order_id;
    const customerName = order.customer_name || 'Customer';
    const status = order.delivery_status || order.order_status || 'pending';
    const total = parseFloat(order.total_amount || 0).toFixed(2);
    const orderDate = order.order_date ? new Date(order.order_date).toLocaleDateString() : 'unknown date';
    const riderName = order.rider_name || 'Not assigned';
    const vehicle = order.vehicle || 'Unknown';

    let response = `I found order ${orderId} for ${customerName}. It was placed on ${orderDate}. `;
    response += `Current status: ${status}. `;
    response += `Rider: ${riderName}. `;
    response += `Vehicle: ${vehicle}. `;
    response += `Total amount: $${total}.`;

    return response;
}

function extractOrderItemsFromMessage(message) {
    const lowerMessage = message.toLowerCase();
    const normalizedMessage = lowerMessage.replace(/\s+and\s+/gi, ', ').replace(/\s*&\s*/g, ', ');
    const orderItems = [];
    let total = 0;

    const numberWords = {
        'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
        'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10
    };

    function parseQuantity(str) {
        if (!str) return 1;
        const num = parseInt(str, 10);
        if (!isNaN(num)) return num;
        return numberWords[str.toLowerCase()] || 1;
    }

    function addItems(count, itemKey) {
        for (let i = 0; i < count; i++) {
            orderItems.push(itemKey);
        }
    }

    const pizzaSizes = {
        'small': 'small pizza',
        'medium': 'medium pizza',
        'large': 'large pizza'
    };

    const burgerTypes = {
        'classic': 'classic burger',
        'cheese': 'cheese burger',
        'double': 'double burger'
    };

    const friesPattern = /(\d+|one|two|three|four|five|six|seven|eight|nine|ten)?\s*fries/gi;
    let friesMatch;
    let friesCount = 0;
    while ((friesMatch = friesPattern.exec(normalizedMessage)) !== null) {
        friesCount += parseQuantity(friesMatch[1]);
    }

    const waterPattern = /(\d+|one|two|three|four|five|six|seven|eight|nine|ten)?\s*(?:bottles?|bottle)\s+of\s+sparkling\s+water/gi;
    let waterMatch;
    while ((waterMatch = waterPattern.exec(normalizedMessage)) !== null) {
        const quantity = parseQuantity(waterMatch[1]);
        addItems(quantity, 'sparkling water');
        total += quantity * MENU_ITEMS.ordersPageMenu.Drinks.sparkling_water.price;
    }

    const pizzaPattern = /(\d+|one|two|three|four|five|six|seven|eight|nine|ten)?\s*(small|medium|large)\s*pizza/gi;
    let pizzaMatch;
    while ((pizzaMatch = pizzaPattern.exec(normalizedMessage)) !== null) {
        const quantity = parseQuantity(pizzaMatch[1]);
        const size = pizzaMatch[2];
        if (pizzaSizes[size]) {
            addItems(quantity, pizzaSizes[size]);
            total += quantity * MENU_ITEMS.pizza[size].price;
        }
    }

    const burgerPattern = /(?:\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+)?(classic|cheese|double|bacon|spicy|grilled|crispy)?\s*burger\b/gi;
    let burgerMatch;
    while ((burgerMatch = burgerPattern.exec(normalizedMessage)) !== null) {
        const quantity = parseQuantity(burgerMatch[1]);
        const type = burgerMatch[2] ? burgerMatch[2].trim() : '';
        const itemKey = type ? `${type} burger` : 'burger';
        addItems(quantity, itemKey);
        total += quantity * (MENU_ITEMS.burger[type] ? MENU_ITEMS.burger[type].price : MENU_ITEMS.burger.cheese.price);
    }

    const wrapPattern = /(?:\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+)?([a-zA-Z][a-zA-Z\s]*?)\s*wraps?\b/gi;
    let wrapMatch;
    while ((wrapMatch = wrapPattern.exec(normalizedMessage)) !== null) {
        const quantity = parseQuantity(wrapMatch[1]);
        const wrapType = wrapMatch[2] ? wrapMatch[2].trim() : '';
        const itemKey = wrapType ? `${wrapType} wrap` : 'wrap';
        addItems(quantity, itemKey);
        total += quantity * 10.25;
    }

    if (orderItems.length === 0) {
        const genericPizzaPattern = /(\d+|one|two|three|four|five|six|seven|eight|nine|ten)?\s*(?:small|medium|large)?\s*pizzas?\b/gi;
        let genericPizzaMatch;
        while ((genericPizzaMatch = genericPizzaPattern.exec(lowerMessage)) !== null) {
            const quantity = parseQuantity(genericPizzaMatch[1]);
            addItems(quantity, 'pizza');
            total += quantity * MENU_ITEMS.pizza.medium.price;
        }

        const genericBurgerPattern = /(\d+|one|two|three|four|five|six|seven|eight|nine|ten)?\s*(?:classic|cheese|double)?\s*burgers?\b/gi;
        let genericBurgerMatch;
        while ((genericBurgerMatch = genericBurgerPattern.exec(lowerMessage)) !== null) {
            const quantity = parseQuantity(genericBurgerMatch[1]);
            addItems(quantity, 'burger');
            total += quantity * MENU_ITEMS.burger.cheese.price;
        }

        const genericWrapPattern = /(\d+|one|two|three|four|five|six|seven|eight|nine|ten)?\s*wraps?\b/gi;
        let genericWrapMatch;
        while ((genericWrapMatch = genericWrapPattern.exec(lowerMessage)) !== null) {
            const quantity = parseQuantity(genericWrapMatch[1]);
            addItems(quantity, 'wrap');
            total += quantity * 10.25;
        }

        const genericWaterPattern = /(\d+|one|two|three|four|five|six|seven|eight|nine|ten)?\s*(?:bottles?|bottle)\s+of\s+water\b/gi;
        let genericWaterMatch;
        while ((genericWaterMatch = genericWaterPattern.exec(lowerMessage)) !== null) {
            const quantity = parseQuantity(genericWaterMatch[1]);
            addItems(quantity, 'sparkling water');
            total += quantity * MENU_ITEMS.ordersPageMenu.Drinks.sparkling_water.price;
        }
    }

    // If the message only contains fries and no priced items, ignore it for order total extraction.
    if (orderItems.length === 0 && friesCount > 0) {
        return { items: null, total: 0 };
    }

    const counts = orderItems.reduce((acc, item) => {
        acc[item] = (acc[item] || 0) + 1;
        return acc;
    }, {});

    const itemSummary = Object.entries(counts)
        .map(([item, count]) => {
            if (count === 1) return item;
            if (item === 'pizza') return `${count} pizzas`;
            if (item === 'burger') return `${count} burgers`;
            if (item.endsWith('pizza')) return `${count} ${item.replace(/pizza$/, 'pizzas')}`;
            if (item.endsWith('burger')) return `${count} ${item.replace(/burger$/, 'burgers')}`;
            return `${count} ${item}s`;
        })
        .join(' and ');

    return { items: itemSummary, total };
}

function formatOrderItemsForConfirmation(items) {
    if (!Array.isArray(items) || items.length === 0) return '';
    return items
        .filter(item => item && typeof item.name === 'string' && item.name.trim() !== '' && Number(item.quantity) > 0)
        .map(item => {
            const name = item.name.trim();
            const quantity = Number(item.quantity);
            return quantity > 1 ? `${name} x${quantity}` : name;
        })
        .join(', ');
}

function cleanJsonOnlyResponse(text) {
    if (!text || typeof text !== 'string') return '';
    let cleaned = text.trim();
    cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/```$/, '').trim();
    return cleaned;
}

async function parseOrderJsonFromAI(message, menuContext = '') {
    if (!message) return { items: [] };
    try {
        const systemPrompt = `You are an order extraction assistant. Extract the ordered items and quantities from the customer's message and return ONLY valid JSON. Do not include markdown, explanations, summaries, prices, totals, or any extra text. If no order is detected, return {"items":[]}.`;
        let userPrompt = `Customer message: "${message}"

Return only valid JSON using this exact structure:
{"items":[{"name":"Item Name","quantity":2}]}

If there are no order items, return {"items":[]}.`;
        if (menuContext) {
            userPrompt += `

Menu reference:
${menuContext}`;
        }

        const aiConfig = resolveAiRequestConfig({ maxTokens: 80, timeoutMs: 3000 });
        const response = await fetchWithTimeout(MISTRAL_API_URL, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.MISTRAL_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: aiConfig.model,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt }
                ],
                max_tokens: aiConfig.maxTokens,
                temperature: aiConfig.temperature
            })
        }, aiConfig.timeoutMs);

        if (!response.ok) {
            const rawError = await response.text().catch(() => '');
            console.log("parseOrderJsonFromAI error:", response.status, rawError);
            return { items: [] };
        }

        const data = await response.json();
        const rawContent = data.choices?.[0]?.message?.content || '';
        const cleaned = cleanJsonOnlyResponse(rawContent);
        const parsed = JSON.parse(cleaned);

        if (!parsed || !Array.isArray(parsed.items)) {
            return { items: [] };
        }

        return {
            items: parsed.items
                .filter(item => item && typeof item.name === 'string' && item.name.trim() !== '' && Number(item.quantity) > 0)
                .map(item => ({ name: item.name.trim(), quantity: Number(item.quantity) }))
        };
    } catch (err) {
        console.log("parseOrderJsonFromAI failed:", err?.message || err);
        return { items: [] };
    }
}

async function calculateOrderTotalFromItems(items) {
    if (!Array.isArray(items) || items.length === 0) return 0;

    let menuItems = await getMenuItemsFromDb();
    if (!Array.isArray(menuItems) || menuItems.length === 0) {
        menuItems = getFallbackMenuItems();
    }

    function normalizeName(name) {
        return name.toString().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    }

    const normalizedMenu = menuItems.map(item => ({
        name: item.name || '',
        normalized: normalizeName(item.name || ''),
        price: Number(item.price || 0)
    }));

    let total = 0;
    for (const item of items) {
        const normalizedItemName = normalizeName(item.name);
        const exactMatch = normalizedMenu.find(menuItem => menuItem.normalized === normalizedItemName);
        const containsMatch = normalizedMenu.find(menuItem => normalizedItemName.includes(menuItem.normalized) || menuItem.normalized.includes(normalizedItemName));
        const match = exactMatch || containsMatch;
        total += item.quantity * (match ? match.price : 0);
    }

    return total;
}

function isTicketCreationRequest(message) {
    const lowerMessage = message.toLowerCase();
    const ticketKeywords = [
        'open a ticket',
        'file a ticket',
        'create a ticket',
        'raise a ticket',
        'log a ticket',
        'make a ticket',
        'support ticket',
        'i want to file a complaint',
        'i want to file a ticket',
        'i want a refund',
        'i want to report a problem',
        'I am having trouble',
        'issue with',
        'problem with',
        'not working',
        'problem',
        'issue',
        'report',
        'complaint',
        'complain',
        'bug report'
    ];
    return ticketKeywords.some(keyword => lowerMessage.includes(keyword));
}

function isProblemReportRequest(message) {
    const lowerMessage = message.toLowerCase();
    const problemKeywords = [
        'i need help',
        'need help with',
        'issue with',
        'problem with',
        'report a problem',
        'report an issue',
        'i have a complaint',
        'this is urgent',
        'please help me',
        "can't resolve",
        'cannot resolve',
        'not working',
        'service down',
        'bug report',
        'technical issue',
        'support needed'
    ];
    return problemKeywords.some(keyword => lowerMessage.includes(keyword));
}

function isHandoffReply(message) {
    const lowerMessage = message.toLowerCase();
    const handoffPhrases = [
        'follow up shortly',
        'our team will follow up',
        'one of our agents will be with you shortly',
        'an agent will be with you shortly',
        'connecting you with our support team',
        'connecting you with support',
        'transfer you to',
        'transferring you to',
        'handing you over',
        'please wait while i connect',
        'please wait while i transfer',
        'i m connecting you with',
        'i am connecting you with',
        'support agent will assist',
        'support team will assist',
        'human agent will assist',
        'i will transfer you',
        'i will connect you',
        'you are being transferred'
    ];
    return handoffPhrases.some(keyword => lowerMessage.includes(keyword));
}

function shouldTriggerHandoff(message, conversationHistory = []) {
    const sentiment = analyzeSentiment(message);
    
    // Always hand off if sentiment is negative and urgent
    if (sentiment.sentiment === 'negative' && sentiment.urgent) {
        return { shouldHandoff: true, reason: 'negative_urgent' };
    }
    
    // Check for repeated negative messages
    const recentMessages = conversationHistory.slice(-5);
    const negativeCount = recentMessages.filter(msg => analyzeSentiment(msg.message || msg).sentiment === 'negative').length;
    if (negativeCount >= 3) {
        return { shouldHandoff: true, reason: 'repeated_negative' };
    }
    
    // Keep the AI engaged for complex queries and attempt to ask follow-up questions first.
    // Only hand off if the customer explicitly requests staff or expresses severe negative urgency.
    const questionCount = (message.match(/\?/g) || []).length;
    if (questionCount > 4 && sentiment.sentiment === 'negative') {
        return { shouldHandoff: true, reason: 'complex_negative_query' };
    }

    // Check for specific keywords that require human intervention
    const escalationKeywords = ['manager', 'supervisor', 'complain', 'escalate', 'speak to human', 'real person'];
    if (escalationKeywords.some(keyword => message.toLowerCase().includes(keyword))) {
        return { shouldHandoff: true, reason: 'escalation_request' };
    }

    // If the customer explicitly requests a human/agent, always hand off
    try {
        if (isRequestingStaff(message)) {
            return { shouldHandoff: true, reason: 'customer_requested_human' };
        }
    } catch (e) {
        // ignore errors from detection
    }
    
    return { shouldHandoff: false, reason: null };
}

export function shouldAskOrderConfirmation(message = '', conversationState = null) {
    const lowerMessage = String(message || '').toLowerCase().replace(/[’']/g, "'");
    if (!lowerMessage) return false;

    const state = conversationState || {};
    const workflow = String(state.workflowState || '').toLowerCase();
    const pending = Array.isArray(state.pendingQuestions) ? state.pendingQuestions.join(' ').toLowerCase() : '';
    const workflowReady = workflow.includes('ready to create order') || pending.includes('place the order') || pending.includes('confirm');
    if (!workflowReady) return false;

    const finalizationPhrases = [
        /(?:no|nah|nope)[^\n]*?(?:that's all|thats all|that's it|thats it|nothing else|nothing else thanks|all good)/i,
        /(?:that's all|thats all|that's it|thats it|nothing else|all set|done)/i,
        /(?:no,?\s*)?(?:that's all|that is all|nothing else)/i
    ];

    return finalizationPhrases.some((phrase) => phrase.test(lowerMessage));
}

function hasOrderConfirmationPromptInHistory(conversationHistory = []) {
    const historyText = Array.isArray(conversationHistory)
        ? conversationHistory.map((item) => item?.message || '').join(' ')
        : '';
    if (!historyText) return false;

    const lowerHistory = historyText.toLowerCase();
    return /(are you sure you want to place this order|would you like me to place the order|place this order|confirm.*order)/i.test(lowerHistory);
}

function isOrderConfirmationResponse(message, conversationState = null, conversationHistory = []) {
    const lowerMessage = String(message || '').toLowerCase().trim();
    if (!lowerMessage) return false;

    const state = conversationState || {};
    const workflow = String(state.workflowState || '').toLowerCase();
    const pendingQuestions = Array.isArray(state.pendingQuestions) ? state.pendingQuestions.join(' ').toLowerCase() : '';
    const hasOrderFlowContext = workflow.includes('ready to create order')
        || workflow.includes('awaiting_order_confirmation')
        || pendingQuestions.includes('place the order')
        || pendingQuestions.includes('confirm');

    if (!hasOrderFlowContext) {
        return false;
    }

    return /^(?:(?:yes|yeah|yep|sure|okay|ok|go ahead|please|yes please|sure thing|come on)[,!\s]+)?(?:confirm|place|order|go ahead|proceed|do it)(?:\s+(?:my|the))?(?:\s+order)?[.!]?$/.test(lowerMessage)
        || /^(?:yes|yeah|yep|sure|okay|ok)[,!\s]+(?:please\s+)?(?:confirm|place|order|go ahead|proceed|do it)\b.*$/i.test(lowerMessage)
        || /^(?:no|nope|nah|cancel|stop|dont|don't|never mind|not now)$/.test(lowerMessage);
}

function isPositiveConfirmation(message) {
    const lowerMessage = message.toLowerCase().trim();
    return /^(?:(?:yes|yeah|yep|sure|okay|ok|go ahead|please|yes please|sure thing|come on)[,!\s]+)?(?:confirm|place|order|go ahead|proceed|do it)(?:\s+(?:my|the))?(?:\s+order)?[.!]?$/.test(lowerMessage)
        || /^(?:yes|yeah|yep|sure|okay|ok)[,!\s]+(?:please\s+)?(?:confirm|place|order|go ahead|proceed|do it)\b.*$/i.test(lowerMessage);
}

function removeUnsolicitedOrderUpsell(reply, customerMessage, conversationState) {
    const replyText = String(reply || '');
    const customerText = String(customerMessage || '').toLowerCase();
    const extrasRequested = /\b(side|sides|topping|toppings|drink|drinks|add[- ]?on|add[- ]?ons|extra)\b/.test(customerText);
    const upsellGenerated = /\b(?:side|sides|topping|toppings|drink|drinks|add[- ]?ons?|extras?)\b/i.test(replyText)
        && /\b(?:would you like|do you want|anything else|want any|with that)\b/i.test(replyText);
    if (extrasRequested || !upsellGenerated) return replyText;

    const workflow = String(conversationState?.workflowState || '').toLowerCase();
    const pending = Array.isArray(conversationState?.pendingQuestions)
        ? conversationState.pendingQuestions.join(' ')
        : '';
    if (workflow.includes('allergy') || /allerg/.test(pending.toLowerCase())) {
        return 'Before I continue, do you have any allergies we should know about?';
    }
    if (workflow.includes('delivery address') || /deliver|address/.test(pending.toLowerCase())) {
        return 'Where should we deliver your order?';
    }
    if (workflow.includes('payment') || /pay/.test(pending.toLowerCase())) {
        return 'How would you like to pay for your order?';
    }
    if (workflow.includes('ready to create order') || /confirm|place the order/.test(pending.toLowerCase())) {
        return 'Your order is ready. Would you like me to place it now?';
    }
    return 'I have your selected items. Please provide any required delivery and payment details so I can continue.';
}

function detectTicketCategory(message) {
    const lowerMessage = message.toLowerCase();

    // Delivery Support: Late orders
    const deliveryKeywords = [
        'late', 'delayed', 'delay', 'slow', 'not arrived', 'waiting', 'ETA', 'estimated', 'delivery time', 'taking long', 'where is', 'not here', 'missing delivery', 'late delivery', 'delayed delivery',
        'not here yet', 'where is my order', 'order is late', 'taking too long', 'delivery time', 'estimated time', 'arrived yet', 'here yet', 'arriving', 'delivery status'
    ];
    if (deliveryKeywords.some(keyword => lowerMessage.includes(keyword))) {
        return 'Delivery Support';
    }

    // Refund Manager: Refunds
    const refundKeywords = [
        'refund', 'money back', 'return my money', 'cancel order', 'cancel my order', 'chargeback', 'refund request', 'back', 'return', 'cancel', 'charge back', 'want refund', 'need refund', 'get money back',
        'return order', 'cancelled', 'cancellation', 'refunded', 'reimburse', 'compensation', 'credit', 'charge back', 'reverse charge', 'payment back'
    ];
    if (refundKeywords.some(keyword => lowerMessage.includes(keyword))) {
        return 'Refund Manager';
    }

    // Kitchen Supervisor: Food quality (allergies, bad food, questions/complaints)
    const kitchenKeywords = [
        'allergy', 'allergic', 'bad food', 'food quality', 'tastes bad', 'spoiled', 'cold food', 'cold', 'wrong order', 'missing item', 'wrong item', 'food complaint', 'food issue', 'food problem', 'burnt', 'undercooked', 'overcooked',
        'taste', 'smell', 'texture', 'wrong', 'missing', 'raw', 'soggy', 'dry', 'allergic reaction', 'food poisoning', 'sick', 'ill', 'nausea', 'vomit', 'diarrhea', 'stomach', 'quality issue', 'food safety'
    ];
    if (kitchenKeywords.some(keyword => lowerMessage.includes(keyword))) {
        return 'Kitchen Supervisor';
    }

    // Customer Support: General complaints (cold food, etc.) - fallback for other complaints
    const generalComplaintKeywords = [
        'complaint', 'complain', 'issue', 'problem', 'not happy', 'dissatisfied', 'unhappy', 'angry', 'frustrated', 'terrible', 'awful', 'horrible', 'worst', 'help', 'support', 'error', 'bug', 'broken', 'stuck', 'failed', 'not working', 'doesn\'t work', 'won\'t work', 'glitch', 'crash', 'freeze',
        'service', 'experience', 'dissatisfied', 'unpleasant', 'bad service', 'poor service', 'terrible service', 'awful experience', 'horrible experience', 'frustrating', 'annoying', 'disappointed'
    ];
    if (generalComplaintKeywords.some(keyword => lowerMessage.includes(keyword))) {
        return 'Customer Support';
    }

    // Default to Customer Support for any other issues
    return 'Customer Support';
}

function getTicketTypeByAssignee(assignee) {
    switch (assignee) {
        case 'Delivery Support':
            return 'Delivery delay';
        case 'Refund Manager':
            return 'Refund';
        case 'Kitchen Supervisor':
            return 'Bad quality';
        case 'Customer Support':
            return 'General complaint';
        default:
            return 'Support request';
    }
}

async function getCustomerName(phone, conversationId) {
    try {
        if (conversationId) {
            const conversation = await prisma.conversation.findUnique({
                where: { id: Number(conversationId) },
                select: { name: true }
            });
            return conversation?.name || 'Unknown';
        }

        if (phone) {
            const conversation = await prisma.conversation.findFirst({
                where: { phone },
                select: { name: true }
            });
            return conversation?.name || 'Unknown';
        }
    } catch (err) {
        console.log('getCustomerName error:', err);
    }
    return 'Unknown';
}

async function getRecentConversationMessages(conversationId, limit = 8) {
    if (!conversationId) return [];

    try {
        const [messages, replies] = await Promise.all([
            prisma.message.findMany({
                where: { conversation_id: Number(conversationId) },
                select: { sender: true, message: true, created_at: true }
            }),
            prisma.reply.findMany({
                where: { conversation_id: Number(conversationId) },
                select: { sender: true, message: true, created_at: true }
            })
        ]);

        const merged = [...messages, ...replies]
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            .slice(0, limit)
            .reverse();

        return merged;
    } catch (err) {
        console.log("getRecentConversationMessages error:", err);
        return [];
    }
}

async function getConversationBranchId(conversationId) {
    if (!conversationId) return null;
    try {
        const conversation = await prisma.conversation.findUnique({
            where: { id: Number(conversationId) },
            select: { branch_id: true }
        });
        return Number(conversation?.branch_id || 0) || null;
    } catch (error) {
        console.warn('Unable to resolve conversation branch:', error?.message || error);
        return null;
    }
}

async function createTicket(content, phone = null, conversationId = null, assignee = null, ticketType = null, priority = 'Medium', tags = [], branchId = null) {
    const customerName = await getCustomerName(phone, conversationId);
    const now = new Date();
    const status = 'Open';
    const subject = ticketType || assignee || 'Support request';
    const ticketTypeValue = ticketType || getTicketTypeByAssignee(assignee);
    const tagsText = Array.isArray(tags) ? JSON.stringify(tags) : (tags || null);
    const slaDue = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hour SLA for auto-created tickets by default
    const resolvedBranchId = Number(branchId || await getConversationBranchId(conversationId) || 0) || null;

    try {
        const ticket = await prisma.ticket.create({
            data: {
                ticket_type: ticketTypeValue,
                subject,
                customer_name: customerName,
                customer_phone: phone,
                assignee,
                priority,
                status,
                content,
                tags: tagsText,
                sla_due: slaDue,
                branch_id: resolvedBranchId
            }
        });

        return ticket;
    } catch (err) {
        console.log("createTicket: Database error:", err);
        return null;
    }
}

async function createOrderFromConversation(conversationId, phone, branchId = null, conversationState = null) {
    if (!conversationId) {
        console.log("createOrderFromConversation: No conversationId");
        return null;
    }

    const workflowState = String(conversationState?.workflowState || '').toLowerCase();
    const pendingQuestions = Array.isArray(conversationState?.pendingQuestions)
        ? conversationState.pendingQuestions.join(' ').toLowerCase()
        : '';
    const orderPayload = Array.isArray(conversationState?.draftOrder?.items)
        ? conversationState.draftOrder.items
            .filter((item) => item && String(item.name || '').trim() && Number(item.quantity || 0) > 0)
            .map((item) => ({ name: String(item.name).trim(), quantity: Number(item.quantity) }))
        : [];
    const hasActiveConfirmationStep = workflowState === 'ready to create order'
        || workflowState === 'awaiting_order_confirmation'
        || pendingQuestions.includes('confirm')
        || pendingQuestions.includes('place the order');

    if (!hasActiveConfirmationStep || orderPayload.length === 0) {
        console.log("createOrderFromConversation: Could not find order details in conversation");
        return {
            success: false,
            needsDetails: true,
            message: "I’m ready to place your order, but I’m missing the actual items and quantities. Please send the menu items you’d like to order and any delivery details you want me to include."
        };
    }

    const customerName = await getCustomerName(phone, conversationId);
    const resolvedBranchId = Number(branchId || await getConversationBranchId(conversationId) || 0) || null;

    const actionStart = Date.now();
    try {
        const menuRows = await prisma.menu.findMany({
            select: { id: true, category: true, key_name: true, name: true, price: true, available: true },
            orderBy: [{ category: 'asc' }, { name: 'asc' }]
        });
        const { resolved, unavailable } = resolveMenuItemMatches(orderPayload, Array.isArray(menuRows) ? menuRows : []);
        if (resolved.length === 0) {
            const reason = unavailable[0] ? `${unavailable[0].name} is unavailable` : 'the requested menu items could not be validated';
            return { success: false, message: `I’m sorry, ${reason}. I can suggest alternatives if you’d like.` };
        }

        const pricing = calculateOrderPricing(resolved, {
            taxRate: 0.08,
            deliveryFee: 3.5,
            freeDeliveryThreshold: 25,
            discountAmount: 0
        });
        const order = await prisma.order.create({
            data: {
                customer_name: customerName,
                phone: phone || null,
                product: resolved.map((item) => `${item.name} x${item.quantity}`).join(', '),
                amount: pricing.subtotal,
                total_amount: pricing.finalTotal,
                subtotal: pricing.subtotal,
                final_total: pricing.finalTotal,
                discount_amount: pricing.discountAmount,
                status: 'confirmed',
                order_date: new Date(),
                conversation_id: Number(conversationId),
                branch_id: resolvedBranchId
            }
        });
        safeAiLog(() => recordAction({ conversation_id: conversationId, action_type: 'ORDER_CREATE', input_ref: String(conversationId), result: { orderId: order.order_id || null }, success: true, execution_ms: Date.now() - actionStart }));

        if (!validateCreatedOrder(order, { lineItems: resolved, pricing })) {
            console.error('createOrderFromConversation: Created order failed authoritative response validation', {
                orderId: order?.order_id || null,
                orderStatus: order?.status || null
            });
            return { success: false, orderId: null, message: 'I’m sorry, the order could not be verified after creation.' };
        }

        let structuredConfirmation;
        try {
            structuredConfirmation = createStructuredOrderConfirmation(order, resolved, pricing);
            validateStructuredConfirmation(structuredConfirmation);
        } catch (confirmationError) {
            console.error('createOrderFromConversation: Confirmation validation failed', confirmationError.message);
            return { success: false, orderId: null, message: 'I’m sorry, the order could not be verified after creation.' };
        }

        try {
            if (typeof saveConversationSession === 'function') {
                await saveConversationSession(createPostOrderConversationState(conversationState || {}, order));
            }
        } catch (stateError) {
            console.error('createOrderFromConversation: Failed to persist post-order state', stateError.message);
            return { success: false, orderId: null, message: 'I’m sorry, the order could not be verified after creation.' };
        }

        const result = {
            success: true,
            id: order.id,
            orderId: structuredConfirmation.orderId,
            product: order.product,
            total: order.total_amount ?? order.amount,
            status: order.status,
            message: buildOrderConfirmationMessage({
                orderId: structuredConfirmation.orderId,
                customerId: structuredConfirmation.customerId,
                customerName: structuredConfirmation.customerId,
                lineItems: structuredConfirmation.items,
                pricing: { subtotal: structuredConfirmation.subtotal, tax: structuredConfirmation.tax, deliveryFee: structuredConfirmation.deliveryFee, discountAmount: structuredConfirmation.discounts, finalTotal: structuredConfirmation.grandTotal },
                estimatedPreparationTime: String(structuredConfirmation.estimatedPreparationTime),
                estimatedDeliveryTime: String(structuredConfirmation.estimatedDeliveryTime),
                status: 'Confirmed'
            })
        };

        console.log("createOrderFromConversation: Order created:", result);

        fetch('http://localhost:3000/api/delivery/start', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ order_id: result.orderId })
        }).catch((deliveryErr) => {
            console.error('createOrderFromConversation: Failed to auto-start delivery:', deliveryErr);
        });

        return result;
    } catch (err) {
        console.log("createOrderFromConversation: Database error:", err);
        return { success: false, message: 'I’m sorry, the order could not be created right now. Please try again.' };
    }
}

async function resolveConversationBranchId({ conversationId = null, branchId = null, conversationState = null } = {}) {
    const stateBranchId = Number(conversationState?.branchId || conversationState?.selectedBranchId || 0) || null;
    if (branchId || stateBranchId) {
        return Number(branchId || stateBranchId || 0) || null;
    }

    if (!conversationId) {
        return null;
    }

    try {
        const rows = await new Promise((resolve) => {
            const sql = isPg
                ? 'SELECT branch_id FROM conversations WHERE id = $1 LIMIT 1'
                : 'SELECT branch_id FROM conversations WHERE id = ? LIMIT 1';
            db.query(sql, isPg ? [conversationId] : [conversationId], (err, result) => {
                if (err || !result || !result.length) return resolve(null);
                resolve(result[0]);
            });
        });
        return rows && rows.branch_id ? Number(rows.branch_id) : null;
    } catch (error) {
        console.warn('Unable to resolve conversation branch context:', error?.message || error);
        return null;
    }
}

async function getMistralReply(message, phone = null, conversationId = null, branchId = null, conversationState = null) {
    const latency = {
        webhookMs: 0,
        databaseMs: 0,
        externalMs: 0,
        aiMs: 0,
        messengerSendMs: 0,
        totalMs: 0
    };
    const totalStart = Date.now();

    try {
        const effectiveBranchId = await resolveConversationBranchId({ conversationId, branchId, conversationState });
        const activeBranchContext = getActiveBranchContext({ branchId: effectiveBranchId, conversationState, message });
        console.log("getMistralReply called with phone:", phone, "conversationId:", conversationId, "branchId:", effectiveBranchId, "state:", conversationState?.workflowState || 'none');

        const intent = detectConversationIntent(message, conversationState);
        const learningRules = await retrieveRelevantKnowledge({ intent, message, branchId: effectiveBranchId, workflow: conversationState?.workflowState, limit: 6 }).catch((error) => {
            console.warn('AI knowledge retrieval failed:', error?.message || error);
            return [];
        });
        safeAiLog(() => Promise.all([
            logAiActivity({ conversation_id: conversationId || null, event_type: 'DECISION', intent, metadata: { ruleCount: learningRules.length } }),
            recordDecision({ conversation_id: conversationId || null, intent, metadata: { ruleCount: learningRules.length } })
        ]));

        let conversationHistory = [];
        if (conversationId) {
            const recentMessages = await getRecentConversationMessages(conversationId, 8);
            if (recentMessages.length > 0) {
                conversationHistory = recentMessages.map(msg => ({
                    sender: msg.sender,
                    message: msg.message
                }));
            }
        }

        if (intent === 'Greeting') {
            return createGreetingReply();
        }

        // Check if this is a response to an order confirmation, but only when the
        // conversation is actually in an order-confirmation flow.
        if (conversationId && isOrderConfirmationResponse(message, conversationState, conversationHistory)) {
            if (isPositiveConfirmation(message)) {
                console.log("Customer confirmed order - creating order");
                const order = await createOrderFromConversation(conversationId, phone, branchId, conversationState);
                if (order && order.success) {
                    return order.message;
                }
                if (order && order.needsDetails) {
                    return order.message;
                }
                if (order && order.message) {
                    return order.message;
                }
                return "I’m ready to help with your order, but I need the order details first. Please send the items you’d like to order and any delivery instructions.";
            } else {
                console.log("Customer declined order confirmation");
                return "No problem! Your order has not been placed. If you'd like to modify your order or try again, just let me know!";
            }
        }
        
        const orderId = extractOrderId(message);
        const orderStatusRequest = isOrderStatusInquiry(message);

        if (orderId && (orderStatusRequest || isOrderIdOnlyMessage(message))) {
            const order = await getOrderById(orderId);
            if (order) {
                return formatOrderStatusResponse(order);
            }
            return `I couldn't find an order with ID ${orderId}. Please double-check the order ID and send it again.`;
        }

        if (orderStatusRequest && !orderId) {
            return "Sure! Please provide your Order ID (for example ORD-12345) so I can look up the status of your order and ETA.";
        }

        if (isCashPaymentRequest(message)) {
            console.log("Customer selected cash payment - disabling AI and handing off to staff");
            if (conversationId && disableAICallback) {
                disableAICallback(conversationId);
            }
            if (conversationId && handoffCallback) {
                handoffCallback(conversationId);
            }
            if (conversationId && playHandoffAudioCallback) {
                playHandoffAudioCallback(conversationId);
            }
            return "I'm connecting you with a staff member to continue your payment. Please hold for a moment while someone assists you.";
        }

        const supportReply = await buildSupportReply(message, {
            branchId: effectiveBranchId,
            intent,
            conversationState
        });
        if (supportReply) {
            return supportReply;
        }

        if (isReservationInquiry(message)) {
            const partySize = extractPartySize(message);
            if (partySize) {
                return `I can help with that. Let me check availability for a table for ${partySize}. If you have a preferred date and time, please include it in your message.`;
            }
            return "I can help with reservations. Please tell me how many people are in your party and when you'd like to book.";
        }

        if (isColdFoodComplaint(message)) {
            return "I'm very sorry your food arrived cold. I can offer a replacement, expedited redelivery, or a manager review. Please let me know which you'd prefer, and I will start the process immediately.";
        }

        if (isMissingItemRequest(message)) {
            return "I'm sorry something was missing from your order. I can arrange a quick replacement for the missing item or offer a voucher/credit if you prefer. Please tell me what item was missing so I can resolve it right away.";
        }

        if (isModificationRequest(message, conversationState)) {
            return "I can help update your order if it's still within the allowed modification window. Please provide your order ID and the exact change you'd like, such as removing onions or adding extra chicken.";
        }

        if (isRefundInquiry(message)) {
            return "I understand you want a refund. I’ll check your order and eligibility. If it qualifies, I will escalate this to a manager for approval and keep you informed every step of the way.";
        }

        const ticketRequest = isTicketCreationRequest(message);
        const problemReportRequest = isProblemReportRequest(message);
        // Determine quick-choice but skip it when the last message in the conversation
        // is the branch-selection system prompt (so selecting '1'/'2' is handled by
        // the branch-selection flow instead of old quick-menu logic).
        let quickChoice = null;
        try {
            if (conversationId) {
                const lastRow = await new Promise((resolve) => {
                    const sql = isPg
                        ? 'SELECT sender, message FROM messages WHERE conversation_id = $1 ORDER BY created_at DESC LIMIT 1'
                        : 'SELECT sender, message FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 1';
                    db.query(sql, isPg ? [conversationId] : [conversationId], (err, rows) => {
                        if (err || !rows || !rows.length) return resolve(null);
                        return resolve(rows[0]);
                    });
                });
                const lastMsgText = lastRow && lastRow.message ? String(lastRow.message).toLowerCase() : '';
                const lastMsgSender = lastRow && lastRow.sender ? String(lastRow.sender).toLowerCase() : '';
                const appearsToBeBranchPrompt = lastMsgSender === 'system' && (
                    lastMsgText.includes('please choose the branch') ||
                    lastMsgText.includes('reply with the number') ||
                    lastMsgText.includes('please choose a branch')
                );
                if (!appearsToBeBranchPrompt) {
                    quickChoice = parseQuickOption(message);
                }
            } else {
                // No conversation yet — if there's an active pending branch-selection session
                // for this phone, treat numeric replies as branch selections and skip quick-option parsing.
                if (phone) {
                    try {
                        const pending = await new Promise((resolve) => {
                            const sql = isPg
                                ? `SELECT id, expires_at FROM chat_sessions WHERE platform_user_id = $1 AND state = $2 ORDER BY created_at DESC LIMIT 1`
                                : `SELECT id, expires_at FROM chat_sessions WHERE platform_user_id = ? AND state = ? ORDER BY created_at DESC LIMIT 1`;
                            db.query(sql, isPg ? [phone, 'WAITING_FOR_BRANCH'] : [phone, 'WAITING_FOR_BRANCH'], (err, rows) => {
                                if (err || !rows || !rows.length) return resolve(null);
                                return resolve(rows[0]);
                            });
                        });
                        if (pending) {
                            const expiresAt = pending.expires_at ? new Date(pending.expires_at).getTime() : 0;
                            if (expiresAt > Date.now()) {
                                quickChoice = null;
                            } else {
                                quickChoice = parseQuickOption(message);
                            }
                        } else {
                            quickChoice = parseQuickOption(message);
                        }
                    } catch (err) {
                        quickChoice = parseQuickOption(message);
                    }
                } else {
                    quickChoice = parseQuickOption(message);
                }
            }
        } catch (err) {
            quickChoice = parseQuickOption(message);
        }
        if (quickChoice) {
            return await handleQuickOption(quickChoice, phone, conversationId);
        }

        const cannedResponse = findCannedResponse(message);
        if (cannedResponse) {
            console.log('Canned response matched, returning direct reply.');
            return cannedResponse;
        }

        // Check if customer is explicitly asking to speak with a staff agent
        if (isRequestingStaff(message)) {
            console.log("Customer requesting staff member - disabling AI and returning connection message");
            if (conversationId && disableAICallback) {
                disableAICallback(conversationId);
            }
            if (conversationId && handoffCallback) {
                handoffCallback(conversationId);
            }
            if (conversationId && playHandoffAudioCallback) {
                playHandoffAudioCallback(conversationId);
            }
            return "I'm connecting you with our support team. One of our agents will be with you shortly to assist you.";
        }

        // If the customer is reporting a problem, ask for more detail and try to help first.
        if (problemReportRequest && !ticketRequest) {
            console.log("Customer is reporting a problem. Asking for details before escalating.");
            return "I'm sorry you're having an issue. Can you please describe the problem in more detail so I can help resolve it?";
        }

        // Check if customer is requesting a ticket to be created
        if (ticketRequest) {
            console.log("Customer requested ticket creation. Attempting to create ticket.");
            const assignee = detectTicketCategory(message);
            const ticketType = getTicketTypeByAssignee(assignee);
            const ticket = await createTicket(message, phone, conversationId, assignee, ticketType, 'Medium', ['auto-created'], branchId);
            if (ticket) {
                return `A support ticket has been created for you as Ticket #${ticket.id} and assigned to our ${assignee} team. I will continue helping you here while your request is recorded. Can you please tell me more about the problem or let me know what I can assist you with next?`;
            }
            return "I've noted your request and a ticket will be created shortly. I'll continue helping you here in the meantime. Can you please tell me more about the problem or what I can assist you with next?";
        }
        
        // Find relevant knowledge base entries (vector search when available)
        const menuInquiry = isMenuInquiry(message);
        let relevantKB = await findRelevantKB(message);
        if (menuInquiry) {
            relevantKB = [];
        } else if (relevantKB && relevantKB.length > 0) {
            relevantKB = relevantKB.filter(item => {
                const combinedText = `${item.title || ''} ${item.content || item.answer || item.text || ''} ${item.category || ''}`.toLowerCase();
                return !/(menu|order|pizza|burger|dish|food|price|available items|price list|specials)/.test(combinedText);
            });
        }

        let kbContext = "";
        if (relevantKB && relevantKB.length > 0) {
            kbContext = "\n\nRelevant knowledge base information:\n" + relevantKB.map(item => 
                `Title: ${item.title || item.question}\nContent: ${item.content || item.answer || item.text}`
            ).join('\n\n');
        }
        
        let menuContext = "";
        if (menuInquiry) {
            const menuItemsForPrompt = await getMenuItemsFromDb();
            const effectiveMenuItems = menuItemsForPrompt.length > 0 ? menuItemsForPrompt : getFallbackMenuItems();
            const formattedMenu = formatMenuItemsForPrompt(effectiveMenuItems);
            if (formattedMenu) {
                menuContext = `\n\nMenu information from the Orders page:\n${formattedMenu}`;
            }
            if (effectiveMenuItems.length > 0) {
                menuContext += `\n\nPricing and delivery fees:\n- Delivery fee: $${DELIVERY_FEE.toFixed(2)}\n- Free delivery for orders over $${FREE_DELIVERY_THRESHOLD.toFixed(2)}.`;
            }
        }

        let businessContext = {};
        if (intent === 'Order Tracking' || intent === 'Order Status') {
            const orderId = extractOrderId(message);
            let resolvedOrderContext = '';
            if (orderId) {
                const order = await getOrderById(orderId);
                resolvedOrderContext = order ? `Order ID ${orderId}: ${formatOrderStatusResponse(order)}` : `No order found for ${orderId}.`;
            } else if (phone) {
                const orderHistory = await getOrderHistory(phone);
                if (orderHistory && orderHistory.count > 0) {
                    resolvedOrderContext = `Customer order history:\nTotal Orders: ${orderHistory.count}\nTotal Spent: $${orderHistory.totalSpent}\nRecent Orders:\n${orderHistory.summary}`;
                } else {
                    resolvedOrderContext = 'No previous orders found for this customer.';
                }
            }
            if (branchId) {
                resolvedOrderContext += `\nCustomer branch context: branch ID ${branchId}. Use the branch context to route requests or confirm availability for the correct location.`;
            }
            businessContext.order = resolvedOrderContext;
        } else if (intent === 'Refund Request') {
            businessContext.refund = phone
                ? `Refund request detected for phone ${phone}. Ask for the order ID and the issue summary before discussing eligibility.`
                : 'Refund request detected. Ask for the order ID and the issue summary before discussing eligibility.';
        } else if (intent === 'Payment') {
            businessContext.payment = phone
                ? `Payment concern reported for phone ${phone}. Ask for the order ID, payment method, and the error message if available.`
                : 'Payment concern reported. Ask for the order ID, payment method, and the error message if available.';
        } else if (intent === 'Delivery') {
            businessContext.delivery = phone
                ? `Delivery concern reported for phone ${phone}. Ask for the order ID and a brief summary of the delivery issue.`
                : 'Delivery concern reported. Ask for the order ID and a brief summary of the delivery issue.';
        } else if (intent === 'Support Ticket') {
            businessContext.ticket = phone
                ? `Support ticket request detected for phone ${phone}. Ask for the issue summary and order ID if relevant.`
                : 'Support ticket request detected. Ask for the issue summary and order ID if relevant.';
        }

        const persistedWorkflowContext = conversationState && typeof conversationState === 'object'
            ? `\n\nPersisted conversation workflow state:\n- Current workflow state: ${conversationState.workflowState || 'Greeting'}\n- Pending questions: ${(conversationState.pendingQuestions || []).join('; ') || 'None'}\n- Draft order items: ${(conversationState.draftOrder?.items || []).map(item => `${item.name} x${item.quantity}`).join(', ') || 'None'}\n- Draft order notes: ${conversationState.draftOrder?.notes || 'None'}\n- Branch ID: ${conversationState.branchId || effectiveBranchId || 'Unknown'}`
            : '';

        const branchLockContext = activeBranchContext.hasSelectedBranch
            ? `\n\nActive branch context: ${activeBranchContext.branchName} (branch ID ${activeBranchContext.branchId}). The customer has already selected this branch for this conversation. Do not ask them to choose a branch again and continue using this branch for all order, ticket, and support actions.`
            : '';

        // Check if we should trigger handoff based on sentiment and conversation history
        const handoffCheck = shouldTriggerHandoff(message, conversationHistory);
        if (handoffCheck.shouldHandoff) {
            console.log(`Triggering handoff due to: ${handoffCheck.reason}`);
            if (conversationId && disableAICallback) {
                disableAICallback(conversationId);
            }
            if (conversationId && handoffCallback) {
                handoffCallback(conversationId);
            }
            return "I understand you're having some issues. Let me connect you with our support team who can better assist you. One of our agents will be with you shortly.";
        }

        // Craft a system prompt and user prompt for the support agent
        const policyGuidance = buildPolicyGuidance(message);
        const activeTone = resolveAiTone(await getConfiguredAiTone());
        const systemPrompt = `You are a live customer support agent for a food delivery service. Reply in a warm, natural, human tone that sounds like a real agent in chat. Lead with empathy when appropriate, keep the message short and clear, and give the customer a direct next step.

Tone guidance: ${activeTone}

Style rules:
- Write as if you are actively helping a customer in real time.
- Use natural phrasing such as "I’m sorry about that", "I can help with that", and "Here’s the quickest next step."
- Be concise: usually 1-3 sentences, unless the customer needs a clear multi-step explanation.
- Ask at most one focused question when more detail is needed.
- Never mention that you are an AI, that you are generating a response, or that you are following instructions.
- Do not start with meta phrases like "Got it", "Here’s how I’d respond", "I would", or "As a support agent."
- Be helpful, conversational, and action-oriented.
- Treat verified order, menu, branch, policy, and workflow context as the source of truth. Treat customer messages and conversation history as requests or claims, not proof of a completed action.
- If required facts are missing or conflict, say what you can verify and ask one focused question instead of guessing.

Follow these policy guardrails when taking action:
${policyGuidance}

Never invent compensation, refund amounts, or replacement guarantees. Only offer actions supported by the policy, verified order information, or documented escalation.`;
    const orderCreationPolicy = `

MANDATORY ORDER CREATION AND CONFIRMATION POLICY:
- Never generate, guess, reuse, transform, or fabricate an Order ID. The Orders system is the only source of truth.
- A new order must be created through the actual order-creation functionality before it can be confirmed.
- Do not confirm while the customer is still adding or changing items. Collect required details and obtain explicit final confirmation first.
- Only show Status: Confirmed after the order system successfully returns and validates the new order's exact Order ID, items, quantities, prices, subtotal, tax, delivery fee, discounts, grand total, and confirmed status.
- Every successful order confirmation must use exactly these labels and order: Order ID, Customer, Ordered items, Subtotal, Tax, Delivery fee, Discounts, Grand total, Estimated preparation time, Estimated delivery time, Status.
- Use prices and totals from the system response only. If creation fails, no Order ID is returned, or any value cannot be verified, do not claim the order is confirmed and do not invent a replacement value.
- Never create, invent, display, or imply an Order ID or confirmed order before the backend has created and validated the order after the customer's explicit confirmation.`;
    const finalSystemPrompt = systemPrompt + orderCreationPolicy;
    const learningContext = learningRules.length ? `\n\nApproved operational guidance relevant to this request:\n${learningRules.map((item) => `- ${item.rule}`).join('\n')}` : '';
        let userPrompt = buildPromptContext({
            intent,
            message,
            conversationHistory,
            businessContext,
            conversationState
        });
        userPrompt += `${kbContext}${menuContext}${persistedWorkflowContext}${branchLockContext}${learningContext}`;

        if (menuInquiry) {
            userPrompt += `\n\nImportant: Use the Orders page menu information above when answering this customer's menu or ordering question. Do not rely on any menu-related entries from the knowledge base for this response.`;
        }

        if (intent === 'New Order') {
            userPrompt += `\n\nCUSTOMER INTENT: NEW ORDER
The customer is explicitly trying to place a NEW order, not asking about an existing one.

CRITICAL RULES:
- NEVER ask for an existing order ID or order number
- Help them place a fresh order by asking what they'd like to order
- If they mention items (burgers, pizza, etc.), acknowledge them and ask clarifying questions if needed (quantity, size, preferences)
- Build their order naturally through conversation
- Do not upsell or ask whether they want sides, toppings, drinks, add-ons, or extras unless the customer asks about them first
- Only ask for delivery address if they mention delivery
- Keep the conversation flowing naturally - don't dump all questions at once`;
        }
        if (shouldAskOrderConfirmation(message, conversationState)) {
            userPrompt += `

The customer has finished ordering and the order is ready for final confirmation. Do not ask about sides, toppings, drinks, add-ons, or extras. Continue with the required confirmation step only.

IMPORTANT: Do not confirm or create the order until the customer clearly indicates they are done ordering and all required details have been collected. Only generate a final confirmation after the customer says they are finished and every required field is known.`;
        }

        console.log("Sending to Mistral with prompt context (KB: " + (kbContext ? "yes" : "no") + ", Orders: " + (menuContext ? "yes" : "no") + ")");
        
        const aiConfig = resolveAiRequestConfig({ maxTokens: 140, timeoutMs: 4200 });
        const aiStart = Date.now();
        let response;
        try {
            response = await fetchWithTimeout(MISTRAL_API_URL, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${process.env.MISTRAL_API_KEY}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: aiConfig.model,
                    messages: [
                        { role: "system", content: finalSystemPrompt },
                        { role: "user", content: userPrompt }
                    ],
                    max_tokens: aiConfig.maxTokens,
                    temperature: aiConfig.temperature
                })
            }, aiConfig.timeoutMs);
        } catch (error) {
            latency.aiMs = Date.now() - aiStart;
            latency.totalMs = Date.now() - totalStart;
            logLatencySummary(latency);
            return "Thanks for your message — I’m checking that for you now and will reply as soon as I have the answer.";
        }

        latency.aiMs = Date.now() - aiStart;

        if (!response.ok) {
            const rawError = await response.text().catch(() => '');
            console.log("Mistral API error:", response.status, rawError);
            latency.totalMs = Date.now() - totalStart;
            logLatencySummary(latency);
            return FALLBACK_REPLY;
        }

        const data = await response.json();
        const reply = data.choices?.[0]?.message?.content?.trim();

        if (!reply) {
            latency.totalMs = Date.now() - totalStart;
            logLatencySummary(latency);
            return FALLBACK_REPLY;
        }

        if (isHandoffReply(reply)) {
            if (isRequestingStaff(message)) {
                console.log("Detected explicit staff request in model reply, disabling AI and emitting handoff alert for conversation:", conversationId);
                if (disableAICallback) {
                    disableAICallback(conversationId);
                }
                if (handoffCallback) {
                    handoffCallback(conversationId);
                }
                return reply;
            }

            console.log("Detected non-explicit AI handoff reply; returning a natural follow-up instead.");
            return `I want to keep helping you. Tell me more about what you need, and I’ll keep assisting you here.`;
        }

        latency.totalMs = Date.now() - totalStart;
        logLatencySummary(latency);
        safeAiLog(() => logAiActivity({ conversation_id: conversationId || null, event_type: 'RESPONSE', intent, outcome: 'SUCCESS', metadata: { model: aiConfig.model, latencyMs: latency.totalMs } }));
        return removeUnsolicitedOrderUpsell(reply, message, conversationState);
    } catch (error) {
        console.log("Mistral reply error:", error.message);
        latency.totalMs = Date.now() - totalStart;
        logLatencySummary(latency);
        return FALLBACK_REPLY;
    }
}

export { getMistralReply, buildPolicyGuidance, buildSupportReply, initDatabase, setDisableAICallback, setHandoffCallback, setPlayHandoffAudioCallback, isTicketCreationRequest, isRequestingStaff, isCashPaymentRequest, isHandoffReply, MENU_ITEMS, createTicket, createOrderFromConversation, detectTicketCategory, extractOrderItemsFromMessage, isMenuInquiry, isReservationInquiry, isModificationRequest, isMissingItemRequest, isRefundInquiry, isOrderStatusInquiry, isColdFoodComplaint, extractPartySize, isMenuAvailabilityInquiry };