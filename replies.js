import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { config as dbConfig, prisma } from './db/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const isPg = dbConfig && dbConfig.usePostgres;
const MISTRAL_API_URL = "https://api.mistral.ai/v1/chat/completions";
const CLARIFICATION_OPTIONS = "If you are not sure, reply with 0 for menu, 1 for your last order, or 2 to connect with staff.";

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
        const formatted = formatMenuItemsForPrompt(menuItems).split('\n').slice(0, 18).join('\n');
        return `Here is a quick menu overview:\n${formatted}\n\nIf you want to order, tell me what you'd like or reply with 1 for your last order, 2 to speak with staff, or just ask another question.

${CLARIFICATION_OPTIONS}`;
    }

    if (choice === 'last_order') {
        if (!phone) {
            return `I don't have your phone number yet. Please send your phone number or your order ID, and I'll look up your last order for you.`;
        }
        const orderHistory = await getOrderHistory(phone);
        if (orderHistory && orderHistory.count > 0) {
            return `Here is your recent order summary:\n${orderHistory.summary}\n\nIf you'd like, I can also help you with the menu or connect you with staff. Reply 0 for menu, 2 for staff, or ask another question.

${CLARIFICATION_OPTIONS}`;
        }
        return `I couldn't find any recent orders for this number. Please provide your order ID or phone number again so I can check.

${CLARIFICATION_OPTIONS}`;
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

    return "I'm sorry, I couldn't understand that clearly. Please choose one of these options:\n0 - Show me the menu\n1 - Show my last order\n2 - Talk to staff\nOr just tell me more about your question and I will help you.";
}

async function getMenuItemsFromDb() {
    try {
        if (!prisma || !prisma.menu) {
            return [];
        }
        const items = await prisma.menu.findMany({
            orderBy: [
                { category: 'asc' },
                { name: 'asc' }
            ]
        });
        return Array.isArray(items) ? items.map(item => ({
            category: item.category || 'Menu',
            name: item.name || item.key_name || 'Unknown item',
            price: Number(item.price || 0),
            available: typeof item.available === 'number' ? item.available : 0
        })) : [];
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
        grouped[category].slice(0, 12).forEach(item => {
            const availableText = typeof item.available === 'number' ? ` (${item.available} available)` : '';
            const descriptionText = item.description ? ` - ${item.description}` : '';
            lines.push(`- ${item.name}: $${item.price.toFixed(2)}${availableText}${descriptionText}`);
        });
        if (grouped[category].length > 12) {
            lines.push(`- ...plus ${grouped[category].length - 12} more items in ${category}`);
        }
        lines.push('');
    }
    return lines.join('\n').trim();
}

function isMenuInquiry(message) {
    if (!message) return false;
    const lowerMessage = message.toLowerCase();
    const menuKeywords = [
        'menu',
        'show me the menu',
        'what do you have',
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
        'what do you serve'
    ];
    return menuKeywords.some(keyword => lowerMessage.includes(keyword));
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
            `- ${order.product} ($${order.total_amount ?? order.amount ?? 0}) on ${order.order_date ? new Date(order.order_date).toLocaleDateString() : 'unknown date'}`
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
        'status for order'
    ];
    return orderStatusKeywords.some(keyword => lowerMessage.includes(keyword));
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

function shouldAskOrderConfirmation(message) {
    const lowerMessage = message.toLowerCase();
    const orderPhrases = [
        'place this order',
        'place order',
        'i want to order',
        "i'd like to order",
        'i would like to order',
        'i would like',
        'i want',
        'can i get',
        'i need',
        'order now',
        'please order',
        'send me',
        "i'll have",
        "i'll have",
        'i am ordering',
        'i am placing',
        'i am buying',
        'checkout',
        'deliver',
        'deliver to'
    ];
    const hasOrderPhrase = orderPhrases.some(phrase => lowerMessage.includes(phrase));
    const hasFoodKeyword = /\b(pizza|burger|chicken|meal|drink|food|combo|sandwich|taco|order|package|fries)\b/.test(lowerMessage);
    return hasOrderPhrase && hasFoodKeyword;
}

function isOrderConfirmationResponse(message) {
    const lowerMessage = message.toLowerCase().trim();
    const yesPhrases = ['yes', 'yeah', 'yep', 'sure', 'confirm', 'okay', 'ok', 'go ahead', 'please', 'yes please', 'sure thing'];
    const noPhrases = ['no', 'nope', 'nah', 'cancel', 'stop', 'dont', "don't", 'never mind', 'not now'];
    
    return yesPhrases.some(phrase => lowerMessage.includes(phrase)) || noPhrases.some(phrase => lowerMessage.includes(phrase));
}

