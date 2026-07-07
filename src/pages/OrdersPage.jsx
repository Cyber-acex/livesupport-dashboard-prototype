import { useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import Sidebar from '../components/Sidebar';
import TopBar from '../components/TopBar';
import DataTable from '../components/DataTable';
import {
  fetchOrders,
  createOrder,
  updateOrder,
  fetchMenuItems,
  saveMenuItem,
  deleteMenuItem,
  reduceMenuItemStock,
  fetchTables,
  updateTableState
} from '../services/ordersService';

const socket = io();
const STATUS_OPTIONS = ['pending', 'processing', 'completed', 'cancelled'];
const DATE_FILTERS = [
  { value: '', label: 'All Dates' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' }
];
const SORT_OPTIONS = [
  { value: 'date_desc', label: 'Newest' },
  { value: 'date_asc', label: 'Oldest' },
  { value: 'amount_desc', label: 'Amount (High → Low)' },
  { value: 'amount_asc', label: 'Amount (Low → High)' }
];

function formatOrderDate(value) {
  if (!value) return 'Unknown';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
}

function formatMoney(amount) {
  return `$${Number(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [tables, setTables] = useState([]);
  const [filterText, setFilterText] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [sortBy, setSortBy] = useState('date_desc');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [notification, setNotification] = useState('');
  const [activeTab, setActiveTab] = useState('orders');
  const [menuSection, setMenuSection] = useState('items');
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [menuItemModalOpen, setMenuItemModalOpen] = useState(false);
  const [editingMenuItem, setEditingMenuItem] = useState(null);
  const [orderDraft, setOrderDraft] = useState({ customerName: '', tableNumber: '', status: 'pending', items: [{ menuItemId: '', quantity: 1 }] });
  const [viewOrder, setViewOrder] = useState(null);
  const [menuSearch, setMenuSearch] = useState('');
  const [menuCategory, setMenuCategory] = useState('All');
  const [menuTag, setMenuTag] = useState('All');
  const [menuSort, setMenuSort] = useState('score_desc');
  const [menuModeActive, setMenuModeActive] = useState(false);

  useEffect(() => {
    loadOrders();
    loadMenuItems();
    loadTables();

    socket.on('order-created', (payload) => {
      setOrders((prev) => [{
        id: payload.id,
        customerName: payload.customerName || 'Customer',
        product: payload.product || '',
        amount: Number(payload.amount || 0),
        status: payload.status || 'pending',
        date: payload.date || new Date().toISOString()
      }, ...prev]);
      setNotification(`New order ${payload.id} received`);
    });

    socket.on('order-updated', (payload) => {
      setOrders((prev) => prev.map((order) => order.id === payload.orderId ? { ...order, status: payload.status || order.status } : order));
    });

    socket.on('delivery-update', (payload) => {
      setOrders((prev) => prev.map((order) => order.id === payload.order_id ? { ...order, status: payload.status || order.status } : order));
    });

    return () => {
      socket.off('order-created');
      socket.off('order-updated');
      socket.off('delivery-update');
    };
  }, []);

  const loadOrders = async () => {
    try {
      const data = await fetchOrders();
      setOrders(data.map((order) => ({
        id: order.id,
        customerName: order.customerName,
        product: order.product,
        amount: order.amount,
        status: order.status,
        date: order.date
      })));
    } catch (error) {
      console.error('Failed to load orders', error);
      setNotification('Unable to load orders');
    }
  };

  const loadMenuItems = async () => {
    try {
      const data = await fetchMenuItems();
      setMenuItems(data);
    } catch (error) {
      console.error('Failed to load menu items', error);
      setNotification('Unable to load menu items');
    }
  };

  const loadTables = async () => {
    try {
      const data = await fetchTables();
      setTables(data);
    } catch (error) {
      console.error('Failed to load tables', error);
      setNotification('Unable to load tables');
    }
  };

  const filteredOrders = useMemo(() => {
    const term = filterText.toLowerCase();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    return orders.filter((order) => {
      const matchesSearch = !term || [order.id, order.customerName, order.product].filter(Boolean).join(' ').toLowerCase().includes(term);
      const matchesStatus = !statusFilter || order.status === statusFilter;
      let matchesDate = true;
      if (dateFilter && order.date) {
        const orderDate = new Date(order.date);
        if (dateFilter === 'today') {
          matchesDate = orderDate.toDateString() === today.toDateString();
        } else if (dateFilter === 'week') {
          matchesDate = orderDate >= weekAgo && orderDate <= today;
        } else if (dateFilter === 'month') {
          matchesDate = orderDate.getMonth() === today.getMonth() && orderDate.getFullYear() === today.getFullYear();
        }
      }
      return matchesSearch && matchesStatus && matchesDate;
    }).sort((a, b) => {
      if (sortBy === 'date_asc') return new Date(a.date) - new Date(b.date);
      if (sortBy === 'date_desc') return new Date(b.date) - new Date(a.date);
      if (sortBy === 'amount_asc') return Number(a.amount) - Number(b.amount);
      if (sortBy === 'amount_desc') return Number(b.amount) - Number(a.amount);
      return 0;
    });
  }, [orders, filterText, statusFilter, dateFilter, sortBy]);

  const pageCount = Math.max(1, Math.ceil(filteredOrders.length / perPage));
  const paginatedOrders = filteredOrders.slice((page - 1) * perPage, page * perPage);

  const ordersRows = useMemo(() => paginatedOrders.map((order) => ([
    <div className="flex flex-col gap-1" key={`${order.id}-identity`}>
      <span className="font-semibold text-slate-900">{order.product || 'Order item'}</span>
      <span className="text-xs text-slate-500">{order.customerName || 'Customer'}</span>
    </div>,
    order.customerName,
    formatMoney(order.amount),
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${order.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : order.status === 'cancelled' ? 'bg-rose-100 text-rose-700' : order.status === 'processing' ? 'bg-sky-100 text-sky-700' : 'bg-amber-100 text-amber-700'}`}>{order.status}</span>,
    formatOrderDate(order.date),
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={() => openViewOrder(order)} className="rounded-2xl border border-slate-200 bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700">View</button>
      <button type="button" onClick={() => completeOrder(order.id)} disabled={order.status === 'completed'} className="rounded-2xl bg-sky-500 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-600 disabled:cursor-not-allowed disabled:bg-slate-300">Complete</button>
      <button type="button" onClick={() => cancelOrder(order.id)} disabled={order.status === 'cancelled'} className="rounded-2xl bg-rose-500 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-600 disabled:cursor-not-allowed disabled:bg-slate-300">Cancel</button>
    </div>
  ])), [paginatedOrders]);

  const menuCategories = useMemo(() => ['All', ...new Set(menuItems.map((item) => item.category || 'Uncategorized'))], [menuItems]);
  const menuTags = useMemo(() => ['All', ...new Set(menuItems.flatMap((item) => item.tags || []))], [menuItems]);

  const menuFiltered = useMemo(() => {
    const query = menuSearch.toLowerCase();
    return menuItems.filter((item) => {
      const matchesSearch = !query || [item.name, item.description, ...(item.tags || [])].filter(Boolean).join(' ').toLowerCase().includes(query);
      const matchesCategory = menuCategory === 'All' || item.category === menuCategory;
      const matchesTag = menuTag === 'All' || (item.tags || []).includes(menuTag);
      return matchesSearch && matchesCategory && matchesTag;
    }).sort((a, b) => {
      if (menuSort === 'price_asc') return a.price - b.price;
      if (menuSort === 'price_desc') return b.price - a.price;
      if (menuSort === 'stock_desc') return (b.stock || 0) - (a.stock || 0);
      const aFeatured = (a.tags || []).includes('Featured') ? 1 : 0;
      const bFeatured = (b.tags || []).includes('Featured') ? 1 : 0;
      if (aFeatured !== bFeatured) return bFeatured - aFeatured;
      return a.price - b.price;
    });
  }, [menuItems, menuSearch, menuCategory, menuTag, menuSort]);

  const menuStats = useMemo(() => ({
    total: menuItems.length,
    available: menuItems.filter((item) => item.available).length,
    featured: menuItems.filter((item) => (item.tags || []).includes('Featured')).length
  }), [menuItems]);

  const tableStats = useMemo(() => ({
    total: tables.length,
    vacant: tables.filter((table) => table.status === 'vacant').length,
    reserved: tables.filter((table) => table.status === 'reserved').length,
    occupied: tables.filter((table) => table.status === 'occupied').length
  }), [tables]);

  const showNotification = (message) => {
    setNotification(message);
    window.setTimeout(() => setNotification(''), 3000);
  };

  const openViewOrder = (order) => {
    setViewOrder(order);
    setViewModalOpen(true);
  };

  const completeOrder = async (orderId) => {
    try {
      await updateOrder(orderId, { status: 'completed' });
      setOrders((prev) => prev.map((order) => order.id === orderId ? { ...order, status: 'completed' } : order));
      showNotification(`Order ${orderId} marked completed.`);
    } catch (error) {
      console.error(error);
      showNotification('Unable to update order.');
    }
  };

  const cancelOrder = async (orderId) => {
    try {
      await updateOrder(orderId, { status: 'cancelled' });
      setOrders((prev) => prev.map((order) => order.id === orderId ? { ...order, status: 'cancelled' } : order));
      showNotification(`Order ${orderId} cancelled.`);
    } catch (error) {
      console.error(error);
      showNotification('Unable to cancel order.');
    }
  };

  const handleCreateOrder = async (event) => {
    event.preventDefault();
    const draft = { ...orderDraft };
    const items = draft.items.filter((item) => item.menuItemId);
    if (items.length === 0) {
      showNotification('Add at least one product.');
      return;
    }
    const productNames = items.map((item) => {
      const menu = menuItems.find((m) => m.id === item.menuItemId);
      return menu ? `${item.quantity}x ${menu.name}` : ''; 
    }).filter(Boolean).join(', ');
    const totalAmount = items.reduce((sum, item) => {
      const menu = menuItems.find((m) => m.id === item.menuItemId);
      return sum + (menu ? menu.price * item.quantity : 0);
    }, 0);

    try {
      await createOrder({
        customerName: draft.customerName,
        tableNumber: draft.tableNumber || null,
        product: productNames,
        menuItemId: items[0]?.menuItemId,
        quantity: items.reduce((sum, item) => sum + item.quantity, 0),
        amount: totalAmount,
        status: draft.status,
        items: items.map((item) => ({
          menuItemId: item.menuItemId,
          quantity: item.quantity,
          name: menuItems.find((m) => m.id === item.menuItemId)?.name || '' ,
          price: menuItems.find((m) => m.id === item.menuItemId)?.price || 0
        }))
      });
      setOrderDraft({ customerName: '', tableNumber: '', status: 'pending', items: [{ menuItemId: '', quantity: 1 }] });
      setOrderModalOpen(false);
      showNotification('Order created successfully!');
      loadOrders();
    } catch (error) {
      console.error(error);
      showNotification(error.message);
    }
  };

  const handleMenuItemSave = async (event) => {
    event.preventDefault();
    const form = event.target;
    const payload = {
      category: form.elements.menuItemCategory.value || 'Uncategorized',
      key: form.elements.menuItemId.value || form.elements.menuItemName.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
      name: form.elements.menuItemName.value.trim(),
      price: Number(form.elements.menuItemPrice.value) || 0,
      available: Number(form.elements.menuItemStock.value) || 0,
      image_url: null
    };
    try {
      await saveMenuItem(payload);
      await loadMenuItems();
      setMenuItemModalOpen(false);
      showNotification('Menu item saved.');
    } catch (error) {
      console.error(error);
      showNotification('Unable to save menu item.');
    }
  };

  const filteredMenuItems = menuFiltered;

  return (
    <div className="min-h-screen orders-page-light !bg-white !text-gray-900">
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar />
          <main className="flex-1 p-4 sm:p-6 lg:p-7">
            {notification ? (
              <div className="mb-4 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                {notification}
              </div>
            ) : null}

            <div className="mb-4 flex flex-wrap items-center gap-3 rounded-full bg-slate-100 p-2 shadow-sm">
              <button type="button" className={`rounded-full px-4 py-2 text-sm font-semibold transition ${activeTab === 'orders' ? 'bg-slate-900 text-white shadow-lg' : 'bg-transparent text-slate-700 hover:bg-slate-200'}`} onClick={() => setActiveTab('orders')}>
                Orders
              </button>
              <button type="button" className={`rounded-full px-4 py-2 text-sm font-semibold transition ${activeTab === 'menu' ? 'bg-slate-900 text-white shadow-lg' : 'bg-transparent text-slate-700 hover:bg-slate-200'}`} onClick={() => setActiveTab('menu')}>
                Menu
              </button>
              <button type="button" className={`rounded-full px-4 py-2 text-sm font-semibold transition ${activeTab === 'tables' ? 'bg-slate-900 text-white shadow-lg' : 'bg-transparent text-slate-700 hover:bg-slate-200'}`} onClick={() => setActiveTab('tables')}>
                Tables
              </button>
            </div>

            {activeTab === 'orders' ? (
              <section className="space-y-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.28em] text-sky-500">Orders</p>
                    <h1 className="mt-3 text-3xl font-semibold text-slate-900">Order management</h1>
                    <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">Manage current order flow, bulk actions, and real-time updates from the kitchen.</p>
                  </div>
                  <button type="button" onClick={() => setOrderModalOpen(true)} className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800">+ New Order</button>
                </div>

                <div className="grid gap-4 xl:grid-cols-[minmax(220px,1fr)_minmax(220px,1fr)]">
                  <div className="rounded-3xl bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.07)]">
                    <p className="text-sm uppercase tracking-[0.18em] text-slate-500">Total Orders</p>
                    <p className="mt-3 text-4xl font-bold text-slate-900">{orders.length}</p>
                    <p className="mt-2 text-sm text-slate-500">Orders loaded from backend.</p>
                  </div>
                  <div className="rounded-3xl bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.07)]">
                    <p className="text-sm uppercase tracking-[0.18em] text-slate-500">In Transit</p>
                    <p className="mt-3 text-4xl font-bold text-slate-900">{orders.filter((order) => ['processing', 'in transit', 'shipping', 'out for delivery', 'delivering'].includes(order.status)).length}</p>
                    <p className="mt-2 text-sm text-slate-500">Orders currently moving through the workflow.</p>
                  </div>
                </div>

                <div className="rounded-[28px] bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.07)]">
                  <div className="grid gap-4 lg:grid-cols-[repeat(4,minmax(0,1fr))]">
                    <input value={filterText} onChange={(e) => setFilterText(e.target.value)} placeholder="Search order ID or customer" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none" />
                    <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none">
                      <option value="">All Status</option>
                      {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}
                    </select>
                    <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none">
                      {DATE_FILTERS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                    <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none">
                      {SORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <button type="button" onClick={() => { setStatusFilter(''); setDateFilter(''); setFilterText(''); setSortBy('date_desc'); }} className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-200">Clear</button>
                      <button type="button" onClick={() => setSelectedIds(new Set())} className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-200">Clear selection</button>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-slate-500">Showing {filteredOrders.length} orders • Page {page} of {pageCount}</div>
                  </div>

                  <div className="mt-5 overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 text-left text-sm text-slate-700">
                      <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-4 py-3"><input type="checkbox" onChange={(e) => {
                            const next = new Set(selectedIds);
                            if (e.target.checked) paginatedOrders.forEach((order) => next.add(order.id));
                            else paginatedOrders.forEach((order) => next.delete(order.id));
                            setSelectedIds(next);
                          }} checked={paginatedOrders.length > 0 && paginatedOrders.every((order) => selectedIds.has(order.id))} /></th>
                          <th className="px-4 py-3">Order ID</th>
                          <th className="px-4 py-3">Customer</th>
                          <th className="px-4 py-3">Product</th>
                          <th className="px-4 py-3">Amount</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3">Date</th>
                          <th className="px-4 py-3">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 bg-white">
                        {paginatedOrders.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="px-4 py-6 text-center text-slate-500">No orders found.</td>
                          </tr>
                        ) : paginatedOrders.map((order) => (
                          <tr key={order.id} className="hover:bg-slate-50">
                            <td className="px-4 py-3"><input type="checkbox" checked={selectedIds.has(order.id)} onChange={(e) => {
                              const next = new Set(selectedIds);
                              if (e.target.checked) next.add(order.id); else next.delete(order.id);
                              setSelectedIds(next);
                            }} /></td>
                            <td className="px-4 py-3 font-semibold text-slate-900">{order.id}</td>
                            <td className="px-4 py-3">{order.customerName}</td>
                            <td className="px-4 py-3">{order.product}</td>
                            <td className="px-4 py-3">{formatMoney(order.amount)}</td>
                            <td className="px-4 py-3"> <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${order.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : order.status === 'cancelled' ? 'bg-rose-100 text-rose-700' : order.status === 'processing' ? 'bg-sky-100 text-sky-700' : 'bg-amber-100 text-amber-700'}`}>{order.status}</span></td>
                            <td className="px-4 py-3">{formatOrderDate(order.date)}</td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-2">
                                <button type="button" onClick={() => openViewOrder(order)} className="rounded-2xl border border-slate-200 bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700">View</button>
                                <button type="button" onClick={() => completeOrder(order.id)} disabled={order.status === 'completed'} className="rounded-2xl bg-sky-500 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-600 disabled:bg-slate-300">Complete</button>
                                <button type="button" onClick={() => cancelOrder(order.id)} disabled={order.status === 'cancelled'} className="rounded-2xl bg-rose-500 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-600 disabled:bg-slate-300">Cancel</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-5 flex flex-wrap items-center justify-between gap-4 text-sm text-slate-500">
                    <div>
                      <button type="button" onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100">Previous</button>
                      <button type="button" onClick={() => setPage(Math.min(pageCount, page + 1))} disabled={page === pageCount} className="ml-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100">Next</button>
                    </div>
                    <select value={perPage} onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none">
                      <option value={10}>10 / page</option>
                      <option value={25}>25 / page</option>
                      <option value={50}>50 / page</option>
                      <option value={100}>100 / page</option>
                    </select>
                  </div>
                </div>
              </section>
            ) : activeTab === 'menu' ? (
              <section className="space-y-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.28em] text-sky-500">Food menu</p>
                    <h1 className="mt-3 text-3xl font-semibold text-slate-900">Menu management</h1>
                    <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">Track inventory, edit items, and keep the kitchen aligned with live menu insights.</p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button type="button" onClick={() => setMenuItemModalOpen(true)} className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800">+ Add Item</button>
                    <button type="button" onClick={() => setMenuModeActive((prev) => !prev)} className={`rounded-2xl px-4 py-3 text-sm font-semibold ${menuModeActive ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>{menuModeActive ? 'Adaptive Mode On' : 'Adaptive Mode'}</button>
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-[minmax(220px,1fr)_minmax(220px,1fr)_minmax(220px,1fr)]">
                  <div className="rounded-3xl bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.07)]">
                    <p className="text-sm uppercase tracking-[0.18em] text-slate-500">Total Menu Items</p>
                    <p className="mt-3 text-4xl font-bold text-slate-900">{menuStats.total}</p>
                  </div>
                  <div className="rounded-3xl bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.07)]">
                    <p className="text-sm uppercase tracking-[0.18em] text-slate-500">Available Now</p>
                    <p className="mt-3 text-4xl font-bold text-slate-900">{menuStats.available}</p>
                  </div>
                  <div className="rounded-3xl bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.07)]">
                    <p className="text-sm uppercase tracking-[0.18em] text-slate-500">Featured Items</p>
                    <p className="mt-3 text-4xl font-bold text-slate-900">{menuStats.featured}</p>
                  </div>
                </div>

                <div className="rounded-[28px] bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.07)]">
                  <div className="grid gap-4 lg:grid-cols-[minmax(220px,1fr)_minmax(220px,1fr)_minmax(220px,1fr)]">
                    <input value={menuSearch} onChange={(e) => setMenuSearch(e.target.value)} placeholder="Search menu items" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none" />
                    <select value={menuCategory} onChange={(e) => setMenuCategory(e.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none">
                      {menuCategories.map((category) => <option key={category} value={category}>{category}</option>)}
                    </select>
                    <select value={menuTag} onChange={(e) => setMenuTag(e.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none">
                      {menuTags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
                    </select>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <select value={menuSort} onChange={(e) => setMenuSort(e.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none">
                      <option value="score_desc">Recommended</option>
                      <option value="price_asc">Price Low → High</option>
                      <option value="price_desc">Price High → Low</option>
                      <option value="stock_desc">Stock</option>
                    </select>
                    <button type="button" onClick={() => showNotification('Menu intelligence refreshed')} className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-200">Refresh Insights</button>
                  </div>

                  <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {filteredMenuItems.map((item) => (
                      <div key={item.id} className="rounded-[22px] border border-slate-200 bg-slate-50 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.07)]">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <h3 className="text-lg font-semibold text-slate-900">{item.name}</h3>
                            <p className="text-sm text-slate-500">{item.category}{item.subtype ? ` · ${item.subtype}` : ''}</p>
                          </div>
                          <div className="rounded-2xl bg-white px-3 py-1 text-xs font-semibold text-slate-600">{item.available ? 'Available' : 'Out'}</div>
                        </div>
                        <div className="mt-4 grid gap-2 text-sm text-slate-600">
                          <div className="flex items-center justify-between"><span>Price</span><span>${item.price.toFixed(2)}</span></div>
                          <div className="flex items-center justify-between"><span>Stock</span><span>{item.stock}</span></div>
                          <div className="flex flex-wrap gap-2">{(item.tags || []).map((tag) => <span key={tag} className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{tag}</span>)}</div>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <button type="button" onClick={() => { setEditingMenuItem(item); setMenuItemModalOpen(true); }} className="rounded-2xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white">Edit</button>
                          <button type="button" onClick={() => reduceStock(item)} className="rounded-2xl bg-amber-500 px-3 py-2 text-xs font-semibold text-white">- Stock</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            ) : (
              <section className="space-y-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.28em] text-sky-500">Dining floor</p>
                    <h1 className="mt-3 text-3xl font-semibold text-slate-900">Table floor plan</h1>
                    <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">Manage reservations and occupancy with a real-time table status view.</p>
                  </div>
                  <button type="button" onClick={loadTables} className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800">Refresh Tables</button>
                </div>

                <div className="grid gap-4 xl:grid-cols-[1fr_260px]">
                  <div className="rounded-[28px] bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.07)]">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl bg-slate-50 p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Total tables</p>
                        <p className="mt-3 text-3xl font-bold text-slate-900">{tableStats.total}</p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Vacant</p>
                        <p className="mt-3 text-3xl font-bold text-slate-900">{tableStats.vacant}</p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Reserved</p>
                        <p className="mt-3 text-3xl font-bold text-slate-900">{tableStats.reserved}</p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Occupied</p>
                        <p className="mt-3 text-3xl font-bold text-slate-900">{tableStats.occupied}</p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[28px] bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.07)]">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 className="text-xl font-semibold text-slate-900">Table legend</h2>
                        <p className="text-sm text-slate-500">Tap a status card to move tables or reserve a booking.</p>
                      </div>
                    </div>
                    <div className="grid gap-3">
                      {tables.map((table) => (
                        <div key={table.number} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="font-semibold text-slate-900">{table.label || `Table ${table.number}`}</p>
                              <p className="text-sm text-slate-500">{table.status}</p>
                            </div>
                            <div className="flex gap-2">
                              <button type="button" onClick={() => handleTableAction(table.number, 'reserve')} className="rounded-2xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white">Reserve</button>
                              <button type="button" onClick={() => handleTableAction(table.number, 'book')} className="rounded-2xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700">Book</button>
                            </div>
                          </div>
                          <p className="mt-3 text-sm text-slate-500">{table.customerName ? `Customer: ${table.customerName}` : 'No current booking'}</p>
                          <p className="text-sm text-slate-500">{table.reservedUntil ? `Until ${new Date(table.reservedUntil).toLocaleString()}` : ''}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            )}
          </main>
        </div>
      </div>

      {orderModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-3xl rounded-[28px] bg-white p-6 shadow-[0_22px_60px_rgba(15,23,42,0.18)]">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-slate-900">New Order</h2>
                <p className="text-sm text-slate-500">Create a new order with products and quantities.</p>
              </div>
              <button type="button" onClick={() => setOrderModalOpen(false)} className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700">Close</button>
            </div>
            <form onSubmit={handleCreateOrder} className="grid gap-4">
              <div className="grid gap-4 lg:grid-cols-2">
                <label className="block text-sm text-slate-700">
                  Customer name
                  <input value={orderDraft.customerName} onChange={(e) => setOrderDraft((prev) => ({ ...prev, customerName: e.target.value }))} required className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none" />
                </label>
                <label className="block text-sm text-slate-700">
                  Table
                  <select value={orderDraft.tableNumber} onChange={(e) => setOrderDraft((prev) => ({ ...prev, tableNumber: e.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none">
                    <option value="">-- No table / Takeaway --</option>
                    {tables.map((table) => <option key={table.number} value={table.number}>{table.label || `Table ${table.number}`}</option>)}
                  </select>
                </label>
              </div>
              <div className="space-y-4">
                {orderDraft.items.map((item, index) => (
                  <div key={index} className="grid gap-4 lg:grid-cols-[1.5fr_0.7fr_0.8fr_0.5fr]">
                    <label className="block text-sm text-slate-700">
                      Product
                      <select value={item.menuItemId} onChange={(e) => {
                        const next = [...orderDraft.items];
                        next[index].menuItemId = e.target.value;
                        setOrderDraft((prev) => ({ ...prev, items: next }));
                      }} required className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none">
                        <option value="">-- Select a menu item --</option>
                        {menuItems.filter((menuItem) => menuItem.available).map((menuItem) => <option key={menuItem.id} value={menuItem.id}>{menuItem.name} - ${menuItem.price.toFixed(2)}</option>)}
                      </select>
                    </label>
                    <label className="block text-sm text-slate-700">
                      Quantity
                      <input type="number" min="1" value={item.quantity} onChange={(e) => {
                        const next = [...orderDraft.items];
                        next[index].quantity = Number(e.target.value) || 1;
                        setOrderDraft((prev) => ({ ...prev, items: next }));
                      }} required className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none" />
                    </label>
                    <div className="block text-sm text-slate-700">
                      <span className="mb-2 block">Item Amount</span>
                      <div className="mt-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                        {formatMoney(menuItems.find((menuItem) => menuItem.id === item.menuItemId)?.price * item.quantity || 0)}
                      </div>
                    </div>
                    <button type="button" onClick={() => {
                      if (orderDraft.items.length === 1) return;
                      const next = orderDraft.items.filter((_, idx) => idx !== index);
                      setOrderDraft((prev) => ({ ...prev, items: next }));
                    }} className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-200">Remove</button>
                  </div>
                ))}
              </div>
              <button type="button" onClick={() => setOrderDraft((prev) => ({ ...prev, items: [...prev.items, { menuItemId: '', quantity: 1 }] }))} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">+ Add another product</button>
              <div className="grid gap-4 lg:grid-cols-[1fr_0.8fr]">
                <label className="block text-sm text-slate-700">
                  Status
                  <select value={orderDraft.status} onChange={(e) => setOrderDraft((prev) => ({ ...prev, status: e.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none">
                    {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}
                  </select>
                </label>
                <div className="block text-sm text-slate-700">
                  <span className="mb-2 block">Total Amount</span>
                  <div className="mt-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">{formatMoney(orderDraft.items.reduce((sum, item) => {
                    const menu = menuItems.find((m) => m.id === item.menuItemId);
                    return sum + (menu ? menu.price * item.quantity : 0);
                  }, 0))}</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-3 pt-4">
                <button type="submit" className="rounded-2xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800">Create Order</button>
                <button type="button" onClick={() => setOrderModalOpen(false)} className="rounded-2xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {viewModalOpen && viewOrder ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-2xl rounded-[28px] bg-white p-6 shadow-[0_22px_60px_rgba(15,23,42,0.18)]">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-slate-900">Order Details</h2>
                <p className="text-sm text-slate-500">Update status or review the order metadata.</p>
              </div>
              <button type="button" onClick={() => setViewModalOpen(false)} className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700">Close</button>
            </div>
            <form onSubmit={async (event) => {
              event.preventDefault();
              if (!viewOrder) return;
              try {
                await updateOrder(viewOrder.id, { status: viewOrder.status });
                setOrders((prev) => prev.map((order) => order.id === viewOrder.id ? viewOrder : order));
                setViewModalOpen(false);
                showNotification('Order updated');
              } catch (error) {
                console.error(error);
                showNotification('Unable to update order.');
              }
            }} className="grid gap-4">
              <div className="grid gap-4 lg:grid-cols-2">
                <label className="block text-sm text-slate-700">
                  Order ID
                  <input value={viewOrder.id} readOnly className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none" />
                </label>
                <label className="block text-sm text-slate-700">
                  Customer
                  <input value={viewOrder.customerName} onChange={(e) => setViewOrder((prev) => ({ ...prev, customerName: e.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none" />
                </label>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <label className="block text-sm text-slate-700">
                  Product
                  <input value={viewOrder.product} onChange={(e) => setViewOrder((prev) => ({ ...prev, product: e.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none" />
                </label>
                <label className="block text-sm text-slate-700">
                  Amount
                  <input type="number" step="0.01" value={viewOrder.amount} onChange={(e) => setViewOrder((prev) => ({ ...prev, amount: Number(e.target.value) }))} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none" />
                </label>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <label className="block text-sm text-slate-700">
                  Status
                  <select value={viewOrder.status} onChange={(e) => setViewOrder((prev) => ({ ...prev, status: e.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none">
                    {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}
                  </select>
                </label>
                <label className="block text-sm text-slate-700">
                  Date
                  <input value={formatOrderDate(viewOrder.date)} readOnly className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none" />
                </label>
              </div>
              <div className="flex flex-wrap gap-3 pt-4">
                <button type="submit" className="rounded-2xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800">Save Changes</button>
                <button type="button" onClick={() => setViewModalOpen(false)} className="rounded-2xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700">Close</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {menuItemModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-2xl rounded-[28px] bg-white p-6 shadow-[0_22px_60px_rgba(15,23,42,0.18)]">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-slate-900">{editingMenuItem ? 'Edit Menu Item' : 'Add Menu Item'}</h2>
                <p className="text-sm text-slate-500">Save menu items and inventory for order creation.</p>
              </div>
              <button type="button" onClick={() => { setMenuItemModalOpen(false); setEditingMenuItem(null); }} className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700">Close</button>
            </div>
            <form onSubmit={handleMenuItemSave} className="grid gap-4">
              <input type="hidden" name="menuItemId" value={editingMenuItem?.key || ''} />
              <div className="grid gap-4 lg:grid-cols-2">
                <label className="block text-sm text-slate-700">
                  Item name
                  <input name="menuItemName" defaultValue={editingMenuItem?.name || ''} required className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none" />
                </label>
                <label className="block text-sm text-slate-700">
                  Category
                  <input name="menuItemCategory" defaultValue={editingMenuItem?.category || ''} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none" />
                </label>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <label className="block text-sm text-slate-700">
                  Price
                  <input name="menuItemPrice" type="number" step="0.01" defaultValue={editingMenuItem?.price || 0} required className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none" />
                </label>
                <label className="block text-sm text-slate-700">
                  Stock
                  <input name="menuItemStock" type="number" step="1" defaultValue={editingMenuItem?.stock || 0} required className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none" />
                </label>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <label className="block text-sm text-slate-700">
                  Tags
                  <input name="menuItemTags" defaultValue={(editingMenuItem?.tags || []).join(',')} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none" />
                </label>
                <label className="block text-sm text-slate-700">
                  Available
                  <input name="menuItemAvailable" type="checkbox" defaultChecked={editingMenuItem?.available || false} className="mt-5 h-5 w-5 rounded border-slate-300 text-slate-900" />
                </label>
              </div>
              <div className="flex flex-wrap gap-3 pt-4">
                <button type="submit" className="rounded-2xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800">Save Item</button>
                <button type="button" onClick={() => { setMenuItemModalOpen(false); setEditingMenuItem(null); }} className="rounded-2xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default OrdersPage;
