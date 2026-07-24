import { useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import Sidebar from '../components/Sidebar';
import TopBar from '../components/TopBar';
import MetricCard from '../components/MetricCard';
import { useNotification } from '../contexts/NotificationContext';
import { RESOLUTION_CATEGORY_OPTIONS, getStarsForRating, isResolvedTicket } from '../utils/ticketResolution';

const socket = io();

function getTicketTone(status, escalated, priority) {
  const normalizedStatus = String(status || 'Open').toLowerCase();
  const normalizedPriority = String(priority || 'Normal').toLowerCase();

  if (escalated || normalizedStatus === 'escalated') {
    return {
      badge: 'border-rose-200 bg-rose-50 text-rose-700',
      dot: 'bg-rose-500',
      accent: 'from-rose-500/20 to-rose-500/5',
      label: escalated || normalizedStatus === 'escalated' ? 'Escalated' : normalizedStatus.charAt(0).toUpperCase() + normalizedStatus.slice(1)
    };
  }

  if (normalizedStatus === 'closed') {
    return {
      badge: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      dot: 'bg-emerald-500',
      accent: 'from-emerald-500/20 to-emerald-500/5',
      label: 'Closed'
    };
  }

  if (normalizedPriority === 'urgent' || normalizedPriority === 'high') {
    return {
      badge: 'border-amber-200 bg-amber-50 text-amber-700',
      dot: 'bg-amber-500',
      accent: 'from-amber-500/20 to-amber-500/5',
      label: 'High priority'
    };
  }

  return {
    badge: 'border-sky-200 bg-sky-50 text-sky-700',
    dot: 'bg-sky-500',
    accent: 'from-sky-500/20 to-sky-500/5',
    label: 'In review'
  };
}

function TicketCard({ ticket, onEscalate, onDelete, onResolve, onOpenResolveModal }) {
  const status = ticket.status || 'Open';
  const assigneeText = ticket.assignee ? `Assigned to ${ticket.assignee}` : 'Unassigned';
  const tone = getTicketTone(status, ticket.escalated, ticket.priority);
  const isResolved = isResolvedTicket(ticket);
  const ratingValue = Number(ticket.customer_rating ?? ticket.customerRating ?? 0) || null;
  const ratingText = ratingValue ? getStarsForRating(ratingValue) : 'Not Rated';
  const attachments = useMemo(() => {
    try {
      if (!ticket.attachments) return [];
      return typeof ticket.attachments === 'string' ? JSON.parse(ticket.attachments) : ticket.attachments;
    } catch {
      return [];
    }
  }, [ticket.attachments]);

  const imageAttachments = attachments.filter((att) => {
    const ext = (att.originalname || '').toLowerCase().match(/\.[^.]*$/)?.[0] || '';
    return ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'].includes(ext);
  });

  return (
    <article className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg">
      <div className={`h-1 w-full bg-gradient-to-r ${tone.accent}`} />
      <div className="p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-slate-900 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-white">
                Ticket #{ticket.id}
              </span>
              <span className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-semibold ${tone.badge}`}>
                <span className={`h-2.5 w-2.5 rounded-full ${tone.dot}`} />
                {tone.label}
              </span>
              <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${ratingValue ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-slate-200 bg-slate-50 text-slate-600'}`} title="Customer Satisfaction Rating">
                {ratingValue ? getStarsForRating(ratingValue) : 'Not Rated'}
              </span>
              {isResolved ? (
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                  Resolved
                </span>
              ) : null}
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600">
                Priority: {ticket.priority || 'Normal'}
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
                <span>{new Date(ticket.created_at).toLocaleString()}</span>
                {ticket.customer_name ? <span>• {ticket.customer_name}</span> : null}
                <span>• {assigneeText}</span>
              </div>
              <h4 className="text-lg font-semibold text-gray-900">{ticket.subject || 'Support request'}</h4>
              <pre className="whitespace-pre-wrap break-words text-sm leading-7 text-gray-600">{ticket.content}</pre>
            </div>

            {imageAttachments.length > 0 ? (
              <div className="flex flex-wrap gap-3 pt-2">
                {imageAttachments.map((att) => (
                  <img
                    key={att.filename}
                    src={`/uploads/${att.filename}`}
                    alt={att.originalname}
                    className="h-24 w-auto rounded-2xl border border-gray-200 object-cover shadow-sm"
                  />
                ))}
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2 lg:flex-col lg:items-stretch">
            {!isResolved ? (
              <button
                type="button"
                onClick={() => onOpenResolveModal(ticket)}
                className="rounded-2xl border border-emerald-200 bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500"
              >
                Resolve Ticket
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => onEscalate(ticket)}
              disabled={ticket.escalated}
              className={`rounded-2xl px-3 py-2 text-sm font-semibold transition ${ticket.escalated ? 'cursor-not-allowed border border-rose-200 bg-rose-50 text-rose-700' : 'border border-rose-200 bg-rose-500 text-white hover:bg-rose-600'}`}
            >
              {ticket.escalated ? 'Escalated' : 'Escalate'}
            </button>
            <button
              type="button"
              onClick={() => {
                const printWindow = window.open('', '', 'height=600,width=800');
                printWindow?.document.write(`<pre>${ticket.content}</pre>`);
                printWindow?.document.close();
                printWindow?.print();
              }}
              className="rounded-2xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-700 transition hover:bg-sky-100"
            >
              Print
            </button>
            <button
              type="button"
              onClick={() => onDelete(ticket.id)}
              className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

function TicketsPage() {
  const { success, error } = useNotification();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const localTicketActionsRef = useRef({ created: new Set(), deleted: new Set(), escalated: new Set() });
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [resolveForm, setResolveForm] = useState({ resolutionNotes: '', resolutionCategory: '', notifyCustomer: true });
  const [resolvingTicket, setResolvingTicket] = useState(false);
  const [resolveError, setResolveError] = useState('');
  const ticketCreationAudio = useMemo(() => {
    const audio = new Audio(encodeURI('/uploads/Notification sounds/Ticket creation.wav'));
    audio.preload = 'auto';
    return audio;
  }, []);
  const [createForm, setCreateForm] = useState({
    subject: '',
    customSubject: '',
    content: '',
    customer_name: '',
    customer_phone: '',
    assignee: '',
    priority: 'Normal',
    status: 'Open'
  });

  useEffect(() => {
    const fetchTickets = async () => {
      try {
        const res = await fetch('/api/tickets');
        const data = await res.json();
        setTickets(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Failed to load tickets', err);
      } finally {
        setLoading(false);
      }
    };

    fetchTickets();

    socket.on('ticketCreated', (ticket) => {
      setTickets((prev) => {
        if (prev.some((item) => String(item.id) === String(ticket.id))) return prev;
        return [ticket, ...prev];
      });
      const ticketId = String(ticket.id);
      if (localTicketActionsRef.current.created.has(ticketId)) {
        localTicketActionsRef.current.created.delete(ticketId);
        return;
      }
      success(`Created ticket #${ticket.id}`);
    });

    socket.on('ticketDeleted', ({ id }) => {
      setTickets((prev) => prev.filter((ticket) => ticket.id !== id));
      if (localTicketActionsRef.current.deleted.has(id)) {
        localTicketActionsRef.current.deleted.delete(id);
        return;
      }
      success(`Deleted ticket #${id}`);
    });

    socket.on('ticketEscalated', ({ ticket_id }) => {
      setTickets((prev) => prev.map((ticket) => ticket.id === ticket_id ? { ...ticket, escalated: true } : ticket));
      if (localTicketActionsRef.current.escalated.has(ticket_id)) {
        localTicketActionsRef.current.escalated.delete(ticket_id);
        return;
      }
      success(`Escalated ticket #${ticket_id}`);
    });

    socket.on('ticketFeedbackSubmitted', ({ ticket_id, customer_rating, customer_rating_comment, customer_rated_at }) => {
      setTickets((prev) => prev.map((ticket) => String(ticket.id) === String(ticket_id)
        ? { ...ticket, customer_rating, customer_rating_comment, customer_rated_at }
        : ticket));
    });

    return () => {
      socket.off('ticketCreated');
      socket.off('ticketDeleted');
      socket.off('ticketEscalated');
      socket.off('ticketFeedbackSubmitted');
    };
  }, [success]);

  const filteredTickets = useMemo(() => {
    const term = query.toLowerCase();
    return tickets.filter((ticket) => {
      const normalizedStatus = String(ticket.status || 'Open').toLowerCase();
      const matchesStatus = statusFilter === 'all'
        || (statusFilter === 'escalated' && (ticket.escalated || normalizedStatus === 'escalated'))
        || normalizedStatus === statusFilter;
      const matchesSearch = !term || [ticket.id, ticket.content, ticket.subject, ticket.customer_name, ticket.assignee].filter(Boolean).join(' ').toLowerCase().includes(term);
      return matchesStatus && matchesSearch;
    });
  }, [tickets, query, statusFilter]);

  const summary = useMemo(() => {
    const open = tickets.filter((ticket) => String(ticket.status || 'Open').toLowerCase() === 'open').length;
    const escalated = tickets.filter((ticket) => ticket.escalated || String(ticket.status || 'Open').toLowerCase() === 'escalated').length;
    const closed = tickets.filter((ticket) => String(ticket.status || 'Open').toLowerCase() === 'closed').length;
    return { total: tickets.length, open, escalated, closed };
  }, [tickets]);

  const handleEscalate = async (ticket) => {
    if (ticket.escalated) return;
    try {
      const res = await fetch('/api/escalate-ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket_id: ticket.id })
      });
      if (!res.ok) throw new Error('Escalation failed');
      localTicketActionsRef.current.escalated.add(ticket.id);
      setTickets((prev) => prev.map((item) => item.id === ticket.id ? { ...item, escalated: true } : item));
      success(`Escalated ticket #${ticket.id}`);
    } catch (err) {
      console.error(err);
      error('Failed to escalate ticket');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this ticket?')) return;
    try {
      const res = await fetch(`/api/tickets/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      localTicketActionsRef.current.deleted.add(id);
      setTickets((prev) => prev.filter((ticket) => ticket.id !== id));
      success(`Deleted ticket #${id}`);
    } catch (err) {
      console.error(err);
      error('Failed to delete ticket');
    }
  };

  const openResolveModal = (ticket) => {
    setSelectedTicket(ticket);
    setResolveError('');
    setResolveForm({ resolutionNotes: '', resolutionCategory: '', notifyCustomer: true });
    setShowResolveModal(true);
  };

  const closeResolveModal = () => {
    setShowResolveModal(false);
    setSelectedTicket(null);
    setResolveError('');
    setResolveForm({ resolutionNotes: '', resolutionCategory: '', notifyCustomer: true });
  };

  const handleResolveTicket = async () => {
    if (!selectedTicket) return;
    const notes = resolveForm.resolutionNotes.trim();
    if (notes.length < 10) {
      setResolveError('Resolution notes must be at least 10 characters long.');
      return;
    }
    if (!resolveForm.resolutionCategory) {
      setResolveError('Please choose a resolution category.');
      return;
    }

    setResolvingTicket(true);
    setResolveError('');
    try {
      const res = await fetch('/api/resolve-ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          ticket_id: selectedTicket.id,
          resolutionNotes: notes,
          resolutionCategory: resolveForm.resolutionCategory,
          notifyCustomer: resolveForm.notifyCustomer
        })
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || 'Failed to resolve ticket');
      setTickets((prev) => prev.map((item) => item.id === selectedTicket.id ? { ...item, status: 'Resolved', resolved_at: payload.resolved_at, resolved_by: payload.resolved_by, resolution_notes: payload.resolution_notes, resolution_category: payload.resolution_category, customer_rating: item.customer_rating ?? null } : item));
      success(`Resolved ticket #${selectedTicket.id}`);
      closeResolveModal();
    } catch (err) {
      console.error(err);
      setResolveError(err.message || 'Failed to resolve ticket');
    } finally {
      setResolvingTicket(false);
    }
  };

  const handleCreateTicket = async () => {
    const trimmedContent = createForm.content.trim();
    const finalSubject = createForm.subject === 'Other'
      ? (createForm.customSubject || '').trim()
      : createForm.subject.trim();
    if (!trimmedContent) {
      error('Please enter a ticket description before creating it');
      return;
    }

    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...createForm,
          subject: finalSubject || 'New Ticket',
          content: trimmedContent
        })
      });
      if (!res.ok) throw new Error('Create failed');
      const data = await res.json();
      localTicketActionsRef.current.created.add(String(data.id));
      const newTicket = {
        id: data.id,
        ...createForm,
        subject: finalSubject || 'New Ticket',
        content: trimmedContent,
        status: createForm.status || 'Open',
        created_at: new Date().toISOString(),
        escalated: false
      };
      setTickets((prev) => [newTicket, ...prev]);
      success(`Created ticket #${data.id}`);
      ticketCreationAudio.currentTime = 0;
      ticketCreationAudio.play().catch(() => {
        // Ignore autoplay restrictions; notification still shows.
      });
      setShowCreateModal(false);
      setCreateForm({
        subject: '',
        customSubject: '',
        content: '',
        customer_name: '',
        customer_phone: '',
        assignee: '',
        priority: 'Normal',
        status: 'Open'
      });
    } catch (err) {
      console.error(err);
      error('Failed to create ticket');
    }
  };

  const statusFilters = [
    { value: 'all', label: 'All tickets' },
    { value: 'open', label: 'Open' },
    { value: 'closed', label: 'Closed' },
    { value: 'escalated', label: 'Escalated' }
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-white">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-6 lg:p-8">
          <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-700">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                Live support queue
              </div>
              <h1 className="text-2xl font-semibold text-gray-900 sm:text-3xl dark:text-white">Tickets</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">Track incoming support requests, escalate critical issues, and keep every customer conversation moving.</p>
            </div>
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400"
            >
              Create ticket
            </button>
          </div>

          <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              icon={(
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M6 6.75A2.75 2.75 0 0 1 8.75 4h6.5A2.75 2.75 0 0 1 18 6.75v10.5A2.75 2.75 0 0 1 15.25 20h-6.5A2.75 2.75 0 0 1 6 17.25V6.75Z" stroke="currentColor" strokeWidth="1.6" />
                  <path d="M9 8.5h6M9 12h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              )}
              label="All tickets"
              value={summary.total}
              change={null}
            />
            <MetricCard
              icon={(
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 4v16M4 12h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              )}
              label="Open"
              value={summary.open}
              change={null}
            />
            <MetricCard
              icon={(
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M5 16 12 8l7 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
              label="Escalated"
              value={summary.escalated}
              change={null}
            />
            <MetricCard
              icon={(
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M5 7h14M5 12h8M5 17h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              )}
              label="Closed"
              value={summary.closed}
              change={null}
            />
          </div>

          <section className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap gap-2">
                {statusFilters.map((filter) => {
                  const isActive = statusFilter === filter.value;
                  return (
                    <button
                      key={filter.value}
                      type="button"
                      onClick={() => setStatusFilter(filter.value)}
                      className={`rounded-full px-3.5 py-2 text-sm font-semibold transition ${isActive ? 'bg-slate-900 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >
                      {filter.label}
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <label className="relative block">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">⌕</span>
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search tickets..."
                    className="w-full rounded-2xl border border-gray-200 bg-gray-50 py-3 pl-11 pr-4 text-sm text-slate-700 outline-none transition focus:border-emerald-400 focus:bg-white sm:w-72"
                  />
                </label>
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-emerald-400 focus:bg-white"
                >
                  <option value="all">All statuses</option>
                  <option value="open">Open</option>
                  <option value="closed">Closed</option>
                  <option value="escalated">Escalated</option>
                </select>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              {loading ? (
                <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-4 py-10 text-center text-sm text-gray-600">Loading tickets…</div>
              ) : filteredTickets.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-4 py-10 text-center text-sm text-gray-600">No tickets match the current filters.</div>
              ) : (
                filteredTickets.map((ticket) => (
                  <TicketCard key={ticket.id} ticket={ticket} onEscalate={handleEscalate} onDelete={handleDelete} onOpenResolveModal={openResolveModal} />
                ))
              )}
            </div>
          </section>
        </main>
      </div>

      {showResolveModal && selectedTicket ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 px-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-3xl border border-emerald-100 bg-white p-6 shadow-[0_20px_60px_rgba(16,185,129,0.16)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Resolve Ticket</h2>
                <p className="mt-1 text-sm text-slate-500">Are you sure this issue has been completely resolved?</p>
              </div>
              <button type="button" onClick={closeResolveModal} className="rounded-full bg-rose-50 px-3 py-2 text-sm text-rose-500 hover:bg-rose-100">✕</button>
            </div>

            <div className="mt-6 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Resolution Notes</label>
                <textarea
                  rows="4"
                  value={resolveForm.resolutionNotes}
                  onChange={(event) => setResolveForm((prev) => ({ ...prev, resolutionNotes: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-emerald-400 focus:bg-white"
                  placeholder="Describe the resolution in detail"
                />
                <p className="mt-1 text-xs text-slate-500">Minimum 10 characters.</p>
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Resolution Category</label>
                <select
                  value={resolveForm.resolutionCategory}
                  onChange={(event) => setResolveForm((prev) => ({ ...prev, resolutionCategory: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-emerald-400 focus:bg-white"
                >
                  <option value="">Select a category</option>
                  {RESOLUTION_CATEGORY_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={resolveForm.notifyCustomer}
                  onChange={(event) => setResolveForm((prev) => ({ ...prev, notifyCustomer: event.target.checked }))}
                  className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                Notify customer that their issue has been resolved
              </label>
              {resolveError ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{resolveError}</div> : null}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={closeResolveModal} className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">Cancel</button>
              <button
                type="button"
                onClick={handleResolveTicket}
                disabled={resolvingTicket || resolveForm.resolutionNotes.trim().length < 10 || !resolveForm.resolutionCategory}
                className="rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-300"
              >
                {resolvingTicket ? 'Resolving...' : 'Resolve Ticket'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showCreateModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 px-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-3xl border border-emerald-100 bg-white p-6 shadow-[0_20px_60px_rgba(16,185,129,0.16)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Create Ticket</h2>
                <p className="mt-1 text-sm text-slate-500">Add a new support request directly from the dashboard.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="rounded-full bg-rose-50 px-3 py-2 text-sm text-rose-500 hover:bg-rose-100"
              >
                ✕
              </button>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <select
                  value={createForm.subject}
                  onChange={(event) => {
                    const nextSubject = event.target.value;
                    setCreateForm((prev) => ({
                      ...prev,
                      subject: nextSubject,
                      customSubject: nextSubject === 'Other' ? prev.customSubject : ''
                    }));
                  }}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none ring-0 transition focus:border-emerald-400 focus:bg-white"
                >
                  <option value="">Select issue type</option>
                  <option value="Cold food">Cold food</option>
                  <option value="Late delivery">Late delivery</option>
                  <option value="Missing item">Missing item</option>
                  <option value="Wrong order">Wrong order</option>
                  <option value="Damaged packaging">Damaged packaging</option>
                  <option value="Poor quality">Poor quality</option>
                  <option value="Billing issue">Billing issue</option>
                  <option value="Refund request">Refund request</option>
                  <option value="Order cancellation">Order cancellation</option>
                  <option value="Delivery driver complaint">Delivery driver complaint</option>
                  <option value="App or website issue">App or website issue</option>
                  <option value="Customer support complaint">Customer support complaint</option>
                  <option value="Food allergy concern">Food allergy concern</option>
                  <option value="Incorrect preparation">Incorrect preparation</option>
                  <option value="Delayed response">Delayed response</option>
                  <option value="Other">Other</option>
                </select>
                {createForm.subject === 'Other' ? (
                  <input
                    value={createForm.customSubject || ''}
                    onChange={(event) => setCreateForm((prev) => ({ ...prev, customSubject: event.target.value }))}
                    placeholder="Please specify the issue"
                    className="mt-3 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none ring-0 transition focus:border-emerald-400 focus:bg-white"
                  />
                ) : null}
              </div>
              <input
                value={createForm.customer_name}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, customer_name: event.target.value }))}
                placeholder="Customer name"
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none ring-0 transition focus:border-emerald-400 focus:bg-white"
              />
              <input
                value={createForm.customer_phone}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, customer_phone: event.target.value }))}
                placeholder="Customer phone"
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none ring-0 transition focus:border-emerald-400 focus:bg-white"
              />
              <input
                value={createForm.assignee}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, assignee: event.target.value }))}
                placeholder="Assignee"
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none ring-0 transition focus:border-emerald-400 focus:bg-white"
              />
              <select
                value={createForm.priority}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, priority: event.target.value }))}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none ring-0 transition focus:border-emerald-400 focus:bg-white"
              >
                <option value="Low">Low</option>
                <option value="Normal">Normal</option>
                <option value="High">High</option>
                <option value="Urgent">Urgent</option>
              </select>
              <select
                value={createForm.status}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, status: event.target.value }))}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none ring-0 transition focus:border-emerald-400 focus:bg-white"
              >
                <option value="Open">Open</option>
                <option value="Closed">Closed</option>
                <option value="Escalated">Escalated</option>
              </select>
              <textarea
                value={createForm.content}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, content: event.target.value }))}
                placeholder="Describe the issue"
                rows="5"
                className="md:col-span-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none ring-0 transition focus:border-emerald-400 focus:bg-white"
              />
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateTicket}
                className="rounded-2xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400"
              >
                Create Ticket
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default TicketsPage;