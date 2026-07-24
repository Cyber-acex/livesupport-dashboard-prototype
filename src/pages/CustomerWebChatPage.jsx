import { useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { createGuestSessionStorage, loadGuestSession, saveGuestSession } from '../utils/webChatSession';

const branchNames = { 1: 'Ikeja', 2: 'Lekki', 3: 'Victoria Island' };
const typingIndicatorIds = new Set();

function formatTime(value) {
  const date = value ? new Date(value) : new Date();
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export default function CustomerWebChatPage() {
  const [session, setSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [typing, setTyping] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const storage = useMemo(() => createGuestSessionStorage(window.localStorage), []);
  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const existing = loadGuestSession(storage);
    if (!existing?.guestId) {
      setStatusMessage('Your chat session needs to be started from the onboarding screen.');
      setLoading(false);
      return;
    }

    setSession(existing);
    setLoading(false);
    (async () => {
      try {
        const response = await fetch(`/api/customer-web-chat/sessions/${existing.guestId}`);
        const data = await response.json().catch(() => ({}));
        if (response.ok && data?.session) {
          const nextSession = { ...existing, ...data.session };
          setSession(nextSession);
          saveGuestSession(storage, nextSession);
        }
      } catch (error) {
        console.warn('Unable to restore guest session', error);
      }
    })();
  }, [storage]);

  useEffect(() => {
    if (!session?.guestId || !session?.conversationId) return;

    const socket = io({ reconnection: true, reconnectionDelay: 1000 });
    socketRef.current = socket;

    socket.emit('conversation:join', { conversationId: session.conversationId });
    socket.on('connect', () => {
      socket.emit('conversation:join', { conversationId: session.conversationId });
    });
    socket.on('newMessage', (payload) => {
      const conversationId = String(payload?.conversation_id || payload?.conversationId || '');
      const activeConversationId = String(session.conversationId);
      if (conversationId && conversationId !== activeConversationId) return;
      setMessages((prev) => {
        const exists = prev.some((message) => String(message.id || message.messageId || '') === String(payload.id || payload.messageId || ''));
        if (exists) return prev;
        return [...prev, {
          id: payload.id || payload.messageId || `${Date.now()}-${Math.random()}`,
          sender: payload.sender,
          message: payload.message || payload.text || '',
          created_at: payload.created_at || payload.timestamp || new Date().toISOString()
        }];
      });
      setTyping(false);
    });
    socket.on('typing', (payload) => {
      if (String(payload?.conversationId || payload?.conversation_id) !== String(session.conversationId)) return;
      if (payload?.userId === session.guestId) return;
      setTyping(true);
    });
    socket.on('stopTyping', (payload) => {
      if (String(payload?.conversationId || payload?.conversation_id) !== String(session.conversationId)) return;
      setTyping(false);
    });

    (async () => {
      try {
        const response = await fetch(`/api/customer-web-chat/conversations/${session.conversationId}/messages`);
        const data = await response.json().catch(() => ({}));
        if (response.ok) {
          setMessages(Array.isArray(data?.messages) ? data.messages : []);
        }
      } catch (error) {
        console.warn('Unable to load conversation history', error);
      }
    })();

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [session?.guestId, session?.conversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!session?.conversationId || !trimmed || sending) return;
    setSending(true);
    setStatusMessage('');
    setInput('');
    try {
      const response = await fetch('/api/customer-web-chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guestId: session.guestId,
          conversationId: session.conversationId,
          branchId: session.branchId,
          customerName: session.customerName,
          phone: session.phone,
          message: trimmed
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || 'Unable to send your message.');
      }
      setMessages((prev) => [...prev, {
        id: data?.message?.id || `${Date.now()}-${Math.random()}`,
        sender: 'customer',
        message: trimmed,
        created_at: new Date().toISOString()
      }]);
      setStatusMessage('Message sent');
      if (socketRef.current?.connected) {
        socketRef.current.emit('typing', { conversationId: session.conversationId, userId: session.guestId, name: session.customerName });
      }
    } catch (error) {
      setStatusMessage(error.message || 'Unable to send');
      setInput(trimmed);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-950/5 text-slate-700">Loading your chat…</div>;
  }

  if (!session?.guestId || !session?.conversationId) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-950/5 px-4 text-center text-slate-700">Start the onboarding flow first to open the chat.</div>;
  }

  return (
    <div className="min-h-screen bg-slate-950/5 px-4 py-8 sm:px-6 lg:px-8">
      <div className="relative mx-auto flex min-h-[calc(100vh-3rem)] max-w-6xl flex-col overflow-hidden rounded-[2rem] border border-white/70 bg-white/85 shadow-[0_40px_140px_-45px_rgba(15,23,42,0.24)] backdrop-blur-2xl">
        <div className="absolute inset-x-0 top-0 h-56 bg-[radial-gradient(circle_at_top_left,_rgba(249,115,22,0.18),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(59,130,246,0.12),_transparent_30%)]" />
        <div className="relative border-b border-slate-200/80 bg-white/90 px-6 py-6 sm:px-8 lg:px-10">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.32em] text-orange-600">{branchNames[session.branchId] || 'Branch'} support</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Premium live support for your order.</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">Chat securely with our staff and keep your request moving. Every conversation is routed to the right team for faster resolution.</p>
            </div>
            <div className="inline-flex items-center gap-3 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700 shadow-sm">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              Live connection active
            </div>
          </div>
        </div>

        <div className="flex flex-1 flex-col overflow-hidden lg:flex-row">
          <main className="order-2 flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-50 px-4 py-5 sm:px-6 sm:py-6 lg:order-1 lg:px-8 lg:py-8">
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
              <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">Support is ready</p>
                    <p className="mt-2 text-base text-slate-700">Your branch has staff standing by to help with orders, tickets, and questions.</p>
                  </div>
                  <div className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">Agent queue: 1-2 min</div>
                </div>
              </div>

              <div className="flex-1 overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_24px_80px_-30px_rgba(15,23,42,0.1)]">
                <div className="h-full overflow-y-auto px-4 py-5 sm:px-6" style={{ scrollBehavior: 'smooth' }}>
                  <div className="space-y-4">
                    {messages.length === 0 ? (
                      <div className="rounded-[1.75rem] border border-dashed border-slate-300 bg-slate-50 px-5 py-6 text-sm text-slate-500">
                        No message history yet. Start the conversation with a quick message below.
                      </div>
                    ) : null}

                    {messages.map((message) => {
                      const isCustomer = String(message.sender || '').toLowerCase() === 'customer';
                      return (
                        <div key={message.id} className={`flex ${isCustomer ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[82%] rounded-[1.75rem] px-5 py-4 shadow-sm ${isCustomer ? 'bg-gradient-to-br from-orange-500 to-amber-400 text-white shadow-[0_18px_40px_-30px_rgba(249,115,22,0.6)]' : 'border border-slate-200 bg-slate-950/5 text-slate-900'}`}>
                            <div className={`mb-2 text-[11px] font-semibold uppercase tracking-[0.24em] ${isCustomer ? 'text-orange-100' : 'text-slate-400'}`}>
                              {isCustomer ? session.customerName || 'You' : 'Staff'}
                            </div>
                            <p className="text-sm leading-7 whitespace-pre-line">{message.message || message.text || ''}</p>
                            <div className={`mt-3 text-[11px] ${isCustomer ? 'text-orange-100/90' : 'text-slate-400'}`}>{formatTime(message.created_at || message.timestamp)}</div>
                          </div>
                        </div>
                      );
                    })}

                    {typing ? (
                      <div className="max-w-[65%] rounded-full border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
                        Staff is typing…
                      </div>
                    ) : null}
                    <div ref={messagesEndRef} />
                  </div>
                </div>
              </div>
            </div>
          </main>

          <aside className="order-1 border-b border-slate-200 bg-slate-950/5 px-6 py-6 sm:px-8 lg:order-2 lg:w-[320px] lg:border-l lg:border-b-0">
            <div className="sticky top-6 space-y-5">
              <div className="rounded-[2rem] bg-gradient-to-br from-slate-900 via-slate-950 to-slate-800 p-5 text-white shadow-lg shadow-slate-900/20">
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">Conversation details</p>
                <div className="mt-5 space-y-4 text-sm">
                  <div className="rounded-3xl bg-white/5 p-4">
                    <p className="text-slate-200">Branch</p>
                    <p className="mt-1 font-semibold text-white">{branchNames[session.branchId] || 'Branch'}</p>
                  </div>
                  <div className="rounded-3xl bg-white/5 p-4">
                    <p className="text-slate-200">Channel</p>
                    <p className="mt-1 font-semibold text-white">Web chat</p>
                  </div>
                  <div className="rounded-3xl bg-white/5 p-4">
                    <p className="text-slate-200">Customer</p>
                    <p className="mt-1 font-semibold text-white">{session.customerName || 'Guest user'}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-[2rem] border border-slate-200/70 bg-white p-5 shadow-sm">
                <p className="text-sm font-semibold text-slate-900">Tips for a faster response</p>
                <ul className="mt-4 space-y-3 text-sm text-slate-600">
                  <li className="flex gap-2"><span className="mt-1 h-2.5 w-2.5 rounded-full bg-orange-400" />Include order or ticket number</li>
                  <li className="flex gap-2"><span className="mt-1 h-2.5 w-2.5 rounded-full bg-orange-400" />Describe your request clearly</li>
                  <li className="flex gap-2"><span className="mt-1 h-2.5 w-2.5 rounded-full bg-orange-400" />Keep follow-ups in one thread</li>
                </ul>
              </div>
            </div>
          </aside>
        </div>

        <footer className="border-t border-slate-200 bg-white/90 px-4 py-4 sm:px-6 lg:px-8">
          {statusMessage ? <div className="mb-3 text-sm text-slate-500">{statusMessage}</div> : null}
          <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-end">
            <textarea
              rows={3}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message..."
              className="min-h-[96px] flex-1 resize-none rounded-[1.75rem] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-900 outline-none transition focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-100"
            />
            <button
              type="button"
              disabled={sending || !input.trim()}
              onClick={sendMessage}
              className="inline-flex h-14 items-center justify-center rounded-[1.75rem] bg-gradient-to-r from-orange-500 to-amber-400 px-6 text-sm font-semibold text-white shadow-lg shadow-orange-200 transition hover:from-orange-600 hover:to-amber-500 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {sending ? 'Sending…' : 'Send message'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
