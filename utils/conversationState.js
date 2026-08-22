const DEFAULT_CONVERSATION_TIMEOUT_MS = Number(process.env.CONVERSATION_STATE_TIMEOUT_MS || 30 * 60 * 1000);

export const DEFAULT_WORKFLOW_STATE = 'Greeting';

export function createDefaultConversationSession({
  conversationId = null,
  sessionId = null,
  customerId = null,
  branchId = null,
  customerName = null,
  phone = null,
  workflowState = DEFAULT_WORKFLOW_STATE,
  pendingQuestions = [],
  draftOrder = null,
  history = [],
  lastMessageAt = null,
  sessionData = {}
} = {}) {
  const now = new Date().toISOString();
  const normalizedDraftOrder = draftOrder && typeof draftOrder === 'object'
    ? {
        items: Array.isArray(draftOrder.items) ? draftOrder.items : [],
        quantities: draftOrder.quantities || {},
        modifiers: draftOrder.modifiers || {},
        allergies: Array.isArray(draftOrder.allergies) ? draftOrder.allergies : [],
        delivery: draftOrder.delivery || null,
        pickup: draftOrder.pickup || null,
        tableNumber: draftOrder.tableNumber || null,
        address: draftOrder.address || null,
        paymentMethod: draftOrder.paymentMethod || null,
        discounts: draftOrder.discounts || [],
        notes: draftOrder.notes || '',
        orderId: draftOrder.orderId || null,
        total: draftOrder.total || null,
        createdAt: draftOrder.createdAt || now,
        updatedAt: draftOrder.updatedAt || now
      }
    : {
        items: [],
        quantities: {},
        modifiers: {},
        allergies: [],
        delivery: null,
        pickup: null,
        tableNumber: null,
        address: null,
        paymentMethod: null,
        discounts: [],
        notes: '',
        orderId: null,
        total: null,
        createdAt: now,
        updatedAt: now
      };

  return {
    conversationId: Number(conversationId || 0) || null,
    sessionId: sessionId || `session-${conversationId || Date.now()}`,
    customerId: Number(customerId || 0) || null,
    branchId: Number(branchId || 0) || null,
    customerName: customerName || null,
    phone: phone || null,
    workflowState,
    pendingQuestions: Array.isArray(pendingQuestions) ? pendingQuestions : [],
    draftOrder: normalizedDraftOrder,
    history: Array.isArray(history) ? history : [],
    lastMessageAt: lastMessageAt || now,
    createdAt: now,
    updatedAt: now,
    expiresAt: new Date(Date.now() + DEFAULT_CONVERSATION_TIMEOUT_MS).toISOString(),
    active: true,
    ...sessionData
  };
}

export function normalizeConversationState(state = {}) {
  const normalized = createDefaultConversationSession({
    ...state,
    pendingQuestions: Array.isArray(state.pendingQuestions) ? state.pendingQuestions : [],
    history: Array.isArray(state.history) ? state.history : [],
    draftOrder: state.draftOrder || null
  });

  return {
    ...normalized,
    workflowState: state.workflowState || normalized.workflowState,
    pendingQuestions: Array.isArray(state.pendingQuestions) ? state.pendingQuestions : normalized.pendingQuestions,
    history: Array.isArray(state.history) ? state.history : normalized.history,
    draftOrder: normalizeDraftOrder(state.draftOrder || normalized.draftOrder),
    lastMessageAt: state.lastMessageAt || normalized.lastMessageAt,
    updatedAt: state.updatedAt || normalized.updatedAt
  };
}

export function normalizeDraftOrder(draftOrder = null) {
  const base = createDefaultConversationSession({ draftOrder }).draftOrder;
  const hasExplicitOrderId = draftOrder && typeof draftOrder === 'object' && Object.prototype.hasOwnProperty.call(draftOrder, 'orderId');
  const hasExplicitTotal = draftOrder && typeof draftOrder === 'object' && Object.prototype.hasOwnProperty.call(draftOrder, 'total');

  return {
    ...base,
    ...(draftOrder && typeof draftOrder === 'object' ? draftOrder : {}),
    items: Array.isArray(draftOrder?.items) ? draftOrder.items : base.items,
    quantities: draftOrder?.quantities && typeof draftOrder.quantities === 'object' ? draftOrder.quantities : base.quantities,
    modifiers: draftOrder?.modifiers && typeof draftOrder.modifiers === 'object' ? draftOrder.modifiers : base.modifiers,
    allergies: Array.isArray(draftOrder?.allergies) ? draftOrder.allergies : base.allergies,
    discounts: Array.isArray(draftOrder?.discounts) ? draftOrder.discounts : base.discounts,
    notes: draftOrder?.notes || base.notes,
    address: draftOrder?.address || base.address,
    tableNumber: draftOrder?.tableNumber || base.tableNumber,
    paymentMethod: draftOrder?.paymentMethod || base.paymentMethod,
    pickup: draftOrder?.pickup || base.pickup,
    delivery: draftOrder?.delivery || base.delivery,
    orderId: hasExplicitOrderId ? (draftOrder.orderId ?? null) : null,
    total: hasExplicitTotal ? (draftOrder.total ?? null) : null,
    createdAt: draftOrder?.createdAt || base.createdAt,
    updatedAt: draftOrder?.updatedAt || base.updatedAt
  };
}

