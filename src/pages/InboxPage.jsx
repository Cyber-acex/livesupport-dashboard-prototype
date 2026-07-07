import { useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import Sidebar from '../components/Sidebar';
import TopBar from '../components/TopBar';
import StatusBadge from '../components/StatusBadge';

const queueFilters = [
  { id: 'all', label: 'All', icon: '✦' },
  { id: 'priority', label: 'Priority', icon: '⚡' },
  { id: 'unread', label: 'Unread', icon: '✉' },
  { id: 'resolved', label: 'Resolved', icon: '✓' }
];

function formatDate(value) {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
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
  const socketRef = useRef(null);
  const selectedConversationIdRef = useRef(null);

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

      setConversations((prev) => prev.map((conv) => {
        if (String(conv.id) !== conversationId) return conv;
        const isActive = String(selectedConversation?.id) === conversationId;
        return {
          ...conv,
          last_message: message.message || conv.last_message,
          last_message_at: message.created_at || new Date().toISOString(),
          unread_count: isActive ? 0 : Math.max(0, (conv.unread_count || 0) + 1)
        };
      }));

      if (String(selectedConversation?.id) === conversationId) {
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
    };

    socket.on('connect', handleConnect);
    socket.on('newMessage', handleNewMessage);
    socket.on('messages:refreshed', handleMessagesRefreshed);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('newMessage', handleNewMessage);
      socket.off('messages:refreshed', handleMessagesRefreshed);
    };
  }, []);

  // When user selects a conversation, tell the server and request a socket refresh
  useEffect(() => {
    if (!selectedConversation?.id) return;
    selectedConversationIdRef.current = selectedConversation.id;
    const socket = socketRef.current;
    if (!socket) return;

    try {
      socket.emit('agent:activeConversation', { conversationId: selectedConversation.id });
      socket.emit('messages:refresh', { conversationId: selectedConversation.id });
    } catch (e) {
      // If not connected yet, wait for connect and then emit
      socket.once('connect', () => {
        try {
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
                                  {message.createdAt ? <span>{new Date(message.createdAt).toLocaleString()}</span> : null}
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
                    <button type="button" className="w-full rounded-2xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-700">
                      Create receipt
                    </button>
                    <button type="button" className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                      Share update
                    </button>
                  </div>
                </aside>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

export default InboxPage;
