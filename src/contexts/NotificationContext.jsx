import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { buildIncomingMessageNotification, buildTicketEventNotification, shouldShowIncomingMessageNotification } from '../utils/inboxNotifications';

const NotificationContext = createContext();

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);
  const socketRef = useRef(null);
  const activeConversationIdRef = useRef(null);
  const localTicketActionsRef = useRef({
    created: new Set(),
    deleted: new Set(),
    escalated: new Set()
  });

  const addNotification = useCallback((message, type = 'success', duration = 4000) => {
    const id = Date.now();
    const notification = { id, message, type };
    
    setNotifications(prev => [...prev, notification]);

    if (duration > 0) {
      setTimeout(() => {
        removeNotification(id);
      }, duration);
    }

    return id;
  }, []);

  const removeNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const success = useCallback((message, duration) => 
    addNotification(message, 'success', duration), [addNotification]);

  const error = useCallback((message, duration) => 
    addNotification(message, 'error', duration), [addNotification]);

  const warning = useCallback((message, duration) => 
    addNotification(message, 'warning', duration), [addNotification]);

  const info = useCallback((message, duration) => 
    addNotification(message, 'info', duration), [addNotification]);

  const markLocalTicketCreated = useCallback((ticketId) => {
    if (!ticketId) return;
    localTicketActionsRef.current.created.add(String(ticketId));
  }, []);

  const markLocalTicketDeleted = useCallback((ticketId) => {
    if (!ticketId) return;
    localTicketActionsRef.current.deleted.add(String(ticketId));
  }, []);

  const markLocalTicketEscalated = useCallback((ticketId) => {
    if (!ticketId) return;
    localTicketActionsRef.current.escalated.add(String(ticketId));
  }, []);

  const shouldSuppressTicketNotification = useCallback((payload, eventType) => {
    if (!payload) return false;
    const ticketId = String(payload?.id ?? payload?.ticket_id ?? '');
    if (!ticketId) return false;

    if (eventType === 'created' && localTicketActionsRef.current.created.has(ticketId)) {
      localTicketActionsRef.current.created.delete(ticketId);
      return true;
    }

    if (eventType === 'deleted' && localTicketActionsRef.current.deleted.has(ticketId)) {
      localTicketActionsRef.current.deleted.delete(ticketId);
      return true;
    }

    if (eventType === 'escalated' && localTicketActionsRef.current.escalated.has(ticketId)) {
      localTicketActionsRef.current.escalated.delete(ticketId);
      return true;
    }

    return false;
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const socket = socketRef.current || io();
    socketRef.current = socket;

    const handleIncomingMessage = (message) => {
      if (!message || !message.conversation_id) return;

      const sender = String(message.sender || '').toLowerCase();
      const isCustomerMessage = !['agent', 'staff', 'ai', 'assistant', 'system'].includes(sender);
      if (!isCustomerMessage) return;
      if (!shouldShowIncomingMessageNotification(message, activeConversationIdRef.current)) return;

      addNotification(buildIncomingMessageNotification(message), 'info', 6000);
    };

    const handleTicketEvent = (payload, eventType) => {
      if (!payload && eventType !== 'created') return;
      if (shouldSuppressTicketNotification(payload || {}, eventType)) return;
      addNotification(buildTicketEventNotification(payload || {}, eventType), 'info', 6000);
    };

    const handleActiveConversationChanged = (event) => {
      const conversationId = event && event.conversationId != null ? String(event.conversationId) : '';
      activeConversationIdRef.current = conversationId;
    };

    socket.on('newMessage', handleIncomingMessage);
    socket.on('ticketCreated', (ticket) => handleTicketEvent(ticket, 'created'));
    socket.on('ticketResolved', (ticket) => handleTicketEvent(ticket, 'resolved'));
    socket.on('ticketDeleted', (ticket) => handleTicketEvent(ticket, 'deleted'));
    socket.on('ticketEscalated', (ticket) => handleTicketEvent(ticket, 'escalated'));
    socket.on('receiptCreated', () => addNotification('Receipt created', 'info', 6000));
    socket.on('receiptDeleted', () => addNotification('Receipt deleted', 'info', 6000));
    window.addEventListener('inbox:activeConversationChanged', handleActiveConversationChanged);

    window.__showAppNotification = (message, type = 'success', duration = 4000) => {
      addNotification(message, type, duration);
    };

    return () => {
      socket.off('newMessage', handleIncomingMessage);
      socket.off('ticketCreated');
      socket.off('ticketResolved');
      socket.off('ticketDeleted');
      socket.off('ticketEscalated');
      socket.off('receiptCreated');
      socket.off('receiptDeleted');
      window.removeEventListener('inbox:activeConversationChanged', handleActiveConversationChanged);
      if (socketRef.current === socket) {
        socket.disconnect();
        socketRef.current = null;
      }
      delete window.__showAppNotification;
    };
  }, [addNotification]);

  return (
    <NotificationContext.Provider value={{ 
      addNotification, 
      removeNotification, 
      success, 
      error, 
      warning, 
      info,
      markLocalTicketCreated,
      markLocalTicketDeleted,
      markLocalTicketEscalated,
      notifications 
    }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within NotificationProvider');
  }
  return context;
}
