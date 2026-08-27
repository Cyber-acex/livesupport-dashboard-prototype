import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, Bot, CheckCheck, Circle, Command, Filter, Inbox, MessageCircle, MoreHorizontal, Paperclip, Phone, Search, Send, ShieldCheck, Smile, Sparkles, Video, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import Sidebar from '../components/Sidebar';
import TopBar from '../components/TopBar';
import StatusBadge from '../components/StatusBadge';
import { formatInboxTimestamp } from '../utils/inboxTime';
import { useNotification } from '../contexts/NotificationContext';
import { canUseAiReply, normalizeAutopilotMode } from '../services/autopilotMode';

const queueFilters = [
  { id: 'all', label: 'All', icon: '✦' },
  { id: 'priority', label: 'Priority', icon: '⚡' },
  { id: 'unread', label: 'Unread', icon: '✉' },
  { id: 'resolved', label: 'Resolved', icon: '✓' },
  { id: 'escalated', label: 'Escalated', icon: '🚨' }
];

const platformFilters = [
  { id: 'all', label: 'All channels' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'messenger', label: 'Messenger' },
  { id: 'web', label: 'Webchat' }
];

const aiFeedbackCategories = ['WRONG_INTENT', 'WRONG_INFORMATION', 'WRONG_ACTION', 'WRONG_CONTEXT', 'REPEATED_QUESTION', 'HALLUCINATION', 'WRONG_BRANCH', 'OTHER'];

function formatDate(value) {
  return formatInboxTimestamp(value);
}