function mergeDraftOrder(currentDraft = null, patchDraft = null) {
  const normalizedCurrent = normalizeDraftOrder(currentDraft);
  const normalizedPatch = normalizeDraftOrder(patchDraft);
  const hasExplicitPatchOrderId = patchDraft && typeof patchDraft === 'object' && Object.prototype.hasOwnProperty.call(patchDraft, 'orderId');
  const hasExplicitPatchTotal = patchDraft && typeof patchDraft === 'object' && Object.prototype.hasOwnProperty.call(patchDraft, 'total');

  return normalizeDraftOrder({
    ...normalizedCurrent,
    ...normalizedPatch,
    items: Array.isArray(normalizedPatch.items) && normalizedPatch.items.length > 0 ? normalizedPatch.items : normalizedCurrent.items,
    quantities: { ...normalizedCurrent.quantities, ...normalizedPatch.quantities },
    modifiers: { ...normalizedCurrent.modifiers, ...normalizedPatch.modifiers },
    allergies: Array.isArray(normalizedPatch.allergies) && normalizedPatch.allergies.length > 0 ? normalizedPatch.allergies : normalizedCurrent.allergies,
    discounts: Array.isArray(normalizedPatch.discounts) && normalizedPatch.discounts.length > 0 ? normalizedPatch.discounts : normalizedCurrent.discounts,
    notes: normalizedPatch.notes || normalizedCurrent.notes,
    address: normalizedPatch.address || normalizedCurrent.address,
    tableNumber: normalizedPatch.tableNumber || normalizedCurrent.tableNumber,
    paymentMethod: normalizedPatch.paymentMethod || normalizedCurrent.paymentMethod,
    pickup: normalizedPatch.pickup || normalizedCurrent.pickup,
    delivery: normalizedPatch.delivery || normalizedCurrent.delivery,
    orderId: hasExplicitPatchOrderId ? (patchDraft.orderId ?? null) : null,
    total: hasExplicitPatchTotal ? (patchDraft.total ?? null) : normalizedCurrent.total,
    updatedAt: normalizedPatch.updatedAt || new Date().toISOString()
  });
}

export function mergeConversationState(currentState = {}, patch = {}) {
  const base = normalizeConversationState(currentState);
  const next = normalizeConversationState({
    ...base,
    ...patch,
    draftOrder: patch.draftOrder || base.draftOrder,
    pendingQuestions: Array.isArray(patch.pendingQuestions) ? patch.pendingQuestions : base.pendingQuestions,
    history: Array.isArray(patch.history) ? patch.history : base.history,
    active: patch.active ?? base.active
  });

  next.updatedAt = new Date().toISOString();
  return next;
}

const ORDER_WORKFLOW_STATES = [
  'Greeting',
  'Browsing Menu',
  'Building Order',
  'Waiting for Quantity',
  'Waiting for Modifiers',
  'Waiting for Allergy Confirmation',
  'Waiting for Table Number',
  'Waiting for Delivery Address',
  'Waiting for Payment Method',
  'Ready to Create Order',
  'Creating Order',
  'Order Created',
  'Cancelled'
];

function extractAllergyKeywords(message) {
  const knownAllergens = ['dairy', 'gluten', 'peanut', 'nuts', 'shellfish', 'soy', 'sesame', 'egg', 'fish', 'wheat', 'tree nuts'];
  const lower = String(message || '').toLowerCase();
  return knownAllergens.filter((allergen) => lower.includes(allergen));
}

function inferOrderFieldsFromMessage(message, currentDraft) {
  const text = String(message || '').trim();
  const lower = text.toLowerCase();
  const draftUpdate = {};

  if (!currentDraft?.pickup && /\b(delivery|deliver|home delivery|ship it|send it)\b/.test(lower)) {
    draftUpdate.pickup = 'delivery';
  }
  if (!currentDraft?.pickup && /\b(pickup|pick up|collect|collection|store pickup)\b/.test(lower)) {
    draftUpdate.pickup = 'pickup';
  }

  if (!currentDraft?.address && /\b(?:deliver to|delivery to|address is|at|to)\b/.test(lower)) {
    const addressMatch = text.match(/(?:deliver to|delivery to|address is|at|to)\s+(.+)/i);
    if (addressMatch && addressMatch[1]) {
      draftUpdate.address = addressMatch[1].trim();
    }
  }

  if (!currentDraft?.tableNumber) {
    const tableMatch = text.match(/table\s*(?:number\s*)?(\d+)/i);
    if (tableMatch && tableMatch[1]) {
      draftUpdate.tableNumber = tableMatch[1].trim();
    }
  }

  if (!currentDraft?.paymentMethod) {
    if (/\b(card|credit card|debit card|visa|mastercard|amex|apple pay|google pay|gpay|cash)\b/.test(lower)) {
      const method = lower.includes('cash') ? 'cash' : (lower.includes('apple pay') ? 'apple_pay' : lower.includes('google pay') ? 'google_pay' : 'card');
      draftUpdate.paymentMethod = method;
    }
  }

  if (!currentDraft?.allergies || !currentDraft.allergies.length) {
    const allergies = extractAllergyKeywords(text);
    if (allergies.length > 0) {
      draftUpdate.allergies = Array.from(new Set(allergies));
    }
  }

  return draftUpdate;
}