function isPositiveConfirmation(message) {
    const lowerMessage = message.toLowerCase().trim();
    const yesPhrases = ['yes', 'yeah', 'yep', 'sure', 'confirm', 'okay', 'ok', 'go ahead', 'please', 'yes please', 'sure thing'];
    return yesPhrases.some(phrase => lowerMessage.includes(phrase));
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

async function createTicket(content, phone = null, conversationId = null, assignee = null, ticketType = null, priority = 'Medium', tags = []) {
    const customerName = await getCustomerName(phone, conversationId);
    const now = new Date();
    const status = 'Open';
    const subject = ticketType || assignee || 'Support request';
    const ticketTypeValue = ticketType || getTicketTypeByAssignee(assignee);
    const tagsText = Array.isArray(tags) ? JSON.stringify(tags) : (tags || null);
    const slaDue = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hour SLA for auto-created tickets by default

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
                sla_due: slaDue
            }
        });

        return ticket;
    } catch (err) {
        console.log("createTicket: Database error:", err);
        return null;
    }
}

async function createOrderFromConversation(conversationId, phone) {
    if (!conversationId) {
        console.log("createOrderFromConversation: No conversationId");
        return null;
    }

    // Get recent conversation messages to find the order details
    const recentMessages = await getRecentConversationMessages(conversationId, 10);
    
    // Find the customer's order message and extract items
    let orderDetails = null;
    for (let i = recentMessages.length - 1; i >= 0; i--) {
        const msg = recentMessages[i];
        if (msg.sender === 'received' || msg.sender === 'customer') { // Customer message
            const extracted = extractOrderItemsFromMessage(msg.message);
            if (extracted.items && extracted.total > 0) {
                orderDetails = extracted;
                break;
            }
        }
    }

    if (!orderDetails) {
        console.log("createOrderFromConversation: Could not find order details in conversation");
        return null;
    }

    // Get customer name
    const customerName = await getCustomerName(phone, conversationId);

    // Generate order ID
    const orderId = `ORD-${Date.now()}`;

    try {
        const order = await prisma.order.create({
            data: {
                order_id: orderId,
                customer_name: customerName,
                phone: phone || null,
                product: orderDetails.items,
                amount: orderDetails.total,
                total_amount: orderDetails.total,
                status: 'confirmed',
                order_date: new Date(),
                conversation_id: Number(conversationId)
            }
        });

        const result = {
            id: order.id,
            orderId: order.order_id,
            product: order.product,
            total: order.total_amount ?? order.amount,
            status: order.status
        };
        console.log("createOrderFromConversation: Order created:", result);

        // Automatically start the delivery simulation using the server route
        fetch('http://localhost:3000/api/delivery/start', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ order_id: result.orderId })
        }).then((response) => {
            if (!response.ok) {
                throw new Error('Delivery start failed');
            }
            return response.json();
        }).then((data) => {
            console.log('createOrderFromConversation: Auto delivery simulation started for order', result.orderId, data);
        }).catch((deliveryErr) => {
            console.error('createOrderFromConversation: Failed to auto-start delivery:', deliveryErr);
        });

        return result;
    } catch (err) {
        console.log("createOrderFromConversation: Database error:", err);
        return null;
    }
}

