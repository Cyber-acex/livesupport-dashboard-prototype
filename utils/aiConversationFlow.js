const GREETING_PHRASES = [
  'hi',
  'hello',
  'hey',
  'good morning',
  'good afternoon',
  'good evening',
  "what's up",
  'whats up',
  'yo'
];

export const SUPPORTED_INTENTS = [
  'Greeting',
  'General Conversation',
  'Order Tracking',
  'Order Status',
  'New Order',
  'Refund Request',
  'Payment',
  'Delivery',
  'Support Ticket',
  'Complaint',
  'FAQ',
  'Unknown'
];

function normalizeText(message = '') {
  return String(message || '').trim().toLowerCase();
}

function isGreetingOnly(message = '') {
  const normalized = normalizeText(message);
  if (!normalized) return false;
  if (normalized.length > 40) return false;
  const cleaned = normalized.replace(/[!?.,]/g, '').trim();
  if (!cleaned) return false;
  return GREETING_PHRASES.some((phrase) => cleaned === phrase || cleaned.startsWith(phrase + ' ') || cleaned.endsWith(' ' + phrase));
}

function hasQuestionMark(message = '') {
  return /\?/.test(String(message || ''));
}

export function detectConversationIntent(message = '') {
  const normalized = normalizeText(message);
  if (!normalized) return 'Unknown';

  if (isGreetingOnly(message)) {
    return 'Greeting';
  }

  const isOrderTracking = /(track|tracking|where is|where's|eta|estimated time|delivery status|arrived yet|arriving|on the way|out for delivery)/i.test(normalized);
  if (isOrderTracking && /(order|delivery)/i.test(normalized)) {
    return 'Order Tracking';
  }

  if (/(order status|status of my order|check my order|what is the status of my order|status of order)/i.test(normalized)) {
    return 'Order Status';
  }

  if (/(place an order|place order|new order|order food|i want to order|i would like to order|can i order|make an order|I'd like to order|i'd like to order)/i.test(normalized)) {
    return 'New Order';
  }

  if (/(refund|money back|reimburse|compensation|voucher|chargeback|refund request|return my money)/i.test(normalized)) {
    return 'Refund Request';
  }

  if (/(payment|pay|billing|charge|card declined|payment failed|transaction failed|invoice|checkout)/i.test(normalized)) {
    return 'Payment';
  }

  if (/(delivery|driver|delivered|pickup|address|where is my delivery|delivery time|late delivery)/i.test(normalized)) {
    return 'Delivery';
  }

  if (/(ticket|support ticket|create ticket|open a ticket|escalate|agent|human support)/i.test(normalized)) {
    return 'Support Ticket';
  }

  if (/(complaint|complain|issue|problem|bad service|terrible service|not happy|disappointed|angry|frustrated|worst)/i.test(normalized)) {
    return 'Complaint';
  }

  if (hasQuestionMark(normalized) || /(what|how|why|when|can|could|do|does|is|are)/i.test(normalized)) {
    return 'FAQ';
  }

  return 'General Conversation';
}

export function shouldInjectBusinessContext(intent = 'Unknown') {
  return ['Order Tracking', 'Order Status', 'Refund Request', 'Payment', 'Delivery', 'Support Ticket'].includes(intent);
}

export function buildPromptContext({
  intent = 'Unknown',
  message = '',
  conversationHistory = [],
  businessContext = {}
} = {}) {
  const parts = [];

  if (Array.isArray(conversationHistory) && conversationHistory.length > 0) {
    parts.push('Conversation history:\n' + conversationHistory.map((item) => {
      const role = item?.sender === 'received' ? 'Customer' : 'Agent';
      return `${role}: ${item?.message || ''}`;
    }).join('\n'));
  }

  parts.push(`Customer message: "${message}"`);

  if (intent === 'Greeting') {
    return parts.join('\n\n');
  }

  if (!shouldInjectBusinessContext(intent)) {
    return parts.join('\n\n');
  }

  const injectedSections = [];
  if (businessContext?.order) {
    injectedSections.push(`Order context:\n${businessContext.order}`);
  }
  if (businessContext?.refund) {
    injectedSections.push(`Refund context:\n${businessContext.refund}`);
  }
  if (businessContext?.payment) {
    injectedSections.push(`Payment context:\n${businessContext.payment}`);
  }
  if (businessContext?.delivery) {
    injectedSections.push(`Delivery context:\n${businessContext.delivery}`);
  }
  if (businessContext?.ticket) {
    injectedSections.push(`Ticket context:\n${businessContext.ticket}`);
  }

  if (injectedSections.length > 0) {
    parts.push(injectedSections.join('\n\n'));
  }

  return parts.join('\n\n');
}

export function createGreetingReply() {
  return 'Hello! 👋 Welcome. How can I help you today?';
}
