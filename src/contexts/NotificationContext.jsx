import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { buildIncomingMessageNotification, buildTicketEventNotification, shouldShowIncomingMessageNotification } from '../utils/inboxNotifications';

const NotificationContext = createContext();

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);
  const [inboxNotifications, setInboxNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const socketRef = useRef(null);
  const activeConversationIdRef = useRef(null);
  const localTicketActionsRef = useRef({
    created: new Set(),
    pendingCreated: new Set(),
    deleted: new Set(),
    escalated: new Set()
  });
  const currentUserIdRef = useRef(null);

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

  const markLocalTicketCreationRequested = useCallback((clientTicketId) => {
    if (!clientTicketId) return;
    localTicketActionsRef.current.pendingCreated.add(String(clientTicketId));
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
    const clientTicketId = String(payload?.client_ticket_id ?? '');

    if (eventType === 'created') {
      if (clientTicketId && localTicketActionsRef.current.pendingCreated.has(clientTicketId)) {
        localTicketActionsRef.current.pendingCreated.delete(clientTicketId);
        return true;
      }
      if (ticketId && localTicketActionsRef.current.created.has(ticketId)) {
        localTicketActionsRef.current.created.delete(ticketId);
        return true;
      }
    }

    if (eventType === 'deleted' && ticketId && localTicketActionsRef.current.deleted.has(ticketId)) {
      localTicketActionsRef.current.deleted.delete(ticketId);
      return true;
    }

    if (eventType === 'escalated' && ticketId && localTicketActionsRef.current.escalated.has(ticketId)) {
      localTicketActionsRef.current.escalated.delete(ticketId);
      return true;
    }

    return false;
  }, []);

  const loadCurrentUserId = useCallback(async () => {
    if (typeof window === 'undefined') return null;
    if (currentUserIdRef.current) return currentUserIdRef.current;
    const userId = window.currentUser?.id || window.currentUser?.userId || null;
    if (userId) {
      currentUserIdRef.current = userId;
      return userId;
    }

    try {
      const res = await fetch('/api/user', { credentials: 'same-origin' });
      if (!res.ok) return null;
      const data = await res.json();
      if (data?.id) {
        currentUserIdRef.current = data.id;
        window.currentUser = Object.assign({}, window.currentUser || {}, data);
        return data.id;
      }
    } catch (err) {
      console.warn('Failed to resolve current user for notifications:', err);
    }
    return null;
  }, []);

  const fetchInboxNotifications = useCallback(async () => {
    setNotificationsLoading(true);
    try {
      const res = await fetch('/api/notifications', { credentials: 'same-origin' });
      if (!res.ok) return;
      const data = await res.json();
      const items = Array.isArray(data.notifications) ? data.notifications : [];
      setInboxNotifications(items);
      setUnreadCount(Number(data.unreadCount || 0));
    } catch (err) {
      console.warn('Failed to load inbox notifications:', err);
    } finally {
      setNotificationsLoading(false);
    }
  }, []);

  const markNotificationRead = useCallback(async (notificationId) => {
    if (!notificationId) return false;
    try {
      const res = await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'PATCH',
        credentials: 'same-origin'
      });
      if (!res.ok) return false;
      setInboxNotifications((prev) => prev.map((item) => item.id === notificationId ? { ...item, isRead: true } : item));
      setUnreadCount((count) => Math.max(0, count - 1));
      return true;
    } catch (err) {
      console.warn('Failed to mark notification read:', err);
      return false;
    }
  }, []);

  const dismissNotification = useCallback(async (notificationId) => {
    if (!notificationId) return false;
    try {
      const res = await fetch(`/api/notifications/${notificationId}`, {
        method: 'DELETE',
        credentials: 'same-origin'
      });
      if (!res.ok) return false;
      setInboxNotifications((prev) => prev.filter((item) => item.id !== notificationId));
      return true;
    } catch (err) {
      console.warn('Failed to dismiss notification:', err);
      return false;
    }
  }, []);

  const markAllNotificationsRead = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications/mark-all-read', {
        method: 'POST',
        credentials: 'same-origin'
      });
      if (!res.ok) return false;
      setInboxNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
      setUnreadCount(0);
      return true;
    } catch (err) {
      console.warn('Failed to mark all notifications read:', err);
      return false;
    }
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

    const handleNotificationReceived = (payload) => {
      if (!payload || !payload.notification) return;
      setInboxNotifications((prev) => {
        const found = prev.some((item) => item.id === payload.notification.id);
        if (found) return prev;
        return [payload.notification, ...prev];
      });
    };

    const handleNotificationCount = (payload) => {
      if (!payload || typeof payload.unreadCount !== 'number') return;
      setUnreadCount(payload.unreadCount);
    };

    const handleNotificationUpdated = (payload) => {
      if (!payload) return;
      if (payload.type === 'all-read') {
        setInboxNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
      }
      if (typeof payload.notificationId !== 'undefined') {
        setInboxNotifications((prev) => prev.map((item) => {
          if (item.id !== payload.notificationId) return item;
          if (payload.isDeleted) return null;
          return {
            ...item,
            isRead: typeof payload.isRead === 'boolean' ? payload.isRead : item.isRead,
            isDeleted: typeof payload.isDeleted === 'boolean' ? payload.isDeleted : item.isDeleted
          };
        }).filter(Boolean));
      }
      if (typeof payload.unreadCount === 'number') {
        setUnreadCount(payload.unreadCount);
      }
    };

    const handleActiveConversationChanged = (event) => {
      const conversationId = event && event.conversationId != null ? String(event.conversationId) : '';
      activeConversationIdRef.current = conversationId;
    };

    const joinNotificationRoom = async () => {
      const userId = await loadCurrentUserId();
      if (userId && socket && socket.connected) {
        socket.emit('notification:join', { userId });
      }
    };

    socket.on('connect', joinNotificationRoom);
    joinNotificationRoom();

    socket.on('newMessage', handleIncomingMessage);
    socket.on('ticketCreated', (ticket) => handleTicketEvent(ticket, 'created'));
    socket.on('ticketResolved', (ticket) => handleTicketEvent(ticket, 'resolved'));
    socket.on('ticketDeleted', (ticket) => handleTicketEvent(ticket, 'deleted'));
    socket.on('ticketEscalated', (ticket) => handleTicketEvent(ticket, 'escalated'));
    socket.on('receiptCreated', () => addNotification('Receipt created', 'info', 6000));
    socket.on('receiptDeleted', () => addNotification('Receipt deleted', 'info', 6000));
    socket.on('notification:received', handleNotificationReceived);
    socket.on('notification:count', handleNotificationCount);
    socket.on('notification:updated', handleNotificationUpdated);
    window.addEventListener('inbox:activeConversationChanged', handleActiveConversationChanged);

    fetchInboxNotifications();

    window.__showAppNotification = (message, type = 'success', duration = 4000) => {
      addNotification(message, type, duration);
    };

    return () => {
      socket.off('connect', joinNotificationRoom);
      socket.off('newMessage', handleIncomingMessage);
      socket.off('ticketCreated');
      socket.off('ticketResolved');
      socket.off('ticketDeleted');
      socket.off('ticketEscalated');
      socket.off('receiptCreated');
      socket.off('receiptDeleted');
      socket.off('notification:received', handleNotificationReceived);
      socket.off('notification:count', handleNotificationCount);
      socket.off('notification:updated', handleNotificationUpdated);
      window.removeEventListener('inbox:activeConversationChanged', handleActiveConversationChanged);
      if (socketRef.current === socket) {
        socket.disconnect();
        socketRef.current = null;
      }
      delete window.__showAppNotification;
    };
  }, [addNotification, fetchInboxNotifications, loadCurrentUserId, shouldSuppressTicketNotification, shouldShowIncomingMessageNotification]);

  return (
    <NotificationContext.Provider value={{ 
      addNotification, 
      removeNotification, 
      success, 
      error, 
      warning, 
      info,
      markLocalTicketCreationRequested,
      markLocalTicketCreated,
      markLocalTicketDeleted,
      markLocalTicketEscalated,
      notifications,
      inboxNotifications,
      unreadCount,
      notificationsLoading,
      fetchInboxNotifications,
      markNotificationRead,
      dismissNotification,
      markAllNotificationsRead
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
