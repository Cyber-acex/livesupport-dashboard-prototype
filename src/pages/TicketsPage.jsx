import { useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import Sidebar from '../components/Sidebar';
import TopBar from '../components/TopBar';
import { useNotification } from '../contexts/NotificationContext';

const socket = io();

function TicketCard({ ticket, onEscalate, onDelete }) {
  const status = ticket.status || 'Open';
  const assigneeText = ticket.assignee ? `Assigned to: ${ticket.assignee}` : 'Unassigned';
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
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-lg shadow-black/10">
      {ticket.escalated ? (
        <div className="mb-3 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-center text-sm font-semibold text-rose-200">
          ESCALATED
        </div>
      ) : null}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-lg font-semibold text-white">Ticket #{ticket.id}</h4>
            <span className="rounded-full bg-indigo-500/20 px-2.5 py-1 text-xs font-semibold text-indigo-200">{status}</span>
            <span className="rounded-full bg-sky-500/20 px-2.5 py-1 text-xs font-semibold text-sky-200">{assigneeText}</span>
          </div>
          <div className="text-sm text-white/70">{new Date(ticket.created_at).toLocaleString()}</div>
          <pre className="whitespace-pre-wrap break-words text-sm leading-6 text-white/80">{ticket.content}</pre>
          {imageAttachments.length > 0 ? (
            <div className="flex flex-wrap gap-3 pt-2">
              {imageAttachments.map((att) => (
                <img
                  key={att.filename}
                  src={`/uploads/${att.filename}`}
                  alt={att.originalname}
                  className="h-24 w-auto rounded-xl border border-white/10 object-cover"
                />
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2 lg:flex-col">
          <button
            type="button"
            onClick={() => onEscalate(ticket)}
            disabled={ticket.escalated}
            className={`rounded-xl px-3 py-2 text-sm font-semibold ${ticket.escalated ? 'cursor-not-allowed bg-rose-900/60 text-rose-100' : 'bg-rose-500/90 text-white hover:bg-rose-500'}`}
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
            className="rounded-xl bg-sky-500/90 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-500"
          >
            Print
          </button>
          <button
            type="button"
            onClick={() => onDelete(ticket.id)}
            className="rounded-xl bg-red-600/90 px-3 py-2 text-sm font-semibold text-white hover:bg-red-600"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
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

    return () => {
      socket.off('ticketCreated');
      socket.off('ticketDeleted');
      socket.off('ticketEscalated');
    };
  }, [success]);

  const filteredTickets = useMemo(() => {
    const term = query.toLowerCase();
    return tickets.filter((ticket) => {
      const matchesStatus = statusFilter === 'all' || (ticket.status || 'Open').toLowerCase() === statusFilter;
      const matchesSearch = !term || [ticket.id, ticket.content, ticket.subject, ticket.customer_name, ticket.assignee].filter(Boolean).join(' ').toLowerCase().includes(term);
      return matchesStatus && matchesSearch;
    });
  }, [tickets, query, statusFilter]);

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

  return (
    <div className="flex min-h-dvh overflow-hidden bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-white">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-3 sm:p-5 lg:p-7">
          <section className="rounded-3xl border border-white/10 bg-slate-950/40 p-4 shadow-2xl shadow-black/20 sm:p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="space-y-3">
                  <h1 className="text-2xl font-semibold text-white">Tickets</h1>
                  <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                    <input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Search tickets, IDs, content or assignee..."
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none sm:w-80"
                    />
                    <select
                      value={statusFilter}
                      onChange={(event) => setStatusFilter(event.target.value)}
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none"
                    >
                      <option value="all">All statuses</option>
                      <option value="open">Open</option>
                      <option value="closed">Closed</option>
                      <option value="escalated">Escalated</option>
                    </select>
                  </div>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(true)}
                    className="w-full rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400 sm:w-auto"
                  >
                    Create Ticket
                  </button>
                  <div className="text-center text-sm text-white/70 sm:text-left">Showing {filteredTickets.length} tickets</div>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {loading ? (
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-center text-white/70">Loading...</div>
                ) : filteredTickets.length === 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-center text-white/70">No tickets yet.</div>
                ) : (
                  filteredTickets.map((ticket) => (
                    <TicketCard key={ticket.id} ticket={ticket} onEscalate={handleEscalate} onDelete={handleDelete} />
                  ))
                )}
              </div>
            </section>
        </main>
      </div>

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
