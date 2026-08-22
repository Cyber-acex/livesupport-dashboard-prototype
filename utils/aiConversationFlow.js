const GREETING_ONLY_PATTERNS = [
  /^hi(?: there| everyone| all)?$/,
  /^hello(?: there| everyone| all)?$/,
  /^hey(?: there| everyone| all)?$/,
  /^good morning(?: everyone| all)?$/,
  /^good afternoon(?: everyone| all)?$/,
  /^good evening(?: everyone| all)?$/,
  /^(what(?:'s| is) up|whats up)$/,
  /^yo$/
];

const GENERAL_CONVERSATION_PATTERNS = [
  /^how are you(?: today)?$/,
  /^how is it going$/,
  /^how's it going$/,
  /^(are you there|can you hear me|is anyone there)$/,
  /^(can you help me|can you assist me)$/,
  /^(thank you|thanks|thanks a lot|thanks so much|thank you very much)$/
];

const ORDER_HELP_PATTERNS = [
  /help(?:ing)? (?:with )?my order/, 
  /need help (?:with )?my order/, 
  /order help/, 
  /help me with my order/, 
  /problem with my order/, 
  /issue with my order/, 
  /order question/, 
  /about my order/
];

export const SUPPORTED_INTENTS = [
  'Greeting',
  'General Conversation',
  'Order Tracking',
  'Order Status',
  'New Order',
  'Order Confirmation',
  'Order Modification',
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

function isAddressLikeText(message = '') {
  const text = String(message || '').trim();
  if (!text) return false;
  const lower = text.toLowerCase();
  const addressIndicators = [
    'my address is', 'address is', 'delivery address', 'deliver to', 'send it to', 'deliver it to',
    'house number', 'street', 'road', 'avenue', 'lane', 'drive', 'close', 'crescent', 'off ',
    'apartment', 'flat', 'unit', 'suite', 'building', 'block', 'estate'
  ];
  return addressIndicators.some((pattern) => lower.includes(pattern));
}

export function isAddressReplyForPendingQuestion(message = '', conversationState = null) {
  const text = String(message || '').trim();
  if (!text) return false;
  const workflow = String(conversationState?.workflowState || '').toLowerCase();
  const pending = Array.isArray(conversationState?.pendingQuestions) ? conversationState.pendingQuestions.join(' ').toLowerCase() : '';

  if (!isAddressLikeText(text)) return false;
  if (workflow.includes('delivery address') || workflow.includes('collecting_delivery_address')) return true;
  if (pending.includes('delivery address') || pending.includes('deliver') || pending.includes('where should we deliver')) return true;
  return false;
}

function isOrderModificationRequest(message = '', conversationState = null) {
  const text = String(message || '').trim();
  if (!text || isAddressReplyForPendingQuestion(message, conversationState)) return false;
  const state = conversationState || {};
  const hasItems = Array.isArray(state?.draftOrder?.items) && state.draftOrder.items.length > 0;
  const lower = text.toLowerCase();
  const modifyPhrases = [
    'actually make that', 'make that', 'make it', 'change it to', 'change the', 'instead of',
    'remove the', 'take it off', 'no onions', 'no cheese', 'add another', 'add more',
    'actually no', 'switch to', 'i don\'t want', 'i do not want', 'can i change', 'make that two',
    'make it two', 'change my order', 'update my order', 'remove fries', 'remove the fries'
  ];
  return hasItems && modifyPhrases.some((pattern) => lower.includes(pattern));
}

function isOrderConfirmationReply(message = '', conversationState = null) {
  const text = String(message || '').trim();
  if (!text) return false;
  const workflow = String(conversationState?.workflowState || '').toLowerCase();
  const pending = Array.isArray(conversationState?.pendingQuestions) ? conversationState.pendingQuestions.join(' ').toLowerCase() : '';
  const lower = text.toLowerCase();
  const positivePhrases = ['yes', 'yeah', 'yep', 'correct', 'that\'s correct', 'looks good', 'go ahead', 'place it', 'confirm', 'do it', 'okay'];
  const inConfirmationFlow = workflow.includes('ready to create order') || workflow.includes('awaiting_order_confirmation') || pending.includes('place the order') || pending.includes('confirm');
  return inConfirmationFlow && positivePhrases.some((phrase) => lower.includes(phrase));
}

function isGreetingOnly(message = '') {
  const normalized = normalizeText(message);
  if (!normalized) return false;
  const cleaned = normalized.replace(/[!?.,]/g, '').trim();
  if (!cleaned) return false;
  return GREETING_ONLY_PATTERNS.some((pattern) => pattern.test(cleaned));
}

function isGeneralConversationOnly(message = '') {
  const normalized = normalizeText(message);
  if (!normalized) return false;
  const cleaned = normalized.replace(/[!?.,]/g, '').trim();
  if (!cleaned) return false;
  return GENERAL_CONVERSATION_PATTERNS.some((pattern) => pattern.test(cleaned));
}

function hasQuestionMark(message = '') {
  return /\?/.test(String(message || ''));
}

export function detectConversationIntent(message = '', conversationState = null) {
  const normalized = normalizeText(message);
  if (!normalized) return 'Unknown';

  if (isGreetingOnly(message)) {
    return 'Greeting';
  }

  if (isGeneralConversationOnly(message)) {
    return 'General Conversation';
  }

  if (isAddressReplyForPendingQuestion(message, conversationState)) {
    return 'Delivery';
  }

  if (isOrderConfirmationReply(message, conversationState)) {
    return 'Order Confirmation';
  }

  if (isOrderModificationRequest(message, conversationState)) {
    return 'Order Modification';
  }

  if (ORDER_HELP_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return 'Order Tracking';
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

function formatBusinessContextValue(value) {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return JSON.stringify(value, null, 2);
  if (typeof value === 'object' && value !== null) {
    return Object.entries(value).map(([key, item]) => {
      if (typeof item === 'object' && item !== null) {
        return `${key}: ${JSON.stringify(item, null, 2)}`;
      }
      return `${key}: ${item}`;
    }).join('\n');
  }
  return String(value);
}

export function buildPromptContext({
  intent = 'Unknown',
  message = '',
  conversationHistory = [],
  businessContext = {},
  conversationState = null
} = {}) {
  const parts = [];
  const shouldAttachConversationState = !['Greeting', 'General Conversation', 'FAQ', 'Unknown'].includes(String(intent || 'Unknown'));

  if (shouldAttachConversationState) {
    const recentAssistantMessage = Array.isArray(conversationHistory)
      ? [...conversationHistory].reverse().find((item) => {
          const sender = String(item?.sender || '').toLowerCase();
          return sender === 'sent' || sender === 'ai' || sender === 'agent' || sender === 'system';
        })
      : null;

    if (recentAssistantMessage) {
      parts.push(`Previous assistant message: "${recentAssistantMessage?.message || ''}"`);
    }

    if (conversationState) {
      const workflowState = conversationState.workflowState || 'Greeting';
      const pendingQuestions = Array.isArray(conversationState.pendingQuestions) && conversationState.pendingQuestions.length > 0
        ? conversationState.pendingQuestions.join('; ')
        : 'None';
      const orderedItems = Array.isArray(conversationState.draftOrder?.items) && conversationState.draftOrder.items.length > 0
        ? conversationState.draftOrder.items.map((item) => `${item.name} x${item.quantity || 1}`).join(', ')
        : 'None';

      parts.push(`Conversation state:\n- Workflow: ${workflowState}\n- Expected input: ${pendingQuestions}\n- Active order: ${orderedItems}`);
    }
  }

  if (Array.isArray(conversationHistory) && conversationHistory.length > 0 && shouldAttachConversationState) {
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
    injectedSections.push(`Order context:\n${formatBusinessContextValue(businessContext.order)}`);
  }
  if (businessContext?.refund) {
    injectedSections.push(`Refund context:\n${formatBusinessContextValue(businessContext.refund)}`);
  }
  if (businessContext?.payment) {
    injectedSections.push(`Payment context:\n${formatBusinessContextValue(businessContext.payment)}`);
  }
  if (businessContext?.delivery) {
    injectedSections.push(`Delivery context:\n${formatBusinessContextValue(businessContext.delivery)}`);
  }
  if (businessContext?.ticket) {
    injectedSections.push(`Ticket context:\n${formatBusinessContextValue(businessContext.ticket)}`);
  }

  if (injectedSections.length > 0) {
    parts.push(injectedSections.join('\n\n'));
  }

  return parts.join('\n\n');
}

export function createGreetingReply() {
  return 'Hello! 👋 Welcome. How can I help you today?';
}
