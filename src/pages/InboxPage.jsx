import { useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import Sidebar from '../components/Sidebar';
import TopBar from '../components/TopBar';
import StatusBadge from '../components/StatusBadge';
import CallStatusBadge from '../components/CallStatusBadge';
import CallLinkPanel from '../components/CallLinkPanel';
import { useCallSocket } from '../hooks/useCallSocket';
import { useCallWebRTC } from '../hooks/useCallWebRTC';
import { formatInboxTimestamp } from '../utils/inboxTime';

const queueFilters = [
  { id: 'all', label: 'All', icon: '✦' },
  { id: 'priority', label: 'Priority', icon: '⚡' },
  { id: 'unread', label: 'Unread', icon: '✉' },
  { id: 'resolved', label: 'Resolved', icon: '✓' }
];

function formatDate(value) {
  return formatInboxTimestamp(value);
}

function InboxPage() {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [composer, setComposer] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [notification, setNotification] = useState('');
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
  const [currentUser, setCurrentUser] = useState(null);
  const [callToken, setCallToken] = useState('');
  const [callLink, setCallLink] = useState('');
  const [callStatus, setCallStatus] = useState('waiting');
  const [callError, setCallError] = useState('');
  const [callStarted, setCallStarted] = useState(false);
  const [offerSent, setOfferSent] = useState(false);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const socketRef = useRef(null);
  const selectedConversationIdRef = useRef(null);
  const activeConversationRoomRef = useRef(null);
  const remoteAudioRef = useRef(null);

  const callSocket = useCallSocket(
    { token: callToken, role: callToken ? 'staff' : null, userId: currentUser?.id, name: currentUser?.name },
    {
      onStatus: (payload) => {
        if (!payload) return;
        if (payload.status) setCallStatus(payload.status);
        if (payload.secureToken && !callLink) {
          setCallLink(`${window.location.origin}/call/${payload.secureToken}`);
        }
        if (payload.error || payload.message) {
          setCallError(payload.error || payload.message);
        }
      },
        onRinging: (payload) => {
        setCallStatus('ringing');
        if (payload.secureToken) {
          setCallLink(`${window.location.origin}/call/${payload.secureToken}`);
        }
      },
      onAnswered: () => setCallStatus('answered'),
      onEnded: () => setCallStatus('ended'),
      onError: (payload) => setCallError(payload?.message || String(payload) || 'Call socket error'),
      onAnswer: async (payload) => {
        if (!payload || !payload.answer) return;
        try {
          await setRemoteDescription(payload.answer);
        } catch (err) {
          console.error('Call remote answer failed', err);
          setCallError('Failed to complete call handshake.');
        }
      },
      onIce: async (payload) => {
        if (!payload || !payload.candidate) return;
        try {
          await addIceCandidate(payload.candidate);
        } catch (err) {
          console.warn('ICE candidate handling failed', err);
        }
      }
    }
  );

  const { createOffer, createAnswer, addIceCandidate, setRemoteDescription, closePeerConnection } = useCallWebRTC({
    localStream,
    onRemoteStream: (stream) => setRemoteStream(stream),
    socket: callSocket,
    token: callToken,
    userId: currentUser?.id,
    targetId: null
  });

  useEffect(() => {
    if (!callStarted || localStream) return;
    const acquireAudio = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setLocalStream(stream);
      } catch (err) {
        console.error('Failed to acquire microphone', err);
        setCallError('Microphone access is required for voice calls.');
      }
    };
    acquireAudio();
  }, [callStarted, localStream]);

  useEffect(() => {
    if (!remoteAudioRef.current || !remoteStream) return;
    remoteAudioRef.current.srcObject = remoteStream;
  }, [remoteStream]);

  useEffect(() => {
    if (!callSocket || !callToken || !localStream || !callStatus) return;
    if (callStatus !== 'ringing' || offerSent) return;

    const sendOffer = async () => {
      try {
        await createOffer();
        setOfferSent(true);
      } catch (err) {
        console.error('Failed to send call offer', err);
        setCallError('Failed to initiate voice call.');
      }
    };

    sendOffer();
  }, [callSocket, callToken, localStream, callStatus, offerSent, createOffer]);

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
        if (active) setNotification('Failed to load inbox conversations.');
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
      } catch (error) {
        console.error('Inbox thread load error', error);
        if (active) {
          setMessages([]);
          setNotification('Failed to load message thread.');
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

    const handleNewMessage = (message) => {
      if (!message || !message.conversation_id) return;
      const conversationId = String(message.conversation_id);
      const activeConversationId = String(selectedConversationIdRef.current);

      setConversations((prev) => prev.map((conv) => {
        if (String(conv.id) !== conversationId) return conv;
        const isActive = activeConversationId === conversationId;
        return {
          ...conv,
          last_message: message.message || conv.last_message,
          last_message_at: message.created_at || new Date().toISOString(),
          unread_count: isActive ? 0 : Math.max(0, (conv.unread_count || 0) + 1)
        };
      }));

      if (activeConversationId === conversationId) {
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
      if (selectedConversationIdRef.current) {
        socket.emit('conversation:join', { conversationId: selectedConversationIdRef.current });
        socket.emit('agent:activeConversation', { conversationId: selectedConversationIdRef.current });
        socket.emit('messages:refresh', { conversationId: selectedConversationIdRef.current });
      }
    };

    const handleCallEvent = (payload) => {
      if (!payload) return;
      if (payload.error || payload.message) {
        setCallError(payload.error || payload.message);
      }
      if (payload.status) {
        setCallStatus(payload.status);
      }
      if (payload.secureToken) {
        const host = window.location.origin;
        setCallLink(`${host}/call/${payload.secureToken}`);
      }
    };

    socket.on('connect', handleConnect);
    socket.on('newMessage', handleNewMessage);
    socket.on('messages:refreshed', handleMessagesRefreshed);
    socket.on('call:status', handleCallEvent);
    socket.on('call:ringing', handleCallEvent);
    socket.on('call:answered', handleCallEvent);
    socket.on('call:rejected', handleCallEvent);
    socket.on('call:missed', handleCallEvent);
    socket.on('call:ended', handleCallEvent);
    socket.on('call:error', handleCallEvent);

    return () => {
      if (activeConversationRoomRef.current && socket) {
        socket.emit('conversation:leave', { conversationId: activeConversationRoomRef.current });
      }
      socket.off('connect', handleConnect);
      socket.off('newMessage', handleNewMessage);
      socket.off('messages:refreshed', handleMessagesRefreshed);
      socket.off('call:status', handleCallEvent);
      socket.off('call:ringing', handleCallEvent);
      socket.off('call:answered', handleCallEvent);
      socket.off('call:rejected', handleCallEvent);
      socket.off('call:missed', handleCallEvent);
      socket.off('call:ended', handleCallEvent);
      socket.off('call:error', handleCallEvent);
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
    if (!conversationId) return;

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
      setNotification('AI reply inserted into the composer.');
    } catch (error) {
      console.error('AI reply generation error', error);
      setNotification(error.message || 'Failed to generate AI reply.');
    } finally {
      setIsGeneratingReply(false);
    }
  }

  async function sendMessage() {
    if (!selectedConversation?.id || !composer.trim()) return;
    setIsSending(true);

    try {
      const response = await fetch('/api/send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation_id: selectedConversation.id, message: composer.trim() })
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        const errorMessage = errorBody.error || 'Failed to send message.';
        throw new Error(errorMessage);
      }

      const data = await response.json();
      const messageData = data.message || data.messageData || {
        sender: 'sent',
        message: composer.trim(),
        created_at: new Date().toISOString()
      };

      setComposer('');
      setMessages((prev) => {
        const alreadyExists = prev.some((msg) =>
          String(msg.sender) === String(messageData.sender) &&
          String(msg.message) === String(messageData.message) &&
          String(msg.created_at) === String(messageData.created_at)
        );
        if (alreadyExists) return prev;
        return [...prev, messageData];
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
    } catch (error) {
      console.error('Inbox send message error', error);
      setNotification(error.message || 'Failed to send message.');
    } finally {
      setIsSending(false);
    }
  }

  async function handleCallCustomer() {
    if (!selectedConversation?.id) {
      setNotification('Select a conversation before placing a call.');
      return;
    }

    setCallError('');
    setCallStatus('waiting');
    setCallLink('');
    setCallToken('');
    setOfferSent(false);
    setCallStarted(true);

    try {
      const response = await fetch('/api/call-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: selectedConversation.id,
          customerName: selectedConversation.name || selectedConversation.phone || 'Customer'
        })
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.error || 'Unable to start call session.');
      }

      const data = await response.json();
      const secureToken = data.secureToken || data.token || data.call?.secureToken;
      if (!secureToken) throw new Error('Call link generation failed.');

      const host = window.location.origin;
      setCallToken(secureToken);
      setCallLink(`${host}/call/${secureToken}`);
      setCallStatus(data.status || 'waiting');
      setNotification('Call link generated. Customer can answer using the secure link.');
    } catch (error) {
      console.error('Call creation failed', error);
      setCallError(error.message || 'Failed to create voice call.');
      setCallStatus('failed');
      setCallStarted(false);
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
      const matchesFilter = (() => {
        switch (activeFilter) {
          case 'priority':
            return (conversation.unread_count || 0) > 0 || conversation.platform === 'WhatsApp';
          case 'unread':
            return (conversation.unread_count || 0) > 0;
          case 'resolved':
            return (conversation.unread_count || 0) === 0 && conversation.platform !== 'WhatsApp';
          default:
            return true;
        }
      })();

      return matchesQuery && matchesFilter;
    });
  }, [activeFilter, conversations, query]);

  const activeConversation = filteredConversations.find((conversation) => conversation.id === selectedConversation?.id) || filteredConversations[0] || null;

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
      setNotification('Add at least one item before saving the receipt.');
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

      setNotification('Receipt created and stored successfully.');
      setIsReceiptModalOpen(false);
    } catch (error) {
      console.error('Receipt save failed', error);
      setNotification(error.message || 'Failed to save receipt.');
    } finally {
      setReceiptSaving(false);
    }
  }

  function handlePreviewReceipt() {
    const previewWindow = window.open('', '_blank', 'width=900,height=800');
    if (!previewWindow) {
      setNotification('Popup blocked. Please allow popups to preview the receipt.');
      return;
    }

    const content = escapeHtml(buildReceiptText()).replace(/\n/g, '<br/>');
    previewWindow.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>Receipt Preview</title><style>body{font-family:Inter,Segoe UI,sans-serif;padding:24px;line-height:1.6;color:#111827}pre{white-space:pre-wrap;font-family:inherit}</style></head><body><pre>${content}</pre></body></html>`);
    previewWindow.document.close();
    previewWindow.focus();
  }

  const conversationMessages = useMemo(() => {
    if (!activeConversation) return [];
    return (messages.length > 0 ? messages : []).map((message, index) => {
      const senderValue = String(message.sender || '').toLowerCase();
      const isAgent = ['sent', 'sent_by_agent', 'agent', 'staff', 'assistant', 'bot'].includes(senderValue);
      return {
        id: message.id || `${activeConversation.id}-${index}`,
        sender: isAgent ? 'agent' : 'customer',
        content: message.message || message.content || '',
        createdAt: message.created_at || message.createdAt
      };
    }).filter((message) => message.content);
  }, [activeConversation, messages]);

  const conversationRows = filteredConversations.map((conversation) => {
    const isActive = activeConversation?.id === conversation.id;
    const initials = (conversation.name || conversation.phone || 'C').charAt(0).toUpperCase();

    return (
      <button
        key={conversation.id}
        type="button"
        onClick={() => setSelectedConversation(conversation)}
        className={`w-full rounded-2xl border p-4 text-left transition ${
          isActive
            ? 'border-brand-500/30 bg-brand-500/10 shadow-sm shadow-brand-500/10'
            : 'border-slate-200 bg-white hover:border-brand-500/20 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950/70 dark:hover:bg-slate-900'
        }`}
      >
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-cyan-400 text-sm font-semibold text-white">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate font-semibold text-slate-900 dark:text-white">
                {conversation.name || conversation.phone || 'Customer'}
              </p>
              {conversation.unread_count > 0 ? (
                <span className="rounded-full bg-rose-500 px-2.5 py-1 text-[11px] font-semibold text-white">
                  {conversation.unread_count}
                </span>
              ) : null}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {conversation.platform || 'Chat'}
              </span>
              <span>{formatDate(conversation.last_message_at || conversation.updated_at || conversation.created_at)}</span>
            </div>
            <p className="mt-2 line-clamp-2 text-sm text-slate-600 dark:text-slate-400">
              {conversation.last_message || conversation.message || 'No preview available.'}
            </p>
          </div>
        </div>
      </button>
    );
  });

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-white">
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar />
          <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
            <div className="mb-6 flex flex-col gap-4 rounded-[32px] border border-slate-200 bg-white/80 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/80 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-500">Customer inbox</p>
                <h1 className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">TailAdmin-style conversations</h1>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">A refined chat workspace for tickets, follow-ups, and live support replies.</p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search conversations..."
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white sm:min-w-[260px]"
                />
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="inline-flex items-center justify-center rounded-2xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-700"
                >
                  Refresh
                </button>
              </div>
            </div>

            {notification ? (
              <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-100">
                {notification}
              </div>
            ) : null}

            <div className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-950">
              <div className="grid h-[calc(100dvh-12rem)] min-h-[720px] max-h-[calc(100dvh-12rem)] grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)_320px]">
                <aside className="border-b border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/80 xl:border-b-0 xl:border-r">
                  <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">Smart queue</p>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Route tickets, refunds, and escalations.</p>
                      </div>
                      <div className="rounded-full bg-brand-50 px-3 py-1 text-sm font-semibold text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
                        {filteredConversations.length}
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {queueFilters.map((filter) => (
                        <button
                          key={filter.id}
                          type="button"
                          onClick={() => setActiveFilter(filter.id)}
                          className={`rounded-full px-3 py-2 text-sm font-medium transition ${
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
                  </div>

                  <div className="mt-4 space-y-3">
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
                </aside>

                <section className="flex h-full min-h-0 flex-col bg-white dark:bg-slate-950">
                  {activeConversation ? (
                    <>
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/80 px-5 py-4 dark:border-slate-800 dark:bg-slate-900/80">
                        <div className="flex items-center gap-3">
                          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-cyan-400 text-sm font-semibold text-white">
                            {(activeConversation.name || activeConversation.phone || 'C').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                                {activeConversation.name || activeConversation.phone || 'Conversation'}
                              </h2>
                              <StatusBadge status={activeConversation.unread_count > 0 ? 'Needs reply' : 'Resolved'} type={activeConversation.unread_count > 0 ? 'pending' : 'success'} />
                            </div>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                              {activeConversation.platform || 'Chat'} • {formatDate(activeConversation.last_message_at || activeConversation.updated_at || activeConversation.created_at)}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button type="button" className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                            Escalate
                          </button>
                          <button type="button" className="rounded-full bg-brand-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-700">
                            Resolve
                          </button>
                        </div>
                      </div>

                      <div className="scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent dark:scrollbar-thumb-slate-700 flex-1 min-h-0 overflow-y-auto bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.08),_transparent_30%)] p-5 dark:bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.14),_transparent_30%)]">
                        <div className="space-y-4">
                        {messagesLoading ? (
                          <div className="rounded-3xl border border-dashed border-slate-300 bg-white/80 p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-400">
                            Loading message thread...
                          </div>
                        ) : conversationMessages.length > 0 ? (
                          conversationMessages.map((message) => (
                            <div key={message.id} className={`flex ${message.sender === 'agent' ? 'justify-end' : 'justify-start'}`}>
                              <div className={`max-w-[80%] rounded-3xl px-4 py-3 text-sm leading-6 shadow-sm ${
                                message.sender === 'agent'
                                  ? 'bg-slate-900 text-slate-50 dark:bg-brand-600'
                                  : 'border border-slate-200 bg-white text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200'
                              }`}>
                                <div className="mb-1 flex items-center justify-between gap-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                                  <span>{message.sender === 'agent' ? 'Support agent' : 'Customer'}</span>
                                  {message.createdAt ? <span>{formatInboxTimestamp(message.createdAt)}</span> : null}
                                </div>
                                {message.content}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="rounded-3xl border border-dashed border-slate-300 bg-white/80 p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-400">
                            No message history found for this conversation yet.
                          </div>
                        )}
                        </div>
                      </div>

                      <div className="border-t border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/80">
                        <div className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950">
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
                            className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                          />
                          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                            <p className="text-sm text-slate-500 dark:text-slate-400">AI suggested response is ready.</p>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                disabled={isGeneratingReply}
                                onClick={handleUseAiReply}
                                className={`rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 ${isGeneratingReply ? 'cursor-not-allowed opacity-70' : ''}`}
                              >
                                {isGeneratingReply ? 'Generating...' : 'Use AI reply'}
                              </button>
                              <button
                                type="button"
                                disabled={isSending || !composer.trim()}
                                onClick={sendMessage}
                                className={`rounded-full px-3 py-2 text-sm font-semibold text-white transition ${isSending || !composer.trim()
                                  ? 'bg-slate-400 cursor-not-allowed hover:bg-slate-400'
                                  : 'bg-brand-600 hover:bg-brand-700'
                                }`}
                              >
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
                </section>

                <aside className="border-t border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/80 xl:border-l xl:border-t-0">
                  <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Customer info</h3>
                      <StatusBadge status="VIP" type="pending" />
                    </div>
                    <div className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Name</p>
                        <p className="mt-1 font-medium text-slate-900 dark:text-white">{activeConversation?.name || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Phone</p>
                        <p className="mt-1 font-medium text-slate-900 dark:text-white">{activeConversation?.phone || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Last contact</p>
                        <p className="mt-1 font-medium text-slate-900 dark:text-white">{formatDate(activeConversation?.last_message_at || activeConversation?.updated_at || activeConversation?.created_at)}</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                    <h3 className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Order snapshot</h3>
                    <div className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300">
                      <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-3 py-2 dark:bg-slate-900">
                        <span>Order ID</span>
                        <span className="font-semibold text-slate-900 dark:text-white">#48291</span>
                      </div>
                      <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-3 py-2 dark:bg-slate-900">
                        <span>Status</span>
                        <span className="font-semibold text-emerald-500">On route</span>
                      </div>
                      <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-3 py-2 dark:bg-slate-900">
                        <span>ETA</span>
                        <span className="font-semibold text-slate-900 dark:text-white">15 mins</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    <button
                      type="button"
                      onClick={openReceiptModal}
                      className="w-full rounded-2xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-700"
                    >
                      Create receipt
                    </button>
                    <button type="button" className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                      Share update
                    </button>
                    <button
                      type="button"
                      onClick={handleCallCustomer}
                      className="w-full rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
                    >
                      Call customer
                    </button>
                    <CallLinkPanel
                      callLink={callLink}
                      status={callStatus}
                      onCopy={() => navigator.clipboard.writeText(callLink)}
                    />
                    {callError ? (
                      <div className="rounded-3xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-100">
                        {callError}
                      </div>
                    ) : null}
                    <CallStatusBadge status={callStatus} />
                  </div>
                </aside>
              </div>
            </div>
          </main>
        </div>
      </div>

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
