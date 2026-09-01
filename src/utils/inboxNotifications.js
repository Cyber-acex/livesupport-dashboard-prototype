export function buildIncomingMessageNotification(messagePayload = {}) {
  const customerName = messagePayload.customer_name || messagePayload.customerName || messagePayload.sender_name || messagePayload.sender || 'Customer';
  const text = String(messagePayload.message || '').trim();
  return text ? `New message from ${customerName}: ${text}` : `New message from ${customerName}`;
}

export function getActiveConversationIdFromEvent(event = null) {
  if (!event) return '';

  if (event?.detail && Object.prototype.hasOwnProperty.call(event.detail, 'conversationId')) {
    return String(event.detail.conversationId ?? '').trim();
  }

  if (event?.conversationId != null) {
    return String(event.conversationId).trim();
  }

  return '';
}

export function shouldShowIncomingMessageNotification(messagePayload = {}, activeConversationId = null) {
  if (!messagePayload || !messagePayload.conversation_id) return false;

  const currentConversationId = String(activeConversationId ?? '').trim();
  const incomingConversationId = String(messagePayload.conversation_id).trim();

  if (!currentConversationId) return true;
  return incomingConversationId !== currentConversationId;
}

export function buildTicketEventNotification(ticketPayload = {}, eventType = 'created') {
  const ticketId = ticketPayload?.id ?? ticketPayload?.ticket_id ?? null;
  const subject = ticketPayload?.subject || ticketPayload?.title || ticketPayload?.content || '';

  if (eventType === 'resolved') {
    return ticketId != null ? `Ticket #${ticketId} resolved` : 'Ticket resolved';
  }

  if (eventType === 'deleted') {
    return ticketId != null ? `Ticket #${ticketId} deleted` : 'Ticket deleted';
  }

  if (eventType === 'escalated') {
    return ticketId != null ? `Ticket #${ticketId} escalated` : 'Ticket escalated';
  }

  if (eventType === 'created') {
    return ticketId != null && subject
      ? `New ticket created #${ticketId}: ${subject}`
      : ticketId != null
        ? `New ticket created #${ticketId}`
        : 'New ticket created';
  }

  return ticketId != null ? `Ticket #${ticketId} updated` : 'Ticket updated';
}