function isCancellationMessage(message) {
  return /\b(cancel|cancel my order|start over|abort|never mind|forget it|stop)\b/i.test(String(message || ''));
}

function hasPositiveConfirmation(message) {
  return /\b(yes|sure|confirm|place it|order now|okay|ok|lets do it|let's do it)\b/i.test(String(message || ''));
}

function hasOrderItems(session) {
  return Array.isArray(session?.draftOrder?.items) && session.draftOrder.items.length > 0;
}

function hasAllergyInfo(session) {
  return Array.isArray(session?.draftOrder?.allergies) && session.draftOrder.allergies.length > 0;
}

function hasDeliveryAddress(session) {
  return !!String(session?.draftOrder?.address || '').trim();
}

function hasTableNumber(session) {
  return !!String(session?.draftOrder?.tableNumber || '').trim();
}

function hasPaymentMethod(session) {
  return !!String(session?.draftOrder?.paymentMethod || '').trim();
}

function isDelivery(session) {
  return String(session?.draftOrder?.pickup || '').toLowerCase() === 'delivery';
}

function isPickup(session) {
  return String(session?.draftOrder?.pickup || '').toLowerCase() === 'pickup';
}

export function applyWorkflowTransition(currentState = {}, { customerMessage = '', draftOrder = null, action = null } = {}) {
  const session = normalizeConversationState(currentState);
  const patchDraft = mergeDraftOrder(session.draftOrder, inferOrderFieldsFromMessage(customerMessage, session.draftOrder));
  const mergedDraft = mergeDraftOrder(patchDraft, draftOrder);
  const next = mergeConversationState(session, {
    draftOrder: mergedDraft,
    history: [...session.history, { role: 'customer', message: String(customerMessage || '') }],
    lastMessageAt: new Date().toISOString()
  });

  if (isCancellationMessage(customerMessage) || action === 'cancel') {
    next.workflowState = 'Cancelled';
    next.pendingQuestions = [];
    next.active = false;
    return next;
  }

  if (next.workflowState === 'Order Created' || next.workflowState === 'Cancelled') {
    return next;
  }

  if (next.draftOrder.orderId) {
    next.workflowState = 'Order Created';
    next.pendingQuestions = [];
    return next;
  }

  const currentStateIndex = ORDER_WORKFLOW_STATES.indexOf(session.workflowState);
  const allergyIndex = ORDER_WORKFLOW_STATES.indexOf('Waiting for Allergy Confirmation');
  const deliveryIndex = ORDER_WORKFLOW_STATES.indexOf('Waiting for Delivery Address');
  const pickupIndex = ORDER_WORKFLOW_STATES.indexOf('Waiting for Table Number');
  const paymentIndex = ORDER_WORKFLOW_STATES.indexOf('Waiting for Payment Method');

  if (!hasOrderItems(next)) {
    next.workflowState = 'Building Order';
    next.pendingQuestions = ['What would you like to order?'];
    return next;
  }

  if (currentStateIndex < allergyIndex || !hasAllergyInfo(next)) {
    next.workflowState = 'Waiting for Allergy Confirmation';
    next.pendingQuestions = ['Do you have any allergies?'];
    return next;
  }

  if (isDelivery(next) && !hasDeliveryAddress(next)) {
    next.workflowState = 'Waiting for Delivery Address';
    next.pendingQuestions = ['Where should we deliver your order?'];
    return next;
  }

  if (isPickup(next) && !hasTableNumber(next)) {
    next.workflowState = 'Waiting for Table Number';
    next.pendingQuestions = ['What table number should we assign your order to?'];
    return next;
  }

  if (currentStateIndex < paymentIndex || !hasPaymentMethod(next)) {
    next.workflowState = 'Waiting for Payment Method';
    next.pendingQuestions = ['How would you like to pay for your order?'];
    return next;
  }

  if (hasOrderItems(next) && hasAllergyInfo(next) && (isDelivery(next) ? hasDeliveryAddress(next) : true) && (isPickup(next) ? hasTableNumber(next) : true) && hasPaymentMethod(next)) {
    next.workflowState = 'Ready to Create Order';
    next.pendingQuestions = [];
    return next;
  }

  next.workflowState = 'Building Order';
  next.pendingQuestions = [];
  return next;
}

export { ORDER_WORKFLOW_STATES };

export function buildSessionOrderKey({ conversationId = null, sessionId = null } = {}) {
  return `conversation:${conversationId || 'unknown'}:session:${sessionId || 'default'}:order`;
}
