import { useEffect, useMemo, useState } from 'react';
import Sidebar from '../components/Sidebar';
import TopBar from '../components/TopBar';
import StatusBadge from '../components/StatusBadge';
import { useNotification } from '../contexts/NotificationContext';

const FILTER_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'expired', label: 'Expired' },
  { value: 'disabled', label: 'Disabled' },
  { value: 'used', label: 'Fully Used' }
];

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

function VouchersPage() {
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [form, setForm] = useState({ type: 'percentage', value: '', minimumOrder: '', maximumDiscount: '', usageLimit: '', expiresAt: '', isActive: true });
  const [draftCode, setDraftCode] = useState('');
  const [stats, setStats] = useState({ total: 0, active: 0, expired: 0, disabled: 0, redemptions: 0, mostUsed: null, totalDiscounts: 0 });
  const { success, error } = useNotification();

  const loadVouchers = async () => {
    try {
      const res = await fetch('/api/vouchers', { credentials: 'same-origin' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Unable to load vouchers');
      setVouchers(Array.isArray(data?.vouchers) ? data.vouchers : []);
      setStats(data?.stats || { total: 0, active: 0, expired: 0, disabled: 0, redemptions: 0, mostUsed: null, totalDiscounts: 0 });
    } catch (e) {
      error(e.message || 'Unable to load vouchers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadVouchers(); }, []);

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return vouchers.filter((voucher) => {
      const matchesText = !term || [voucher.code, voucher.type, voucher.status].join(' ').toLowerCase().includes(term);
      const matchesFilter = filter === 'all' || voucher.status?.toLowerCase() === filter || (filter === 'used' && voucher.status?.toLowerCase() === 'fully used');
      return matchesText && matchesFilter;
    });
  }, [vouchers, search, filter]);

  const createVoucher = async (event) => {
    event.preventDefault();
    try {
      const res = await fetch('/api/vouchers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          type: form.type,
          value: form.value,
          minimumOrder: form.minimumOrder,
          maximumDiscount: form.maximumDiscount,
          usageLimit: form.usageLimit,
          expiresAt: form.expiresAt,
          isActive: form.isActive
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Unable to create voucher');
      setDraftCode(data?.voucher?.code || '');
      setForm({ type: 'percentage', value: '', minimumOrder: '', maximumDiscount: '', usageLimit: '', expiresAt: '', isActive: true });
      success(data?.message || 'Voucher created');
      await loadVouchers();
    } catch (e) {
      error(e.message || 'Unable to create voucher');
    }
  };

  const toggleStatus = async (voucher) => {
    try {
      const res = await fetch(`/api/vouchers/${voucher.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ isActive: !Boolean(voucher.is_active) })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Unable to update voucher');
      success(data?.message || 'Voucher updated');
      await loadVouchers();
    } catch (e) {
      error(e.message || 'Unable to update voucher');
    }
  };

  const deleteVoucher = async (voucher) => {
    if (!window.confirm(`Delete voucher ${voucher.code}?`)) return;
    try {
      const res = await fetch(`/api/vouchers/${voucher.id}`, { method: 'DELETE', credentials: 'same-origin' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Unable to delete voucher');
      success(data?.message || 'Voucher deleted');
      await loadVouchers();
    } catch (e) {
      error(e.message || 'Unable to delete voucher');
    }
  };

  return (
    <div className="flex min-h-dvh bg-gray-50 dark:bg-slate-950">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="mb-8 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Vouchers</h1>
              <p className="mt-1 text-sm text-gray-600 dark:text-slate-400">Create, manage, and monitor promo codes securely from the dashboard.</p>
            </div>
          </div>

          <div className="mb-6 grid gap-4 lg:grid-cols-3">
            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="text-sm text-gray-500 dark:text-slate-400">Total vouchers</div>
              <div className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">{stats.total}</div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="text-sm text-gray-500 dark:text-slate-400">Active vouchers</div>
              <div className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">{stats.active}</div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="text-sm text-gray-500 dark:text-slate-400">Redemptions</div>
              <div className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">{stats.redemptions}</div>
            </div>
          </div>

          <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Create Voucher</h2>
              {draftCode ? <div className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-700">Created: {draftCode}</div> : null}
            </div>
            <form onSubmit={createVoucher} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <label className="text-sm font-medium text-gray-700 dark:text-slate-300">
                Type
                <select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })} className="mt-2 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
                  <option value="percentage">Percentage Discount</option>
                  <option value="fixed">Fixed Amount Discount</option>
                  <option value="delivery">Free Delivery</option>
                </select>
              </label>
              <label className="text-sm font-medium text-gray-700 dark:text-slate-300">
                Value
                <input type="number" min="0" step="0.01" value={form.value} onChange={(event) => setForm({ ...form, value: event.target.value })} className="mt-2 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" required />
              </label>
              <label className="text-sm font-medium text-gray-700 dark:text-slate-300">
                Minimum Order
                <input type="number" min="0" step="0.01" value={form.minimumOrder} onChange={(event) => setForm({ ...form, minimumOrder: event.target.value })} className="mt-2 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
              </label>
              <label className="text-sm font-medium text-gray-700 dark:text-slate-300">
                Usage Limit
                <input type="number" min="0" step="1" value={form.usageLimit} onChange={(event) => setForm({ ...form, usageLimit: event.target.value })} className="mt-2 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
              </label>
              <label className="text-sm font-medium text-gray-700 dark:text-slate-300">
                Max Discount
                <input type="number" min="0" step="0.01" value={form.maximumDiscount} onChange={(event) => setForm({ ...form, maximumDiscount: event.target.value })} className="mt-2 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
              </label>
              <label className="text-sm font-medium text-gray-700 dark:text-slate-300">
                Expires At
                <input type="date" value={form.expiresAt} onChange={(event) => setForm({ ...form, expiresAt: event.target.value })} className="mt-2 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
              </label>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-slate-300">
                <input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} />
                Active
              </label>
              <button type="submit" className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">Create Voucher</button>
            </form>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex gap-2">
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search vouchers" className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
                <select value={filter} onChange={(event) => setFilter(event.target.value)} className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
                  {FILTER_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500 dark:bg-slate-800 dark:text-slate-400">
                  <tr>
                    <th className="px-3 py-3">Voucher Code</th>
                    <th className="px-3 py-3">Discount Type</th>
                    <th className="px-3 py-3">Discount Value</th>
                    <th className="px-3 py-3">Usage Count</th>
                    <th className="px-3 py-3">Usage Limit</th>
                    <th className="px-3 py-3">Expiry Date</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3">Date Created</th>
                    <th className="px-3 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-slate-800">
                  {loading ? (
                    <tr><td colSpan="9" className="px-3 py-6 text-center text-gray-500">Loading…</td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan="9" className="px-3 py-6 text-center text-gray-500">No vouchers found.</td></tr>
                  ) : filtered.map((voucher) => (
                    <tr key={voucher.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/60">
                      <td className="px-3 py-3 font-semibold text-gray-900 dark:text-white">{voucher.code}</td>
                      <td className="px-3 py-3 capitalize">{voucher.type || 'percentage'}</td>
                      <td className="px-3 py-3">{voucher.type === 'percentage' ? `${Number(voucher.value || 0).toFixed(2)}%` : voucher.type === 'fixed' ? `$${Number(voucher.value || 0).toFixed(2)}` : 'Free Delivery'}</td>
                      <td className="px-3 py-3">{voucher.used_count || 0}</td>
                      <td className="px-3 py-3">{voucher.usage_limit || '∞'}</td>
                      <td className="px-3 py-3">{formatDate(voucher.expires_at)}</td>
                      <td className="px-3 py-3"><StatusBadge status={voucher.status} type={voucher.status === 'Active' ? 'success' : voucher.status === 'Disabled' ? 'error' : voucher.status === 'Expired' ? 'warning' : 'pending'} /></td>
                      <td className="px-3 py-3">{formatDate(voucher.created_at)}</td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button type="button" onClick={() => toggleStatus(voucher)} className="rounded-lg border border-gray-200 px-2 py-1 text-xs font-semibold text-gray-700 dark:border-slate-700 dark:text-slate-200">{voucher.is_active ? 'Disable' : 'Enable'}</button>
                          <button type="button" onClick={() => deleteVoucher(voucher)} className="rounded-lg border border-red-200 px-2 py-1 text-xs font-semibold text-red-600">Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default VouchersPage;