async function getMistralReply(message, phone = null, conversationId = null) {
    try {
        console.log("getMistralReply called with phone:", phone, "conversationId:", conversationId);
        
        // Check if this is a response to an order confirmation
        if (conversationId && isOrderConfirmationResponse(message)) {
            if (isPositiveConfirmation(message)) {
                console.log("Customer confirmed order - creating order");
                const order = await createOrderFromConversation(conversationId, phone);
                if (order) {
                    return `Great! Your order has been confirmed and placed. Order ID: ${order.orderId}. Your ${order.product} will be prepared and delivered soon. Total: $${order.total.toFixed(2)}. Thank you for your business!`;
                } else {
                    return "I apologize, but I couldn't process your order at this time. Please try again or contact our support team for assistance.";
                }
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
            return "Sure! Please provide your Order ID (for example ORD-12345) so I can look up the status of your order.";
        }

        const ticketRequest = isTicketCreationRequest(message);
        const problemReportRequest = isProblemReportRequest(message);
        const quickChoice = parseQuickOption(message);
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
            const ticket = await createTicket(message, phone, conversationId, assignee, ticketType, 'Medium', ['auto-created']);
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
        }

        // Get customer order history
        let orderContext = "";
        if (phone) {
            console.log("Fetching order history for phone:", phone);
            const orderHistory = await getOrderHistory(phone);
            console.log("Order history result:", orderHistory);
            if (orderHistory) {
                orderContext = `\n\nCustomer Order History:\nTotal Orders: ${orderHistory.count}\nTotal Spent: $${orderHistory.totalSpent}\nRecent Orders:\n${orderHistory.summary}`;
            } else {
                orderContext = "\n\nCustomer Order History: No previous orders found in the system.";
            }
        } else {
            console.log("No phone provided to getMistralReply");
        }

        // Include recent conversation history so Mistral remembers ongoing orders
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

        // Craft a system prompt and user prompt for the support agent
        const systemPrompt = `You are a professional customer support assistant for a food delivery service. Reply directly to the customer without any meta-commentary. Do not start with "Got it", "Here’s how I’d respond", "I would", "As a support agent", or any other explanation of how you are generating the reply. Keep the answer polite, clear, and concise as if you were replying directly to the customer.`;
        let userPrompt = `Customer message: "${message}"${kbContext}${menuContext}${orderContext}

If the customer reports a problem, ask clarifying questions and gather details before suggesting a solution. Only offer a human agent connection if the customer explicitly requests a live agent. If the message is unclear, ask for clarification and offer the customer the options 0 for menu, 1 for last order, or 2 for staff. Keep the response helpful, follow up naturally, and avoid sending the customer to a human unless absolutely necessary.

${CLARIFICATION_OPTIONS}`;

        if (menuInquiry) {
            userPrompt += `\n\nImportant: Use the Orders page menu information above when answering this customer's menu or ordering question. Do not rely on any menu-related entries from the knowledge base for this response.`;
        }

        if (conversationHistory.length > 0) {
            const historyText = "\n\nConversation history:\n" + conversationHistory.map(msg => {
                const role = msg.sender === 'received' ? 'Customer' : 'Agent';
                return `${role}: ${msg.message}`;
            }).join('\n');
            userPrompt += historyText;
        }
        if (shouldAskOrderConfirmation(message)) {
            const { items, total } = extractOrderItemsFromMessage(message);
            if (items && total > 0) {
                userPrompt += `

The customer appears to be placing an order for: ${items}, which comes to $${total}. Ask them exactly: ARE YOU SURE YOU WANT TO PLACE THIS ORDER?

IMPORTANT: Confirm the order details exactly as specified above. Do not add or change items. Do not confirm or save the order until the customer explicitly replies with a positive confirmation.`;
            } else {
                userPrompt += `

The customer appears to be placing an order but I couldn't identify the specific items. Ask them to clarify what they want to order from our menu above, or to provide the exact menu item names from the Orders page.`;
            }
        }

        console.log("Sending to Mistral with prompt context (KB: " + (kbContext ? "yes" : "no") + ", Orders: " + (orderContext ? "yes" : "no") + ")");
        
        const response = await fetch(MISTRAL_API_URL, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.MISTRAL_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "mistral-large-latest",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt }
                ],
                max_tokens: 150,
                temperature: 0.35
            })
        });

        if (!response.ok) {
            console.log("Mistral API error:", response.status, await response.text());
            return "I'm sorry, I couldn't understand that clearly. Please choose one of these options:\n0 - Show me the menu\n1 - Show my last order\n2 - Talk to staff\nOr just tell me more about your question and I will help you.";
        }

        const data = await response.json();
        const reply = data.choices?.[0]?.message?.content?.trim();

        if (!reply) {
            return "I'm sorry, I couldn't understand that clearly. Please choose one of these options:\n0 - Show me the menu\n1 - Show my last order\n2 - Talk to staff\nOr just tell me more about your question and I will help you.";
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

            console.log("Detected non-explicit AI handoff reply; returning clarification options instead.");
            return `I want to keep helping you. Please choose one of these options:\n0 - Show me the menu\n1 - Show my last order\n2 - Talk to staff\nOr tell me more about your issue and I will follow up.`;
        }

        return reply;
    } catch (error) {
        console.log("Mistral reply error:", error.message);
        return "I'm sorry, I couldn't understand that clearly. Please choose one of these options:\n0 - Show me the menu\n1 - Show my last order\n2 - Talk to staff\nOr just tell me more about your question and I will help you.";
    }
}

export { getMistralReply, initDatabase, setDisableAICallback, setHandoffCallback, setPlayHandoffAudioCallback, isTicketCreationRequest, isRequestingStaff, isHandoffReply, MENU_ITEMS, createTicket, detectTicketCategory, extractOrderItemsFromMessage };