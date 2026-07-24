import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import TopBar from '../components/TopBar';
import StatusBadge from '../components/StatusBadge';
import { formatInboxTimestamp } from '../utils/inboxTime';

export default function StaffWebChatPage() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [composer, setComposer] = useState('');
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const [conversationError, setConversationError] = useState('');
  const messagesViewportRef = useRef(null);

  useEffect(() => {
    let active = true;
    if (!conversationId) {
      setConversationError('Conversation ID is missing.');
      setLoading(false);
      return;
    }

    const loadDetails = async () => {
      setLoading(true);
      setConversationError('');
      try {
        const response = await fetch(`/api/conversations?id=${encodeURIComponent(conversationId)}`);
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error || 'Unable to load conversation details.');
        }
        const data = await response.json();
        const result = Array.isArray(data) ? data[0] : null;
        if (!result) {
          throw new Error('Conversation not found.');
        }
        if (active) setConversation(result);
      } catch (err) {
        if (active) setConversationError(err.message || 'Unable to load conversation.');
      } finally {
        if (active) setLoading(false);
      }
    };

    loadDetails();
    return () => { active = false; };
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId) return;
    let active = true;
    setMessagesLoading(true);
    setError('');

    fetch(`/api/messages/${encodeURIComponent(conversationId)}`)
      .then(async (response) => {
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error || 'Failed to load messages.');
        }
        return response.json();
      })
      .then((data) => {
        if (!active) return;
        if (!Array.isArray(data)) {
          throw new Error('Invalid message payload');
        }
        setMessages(data);
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message || 'Unable to load message history.');
      })
      .finally(() => {
        if (active) setMessagesLoading(false);
      });

    return () => { active = false; };
  }, [conversationId]);

  useEffect(() => {
    const container = messagesViewportRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [messages, messagesLoading]);

  const messageGroups = useMemo(() => {
    if (!messages || messages.length === 0) return [];

    const groups = [];
    let previousSender = null;

    messages.forEach((message) => {
      const sender = String(message.sender || '').toLowerCase();
      const currentParty = ['sent', 'sent_by_agent', 'agent', 'staff', 'assistant', 'bot'].includes(sender) ? 'agent' : 'customer';
      if (currentParty !== previousSender) {
        groups.push({ sender: currentParty, items: [message] });
        previousSender = currentParty;
      } else {
        groups[groups.length - 1].items.push(message);
      }
    });

    return groups;
  }, [messages]);

  const handleSendMessage = async () => {
    const trimmed = composer.trim();
    if (!trimmed || !conversation?.id || isSending) return;

    setIsSending(true);
    setError('');

    try {
      const response = await fetch('/api/send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation_id: conversation.id, message: trimmed, phone: conversation.phone })
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Failed to send message.');
      }
      const data = await response.json();
      const messageData = data?.message || {
        sender: 'sent',
        message: trimmed,
        created_at: new Date().toISOString()
      };
      setMessages((prev) => [...prev, messageData]);
      setComposer('');
    } catch (err) {
      setError(err.message || 'Unable to send message.');
    } finally {
      setIsSending(false);
    }
  };

  const statusBadge = conversation?.unread_count > 0
    ? { label: 'Needs reply', type: 'pending' }
    : { label: 'Closed', type: 'success' };

  return (
    <div className="min-h-screen bg-slate-950/5 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar />
          <main className="flex-1 min-h-0 overflow-hidden p-4 sm:p-6 lg:p-8">
            <div className="mx-auto max-w-7xl space-y-6">
              <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-950">
                <div className="flex flex-col gap-4 border-b border-slate-200/80 bg-slate-50/80 px-6 py-5 dark:border-slate-800 dark:bg-slate-900/80 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.32em] text-slate-500 dark:text-slate-400">Customer chat</p>
                    <h1 className="mt-2 text-3xl font-semibold text-slate-950 dark:text-white">Staff view — customer conversation</h1>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-400">
                      View the customer thread and respond directly. Branch verification is enforced so staff only access conversations for their assigned branch.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={statusBadge.label} type={statusBadge.type} />
                    <button
                      type="button"
                      onClick={() => navigate('/inbox')}
                      className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      Back to inbox
                    </button>
                  </div>
                </div>

                <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1.2fr)_360px]">
                  <section className="space-y-6">
                    <div className="rounded-[2rem] border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Conversation</p>
                          <h2 className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">{conversation?.name || conversation?.phone || `#${conversationId}`}</h2>
                          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{conversation?.platform || 'Chat'} • Branch ID: {conversation?.branch_id || 'N/A'}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge status={conversation?.platform || 'Chat'} type="default" />
                          <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                            {conversation?.phone || 'No phone'}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-[2rem] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
                      <div className="rounded-[2rem] px-5 py-5 dark:bg-slate-950/95">
                        <div className="mb-4 flex items-center justify-between gap-4">
                          <div>
                            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Message history</h3>
                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">All messages are loaded with branch verification enabled.</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => window.location.reload()}
                            className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                          >
                            Refresh
                          </button>
                        </div>

                        {loading || messagesLoading ? (
                          <div className="rounded-[1.75rem] border border-dashed border-slate-200 bg-slate-100 px-5 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-400">
                            Loading conversation...
                          </div>
                        ) : conversationError ? (
                          <div className="rounded-[1.75rem] border border-rose-200 bg-rose-50 px-5 py-8 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-100">
                            {conversationError}
                          </div>
                        ) : error ? (
                          <div className="rounded-[1.75rem] border border-rose-200 bg-rose-50 px-5 py-8 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-100">
                            {error}
                          </div>
                        ) : messageGroups.length === 0 ? (
                          <div className="rounded-[1.75rem] border border-dashed border-slate-200 bg-slate-100 px-5 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-400">
                            No messages found for this conversation yet.
                          </div>
                        ) : (
                          <div ref={messagesViewportRef} className="space-y-6 overflow-y-auto max-h-[56vh] pr-1 custom-scrollbar">
                            {messageGroups.map((group, index) => (
                              <div key={index} className="space-y-3">
                                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                                  <span className={`h-2 w-2 rounded-full ${group.sender === 'agent' ? 'bg-brand-500' : 'bg-slate-400'}`} />
                                  <span>{group.sender === 'agent' ? 'Support' : 'Customer'}</span>
                                </div>
                                <div className="space-y-3">
                                  {group.items.map((message) => (
                                    <div key={`${message.created_at}-${message.message || ''}`} className={`flex ${group.sender === 'agent' ? 'justify-end' : 'justify-start'}`}>
                                      <div className={`max-w-[80%] rounded-[1.75rem] px-5 py-4 text-sm leading-7 shadow-sm ${group.sender === 'agent' ? 'bg-brand-600 text-white' : 'border border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200'}`}>
                                        <div className="whitespace-pre-wrap">{message.message}</div>
                                        <div className="mt-3 text-right text-[11px] text-slate-500 dark:text-slate-400">{formatInboxTimestamp(message.created_at)}</div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="rounded-[2rem] border border-slate-200 bg-slate-50 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">Reply to customer</label>
                      <textarea
                        rows={3}
                        value={composer}
                        onChange={(event) => setComposer(event.target.value)}
                        placeholder="Write your response here..."
                        className="mt-3 min-h-[112px] w-full rounded-[1.5rem] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' && !event.shiftKey) {
                            event.preventDefault();
                            handleSendMessage();
                          }
                        }}
                      />
                      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
                        <p className="text-sm text-slate-500 dark:text-slate-400">Send direct staff replies into the customer thread.</p>
                        <button
                          type="button"
                          onClick={handleSendMessage}
                          disabled={!composer.trim() || isSending}
                          className="inline-flex items-center justify-center rounded-full bg-brand-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isSending ? 'Sending…' : 'Send reply'}
                        </button>
                      </div>
                    </div>
                  </section>

                  <aside className="space-y-6">
                    <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Branch verification</p>
                      <h3 className="mt-3 text-xl font-semibold text-slate-950 dark:text-white">Verified branch access</h3>
                      <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-400">
                        This conversation is available because your staff session belongs to the same branch as the customer thread. If access is denied, check your branch assignment.
                      </p>
                    </div>

                    <div className="rounded-[2rem] border border-slate-200 bg-slate-50 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Conversation details</p>
                      <div className="mt-4 space-y-3 text-sm text-slate-700 dark:text-slate-300">
                        <div className="rounded-2xl bg-white p-3 dark:bg-slate-950">
                          <p className="text-xs text-slate-500 dark:text-slate-400">Customer</p>
                          <p className="mt-2 font-semibold text-slate-900 dark:text-white">{conversation?.name || 'Unknown'}</p>
                        </div>
                        <div className="rounded-2xl bg-white p-3 dark:bg-slate-950">
                          <p className="text-xs text-slate-500 dark:text-slate-400">Phone</p>
                          <p className="mt-2 font-semibold text-slate-900 dark:text-white">{conversation?.phone || 'N/A'}</p>
                        </div>
                        <div className="rounded-2xl bg-white p-3 dark:bg-slate-950">
                          <p className="text-xs text-slate-500 dark:text-slate-400">Last updated</p>
                          <p className="mt-2 font-semibold text-slate-900 dark:text-white">{conversation?.last_message_at ? formatInboxTimestamp(conversation.last_message_at) : 'Unknown'}</p>
                        </div>
                      </div>
                    </div>
                  </aside>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
