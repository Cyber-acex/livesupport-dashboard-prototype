import { useEffect, useMemo, useState } from 'react';
import Sidebar from '../components/Sidebar';
import TopBar from '../components/TopBar';
import { useNotification } from '../contexts/NotificationContext';
import { normalizeRole } from '../utils/rolePermissions';

const STATUS_TABS = ['pending', 'approved', 'rejected', 'needs_more_information', 'completed'];

function formatMoney(amount) {
  return `$${Number(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function RefundsPage() {
  const [refunds, setRefunds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
  const [selectedRefund, setSelectedRefund] = useState(null);
  const [managerNote, setManagerNote] = useState('');
  const [decision, setDecision] = useState('approve');
  const [currentUser, setCurrentUser] = useState(null);
  const { success, error } = useNotification();

  const loadRefunds = async () => {
    try {
      const res = await fetch('/api/refunds/admin', { credentials: 'same-origin' });
      if (!res.ok) {
        if (res.status === 403) throw new Error('You do not have permission to view refunds. Manager or admin access is required.');
        if (res.status === 401) throw new Error('Please log in to view refunds.');
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await res.json();
          throw new Error(data?.error || `Server error: ${res.status}`);
        } else {
          throw new Error(`Server error: ${res.status} ${res.statusText}`);
        }
      }
      const data = await res.json();
      setRefunds(Array.isArray(data) ? data : []);
    } catch (err) {
      error(err.message || 'Unable to load refunds');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRefunds();
    void (async () => {
      try {
        const res = await fetch('/api/user', { credentials: 'same-origin' });
        const data = await res.json();
        if (res.ok) setCurrentUser(data);
      } catch (err) {
        console.error(err);
      }
    })();
  }, []);

  const filteredRefunds = useMemo(() => {
    return refunds.filter((refund) => refund.status === activeTab || (activeTab === 'pending' && !refund.status));
  }, [refunds, activeTab]);

  const canManageRefunds = currentUser && ['admin', 'manager'].includes(normalizeRole(currentUser.role));

  const actOnRefund = async (refundId, nextStatus) => {
    try {
      const res = await fetch(`/api/refunds/${refundId}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ status: nextStatus, managerNotes: managerNote })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Unable to update refund');
      success(data?.message || 'Refund updated');
      setSelectedRefund(null);
      setManagerNote('');
      await loadRefunds();
    } catch (err) {
      error(err.message || 'Unable to update refund');
    }
  };

  return (
    <div className="flex min-h-dvh bg-gray-50 dark:bg-slate-950">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Refunds</h1>
              <p className="mt-1 text-sm text-gray-600 dark:text-slate-400">Review refund requests, approve or reject them, and keep a clear audit trail.</p>
            </div>
            {!canManageRefunds ? (
              <div className="rounded-full border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">Manager or admin access required</div>
            ) : null}
          </div>

          <div className="mb-6 flex flex-wrap gap-2">
            {STATUS_TABS.map((status) => (
              <button key={status} type="button" onClick={() => setActiveTab(status)} className={`rounded-full px-3 py-2 text-sm font-medium ${activeTab === status ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 shadow-sm dark:bg-slate-900 dark:text-slate-300'}`}>
                {status.replace(/_/g, ' ')}
              </button>
            ))}
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            {loading ? (
              <div className="py-8 text-center text-sm text-slate-500">Loading refunds…</div>
            ) : filteredRefunds.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-500">No refunds in this state.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500 dark:bg-slate-800 dark:text-slate-400">
                    <tr>
                      <th className="px-3 py-3">Refund ID</th>
                      <th className="px-3 py-3">Order</th>
                      <th className="px-3 py-3">Customer</th>
                      <th className="px-3 py-3">Requested by</th>
                      <th className="px-3 py-3">Amount</th>
                      <th className="px-3 py-3">Status</th>
                      <th className="px-3 py-3">Requested at</th>
                      <th className="px-3 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-slate-800">
                    {filteredRefunds.map((refund) => (
                      <tr key={refund.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/60">
                        <td className="px-3 py-3 font-semibold text-gray-900 dark:text-white">{refund.refundNumber || `RF-${refund.id}`}</td>
                        <td className="px-3 py-3">{refund.orderId || '—'}</td>
                        <td className="px-3 py-3">{refund.customerName || refund.customer || '—'}</td>
                        <td className="px-3 py-3">{refund.requestedBy || '—'}</td>
                        <td className="px-3 py-3">{formatMoney(refund.refundAmount || refund.amount || 0)}</td>
                        <td className="px-3 py-3 capitalize">{refund.status || 'pending'}</td>
                        <td className="px-3 py-3">{formatDate(refund.requestedAt || refund.createdAt)}</td>
                        <td className="px-3 py-3">
                          <button type="button" onClick={() => setSelectedRefund(refund)} className="rounded-lg border border-gray-200 px-2 py-1 text-xs font-semibold text-gray-700 dark:border-slate-700 dark:text-slate-200">Review</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>
      </div>

      {selectedRefund ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-2xl rounded-[28px] bg-white p-6 shadow-[0_22px_60px_rgba(15,23,42,0.18)] dark:bg-slate-900 dark:text-slate-100">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold">Review refund request</h2>
                <p className="text-sm text-slate-500">Approve, reject, or request more information.</p>
              </div>
              <button type="button" onClick={() => setSelectedRefund(null)} className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">Close</button>
            </div>

            <div className="space-y-4 text-sm">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs uppercase tracking-wide text-slate-500">Refund ID</div>
                  <div className="mt-1 font-semibold">{selectedRefund.refundNumber || `RF-${selectedRefund.id}`}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs uppercase tracking-wide text-slate-500">Order</div>
                  <div className="mt-1 font-semibold">{selectedRefund.orderId || '—'}</div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs uppercase tracking-wide text-slate-500">Reason</div>
                <div className="mt-2">{selectedRefund.refundReason || 'No reason provided'}</div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs uppercase tracking-wide text-slate-500">Customer</div>
                  <div className="mt-1 font-semibold">{selectedRefund.customerName || selectedRefund.customer || '—'}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs uppercase tracking-wide text-slate-500">Requested by</div>
                  <div className="mt-1 font-semibold">{selectedRefund.requestedBy || '—'}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs uppercase tracking-wide text-slate-500">Requested amount</div>
                  <div className="mt-1 font-semibold">{formatMoney(selectedRefund.refundAmount || selectedRefund.amount || 0)}</div>
                </div>
              </div>

              <label className="block text-sm">
                Decision
                <select value={decision} onChange={(e) => setDecision(e.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none dark:border-slate-700 dark:bg-slate-950">
                  <option value="approve">Approve</option>
                  <option value="reject">Reject</option>
                  <option value="needs_more_information">Request More Information</option>
                </select>
              </label>

              <label className="block text-sm">
                Manager notes
                <textarea value={managerNote} onChange={(e) => setManagerNote(e.target.value)} rows="4" className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none dark:border-slate-700 dark:bg-slate-950" placeholder="Add notes for the approval decision" />
              </label>

              <div className="flex flex-wrap gap-3 pt-2">
                <button type="button" onClick={() => actOnRefund(selectedRefund.id, decision)} className="rounded-2xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white hover:bg-brand-700">Submit decision</button>
                <button type="button" onClick={() => setSelectedRefund(null)} className="rounded-2xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default RefundsPage;