function getPlatformDetails(platform) {
  const normalized = String(platform || '').trim().toLowerCase();
  if (normalized === 'messenger' || normalized === 'facebook') {
    return { label: 'Messenger', className: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300' };
  }
  if (normalized === 'web' || normalized === 'webchat' || normalized === 'chat') {
    return { label: 'Webchat', className: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300' };
  }
  if (normalized === 'whatsapp') {
    return { label: 'WhatsApp', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' };
  }
  return { label: platform || 'Chat', className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' };
}

function InboxPage({ defaultPlatform = null }) {
  const platformFilter = String(defaultPlatform || '').trim().toLowerCase() || null;
  const isMessenger = platformFilter === 'messenger';
  const isUnifiedInbox = !platformFilter;
  const platformLabel = isUnifiedInbox ? 'all' : isMessenger ? 'Messenger' : 'WhatsApp';
  const platformHeroTitle = isUnifiedInbox ? 'Unified inbox workspace' : isMessenger ? 'Messenger inbox workspace' : 'WhatsApp inbox workspace';
  const platformHeroDescription = isUnifiedInbox
    ? 'Manage every WhatsApp, Messenger, and Webchat conversation in one place.'
    : isMessenger
      ? 'Manage Facebook Messenger customer conversations.'
      : 'Stay ahead of every WhatsApp customer conversation.';
  const palette = isMessenger
    ? {
        shell: 'from-sky-600 via-blue-600 to-indigo-600',
        accent: 'bg-sky-600 hover:bg-sky-700',
        accentSoft: 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300',
        border: 'border-sky-200 dark:border-sky-900/40',
        badge: 'from-sky-500 to-blue-500',
        incoming: 'border-slate-200 bg-white text-slate-700 shadow-[0_10px_25px_rgba(15,23,42,0.06)] dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200',
        outgoing: 'border-transparent bg-gradient-to-br from-sky-600 to-blue-600 text-white shadow-[0_12px_28px_rgba(59,130,246,0.28)]'
      }
    : {
        shell: 'from-emerald-600 via-green-600 to-teal-600',
        accent: 'bg-emerald-600 hover:bg-emerald-700',
        accentSoft: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
        border: 'border-emerald-200 dark:border-emerald-900/40',
        badge: 'from-emerald-500 to-teal-500',
        incoming: 'border-slate-200 bg-white text-slate-700 shadow-[0_10px_25px_rgba(15,23,42,0.06)] dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200',
        outgoing: 'border-transparent bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-[0_12px_28px_rgba(16,185,129,0.28)]'
      };
  const { success, error, warning, info } = useNotification();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [composer, setComposer] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [activePlatform, setActivePlatform] = useState('all');
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [isGeneratingReply, setIsGeneratingReply] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [receiptSaving, setReceiptSaving] = useState(false);
  const [receiptForm, setReceiptForm] = useState({
    receiptNumber: '',
    issuedAt: '',
    customerName: '',
    customerPhone: '',
    orderId: '',
    paymentMethod: 'cash',
    currency: 'NGN',
    taxRate: 7.5,
    serviceChargeRate: 0,
    notes: '',
    lineItems: []
  });
  const [escalatedConversationIds, setEscalatedConversationIds] = useState([]);
  const [escalatingConversationId, setEscalatingConversationId] = useState(null);
  const [isDeletingConversation, setIsDeletingConversation] = useState(false);
  const [feedbackTarget, setFeedbackTarget] = useState(null);
  const [feedbackForm, setFeedbackForm] = useState({ category: 'OTHER', explanation: '', correction: '', expectedBehavior: '' });
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const escalationAudio = useMemo(() => {
    const audio = new Audio(encodeURI('/uploads/Notification sounds/escalation sound.wav'));
    audio.preload = 'auto';
    return audio;
  }, []);
  const inboxMessageAudio = useMemo(() => {
    const audio = new Audio(encodeURI('/uploads/Notification sounds/inbox message.wav'));
    audio.preload = 'auto';
    return audio;
  }, []);
  const [currentUser, setCurrentUser] = useState(null);
  const [autopilotMode, setAutopilotMode] = useState('assist');
  const [recentOrders, setRecentOrders] = useState([]);
  const [recentOrdersLoading, setRecentOrdersLoading] = useState(false);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const navigate = useNavigate();
  const [editingConversationId, setEditingConversationId] = useState(null);
  const [editingConversationName, setEditingConversationName] = useState('');
  const [isSavingConversationName, setIsSavingConversationName] = useState(false);
  const socketRef = useRef(null);
  const selectedConversationIdRef = useRef(null);
  const activeConversationRoomRef = useRef(null);
  const messagesViewportRef = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    let active = true;

    async function loadConversations() {
      try {
        const response = await fetch('/api/conversations');
        if (!response.ok) throw new Error('Failed to load conversations');
        const data = await response.json();
        if (active) {
          const normalized = Array.isArray(data) ? data : [];
          setConversations(normalized);
          if (normalized.length > 0) {
            setSelectedConversation(normalized[0]);
          }
        }
      } catch (error) {
        console.error('Inbox load error', error);
        if (active) error('Failed to load inbox conversations');
      } finally {
        if (active) setLoading(false);
      }
    }

    loadConversations();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (conversations.length === 0) {
      setSelectedConversation(null);
      setMessages([]);
      return;
    }

    if (!selectedConversation || !conversations.some((conversation) => conversation.id === selectedConversation.id)) {
      setSelectedConversation(conversations[0]);
    }
  }, [conversations, selectedConversation]);

  useEffect(() => {
    const savedMode = normalizeAutopilotMode(window.localStorage.getItem('autopilotMode') || 'assist');
    setAutopilotMode(savedMode);

    const handleStorage = (event) => {
      if (event.key === 'autopilotMode') {
        setAutopilotMode(normalizeAutopilotMode(event.newValue || 'assist'));
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // Emit autopilot mode changes to the socket so server presence reflects current mode
  useEffect(() => {
    try {
      const socket = socketRef.current;
      if (socket && socket.connected) {
        socket.emit('agent:updateAutopilotMode', { autopilotMode: autopilotMode });
      }
    } catch (e) {
      console.warn('Failed to emit autopilot mode update', e);
    }
  }, [autopilotMode]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const conversationId = selectedConversation?.id != null ? String(selectedConversation.id) : '';
      window.dispatchEvent(new CustomEvent('inbox:activeConversationChanged', { detail: { conversationId } }));
    }
  }, [selectedConversation?.id]);

  useEffect(() => {
    if (!selectedConversation?.id) {
      setMessages([]);
      return;
    }

    let active = true;
    async function loadMessages() {
      setMessagesLoading(true);
      try {
        const response = await fetch(`/api/messages/${selectedConversation.id}`);
        if (!response.ok) throw new Error('Failed to load messages');
        const data = await response.json();
        if (active) {
          setMessages(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error('Inbox thread load error', err);
        if (active) {
          setMessages([]);
          error('Failed to load message thread');
        }
      } finally {
        if (active) setMessagesLoading(false);
      }
    }

    loadMessages();
    return () => {
      active = false;
    };
  }, [selectedConversation?.id]);

  useEffect(() => {
    if (!socketRef.current) {
      socketRef.current = io();
    }

    const socket = socketRef.current;

    const refreshConversations = async () => {
      try {
        const response = await fetch('/api/conversations');
        if (!response.ok) throw new Error('Failed to refresh conversations');
        const data = await response.json();
        setConversations(Array.isArray(data) ? data : []);
      } catch (err) {
        console.warn('Live inbox conversation refresh failed', err);
      }
    };

    const handleNewMessage = (message) => {
      if (!message || !message.conversation_id) return;
      const conversationId = String(message.conversation_id);
      const activeConversationId = String(selectedConversationIdRef.current);
      const isActiveConversation = activeConversationId === conversationId;
      const sender = String(message.sender || '').toLowerCase();
      const isCustomerMessage = !['agent', 'staff', 'ai', 'assistant', 'system'].includes(sender);

      setConversations((prev) => prev.map((conv) => {
        if (String(conv.id) !== conversationId) return conv;
        return {
          ...conv,
          last_message: message.message || conv.last_message,
          last_message_at: message.created_at || new Date().toISOString(),
          unread_count: isActiveConversation ? 0 : Math.max(0, (conv.unread_count || 0) + 1)
        };
      }));

      refreshConversations();

      if (isCustomerMessage && !isActiveConversation) {
        inboxMessageAudio.currentTime = 0;
        inboxMessageAudio.play().catch(() => {
          // Ignore autoplay restrictions.
        });
      }

      if (isActiveConversation) {
        setMessages((prev) => {
          const alreadyExists = prev.some((msg) =>
            String(msg.sender) === String(message.sender) &&
            String(msg.message) === String(message.message) &&
            String(msg.created_at) === String(message.created_at)
          );
          if (alreadyExists) return prev;
          return [...prev, message];
        });
      }
    };

    const handleMessagesRefreshed = (payload) => {
      try {
        const convId = String(payload && payload.conversationId);
        if (!convId) return;
        // Only update messages when it's for currently selected conversation
        if (String(selectedConversationIdRef.current) !== convId) return;
        const msgs = Array.isArray(payload.messages) ? payload.messages : [];
        setMessages(msgs);
      } catch (e) {
        console.error('messages:refreshed handler error', e);
      }
    };

    const handleConnect = () => {
      console.log('Inbox socket connected:', socket.id);
      refreshConversations();
      if (selectedConversationIdRef.current) {
        socket.emit('conversation:join', { conversationId: selectedConversationIdRef.current });
        socket.emit('agent:activeConversation', { conversationId: selectedConversationIdRef.current });
        socket.emit('messages:refresh', { conversationId: selectedConversationIdRef.current });
      }
    };

    socket.on('connect', handleConnect);
    socket.on('newMessage', handleNewMessage);
    socket.on('messages:refreshed', handleMessagesRefreshed);

    return () => {
      if (activeConversationRoomRef.current && socket) {
        socket.emit('conversation:leave', { conversationId: activeConversationRoomRef.current });
      }
      socket.off('connect', handleConnect);
      socket.off('newMessage', handleNewMessage);
      socket.off('messages:refreshed', handleMessagesRefreshed);
    };
  }, []);

  // When user selects a conversation, tell the server and request a socket refresh
  useEffect(() => {
    if (!selectedConversation?.id) return;
    const socket = socketRef.current;
    const previousConversationId = activeConversationRoomRef.current;

    if (previousConversationId && previousConversationId !== selectedConversation.id && socket) {
      socket.emit('conversation:leave', { conversationId: previousConversationId });
    }

    selectedConversationIdRef.current = selectedConversation.id;
    activeConversationRoomRef.current = selectedConversation.id;

    if (!socket) return;

    try {
      socket.emit('conversation:join', { conversationId: selectedConversation.id });
      socket.emit('agent:activeConversation', { conversationId: selectedConversation.id });
      socket.emit('messages:refresh', { conversationId: selectedConversation.id });
    } catch (e) {
      // If not connected yet, wait for connect and then emit
      socket.once('connect', () => {
        try {
          socket.emit('conversation:join', { conversationId: selectedConversation.id });
          socket.emit('agent:activeConversation', { conversationId: selectedConversation.id });
          socket.emit('messages:refresh', { conversationId: selectedConversation.id });
        } catch (err) { console.error('emit after connect failed', err); }
      });
    }
  }, [selectedConversation?.id]);

  useEffect(() => {
    selectedConversationIdRef.current = selectedConversation?.id;
  }, [selectedConversation?.id]);

  useEffect(() => {
    if (!selectedConversation?.id) return;
    fetch('/api/conversations/viewed', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: selectedConversation.id })
    }).catch((err) => console.warn('Failed to mark conversation viewed', err));
  }, [selectedConversation?.id]);

  async function handleUseAiReply() {
    const conversationId = activeConversation?.id || selectedConversation?.id;
    if (!conversationId || !canUseAiReply(autopilotMode)) {
      warning('AI reply suggestions are disabled in the current mode.');
      return;
    }

    setIsGeneratingReply(true);
    try {
      const response = await fetch(`/api/suggest-reply/${conversationId}`);
      if (!response.ok) {
        throw new Error('Failed to generate AI reply.');
      }

      const data = await response.json();
      const suggestion = data?.suggestion?.trim();
      if (!suggestion) {
        throw new Error('No AI reply was generated.');
      }

      setComposer(suggestion);
      success('AI reply inserted into the composer');
    } catch (error) {
      console.error('AI reply generation error', error);
      error(err.message || 'Failed to generate AI reply');
    } finally {
      setIsGeneratingReply(false);
    }
  }

  async function sendConversationMessage(text, options = {}) {
    const { clearComposer = true } = options;
    const trimmedText = text?.trim();

    if (!selectedConversation?.id || !trimmedText) return false;
    if (!canUseAiReply(autopilotMode) && trimmedText.startsWith('AI')) {
      warning('AI replies are disabled in Manual Mode.');
      return false;
    }

    setIsSending(true);

    try {
      const response = await fetch('/api/send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation_id: selectedConversation.id, message: trimmedText })
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        const errorMessage = errorBody.error || 'Failed to send message.';
        throw new Error(errorMessage);
      }

      const data = await response.json();
      const messageData = data.message || data.messageData || {
        sender: 'sent',
        message: trimmedText,
        created_at: new Date().toISOString()
      };

      if (clearComposer) {
        setComposer('');
      }

      setMessages((prev) => {
        const alreadyExists = prev.some((msg) =>
          String(msg.sender) === String(messageData.sender) &&
          String(msg.message) === String(messageData.message) &&
          String(msg.created_at) === String(messageData.created_at)
        );
        if (alreadyExists) return prev;
        const next = [...prev, messageData];
        // After adding a message (user sent), ensure viewport scrolls to bottom
        window.requestAnimationFrame(() => {
          scrollToBottom('smooth');
        });
        return next;
      });

      setConversations((prev) => prev.map((conv) => {
        if (String(conv.id) !== String(selectedConversation.id)) return conv;
        return {
          ...conv,
          last_message: messageData.message,
          last_message_at: messageData.created_at || new Date().toISOString(),
          unread_count: 0
        };
      }));

      return true;
    } catch (error) {
      console.error('Inbox send message error', error);
      error(error.message || 'Failed to send message');
      return false;
    } finally {
      setIsSending(false);
    }
  }

  async function sendMessage() {
    if (!selectedConversation?.id || !composer.trim()) return;
    await sendConversationMessage(composer.trim());
  }

  async function handleEscalateConversation() {
    const conversationId = activeConversation?.id || selectedConversation?.id;
    if (!conversationId) return;

    const conversationName = activeConversation?.name
      || selectedConversation?.name
      || activeConversation?.phone
      || selectedConversation?.phone
      || 'Customer';

    if (escalatingConversationId === String(conversationId)) return;

    setEscalatingConversationId(String(conversationId));

    try {
      const response = await fetch('/api/escalate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation_id: conversationId, name: conversationName })
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok && data?.success !== true) {
        throw new Error(data?.error || 'Failed to escalate conversation');
      }

      setEscalatedConversationIds((prev) => {
        const nextId = String(conversationId);
        return prev.includes(nextId) ? prev : [...prev, nextId];
      });

      setConversations((prev) => prev.map((conversation) => (
        String(conversation.id) === String(conversationId)
          ? { ...conversation, escalated: true }
          : conversation
      )));

      setSelectedConversation((prev) => (
        prev && String(prev.id) === String(conversationId)
          ? { ...prev, escalated: true }
          : prev
      ));

      escalationAudio.currentTime = 0;
      escalationAudio.play().catch(() => {
        // Ignore autoplay restrictions; notification still shows.
      });

      success(`Escalated conversation #${conversationId}`);
    } catch (error) {
      console.error('Conversation escalation failed', error);
      error(error.message || 'Failed to escalate conversation');
    } finally {
      setEscalatingConversationId(null);
    }
  }

  async function handleResolveConversation() {
    const conversationId = activeConversation?.id || selectedConversation?.id;
    if (!conversationId) return;

    setConversations((prev) => prev.map((conversation) => (
      String(conversation.id) === String(conversationId)
        ? { ...conversation, escalated: false, unread_count: 0 }
        : conversation
    )));

    setSelectedConversation((prev) => (
      prev && String(prev.id) === String(conversationId)
        ? { ...prev, escalated: false, unread_count: 0 }
        : prev
    ));

    setEscalatedConversationIds((prev) => prev.filter((id) => String(id) !== String(conversationId)));
    success(`Marked conversation #${conversationId} as resolved`);
  }

  async function handleDeleteConversation() {
    const conversationId = activeConversation?.id || selectedConversation?.id;
    if (!conversationId || isDeletingConversation) return;

    const confirmed = window.confirm('Delete this customer conversation and all associated data? This action cannot be undone.');
    if (!confirmed) return;

    setIsDeletingConversation(true);
    try {
      const response = await fetch('/api/conversations', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: conversationId })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.success === false) {
        throw new Error(payload.error || 'Failed to delete conversation.');
      }

      setConversations((prev) => prev.filter((conversation) => String(conversation.id) !== String(conversationId)));
      setEscalatedConversationIds((prev) => prev.filter((id) => String(id) !== String(conversationId)));

      setSelectedConversation((prev) => {
        if (prev && String(prev.id) !== String(conversationId)) {
          return prev;
        }
        const nextConversation = conversations.find((conversation) => String(conversation.id) !== String(conversationId));
        return nextConversation || null;
      });

      success('Customer conversation deleted successfully');
    } catch (error) {
      console.error('Delete conversation failed', error);
      error(error.message || 'Unable to delete customer conversation');
    } finally {
      setIsDeletingConversation(false);
    }
  }

  const filteredConversations = useMemo(() => {
    const term = query.trim().toLowerCase();
    return conversations.filter((conversation) => {
      const searchable = [
        conversation.name,
        conversation.phone,
        conversation.platform,
        conversation.last_message,
        conversation.subject,
        conversation.message
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      const matchesQuery = !term || searchable.includes(term);
      const isEscalated = Boolean(conversation.escalated || escalatedConversationIds.includes(String(conversation.id)));
      const conversationPlatform = String(conversation.platform || '').toLowerCase();
      const matchesPlatform = (!platformFilter || conversationPlatform === platformFilter)
        && (activePlatform === 'all' || conversationPlatform === activePlatform || (activePlatform === 'web' && conversationPlatform === 'webchat'));
      const matchesFilter = (() => {
        switch (activeFilter) {
          case 'priority':
            return (conversation.unread_count || 0) > 0 || conversation.platform === 'WhatsApp';
          case 'unread':
            return (conversation.unread_count || 0) > 0;
          case 'resolved':
            return (conversation.unread_count || 0) === 0 && conversation.platform !== 'WhatsApp' && !isEscalated;
          case 'escalated':
            return isEscalated;
          default:
            return true;
        }
      })();

      return matchesQuery && matchesPlatform && matchesFilter;
    });
  }, [activeFilter, activePlatform, conversations, escalatedConversationIds, platformFilter, query]);

  const activeConversation = filteredConversations.find((conversation) => conversation.id === selectedConversation?.id) || filteredConversations[0] || null;
  const activeConversationStatus = activeConversation?.escalated || escalatedConversationIds.includes(String(activeConversation?.id))
    ? { label: 'Escalated', type: 'warning' }
    : activeConversation?.unread_count > 0
      ? { label: 'Needs reply', type: 'pending' }
      : { label: 'Resolved', type: 'success' };

  useEffect(() => {
    if (!activeConversation?.phone) {
      setRecentOrders([]);
      setRecentOrdersLoading(false);
      return;
    }

    let active = true;
    const phone = activeConversation.phone;

    setRecentOrdersLoading(true);
    fetch(`/api/orders/${encodeURIComponent(phone)}`)
      .then((response) => {
        if (!response.ok) throw new Error('Failed to load recent orders');
        return response.json();
      })
      .then((data) => {
        if (!active) return;
        setRecentOrders(Array.isArray(data) ? data : []);
      })
      .catch((error) => {
        console.error('Recent orders load failed', error);
        if (active) {
          setRecentOrders([]);
        }
      })
      .finally(() => {
        if (active) {
          setRecentOrdersLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [activeConversation?.phone]);

  const latestRecentOrder = recentOrders[0] || null;
  const queueSummary = useMemo(() => {
    const visibleConversations = platformFilter
      ? conversations.filter((conversation) => String(conversation.platform || '').toLowerCase() === platformFilter)
      : conversations;
    const total = visibleConversations.length;
    const needsReply = visibleConversations.filter((conversation) => {
      const isEscalated = Boolean(conversation.escalated || escalatedConversationIds.includes(String(conversation.id)));
      return !isEscalated && ((conversation.unread_count || 0) > 0 || conversation.platform === 'WhatsApp');
    }).length;
    const escalated = visibleConversations.filter((conversation) => Boolean(conversation.escalated || escalatedConversationIds.includes(String(conversation.id)))).length;

    return [
      { label: 'Live queue', value: total, detail: 'Open conversations', tone: 'from-brand-500 to-cyan-400' },
      { label: 'Needs reply', value: needsReply, detail: 'Awaiting agent action', tone: 'from-amber-500 to-orange-400' },
      { label: 'Escalations', value: escalated, detail: 'Priority handoffs', tone: 'from-rose-500 to-pink-500' }
    ];
  }, [conversations, escalatedConversationIds, platformFilter]);

  async function handleShareUpdate() {
    if (!activeConversation?.id) return;

    const shareText = latestRecentOrder
      ? `Hi ${activeConversation.name || 'there'}, just a quick update on your order #${latestRecentOrder.order_id || latestRecentOrder.id || 'this order'}: it is currently ${latestRecentOrder.status || 'unknown'}.`
      : "Customer doesn't have any recent orders";

    const sent = await sendConversationMessage(shareText, { clearComposer: false });
    if (sent) {
      success('Update sent to customer');
    }
  }

  function createReceiptNumber() {
    return `RCP-${Date.now().toString().slice(-6)}`;
  }

  function formatCurrency(value, currency = 'NGN') {
    const safeValue = Number(value || 0);
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2
    }).format(safeValue);
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function openReceiptModal() {
    const now = new Date();
    setReceiptForm({
      receiptNumber: createReceiptNumber(),
      issuedAt: now.toISOString().slice(0, 16),
      customerName: activeConversation?.name || '',
      customerPhone: activeConversation?.phone || '',
      orderId: activeConversation?.id ? `ORD-${activeConversation.id}` : '',
      paymentMethod: 'cash',
      currency: 'NGN',
      taxRate: 7.5,
      serviceChargeRate: 0,
      notes: `Prepared for ${activeConversation?.name || 'customer'} from the inbox conversation.`,
      lineItems: [
        {
          id: Date.now(),
          description: 'Support service / order item',
          qty: 1,
          price: 0
        }
      ]
    });
    setIsReceiptModalOpen(true);
  }

  function updateReceiptField(field, value) {
    setReceiptForm((prev) => ({ ...prev, [field]: value }));
  }

  function updateLineItem(itemId, field, value) {
    setReceiptForm((prev) => ({
      ...prev,
      lineItems: prev.lineItems.map((item) => {
        if (item.id !== itemId) return item;
        if (field === 'qty') return { ...item, qty: Math.max(1, Number(value) || 1) };
        if (field === 'price') return { ...item, price: Math.max(0, Number(value) || 0) };
        return { ...item, [field]: value };
      })
    }));
  }

  function addLineItem() {
    setReceiptForm((prev) => ({
      ...prev,
      lineItems: [
        ...prev.lineItems,
        {
          id: Date.now() + Math.random(),
          description: '',
          qty: 1,
          price: 0
        }
      ]
    }));
  }

  function removeLineItem(itemId) {
    setReceiptForm((prev) => ({
      ...prev,
      lineItems: prev.lineItems.filter((item) => item.id !== itemId)
    }));
  }

  const receiptTotals = useMemo(() => {
    const subtotal = receiptForm.lineItems.reduce((sum, item) => sum + (Number(item.qty) || 0) * (Number(item.price) || 0), 0);
    const taxAmount = subtotal * (Number(receiptForm.taxRate) || 0) / 100;
    const serviceChargeAmount = subtotal * (Number(receiptForm.serviceChargeRate) || 0) / 100;
    return {
      subtotal,
      taxAmount,
      serviceChargeAmount,
      grandTotal: subtotal + taxAmount + serviceChargeAmount
    };
  }, [receiptForm.lineItems, receiptForm.serviceChargeRate, receiptForm.taxRate]);

  function buildReceiptText() {
    const createdAt = receiptForm.issuedAt ? new Date(receiptForm.issuedAt).toLocaleString() : new Date().toLocaleString();
    const lines = [
      'LIVE SUPPORT RECEIPT',
      '===================',
      `Receipt #: ${receiptForm.receiptNumber || 'RCP-000000'}`,
      `Issued: ${createdAt}`,
      `Customer: ${receiptForm.customerName || 'Walk-in customer'}`,
      `Phone: ${receiptForm.customerPhone || '—'}`,
      `Order: ${receiptForm.orderId || '—'}`,
      `Payment: ${receiptForm.paymentMethod || 'Cash'}`,
      '',
      'Items',
      '-----'
    ];

    receiptForm.lineItems.forEach((item) => {
      const lineTotal = (Number(item.qty) || 0) * (Number(item.price) || 0);
      lines.push(`${item.description || 'Item'} | Qty ${item.qty || 1} | ${formatCurrency(item.price, receiptForm.currency)} | ${formatCurrency(lineTotal, receiptForm.currency)}`);
    });

    lines.push('', `Subtotal: ${formatCurrency(receiptTotals.subtotal, receiptForm.currency)}`);
    lines.push(`Tax (${Number(receiptForm.taxRate) || 0}%): ${formatCurrency(receiptTotals.taxAmount, receiptForm.currency)}`);
    lines.push(`Service charge (${Number(receiptForm.serviceChargeRate) || 0}%): ${formatCurrency(receiptTotals.serviceChargeAmount, receiptForm.currency)}`);
    lines.push(`Grand total: ${formatCurrency(receiptTotals.grandTotal, receiptForm.currency)}`);
    lines.push('', `Notes: ${receiptForm.notes || 'No additional notes.'}`);
    lines.push('', 'Thank you for choosing LiveSupport.');

    return lines.join('\n');
  }

  async function handleSaveReceipt() {
    const content = buildReceiptText();
    if (!receiptForm.lineItems.some((item) => (item.description || '').trim())) {
      warning('Add at least one item before saving the receipt');
      return;
    }

    setReceiptSaving(true);
    try {
      const response = await fetch('/api/receipts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      });

      if (!response.ok) {
        throw new Error('Failed to save receipt.');
      }

      success('Receipt created and stored successfully');
      setIsReceiptModalOpen(false);
    } catch (err) {
      console.error('Receipt save failed', err);
      error(err?.message || 'Failed to save receipt');
    } finally {
      setReceiptSaving(false);
    }
  }

  function handlePreviewReceipt() {
    const previewWindow = window.open('', '_blank', 'width=900,height=800');
    if (!previewWindow) {
      warning('Popup blocked. Please allow popups to preview the receipt');
      return;
    }

    const content = escapeHtml(buildReceiptText()).replace(/\n/g, '<br/>');
    previewWindow.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>Receipt Preview</title><style>body{font-family:Inter,Segoe UI,sans-serif;padding:24px;line-height:1.6;color:#111827}pre{white-space:pre-wrap;font-family:inherit}</style></head><body><pre>${content}</pre></body></html>`);
    previewWindow.document.close();
    previewWindow.focus();
  }

  function updateScrollToBottomVisibility() {
    const container = messagesViewportRef.current;
    if (!container) return;
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    setShowScrollToBottom(distanceFromBottom > 140);
  }

  function scrollToBottom(behavior = 'auto') {
    const container = messagesViewportRef.current;
    if (!container) return;

    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior });
    } else {
      const targetScrollTop = container.scrollHeight;
      try {
        container.scrollTo({ top: targetScrollTop, behavior });
      } catch (error) {
        container.scrollTop = targetScrollTop;
      }
    }

    setShowScrollToBottom(false);
  }

  function openAiFeedback(message) {
    setFeedbackTarget(message);
    setFeedbackForm({ category: 'OTHER', explanation: '', correction: '', expectedBehavior: '' });
  }

  async function submitAiFeedback() {
    if (!feedbackTarget || !activeConversation?.id || isSubmittingFeedback) return;
    setIsSubmittingFeedback(true);
    try {
      const response = await fetch('/api/ai-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          conversation_id: activeConversation.id,
          message_id: Number.isFinite(Number(feedbackTarget.id)) ? Number(feedbackTarget.id) : undefined,
          category: feedbackForm.category,
          feedback_text: feedbackForm.explanation,
          correction: feedbackForm.correction,
          expected_behavior: feedbackForm.expectedBehavior,
          original_response: feedbackTarget.content,
          kind: feedbackForm.correction || feedbackForm.expectedBehavior ? 'correction' : 'evaluation'
        })
      });
      if (!response.ok) throw new Error('Unable to save AI feedback');
      setFeedbackTarget(null);
      success('AI feedback recorded for learning review');
    } catch (submitError) {
      error(submitError.message || 'Unable to save AI feedback');
    } finally {
      setIsSubmittingFeedback(false);
    }
  }

  const conversationMessages = useMemo(() => {
    if (!activeConversation) return [];
    return (messages.length > 0 ? messages : []).map((message, index) => {
      const senderValue = String(message.sender || '').toLowerCase();
      const isAgent = ['sent', 'sent_by_agent', 'agent', 'staff', 'assistant', 'bot'].includes(senderValue);
      return {
        id: message.id || `${activeConversation.id}-${index}`,
        sender: isAgent ? 'agent' : 'customer',
        isAi: ['ai', 'assistant', 'bot'].includes(senderValue),
        content: message.message || message.content || '',
        createdAt: message.created_at || message.createdAt
      };
    }).filter((message) => message.content);
  }, [activeConversation, messages]);

  const groupedConversationMessages = useMemo(() => {
    const groups = [];
    let previousSender = null;

    conversationMessages.forEach((message) => {
      if (previousSender !== message.sender) {
        groups.push({ sender: message.sender, messages: [message] });
        previousSender = message.sender;
      } else {
        groups[groups.length - 1].messages.push(message);
      }
    });

    return groups;
  }, [conversationMessages]);

  useEffect(() => {
    const container = messagesViewportRef.current;
    if (!container) return;

    const handleScroll = () => updateScrollToBottomVisibility();
    const handleResize = () => updateScrollToBottomVisibility();

    container.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize);
    updateScrollToBottomVisibility();

    return () => {
      container.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, [activeConversation?.id, messagesLoading, conversationMessages.length]);

  useEffect(() => {
    if (!activeConversation || messagesLoading) return;
    const container = messagesViewportRef.current;
    if (!container) return;

    const runAutoScroll = () => {
      const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
      if (distanceFromBottom < 140) {
        scrollToBottom('auto');
      }
      updateScrollToBottomVisibility();
    };

    const frameId = window.requestAnimationFrame(runAutoScroll);
    const timeoutId = window.setTimeout(runAutoScroll, 60);
    const timeoutId2 = window.setTimeout(runAutoScroll, 180);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(timeoutId);
      window.clearTimeout(timeoutId2);
    };
  }, [activeConversation?.id, messagesLoading, conversationMessages.length]);

  useEffect(() => {
    if (!activeConversation || messagesLoading) return;
    scrollToBottom('auto');
  }, [activeConversation?.id, messagesLoading]);

  async function saveConversationName(conversation) {
    const trimmedName = editingConversationName.trim();
    if (!conversation?.id) return;

    setIsSavingConversationName(true);
    try {
      const response = await fetch('/api/conversations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: conversation.id, name: trimmedName || null })
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || 'Failed to update customer name');
      }

      const nextName = trimmedName || null;
      setConversations((prev) => prev.map((item) => (
        String(item.id) === String(conversation.id)
          ? { ...item, name: nextName }
          : item
      )));

      setSelectedConversation((prev) => (
        prev && String(prev.id) === String(conversation.id)
          ? { ...prev, name: nextName }
          : prev
      ));

      setEditingConversationId(null);
      setEditingConversationName('');
      success('Customer name updated');
    } catch (err) {
      console.error('Failed to update conversation name', err);
      error(err.message || 'Failed to update customer name');
    } finally {
      setIsSavingConversationName(false);
    }
  }

  const conversationRows = filteredConversations.map((conversation) => {
    const isActive = activeConversation?.id === conversation.id;
    const initials = (conversation.name || conversation.phone || 'C').charAt(0).toUpperCase();
    const platformDetails = getPlatformDetails(conversation.platform);

    return (
      <div
        key={conversation.id}
        className={`group relative overflow-hidden rounded-[24px] border p-3.5 backdrop-blur-sm transition-all duration-300 ${
          isActive
            ? `${palette.border} ${isMessenger ? 'bg-sky-50/90 shadow-[0_10px_24px_rgba(59,130,246,0.14)] dark:bg-sky-500/10' : 'bg-emerald-50/90 shadow-[0_10px_24px_rgba(16,185,129,0.14)] dark:bg-emerald-500/10'}`
            : 'border-slate-200/80 bg-white/90 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950/70 dark:hover:bg-slate-900/80'
        }`}
      >
        <div className={`absolute inset-y-0 left-0 w-1 bg-gradient-to-b ${palette.badge} ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-60'}`} />
        <button
          type="button"
          onClick={() => setSelectedConversation(conversation)}
          className="w-full text-left"
        >
          <div className="flex items-start gap-3">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-semibold ${isActive ? `bg-gradient-to-br ${palette.badge} text-white` : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate font-semibold text-slate-900 dark:text-white">
                  {conversation.name || conversation.phone || 'Customer'}
                </p>
                {conversation.unread_count > 0 ? (
                  <span className={`rounded-full bg-gradient-to-r ${palette.badge} px-2.5 py-1 text-[11px] font-semibold text-white`}>
                    {conversation.unread_count}
                  </span>
                ) : null}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span className={`rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${platformDetails.className}`}>
                  {platformDetails.label}
                </span>
                <span>{formatDate(conversation.last_message_at || conversation.updated_at || conversation.created_at)}</span>
              </div>
              <p className="mt-2 line-clamp-2 text-sm text-slate-600 dark:text-slate-400">
                {conversation.last_message || conversation.message || 'No preview available.'}
              </p>
            </div>
          </div>
        </button>

        <button
          type="button"
          aria-label="Edit customer name"
          onClick={(event) => {
            event.stopPropagation();
            setEditingConversationId(String(conversation.id));
            setEditingConversationName(conversation.name || conversation.phone || '');
          }}
          className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200/80 bg-white/90 text-slate-600 shadow-sm transition hover:border-brand-500/30 hover:text-brand-600 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-300"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" />
          </svg>
        </button>

        {String(editingConversationId) === String(conversation.id) ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white/90 p-2 shadow-sm dark:border-slate-700 dark:bg-slate-900/80" onClick={(event) => event.stopPropagation()}>
            <input
              autoFocus
              value={editingConversationName}
              onChange={(event) => setEditingConversationName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  saveConversationName(conversation);
                }
              }}
              placeholder="Customer name"
              className="min-w-[140px] flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
            <button
              type="button"
              onClick={() => saveConversationName(conversation)}
              disabled={isSavingConversationName}
              className="rounded-xl bg-brand-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSavingConversationName ? 'Saving...' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditingConversationId(null);
                setEditingConversationName('');
              }}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300"
            >
              Cancel
            </button>
          </div>
        ) : null}
      </div>
    );
  });

  return (
    <div className="min-h-screen bg-[#eef2f5] text-slate-900 dark:bg-slate-950 dark:text-white">
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar />
          <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-2 pb-6 sm:p-3 lg:p-4">
            <div className="mb-3 overflow-hidden rounded-[22px] border border-slate-800 bg-[#111827] text-white shadow-[0_18px_42px_rgba(15,23,42,0.16)]">
              <div className="relative overflow-hidden px-4 py-3 sm:px-5 lg:px-6">
                <div className="absolute inset-0 bg-[linear-gradient(110deg,rgba(16,185,129,0.16),transparent_38%),radial-gradient(circle_at_90%_10%,rgba(56,189,248,0.16),transparent_30%)]" />
                <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <div className="max-w-2xl">
                    <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-300">
                      <Command className="h-3.5 w-3.5" />
                      Command center / conversations
                    </div>
                    <h1 className="mt-1.5 text-xl font-semibold tracking-tight sm:text-2xl">
                      {platformHeroTitle}
                    </h1>
                    <p className="mt-1 max-w-xl text-xs leading-5 text-slate-300">
                      {platformHeroDescription}
                    </p>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <label className="relative min-w-[240px] sm:min-w-[280px]">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder={`Search ${platformLabel} conversations...`}
                        className="w-full rounded-xl border border-slate-600 bg-slate-900/80 py-2.5 pl-10 pr-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => window.location.reload()}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-600 bg-slate-900/60 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-800"
                    >
                      <Zap className="h-4 w-4 text-amber-300" />
                      Refresh
                    </button>
                  </div>
                </div>

                <div className="relative mt-3 grid gap-px overflow-hidden rounded-xl border border-white/10 bg-white/10 sm:grid-cols-3">
                  {queueSummary.map((card) => (
                    <div key={card.label} className="bg-slate-950/20 p-2.5">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/80">
                          {card.label}
                        </div>
                        <span className={`h-2.5 w-2.5 rounded-full bg-gradient-to-r ${card.tone}`} />
                      </div>
                      <div className="mt-2 flex items-baseline gap-2">
                        <p className="text-xl font-semibold text-white">{card.value}</p>
                        <p className="text-xs text-white/80">{card.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-1 min-h-0 flex-col overflow-hidden rounded-[26px] border border-slate-300 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.09)] dark:border-slate-800 dark:bg-slate-950">
              <div className="grid h-full min-h-0 flex-1 gap-0 lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)_300px]">
                <aside className="flex min-h-0 flex-1 flex-col border-b border-slate-200 bg-[#f7f9fa] p-3 sm:p-4 dark:border-slate-800 dark:bg-slate-900/80 lg:border-b-0 lg:border-r">
                  <div className="border-b border-slate-200 pb-4 dark:border-slate-800">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">Smart queue</p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Every channel, one stream.</p>
                      </div>
                      <div className="rounded-full bg-brand-50 px-3 py-1 text-sm font-semibold text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
                        {filteredConversations.length}
                      </div>
                    </div>
                    <div className="mt-4 flex gap-1 overflow-x-auto pb-1">
                      {queueFilters.map((filter) => (
                        <button
                          key={filter.id}
                          type="button"
                          onClick={() => setActiveFilter(filter.id)}
                          className={`rounded-lg px-2.5 py-2 text-xs font-medium transition ${
                            activeFilter === filter.id
                              ? 'bg-brand-600 text-white shadow-sm'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                          }`}
                        >
                          <span className="mr-1">{filter.icon}</span>
                          {filter.label}
                        </button>
                      ))}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {platformFilters.map((filter) => (
                        <button
                          key={filter.id}
                          type="button"
                          onClick={() => setActivePlatform(filter.id)}
                          className={`rounded-md border px-2 py-1.5 text-[11px] font-semibold transition ${activePlatform === filter.id
                            ? 'border-slate-800 bg-slate-800 text-white dark:border-slate-200 dark:bg-slate-200 dark:text-slate-900'
                            : 'border-slate-200 bg-white text-slate-500 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400'
                          }`}
                        >
                          {filter.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 h-[520px] flex-none overflow-y-scroll pr-1 custom-scrollbar">
                    <div className="space-y-3">
                      {loading ? (
                        <div className="rounded-3xl border border-dashed border-slate-300 bg-white/80 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-400">
                          Loading chats...
                        </div>
                      ) : conversationRows.length > 0 ? (
                        conversationRows
                      ) : (
                        <div className="rounded-3xl border border-dashed border-slate-300 bg-white/80 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-400">
                          No conversations found.
                        </div>
                      )}
                    </div>
                  </div>
                </aside>

                <section className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-[30px] border border-slate-200/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(248,250,252,0.96))] shadow-[0_20px_70px_rgba(15,23,42,0.06)] dark:border-slate-800 dark:bg-slate-950">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.12),_transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(16,185,129,0.10),_transparent_24%)]" />
                  <div className="relative flex h-full min-h-0 flex-col">
                  {activeConversation ? (
                    <>
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 bg-white/80 px-6 py-5 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/80">
                        <div className="flex items-center gap-3">
                          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 via-sky-500 to-cyan-400 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(37,99,235,0.25)]">
                            {(activeConversation.name || activeConversation.phone || 'C').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                                {activeConversation.name || activeConversation.phone || 'Conversation'}
                              </h2>
                              <span className={`rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${getPlatformDetails(activeConversation.platform).className}`}>
                                {getPlatformDetails(activeConversation.platform).label}
                              </span>
                              <StatusBadge status={activeConversationStatus.label} type={activeConversationStatus.type} />
                            </div>
                            <p className="mt-1 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                              <MessageCircle className="h-4 w-4" />
                              {activeConversation.platform || 'Chat'} • {formatDate(activeConversation.last_message_at || activeConversation.updated_at || activeConversation.created_at)}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={handleEscalateConversation}
                            disabled={Boolean(activeConversation?.escalated || escalatedConversationIds.includes(String(activeConversation?.id))) || escalatingConversationId === String(activeConversation?.id)}
                            className={`rounded-full border px-3 py-2 text-sm font-medium transition ${
                              activeConversation?.escalated || escalatedConversationIds.includes(String(activeConversation?.id))
                                ? 'cursor-not-allowed border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-300'
                                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
                            } ${escalatingConversationId === String(activeConversation?.id) ? 'opacity-70' : ''}`}
                          >
                            {activeConversation?.escalated || escalatedConversationIds.includes(String(activeConversation?.id))
                              ? 'Escalated'
                              : escalatingConversationId === String(activeConversation?.id)
                                ? 'Escalating...'
                                : 'Escalate'}
                          </button>
                          <button
                            type="button"
                            onClick={() => navigate(`/inbox/chat/${activeConversation?.id}`)}
                            disabled={!activeConversation?.id}
                            className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                          >
                            Open staff chat
                          </button>
                          <button
                            type="button"
                            onClick={handleResolveConversation}
                            className="rounded-full bg-brand-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
                          >
                            Resolve
                          </button>
                          <button
                            type="button"
                            onClick={handleDeleteConversation}
                            disabled={!activeConversation?.id || isDeletingConversation}
                            aria-label={isDeletingConversation ? 'Deleting customer' : 'Delete customer'}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-rose-200 bg-rose-50 text-rose-700 transition hover:border-rose-300 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-900/40 dark:bg-rose-950/60 dark:text-rose-300 dark:hover:bg-rose-900/80"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                              <path d="M4.5 7.5h15" />
                              <path d="M8 7.5V5.25a1.25 1.25 0 0 1 1.25-1.25h5.5A1.25 1.25 0 0 1 16 5.25V7.5" />
                              <path d="M9.5 11.5v6" />
                              <path d="M14.5 11.5v6" />
                              <path d="M6.5 7.5l1-1.75" />
                              <path d="M17.5 7.5l-1-1.75" />
                              <path d="M7.5 18.5h9" />
                            </svg>
                          </button>
                        </div>
                      </div>

                      <div className="relative flex flex-1 min-h-0 flex-col overflow-hidden">
                        <div ref={messagesViewportRef} className="relative h-[360px] flex-none overflow-y-scroll overscroll-contain bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.09),_transparent_30%)] px-6 py-6 pr-1 custom-scrollbar dark:bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.14),_transparent_30%)]">
                          <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
                            {messagesLoading ? (
                              <div className="rounded-3xl border border-dashed border-slate-300 bg-white/80 p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-400">
                                Loading message thread...
                              </div>
                            ) : groupedConversationMessages.length > 0 ? (
                              groupedConversationMessages.map((group, groupIndex) => (
                                <div key={`${group.sender}-${groupIndex}`} className="space-y-6">
                                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                                    <span className="inline-flex h-1.5 w-1.5 rounded-full bg-brand-500" />
                                    <span>{group.sender === 'agent' ? 'Support' : 'Customer'}</span>
                                  </div>
                                  <div className="space-y-3">
                                    {group.messages.map((message) => (
                                      <div key={message.id} className={`flex ${message.sender === 'agent' ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`relative max-w-[80%] rounded-[24px] border px-5 py-4 text-sm leading-7 shadow-sm ${
                                          message.sender === 'agent'
                                            ? palette.outgoing
                                            : palette.incoming
                                        }`}>
                                          <div className="whitespace-pre-wrap break-words">{message.content}</div>
                                          {message.isAi ? (
                                            <button type="button" onClick={() => openAiFeedback(message)} className="mt-3 inline-flex items-center gap-1 rounded-lg border border-white/30 px-2 py-1 text-[11px] font-semibold text-current opacity-80 transition hover:opacity-100">
                                              <Bot className="h-3 w-3" /> Teach AI
                                            </button>
                                          ) : null}
                                          {message.createdAt ? (
                                            <div className="mt-3 text-right text-[11px] leading-none text-slate-400 dark:text-slate-500">
                                              {formatInboxTimestamp(message.createdAt)}
                                            </div>
                                          ) : null}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="rounded-3xl border border-dashed border-slate-300 bg-white/80 p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-400">
                                No message history found for this conversation yet.
                              </div>
                            )}
                            <div ref={messagesEndRef} />
                          </div>

                          <button
                            type="button"
                            onClick={() => scrollToBottom('smooth')}
                            aria-label="Scroll to bottom"
                            className={`pointer-events-none absolute bottom-5 left-1/2 z-20 inline-flex h-12 w-12 -translate-x-1/2 items-center justify-center rounded-full border border-white/30 bg-gradient-to-br from-brand-500 via-sky-500 to-cyan-400 text-white shadow-[0_16px_40px_rgba(14,165,233,0.35),0_8px_18px_rgba(15,23,42,0.2)] backdrop-blur-sm transition-all duration-200 ${showScrollToBottom ? 'pointer-events-auto translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0'}`}
                          >
                            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M12 5v14" />
                              <path d="m6 13 6 6 6-6" />
                            </svg>
                          </button>
                        </div>
                      </div>

                      <div className="border-t border-slate-200/80 bg-white/70 p-4 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/70">
                        <div className="mx-auto w-full max-w-2xl rounded-[28px] border border-slate-200/80 bg-slate-950/95 p-3 shadow-[0_18px_44px_rgba(15,23,42,0.09)] dark:border-slate-800">
                          <textarea
                            rows={3}
                            placeholder="Write a reply..."
                            value={composer}
                            onChange={(event) => setComposer(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' && !event.shiftKey) {
                                event.preventDefault();
                                sendMessage();
                              }
                            }}
                            className="min-h-[112px] w-full resize-none rounded-2xl border border-slate-700 bg-slate-900/70 px-3 py-3 text-sm text-slate-100 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-500/20"
                          />
                          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                              {canUseAiReply(autopilotMode)
                                ? 'AI suggested response is ready.'
                                : autopilotMode === 'manual'
                                  ? 'AI reply suggestions are disabled in Manual Mode.'
                                  : 'AI response mode is currently unavailable.'}
                            </p>
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                disabled={isGeneratingReply || !canUseAiReply(autopilotMode)}
                                onClick={handleUseAiReply}
                                className={`inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-800 ${isGeneratingReply || !canUseAiReply(autopilotMode) ? 'cursor-not-allowed opacity-70' : ''}`}
                              >
                                <Bot className="h-4 w-4" />
                                {isGeneratingReply ? 'Generating...' : 'Use AI reply'}
                              </button>
                              <button
                                type="button"
                                disabled={isSending || !composer.trim()}
                                onClick={sendMessage}
                                className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold text-white transition ${isSending || !composer.trim()
                                  ? 'bg-slate-400 cursor-not-allowed hover:bg-slate-400'
                                  : palette.accent
                                }`}
                              >
                                <ArrowUpRight className="h-4 w-4" />
                                {isSending ? 'Sending...' : 'Send'}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-slate-500 dark:text-slate-400">
                      {loading ? 'Loading conversation thread...' : 'Select a conversation to open the thread.'}
                    </div>
                  )}
                  </div>
                </section>

                <aside className="border-t border-slate-200 bg-slate-50/80 p-3 sm:p-4 dark:border-slate-800 dark:bg-slate-900/80 xl:border-l xl:border-t-0">
                  <div className="rounded-[24px] border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-4 text-white shadow-sm">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">Customer insight</h3>
                      <div className="rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-100">
                        <ShieldCheck className="mr-1 inline h-3.5 w-3.5" />
                        VIP
                      </div>
                    </div>
                    <div className="mt-4 space-y-3 text-sm text-slate-300">
                      <div className="rounded-2xl border border-white/10 bg-white/10 p-3">
                        <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Name</p>
                        <p className="mt-1 font-semibold text-white">{activeConversation?.name || '—'}</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/10 p-3">
                        <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Phone</p>
                        <p className="mt-1 font-semibold text-white">{activeConversation?.phone || '—'}</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/10 p-3">
                        <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Last contact</p>
                        <p className="mt-1 font-semibold text-white">{formatDate(activeConversation?.last_message_at || activeConversation?.updated_at || activeConversation?.created_at)}</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                    <h3 className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Order snapshot</h3>
                    {recentOrdersLoading ? (
                      <div className="mt-4 text-sm text-slate-500 dark:text-slate-400">Loading recent order…</div>
                    ) : latestRecentOrder ? (
                      <div className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300">
                        <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-3 py-2 dark:bg-slate-900">
                          <span>Order ID</span>
                          <span className="font-semibold text-slate-900 dark:text-white">#{latestRecentOrder.order_id || latestRecentOrder.id || '—'}</span>
                        </div>
                        <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-3 py-2 dark:bg-slate-900">
                          <span>Status</span>
                          <span className="font-semibold text-emerald-500">{latestRecentOrder.status || 'Unknown'}</span>
                        </div>
                        <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-3 py-2 dark:bg-slate-900">
                          <span>Total</span>
                          <span className="font-semibold text-slate-900 dark:text-white">${Number(latestRecentOrder.total_amount ?? latestRecentOrder.amount ?? 0).toFixed(2)}</span>
                        </div>
                        <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-3 py-2 dark:bg-slate-900">
                          <span>Placed</span>
                          <span className="font-semibold text-slate-900 dark:text-white">{latestRecentOrder.order_date ? new Date(latestRecentOrder.order_date).toLocaleDateString() : 'Unknown date'}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                        No recent order
                      </div>
                    )}
                  </div>

                  <div className="mt-4 space-y-2">
                    <button
                      type="button"
                      onClick={openReceiptModal}
                      className="w-full rounded-2xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-700"
                    >
                      Create receipt
                    </button>
                    <button
                      type="button"
                      onClick={handleShareUpdate}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                    >
                      Share update
                    </button>
                  </div>
                </aside>
              </div>
            </div>
          </main>
        </div>
      </div>

      {feedbackTarget ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-start justify-between gap-4">
              <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-600">Teach AI</p><h3 className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">What should improve?</h3></div>
              <button type="button" onClick={() => setFeedbackTarget(null)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-500 dark:border-slate-700">Close</button>
            </div>
            <div className="mt-4 rounded-2xl bg-slate-50 p-3 text-sm text-slate-600 dark:bg-slate-900 dark:text-slate-300">{feedbackTarget.content}</div>
            <label className="mt-4 block text-sm font-medium text-slate-700 dark:text-slate-200">Category<select value={feedbackForm.category} onChange={(event) => setFeedbackForm((form) => ({ ...form, category: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900">{aiFeedbackCategories.map((category) => <option key={category} value={category}>{category.replaceAll('_', ' ')}</option>)}</select></label>
            <label className="mt-4 block text-sm font-medium text-slate-700 dark:text-slate-200">Explanation<textarea value={feedbackForm.explanation} onChange={(event) => setFeedbackForm((form) => ({ ...form, explanation: event.target.value }))} rows={2} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900" placeholder="Why was this incorrect?" /></label>
            <label className="mt-4 block text-sm font-medium text-slate-700 dark:text-slate-200">Correct response or expected behavior<textarea value={feedbackForm.correction} onChange={(event) => setFeedbackForm((form) => ({ ...form, correction: event.target.value, expectedBehavior: event.target.value }))} rows={3} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900" placeholder="What should the AI do instead?" /></label>
            <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setFeedbackTarget(null)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300">Cancel</button><button type="button" onClick={submitAiFeedback} disabled={isSubmittingFeedback} className="rounded-xl bg-teal-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{isSubmittingFeedback ? 'Saving...' : 'Submit feedback'}</button></div>
          </div>
        </div>
      ) : null}

      {isReceiptModalOpen ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xl">
          <div className="max-h-[92vh] w-full max-w-6xl overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-[0_40px_120px_rgba(15,23,42,0.35)] dark:border-slate-800 dark:bg-slate-950">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-gradient-to-r from-brand-600 via-brand-500 to-cyan-500 px-6 py-5 text-white">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/80">Advanced receipt studio</p>
                <h3 className="mt-1 text-2xl font-semibold">Create a polished invoice-style receipt</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsReceiptModalOpen(false)}
                className="rounded-full border border-white/30 bg-white/10 px-3 py-2 text-sm font-semibold transition hover:bg-white/20"
              >
                Close
              </button>
            </div>

            <div className="grid max-h-[calc(92vh-120px)] gap-6 overflow-y-auto p-6 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-800 dark:bg-slate-900">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Receipt number</span>
                    <input
                      value={receiptForm.receiptNumber}
                      onChange={(event) => updateReceiptField('receiptNumber', event.target.value)}
                      className="w-full border-none bg-transparent text-sm text-slate-900 outline-none dark:text-white"
                    />
                  </label>
                  <label className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-800 dark:bg-slate-900">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Issued at</span>
                    <input
                      type="datetime-local"
                      value={receiptForm.issuedAt}
                      onChange={(event) => updateReceiptField('issuedAt', event.target.value)}
                      className="w-full border-none bg-transparent text-sm text-slate-900 outline-none dark:text-white"
                    />
                  </label>
                  <label className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-800 dark:bg-slate-900">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Customer</span>
                    <input
                      value={receiptForm.customerName}
                      onChange={(event) => updateReceiptField('customerName', event.target.value)}
                      className="w-full border-none bg-transparent text-sm text-slate-900 outline-none dark:text-white"
                    />
                  </label>
                  <label className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-800 dark:bg-slate-900">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Phone</span>
                    <input
                      value={receiptForm.customerPhone}
                      onChange={(event) => updateReceiptField('customerPhone', event.target.value)}
                      className="w-full border-none bg-transparent text-sm text-slate-900 outline-none dark:text-white"
                    />
                  </label>
                </div>

                <div className="grid gap-4 md:grid-cols-[1fr_0.75fr_0.75fr]">
                  <label className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-800 dark:bg-slate-900">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Order reference</span>
                    <input
                      value={receiptForm.orderId}
                      onChange={(event) => updateReceiptField('orderId', event.target.value)}
                      className="w-full border-none bg-transparent text-sm text-slate-900 outline-none dark:text-white"
                    />
                  </label>
                  <label className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-800 dark:bg-slate-900">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Payment</span>
                    <select
                      value={receiptForm.paymentMethod}
                      onChange={(event) => updateReceiptField('paymentMethod', event.target.value)}
                      className="w-full border-none bg-transparent text-sm text-slate-900 outline-none dark:text-white"
                    >
                      <option value="cash">Cash</option>
                      <option value="card">Card</option>
                      <option value="bank transfer">Bank transfer</option>
                      <option value="wallet">Wallet</option>
                    </select>
                  </label>
                  <label className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-800 dark:bg-slate-900">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Currency</span>
                    <select
                      value={receiptForm.currency}
                      onChange={(event) => updateReceiptField('currency', event.target.value)}
                      className="w-full border-none bg-transparent text-sm text-slate-900 outline-none dark:text-white"
                    >
                      <option value="NGN">NGN</option>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                    </select>
                  </label>
                </div>

                <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Line items</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Fine-tune quantities, prices, and totals in real time.</p>
                    </div>
                    <button
                      type="button"
                      onClick={addLineItem}
                      className="rounded-full border border-brand-200 bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-700 transition hover:bg-brand-100 dark:border-brand-500/20 dark:bg-brand-500/10 dark:text-brand-300"
                    >
                      + Add item
                    </button>
                  </div>
                  <div className="space-y-3">
                    {receiptForm.lineItems.map((item) => (
                      <div key={item.id} className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-[1.4fr_0.5fr_0.7fr_auto] dark:border-slate-800 dark:bg-slate-900">
                        <input
                          value={item.description}
                          onChange={(event) => updateLineItem(item.id, 'description', event.target.value)}
                          placeholder="Item description"
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                        />
                        <input
                          type="number"
                          min="1"
                          value={item.qty}
                          onChange={(event) => updateLineItem(item.id, 'qty', event.target.value)}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                        />
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.price}
                          onChange={(event) => updateLineItem(item.id, 'price', event.target.value)}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                        />
                        <button
                          type="button"
                          onClick={() => removeLineItem(item.id)}
                          className="rounded-xl border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 dark:border-rose-500/20 dark:text-rose-300"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <label className="block rounded-[24px] border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Notes</span>
                  <textarea
                    rows={4}
                    value={receiptForm.notes}
                    onChange={(event) => updateReceiptField('notes', event.target.value)}
                    placeholder="Add a tailored note, delivery detail, or payment instruction..."
                    className="w-full resize-none border-none bg-transparent text-sm text-slate-900 outline-none dark:text-white"
                  />
                </label>
              </div>

              <div className="space-y-4">
                <div className="rounded-[24px] border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-5 text-white shadow-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/70">Live preview</p>
                      <h4 className="mt-1 text-lg font-semibold">Digital receipt snapshot</h4>
                    </div>
                    <div className="rounded-full border border-emerald-400/30 bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-300">
                      Ready to save
                    </div>
                  </div>
                  <div className="mt-4 rounded-2xl border border-white/10 bg-white/10 p-4 text-sm backdrop-blur">
                    <div className="font-semibold">LIVE SUPPORT RECEIPT</div>
                    <div className="mt-2 text-xs uppercase tracking-[0.2em] text-white/70">{receiptForm.receiptNumber || 'RCP-000000'}</div>
                    <div className="mt-3 space-y-1 text-sm text-white/90">
                      <div>Customer: {receiptForm.customerName || 'Walk-in customer'}</div>
                      <div>Order: {receiptForm.orderId || '—'}</div>
                      <div>Payment: {receiptForm.paymentMethod || 'Cash'}</div>
                    </div>
                    <div className="mt-4 border-t border-white/10 pt-3 text-sm text-white/90">
                      <div className="flex items-center justify-between">
                        <span>Subtotal</span>
                        <span>{formatCurrency(receiptTotals.subtotal, receiptForm.currency)}</span>
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <span>Tax</span>
                        <span>{formatCurrency(receiptTotals.taxAmount, receiptForm.currency)}</span>
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <span>Service charge</span>
                        <span>{formatCurrency(receiptTotals.serviceChargeAmount, receiptForm.currency)}</span>
                      </div>
                      <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3 text-base font-semibold">
                        <span>Total</span>
                        <span>{formatCurrency(receiptTotals.grandTotal, receiptForm.currency)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Automation controls</h4>
                    <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">AI-assisted</span>
                  </div>
                  <div className="mt-4 grid gap-3">
                    <label className="rounded-2xl border border-slate-200 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-950">
                      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Tax rate (%)</span>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={receiptForm.taxRate}
                        onChange={(event) => updateReceiptField('taxRate', event.target.value)}
                        className="w-full border-none bg-transparent text-sm text-slate-900 outline-none dark:text-white"
                      />
                    </label>
                    <label className="rounded-2xl border border-slate-200 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-950">
                      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Service charge (%)</span>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={receiptForm.serviceChargeRate}
                        onChange={(event) => updateReceiptField('serviceChargeRate', event.target.value)}
                        className="w-full border-none bg-transparent text-sm text-slate-900 outline-none dark:text-white"
                      />
                    </label>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={handleSaveReceipt}
                    disabled={receiptSaving}
                    className={`rounded-2xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 ${receiptSaving ? 'cursor-not-allowed opacity-70' : ''}`}
                  >
                    {receiptSaving ? 'Saving...' : 'Save receipt'}
                  </button>
                  <button
                    type="button"
                    onClick={handlePreviewReceipt}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  >
                    Preview
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default InboxPage;
