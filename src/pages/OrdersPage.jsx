import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import Sidebar from '../components/Sidebar';
import TopBar from '../components/TopBar';
import DataTable from '../components/DataTable';
import { useNotification } from '../contexts/NotificationContext';
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
import { buildOccupiedFromReservationPayload, shouldTransitionReservedTable } from '../utils/tableReservation';

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
  const location = useLocation();
  const navigate = useNavigate();
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
  const { success, error, info, warning } = useNotification();
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
  const [selectedTable, setSelectedTable] = useState(null);
  const [tableMenuOpen, setTableMenuOpen] = useState(null);
  const [tableDialog, setTableDialog] = useState({ open: false, mode: 'reserve', table: null });
  const [tableConfirm, setTableConfirm] = useState({ open: false, table: null, title: '', message: '', action: null });
  const [tableForm, setTableForm] = useState({ customerName: '', phoneNumber: '', guestCount: '2', reservationDateTime: '', notes: '', assignedStaff: '', status: 'vacant' });
  const [tableActionPending, setTableActionPending] = useState(false);
  const [sessionTick, setSessionTick] = useState(0);

  const resolveActiveTab = (pathname) => {
    if (pathname === '/orders/menu' || pathname.startsWith('/orders/menu/')) return 'menu';
    if (pathname === '/orders/tables' || pathname.startsWith('/orders/tables/')) return 'tables';
    return 'orders';
  };

  const handleSectionChange = (nextTab) => {
    setActiveTab(nextTab);
    if (nextTab === 'orders') {
      navigate('/orders');
    } else {
      navigate(`/orders/${nextTab}`);
    }
  };

  useEffect(() => {
    setActiveTab(resolveActiveTab(location.pathname));
  }, [location.pathname]);

  useEffect(() => {
    loadOrders();
    loadMenuItems();
    loadTables();

    const timer = window.setInterval(() => setSessionTick((value) => value + 1), 1000);

    socket.on('order-created', (payload) => {
      setOrders((prev) => [{
        id: payload.id,
        customerName: payload.customerName || 'Customer',
        product: payload.product || '',
        amount: Number(payload.amount || 0),
        status: payload.status || 'pending',
        date: payload.date || new Date().toISOString()
      }, ...prev]);
      info(`New order ${payload.id} received`);
    });

    socket.on('order-updated', (payload) => {
      setOrders((prev) => prev.map((order) => order.id === payload.orderId ? { ...order, status: payload.status || order.status } : order));
    });

    socket.on('delivery-update', (payload) => {
      setOrders((prev) => prev.map((order) => order.id === payload.order_id ? { ...order, status: payload.status || order.status } : order));
    });

    return () => {
      window.clearInterval(timer);
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
      error('Unable to load orders');
    }
  };

  const loadMenuItems = async () => {
    try {
      const data = await fetchMenuItems();
      setMenuItems(data);
    } catch (error) {
      console.error('Failed to load menu items', error);
      error('Unable to load menu items');
    }
  };

  const loadTables = async () => {
    try {
      const data = await fetchTables();
      setTables(data);
    } catch (error) {
      console.error('Failed to load tables', error);
      error('Unable to load tables');
    }
  };

  const syncReservationTransitions = async (tableData = tables) => {
    const now = new Date();
    const pendingTransitions = (tableData || []).filter((table) => shouldTransitionReservedTable(table, now));
    if (pendingTransitions.length === 0) return;

    await Promise.all(pendingTransitions.map(async (table) => {
      const payload = buildOccupiedFromReservationPayload(table, now);
      try {
        await updateTableState(table.number, payload);
        const tableLabel = table.label || `Table ${table.number}`;
      info(`${tableLabel} is now occupied.`);
      } catch (error) {
        console.error(`Failed to transition table ${table.number} to occupied`, error);
      }
    }));

    await loadTables();
  };

  useEffect(() => {
    if (!tables.length) return;
    void syncReservationTransitions(tables);
  }, [tables.length]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void syncReservationTransitions(tables);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [tables]);

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
      <span className="font-semibold text-slate-900 dark:text-slate-100">{order.product || 'Order item'}</span>
      <span className="text-xs text-slate-500 dark:text-slate-400">{order.customerName || 'Customer'}</span>
    </div>,
    order.customerName,
    formatMoney(order.amount),
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${order.status === 'completed' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200' : order.status === 'cancelled' ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200' : order.status === 'processing' ? 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200' : 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200'}`}>{order.status}</span>,
    formatOrderDate(order.date),
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={() => openViewOrder(order)} className="rounded-2xl border border-slate-200 bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700">View</button>
      <button type="button" onClick={() => completeOrder(order.id)} disabled={order.status === 'completed'} className="rounded-2xl bg-sky-500 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-600 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-slate-700">Complete</button>
      <button type="button" onClick={() => cancelOrder(order.id)} disabled={order.status === 'cancelled'} className="rounded-2xl bg-rose-500 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-600 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-slate-700">Cancel</button>
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

  const normalizeTableStatus = (status) => String(status || 'vacant').toLowerCase().replace(/\s+/g, '_');

  const tableStats = useMemo(() => {
    const totals = tables.reduce((acc, table) => {
      const status = normalizeTableStatus(table.status);
      acc.total += 1;
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {
      total: 0,
      vacant: 0,
      reserved: 0,
      occupied: 0,
      cleaning: 0,
      maintenance: 0,
      out_of_service: 0
    });
    return totals;
  }, [tables]);

  const tableStatusLegend = [
    {
      value: 'vacant',
      label: 'Vacant',
      description: 'Ready for seating right away.',
      badgeClass: 'bg-emerald-100 text-emerald-700',
      cardClass: 'border-emerald-200 bg-emerald-50/70',
      dotClass: 'bg-emerald-500'
    },
    {
      value: 'reserved',
      label: 'Reserved',
      description: 'Booked for a future arrival.',
      badgeClass: 'bg-amber-100 text-amber-700',
      cardClass: 'border-amber-200 bg-amber-50/70',
      dotClass: 'bg-amber-500'
    },
    {
      value: 'occupied',
      label: 'Occupied',
      description: 'Currently in use by guests.',
      badgeClass: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200',
      cardClass: 'border-rose-200 bg-rose-50/70 dark:border-rose-700 dark:bg-rose-950/50',
      dotClass: 'bg-rose-500'
    },
    {
      value: 'cleaning',
      label: 'Cleaning',
      description: 'Being reset for the next guests.',
      badgeClass: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200',
      cardClass: 'border-sky-200 bg-sky-50/70 dark:border-sky-700 dark:bg-sky-950/50',
      dotClass: 'bg-sky-500'
    },
    {
      value: 'maintenance',
      label: 'Maintenance',
      description: 'Temporarily unavailable for service.',
      badgeClass: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-200',
      cardClass: 'border-violet-200 bg-violet-50/70 dark:border-violet-700 dark:bg-violet-950/50',
      dotClass: 'bg-violet-500'
    },
    {
      value: 'out_of_service',
      label: 'Out of Service',
      description: 'Disabled until staff re-enables it.',
      badgeClass: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
      cardClass: 'border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-950',
      dotClass: 'bg-slate-500'
    }
  ];

  const getTableStatusMeta = (status) => tableStatusLegend.find((item) => item.value === normalizeTableStatus(status)) || tableStatusLegend[0];

  const getPrimaryTableActions = (table) => {
    const status = normalizeTableStatus(table.status);
    if (status === 'vacant') {
      return [
        { label: 'Reserve', action: 'reserve', style: 'primary' },
        { label: 'Book', action: 'book', style: 'secondary' }
      ];
    }
    if (status === 'reserved') {
      return [
        { label: 'Check In', action: 'checkin', style: 'primary' },
        { label: 'Cancel Reservation', action: 'cancel', style: 'secondary' }
      ];
    }
    if (status === 'occupied') {
      return [
        { label: 'Manage', action: 'manage', style: 'primary' },
        { label: 'Checkout', action: 'checkout', style: 'secondary' }
      ];
    }
    if (status === 'cleaning') {
      return [{ label: 'Mark Ready', action: 'ready', style: 'primary' }];
    }
    if (status === 'maintenance') {
      return [{ label: 'Mark Available', action: 'available', style: 'primary' }];
    }
    if (status === 'out_of_service') {
      return [{ label: 'Enable', action: 'enable', style: 'primary' }];
    }
    return [{ label: 'Details', action: 'details', style: 'primary' }];
  };

  const getMoreTableActions = (table) => {
    const status = normalizeTableStatus(table.status);
    const actions = [
      { label: 'View Table Details', action: 'details' },
      { label: 'View Booking / Reservation', action: 'booking' },
      { label: 'View History', action: 'history' },
      { label: 'Change Status', action: 'status' }
    ];
    if (status !== 'cleaning') actions.push({ label: 'Mark as Cleaning', action: 'cleaning' });
    if (status !== 'maintenance') actions.push({ label: 'Mark as Maintenance', action: 'maintenance' });
    if (status === 'out_of_service') {
      actions.push({ label: 'Enable Table', action: 'enable' });
    } else {
      actions.push({ label: 'Disable Table', action: 'disable' });
    }
    return actions;
  };

  const formatSessionTimer = (table) => {
    if (!table?.sessionStartedAt) return null;
    const startedAt = new Date(table.sessionStartedAt).getTime();
    const elapsed = Math.max(0, Date.now() - startedAt);
    const minutes = Math.floor(elapsed / 60000);
    const seconds = Math.floor((elapsed % 60000) / 1000);
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  const updateTableLocally = (tableNumber, changes) => {
    setTables((prev) => prev.map((table) => table.number === tableNumber ? { ...table, ...changes } : table));
  };

  const openTableDialog = (table, mode) => {
    const defaults = {
      customerName: table?.customerName || '',
      phoneNumber: table?.phoneNumber || '',
      guestCount: table?.guestCount || '2',
      reservationDateTime: table?.reservedUntil ? new Date(table.reservedUntil).toISOString().slice(0, 16) : '',
      notes: table?.notes || '',
      assignedStaff: table?.assignedStaff || '',
      status: table?.status || 'vacant'
    };
    setSelectedTable(table || null);
    setTableDialog({ open: true, mode, table: table || null });
    setTableForm(defaults);
    setTableMenuOpen(null);
  };

  const closeTableDialog = () => {
    setTableDialog({ open: false, mode: 'reserve', table: null });
    setTableForm({ customerName: '', phoneNumber: '', guestCount: '2', reservationDateTime: '', notes: '', assignedStaff: '', status: 'vacant' });
    setSelectedTable(null);
  };

  const openTableConfirm = (table, action, title, message) => {
    setTableConfirm({ open: true, table, action, title, message });
    setSelectedTable(table || null);
    setTableMenuOpen(null);
  };

  const closeTableConfirm = () => {
    setTableConfirm({ open: false, table: null, action: null, title: '', message: '' });
    setSelectedTable(null);
  };

  const openViewOrder = (order) => {
    setViewOrder(order);
    setViewModalOpen(true);
  };

  const completeOrder = async (orderId) => {
    try {
      await updateOrder(orderId, { status: 'completed' });
      setOrders((prev) => prev.map((order) => order.id === orderId ? { ...order, status: 'completed' } : order));
      success(`Order ${orderId} marked completed.`);
    } catch (error) {
      console.error(error);
      error('Unable to update order.');
    }
  };

  const cancelOrder = async (orderId) => {
    try {
      await updateOrder(orderId, { status: 'cancelled' });
      setOrders((prev) => prev.map((order) => order.id === orderId ? { ...order, status: 'cancelled' } : order));
      success(`Order ${orderId} cancelled.`);
    } catch (error) {
      console.error(error);
      error('Unable to cancel order.');
    }
  };

  const handleCreateOrder = async (event) => {
    event.preventDefault();
    const draft = { ...orderDraft };
    const items = draft.items.filter((item) => item.menuItemId);
    if (items.length === 0) {
      warning('Add at least one product.');
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
      success('Order created successfully!');
      loadOrders();
    } catch (error) {
      console.error(error);
      error(error.message);
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
      success('Menu item saved.');
    } catch (error) {
      console.error(error);
      error('Unable to save menu item.');
    }
  };

  const handleTableAction = async (tableNumber, action) => {
    const table = tables.find((item) => item.number === tableNumber);
    if (!table) return;

    if (action === 'reserve') {
      openTableDialog(table, 'reserve');
      return;
    }

    if (action === 'book') {
      openTableDialog(table, 'book');
      return;
    }

    if (action === 'checkin') {
      openTableConfirm(table, 'checkin', 'Check in table', 'Convert this reservation into an active session?');
      return;
    }

    if (action === 'cancel') {
      openTableConfirm(table, 'cancel', 'Cancel reservation', 'Remove this reservation and return the table to Vacant?');
      return;
    }

    if (action === 'manage') {
      openTableDialog(table, 'manage');
      return;
    }

    if (action === 'checkout') {
      openTableConfirm(table, 'checkout', 'Checkout table', 'End the session and make the table available again?');
      return;
    }

    if (action === 'ready') {
      openTableConfirm(table, 'ready', 'Mark table ready', 'Clear the cleaning state and make the table Vacant?');
      return;
    }

    if (action === 'available') {
      openTableConfirm(table, 'available', 'Mark table available', 'Return the table to Vacant?');
      return;
    }

    if (action === 'enable') {
      openTableConfirm(table, 'enable', 'Enable table', 'Make this table available again?');
      return;
    }

    if (action === 'details') {
      openTableDialog(table, 'details');
      return;
    }

    if (action === 'booking') {
      openTableDialog(table, 'details');
      return;
    }

    if (action === 'history') {
      info('History view is ready for future expansion.');
      return;
    }

    if (action === 'status') {
      openTableDialog(table, 'status');
      return;
    }

    if (action === 'cleaning') {
      openTableConfirm(table, 'cleaning', 'Mark table cleaning', 'Set this table to Cleaning?');
      return;
    }

    if (action === 'maintenance') {
      openTableConfirm(table, 'maintenance', 'Mark table maintenance', 'Set this table to Maintenance?');
      return;
    }

    if (action === 'disable') {
      openTableConfirm(table, 'disable', 'Disable table', 'Set this table to Out of Service?');
      return;
    }
  };

  const submitTableDialog = async (event) => {
    event.preventDefault();
    if (!tableDialog.table) return;

    setTableActionPending(true);
    try {
      if (tableDialog.mode === 'reserve') {
        const reservationTime = tableForm.reservationDateTime ? new Date(tableForm.reservationDateTime).toISOString() : null;
        if (!tableForm.customerName.trim() || !tableForm.phoneNumber.trim() || !tableForm.guestCount || !tableForm.reservationDateTime) {
          throw new Error('Please complete all reservation fields.');
        }
        updateTableLocally(tableDialog.table.number, {
          status: 'reserved',
          customerName: tableForm.customerName.trim(),
          phoneNumber: tableForm.phoneNumber.trim(),
          guestCount: Number(tableForm.guestCount) || 1,
          notes: tableForm.notes.trim(),
          reservedUntil: reservationTime,
          isBooking: false,
          sessionStartedAt: null
        });
        await updateTableState(tableDialog.table.number, {
          status: 'reserved',
          customerName: tableForm.customerName.trim(),
          phoneNumber: tableForm.phoneNumber.trim(),
          guestCount: Number(tableForm.guestCount) || 1,
          notes: tableForm.notes.trim(),
          reservedUntil: reservationTime,
          isBooking: false
        });
        success(`Table ${tableDialog.table.number} reserved.`);
      } else if (tableDialog.mode === 'book') {
        if (!tableForm.guestCount) {
          throw new Error('Please enter a guest count.');
        }
        updateTableLocally(tableDialog.table.number, {
          status: 'occupied',
          customerName: tableForm.customerName.trim() || 'Guest',
          phoneNumber: tableForm.phoneNumber || '',
          guestCount: Number(tableForm.guestCount) || 1,
          notes: tableForm.notes.trim(),
          assignedStaff: tableForm.assignedStaff.trim(),
          reservedUntil: null,
          isBooking: true,
          sessionStartedAt: new Date().toISOString()
        });
        await updateTableState(tableDialog.table.number, {
          status: 'occupied',
          customerName: tableForm.customerName.trim() || 'Guest',
          phoneNumber: tableForm.phoneNumber || '',
          guestCount: Number(tableForm.guestCount) || 1,
          notes: tableForm.notes.trim(),
          assignedStaff: tableForm.assignedStaff.trim(),
          reservedUntil: null,
          isBooking: true,
          sessionStartedAt: new Date().toISOString()
        });
        success(`Table ${tableDialog.table.number} booked.`);
      } else if (tableDialog.mode === 'status') {
        updateTableLocally(tableDialog.table.number, { status: tableForm.status, reservedUntil: null, isBooking: false, customerName: tableForm.customerName || null });
        await updateTableState(tableDialog.table.number, {
          status: tableForm.status,
          customerName: tableForm.customerName || null,
          reservedUntil: null,
          isBooking: false
        });
        success(`Table ${tableDialog.table.number} status updated.`);
      } else if (tableDialog.mode === 'manage') {
        if (tableForm.notes.trim()) {
          updateTableLocally(tableDialog.table.number, { notes: tableForm.notes.trim() });
        }
        await updateTableState(tableDialog.table.number, {
          status: tableDialog.table.status,
          customerName: tableDialog.table.customerName || null,
          notes: tableForm.notes.trim(),
          assignedStaff: tableForm.assignedStaff.trim(),
          reservedUntil: tableDialog.table.reservedUntil || null,
          isBooking: Boolean(tableDialog.table.isBooking)
        });
        success('Table details saved.');
      }
      closeTableDialog();
      await loadTables();
    } catch (error) {
      console.error(error);
      error(error.message || 'Unable to update table.');
    } finally {
      setTableActionPending(false);
    }
  };

  const confirmTableAction = async () => {
    if (!tableConfirm.table) return;
    setTableActionPending(true);
    try {
      if (tableConfirm.action === 'checkin') {
        updateTableLocally(tableConfirm.table.number, { status: 'occupied', reservedUntil: null, isBooking: true, sessionStartedAt: new Date().toISOString() });
        await updateTableState(tableConfirm.table.number, { status: 'occupied', reservedUntil: null, isBooking: true, sessionStartedAt: new Date().toISOString() });
        success(`Table ${tableConfirm.table.number} checked in.`);
      } else if (tableConfirm.action === 'cancel') {
        updateTableLocally(tableConfirm.table.number, { status: 'vacant', customerName: null, reservedUntil: null, isBooking: false, notes: '', phoneNumber: '', guestCount: 1, assignedStaff: '', sessionStartedAt: null });
        await updateTableState(tableConfirm.table.number, { status: 'vacant', customerName: null, phoneNumber: '', guestCount: 1, notes: '', assignedStaff: '', reservedUntil: null, isBooking: false, sessionStartedAt: null });
        success(`Reservation for table ${tableConfirm.table.number} cancelled.`);
      } else if (tableConfirm.action === 'checkout') {
        updateTableLocally(tableConfirm.table.number, { status: 'vacant', customerName: null, reservedUntil: null, isBooking: false, sessionStartedAt: null, phoneNumber: '', guestCount: 1, notes: '', assignedStaff: '' });
        await updateTableState(tableConfirm.table.number, { status: 'vacant', customerName: null, phoneNumber: '', guestCount: 1, notes: '', assignedStaff: '', reservedUntil: null, isBooking: false, sessionStartedAt: null });
        success(`Table ${tableConfirm.table.number} checked out.`);
      } else if (tableConfirm.action === 'ready') {
        updateTableLocally(tableConfirm.table.number, { status: 'vacant', reservedUntil: null, isBooking: false, customerName: null, sessionStartedAt: null });
        await updateTableState(tableConfirm.table.number, { status: 'vacant', customerName: null, reservedUntil: null, isBooking: false, sessionStartedAt: null });
        success(`Table ${tableConfirm.table.number} marked ready.`);
      } else if (tableConfirm.action === 'available') {
        updateTableLocally(tableConfirm.table.number, { status: 'vacant', reservedUntil: null, isBooking: false, customerName: null, sessionStartedAt: null });
        await updateTableState(tableConfirm.table.number, { status: 'vacant', customerName: null, reservedUntil: null, isBooking: false, sessionStartedAt: null });
        success(`Table ${tableConfirm.table.number} marked available.`);
      } else if (tableConfirm.action === 'enable') {
        updateTableLocally(tableConfirm.table.number, { status: 'vacant', reservedUntil: null, isBooking: false, customerName: null, sessionStartedAt: null });
        await updateTableState(tableConfirm.table.number, { status: 'vacant', customerName: null, reservedUntil: null, isBooking: false, sessionStartedAt: null });
        success(`Table ${tableConfirm.table.number} enabled.`);
      } else if (tableConfirm.action === 'cleaning') {
        updateTableLocally(tableConfirm.table.number, { status: 'cleaning' });
        await updateTableState(tableConfirm.table.number, { status: 'cleaning' });
        success(`Table ${tableConfirm.table.number} marked cleaning.`);
      } else if (tableConfirm.action === 'maintenance') {
        updateTableLocally(tableConfirm.table.number, { status: 'maintenance' });
        await updateTableState(tableConfirm.table.number, { status: 'maintenance' });
        success(`Table ${tableConfirm.table.number} marked maintenance.`);
      } else if (tableConfirm.action === 'disable') {
        updateTableLocally(tableConfirm.table.number, { status: 'out_of_service' });
        await updateTableState(tableConfirm.table.number, { status: 'out_of_service' });
        success(`Table ${tableConfirm.table.number} disabled.`);
      }
      closeTableConfirm();
      await loadTables();
    } catch (error) {
      console.error(error);
      error(error.message || 'Unable to update table.');
    } finally {
      setTableActionPending(false);
    }
  };

  const filteredMenuItems = menuFiltered;

  return (
    <div className="flex h-screen overflow-hidden orders-page-light !bg-white !text-gray-900 dark:!bg-slate-950 dark:!text-slate-100">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-6 lg:p-7">
          <div className="mb-4 overflow-x-auto">
            <div className="flex min-w-max items-center gap-2 rounded-full bg-slate-100 p-1.5 shadow-sm dark:bg-slate-800">
              <button type="button" className={`rounded-full px-4 py-2 text-sm font-semibold transition ${activeTab === 'orders' ? 'bg-slate-900 text-white shadow-lg' : 'bg-transparent text-slate-700 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700'}`} onClick={() => handleSectionChange('orders')}>
                Orders
              </button>
              <button type="button" className={`rounded-full px-4 py-2 text-sm font-semibold transition ${activeTab === 'menu' ? 'bg-slate-900 text-white shadow-lg' : 'bg-transparent text-slate-700 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700'}`} onClick={() => handleSectionChange('menu')}>
                Menu
              </button>
              <button type="button" className={`rounded-full px-4 py-2 text-sm font-semibold transition ${activeTab === 'tables' ? 'bg-slate-900 text-white shadow-lg' : 'bg-transparent text-slate-700 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700'}`} onClick={() => handleSectionChange('tables')}>
                Tables
              </button>
            </div>
          </div>

            {activeTab === 'orders' ? (
              <section className="space-y-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.28em] text-sky-500">Orders</p>
                    <h1 className="mt-3 text-2xl font-semibold text-slate-900 sm:text-3xl dark:text-slate-100">Order management</h1>
                    <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600 dark:text-slate-400">Manage current order flow, bulk actions, and real-time updates from the kitchen.</p>
                  </div>
                  <button type="button" onClick={() => setOrderModalOpen(true)} className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 sm:w-auto">+ New Order</button>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-3xl bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.07)] dark:bg-slate-900 dark:text-slate-100">
                    <p className="text-sm uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Total Orders</p>
                    <p className="mt-3 text-3xl font-bold text-slate-900 dark:text-white sm:text-4xl">{orders.length}</p>
                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Orders loaded from backend.</p>
                  </div>
                  <div className="rounded-3xl bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.07)] dark:bg-slate-900 dark:text-slate-100">
                    <p className="text-sm uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">In Transit</p>
                    <p className="mt-3 text-3xl font-bold text-slate-900 dark:text-white sm:text-4xl">{orders.filter((order) => ['processing', 'in transit', 'shipping', 'out for delivery', 'delivering'].includes(order.status)).length}</p>
                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Orders currently moving through the workflow.</p>
                  </div>
                </div>

                <div className="rounded-[28px] bg-white p-4 shadow-[0_18px_40px_rgba(15,23,42,0.07)] dark:bg-slate-900 dark:text-slate-100 sm:p-6">
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <input value={filterText} onChange={(e) => setFilterText(e.target.value)} placeholder="Search order ID or customer" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
                    <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
                      <option value="">All Status</option>
                      {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}
                    </select>
                    <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
                      {DATE_FILTERS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                    <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
                      {SORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </div>

                  <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                      <button type="button" onClick={() => { setStatusFilter(''); setDateFilter(''); setFilterText(''); setSortBy('date_desc'); }} className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700">Clear</button>
                      <button type="button" onClick={() => setSelectedIds(new Set())} className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700">Clear selection</button>
                    </div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">Showing {filteredOrders.length} orders • Page {page} of {pageCount}</div>
                  </div>

                  <div className="mt-5 space-y-3 lg:hidden">
                    {paginatedOrders.length === 0 ? (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400">No orders found.</div>
                    ) : paginatedOrders.map((order) => (
                      <div key={order.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-950">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-slate-100">{order.product || 'Order item'}</p>
                            <p className="text-sm text-slate-500 dark:text-slate-400">{order.customerName || 'Customer'}</p>
                          </div>
                          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${order.status === 'completed' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200' : order.status === 'cancelled' ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200' : order.status === 'processing' ? 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200' : 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200'}`}>{order.status}</span>
                        </div>
                        <div className="mt-3 grid gap-2 text-sm text-slate-600 dark:text-slate-400">
                          <div className="flex items-center justify-between"><span>Order ID</span><span className="font-medium text-slate-900 dark:text-slate-100">#{order.id}</span></div>
                          <div className="flex items-center justify-between"><span>Amount</span><span className="font-medium text-slate-900 dark:text-slate-100">{formatMoney(order.amount)}</span></div>
                          <div className="flex items-center justify-between"><span>Date</span><span>{formatOrderDate(order.date)}</span></div>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <button type="button" onClick={() => openViewOrder(order)} className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700">View</button>
                          <button type="button" onClick={() => completeOrder(order.id)} disabled={order.status === 'completed'} className="rounded-2xl bg-sky-500 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-600 disabled:bg-slate-300 dark:disabled:bg-slate-700">Complete</button>
                          <button type="button" onClick={() => cancelOrder(order.id)} disabled={order.status === 'cancelled'} className="rounded-2xl bg-rose-500 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-600 disabled:bg-slate-300 dark:disabled:bg-slate-700">Cancel</button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 hidden overflow-x-auto lg:block">
                    <table className="min-w-full divide-y divide-slate-200 text-left text-sm text-slate-700 dark:text-slate-200">
                      <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-400">
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
                      <tbody className="divide-y divide-slate-200 bg-white dark:bg-slate-950">
                        {paginatedOrders.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="px-4 py-6 text-center text-slate-500 dark:text-slate-400">No orders found.</td>
                          </tr>
                        ) : paginatedOrders.map((order) => (
                          <tr key={order.id} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                            <td className="px-4 py-3"><input type="checkbox" checked={selectedIds.has(order.id)} onChange={(e) => {
                              const next = new Set(selectedIds);
                              if (e.target.checked) next.add(order.id); else next.delete(order.id);
                              setSelectedIds(next);
                            }} /></td>
                            <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">{order.id}</td>
                            <td className="px-4 py-3 dark:text-slate-100">{order.customerName}</td>
                            <td className="px-4 py-3 dark:text-slate-100">{order.product}</td>
                            <td className="px-4 py-3 dark:text-slate-100">{formatMoney(order.amount)}</td>
                            <td className="px-4 py-3"><span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${order.status === 'completed' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200' : order.status === 'cancelled' ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200' : order.status === 'processing' ? 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200' : 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200'}`}>{order.status}</span></td>
                            <td className="px-4 py-3 dark:text-slate-100">{formatOrderDate(order.date)}</td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-2">
                                <button type="button" onClick={() => openViewOrder(order)} className="rounded-2xl border border-slate-200 bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700">View</button>
                                <button type="button" onClick={() => completeOrder(order.id)} disabled={order.status === 'completed'} className="rounded-2xl bg-sky-500 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-600 disabled:bg-slate-300 dark:disabled:bg-slate-700">Complete</button>
                                <button type="button" onClick={() => cancelOrder(order.id)} disabled={order.status === 'cancelled'} className="rounded-2xl bg-rose-500 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-600 disabled:bg-slate-300 dark:disabled:bg-slate-700">Cancel</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between text-sm text-slate-500">
                    <div className="flex flex-wrap items-center gap-2">
                      <button type="button" onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:disabled:bg-slate-800">Previous</button>
                      <button type="button" onClick={() => setPage(Math.min(pageCount, page + 1))} disabled={page === pageCount} className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:disabled:bg-slate-800">Next</button>
                    </div>
                    <select value={perPage} onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
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
                    <button type="button" onClick={() => setMenuModeActive((prev) => !prev)} className={`rounded-2xl px-4 py-3 text-sm font-semibold ${menuModeActive ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700'}`}>{menuModeActive ? 'Adaptive Mode On' : 'Adaptive Mode'}</button>
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-[minmax(220px,1fr)_minmax(220px,1fr)_minmax(220px,1fr)]">
                  <div className="rounded-3xl bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.07)] dark:bg-slate-900 dark:text-slate-100">
                    <p className="text-sm uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Total Menu Items</p>
                    <p className="mt-3 text-4xl font-bold text-slate-900 dark:text-white">{menuStats.total}</p>
                  </div>
                  <div className="rounded-3xl bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.07)] dark:bg-slate-900 dark:text-slate-100">
                    <p className="text-sm uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Available Now</p>
                    <p className="mt-3 text-4xl font-bold text-slate-900 dark:text-white">{menuStats.available}</p>
                  </div>
                  <div className="rounded-3xl bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.07)] dark:bg-slate-900 dark:text-slate-100">
                    <p className="text-sm uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Featured Items</p>
                    <p className="mt-3 text-4xl font-bold text-slate-900 dark:text-white">{menuStats.featured}</p>
                  </div>
                </div>

                <div className="rounded-[28px] bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.07)]">
                  <div className="grid gap-4 lg:grid-cols-[minmax(220px,1fr)_minmax(220px,1fr)_minmax(220px,1fr)]">
                    <input value={menuSearch} onChange={(e) => setMenuSearch(e.target.value)} placeholder="Search menu items" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
                    <select value={menuCategory} onChange={(e) => setMenuCategory(e.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
                      {menuCategories.map((category) => <option key={category} value={category}>{category}</option>)}
                    </select>
                    <select value={menuTag} onChange={(e) => setMenuTag(e.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
                      {menuTags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
                    </select>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <select value={menuSort} onChange={(e) => setMenuSort(e.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
                      <option value="score_desc">Recommended</option>
                      <option value="price_asc">Price Low → High</option>
                      <option value="price_desc">Price High → Low</option>
                      <option value="stock_desc">Stock</option>
                    </select>
                    <button type="button" onClick={() => info('Menu intelligence refreshed')} className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700">Refresh Insights</button>
                  </div>

                  <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {filteredMenuItems.map((item) => (
                      <div key={item.id} className="rounded-[22px] border border-slate-200 bg-slate-50 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.07)] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{item.name}</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">{item.category}{item.subtype ? ` · ${item.subtype}` : ''}</p>
                          </div>
                          <div className="rounded-2xl bg-white px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-200">{item.available ? 'Available' : 'Out'}</div>
                        </div>
                        <div className="mt-4 grid gap-2 text-sm text-slate-600 dark:text-slate-400">
                          <div className="flex items-center justify-between"><span>Price</span><span>${item.price.toFixed(2)}</span></div>
                          <div className="flex items-center justify-between"><span>Stock</span><span>{item.stock}</span></div>
                          <div className="flex flex-wrap gap-2">{(item.tags || []).map((tag) => <span key={tag} className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">{tag}</span>)}</div>
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
                    <h1 className="mt-3 text-3xl font-semibold text-slate-900 dark:text-slate-100">Table floor plan</h1>
                    <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600 dark:text-slate-400">Manage reservations and occupancy with a real-time table status view.</p>
                  </div>
                  <button type="button" onClick={loadTables} className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800">Refresh Tables</button>
                </div>

                <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
                  <div className="rounded-[28px] bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.07)] dark:bg-slate-900 dark:text-slate-100">
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Total tables</p>
                        <p className="mt-3 text-3xl font-bold text-slate-900 dark:text-white">{tableStats.total}</p>
                      </div>
                      {tableStatusLegend.map((item) => (
                        <div key={item.value} className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950">
                          <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{item.label}</p>
                          <p className="mt-3 text-3xl font-bold text-slate-900 dark:text-white">{tableStats[item.value] || 0}</p>
                        </div>
                      ))}
                    </div>

                    <div className="mt-6">
                      <div className="mb-4">
                        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Tables by row</h2>
                        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Each table appears as a compact card with its live status and booking details.</p>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {tables.map((table) => {
                          const statusMeta = tableStatusLegend.find((item) => item.value === (table.status || 'vacant')) || tableStatusLegend[0];
                          return (
                            <div key={table.number} className={`rounded-2xl border p-4 ${statusMeta.cardClass}`}>
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="font-semibold text-slate-900 dark:text-slate-100">{table.label || `Table ${table.number}`}</p>
                                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{statusMeta.label}</p>
                                </div>
                                <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${statusMeta.badgeClass}`}>{statusMeta.label}</span>
                              </div>
                              <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
                                {statusMeta.value === 'reserved'
                                  ? (table.customerName ? `Booked by ${table.customerName}` : 'Reserved for a future booking')
                                  : statusMeta.value === 'occupied'
                                    ? `Seated with ${table.customerName || 'guests'}`
                                    : statusMeta.value === 'cleaning'
                                      ? 'Being cleaned and refreshed'
                                      : statusMeta.value === 'maintenance'
                                        ? 'Unavailable for service'
                                        : statusMeta.value === 'out_of_service'
                                          ? 'Disabled until re-enabled'
                                          : 'Ready for seating'}
                              </p>
                              {statusMeta.value === 'occupied' && formatSessionTimer(table) ? (
                                <p className="mt-2 text-xs font-medium text-slate-700 dark:text-slate-300">Session: {formatSessionTimer(table)}</p>
                              ) : null}
                              {table.reservedUntil ? <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Until {new Date(table.reservedUntil).toLocaleString()}</p> : null}
                              <div className="mt-4 flex flex-wrap items-center gap-2">
                                {getPrimaryTableActions(table).map((actionItem) => (
                                  <button
                                    key={actionItem.action}
                                    type="button"
                                    onClick={() => handleTableAction(table.number, actionItem.action)}
                                    className={`rounded-2xl px-3 py-2 text-xs font-semibold ${actionItem.style === 'primary' ? 'bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700'}`}
                                  >
                                    {actionItem.label}
                                  </button>
                                ))}
                                <div className="relative">
                                  <button
                                    type="button"
                                    onClick={() => setTableMenuOpen((prev) => (prev === table.number ? null : table.number))}
                                    className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                                  >
                                    More
                                  </button>
                                  {tableMenuOpen === table.number ? (
                                    <div className="absolute right-0 top-full z-20 mt-2 w-52 rounded-3xl border border-slate-200 bg-white p-2 shadow-[0_16px_40px_rgba(15,23,42,0.08)] dark:border-slate-700 dark:bg-slate-950">
                                      {getMoreTableActions(table).map((item) => (
                                        <button
                                          key={item.action}
                                          type="button"
                                          onClick={() => handleTableAction(table.number, item.action)}
                                          className="w-full rounded-2xl px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800"
                                        >
                                          {item.label}
                                        </button>
                                      ))}
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[28px] bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.07)] dark:bg-slate-900 dark:text-slate-100">
                    <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Status guide</h2>
                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Use this legend to check the state of any table at a glance.</p>
                    <div className="mt-5 space-y-3">
                      {tableStatusLegend.map((item) => (
                        <div key={item.value} className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950">
                          <div className="flex items-center gap-2">
                            <span className={`h-2.5 w-2.5 rounded-full ${item.dotClass}`} />
                            <span className="font-semibold text-slate-900 dark:text-slate-100">{item.label}</span>
                          </div>
                          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{item.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            )}
        </main>
      </div>

      {tableDialog.open && tableDialog.table ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-3xl rounded-[28px] bg-white p-6 shadow-[0_22px_60px_rgba(15,23,42,0.18)] dark:bg-slate-900 dark:text-slate-100">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">
                  {tableDialog.mode === 'reserve' && 'Reserve Table'}
                  {tableDialog.mode === 'book' && 'Book Table'}
                  {tableDialog.mode === 'manage' && 'Manage Table'}
                  {tableDialog.mode === 'status' && 'Change Table Status'}
                  {tableDialog.mode === 'details' && 'Table Details'}
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Configure status, reservations, or session details for {tableDialog.table.label || `Table ${tableDialog.table.number}` }.</p>
              </div>
              <button type="button" onClick={closeTableDialog} className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">Close</button>
            </div>
            <form onSubmit={submitTableDialog} className="grid gap-4">
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Table</p>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{tableDialog.table.label || `Table ${tableDialog.table.number}`}</p>
                  <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${getTableStatusMeta(tableDialog.table.status).badgeClass}`}>
                    {getTableStatusMeta(tableDialog.table.status).label}
                  </span>
                </div>
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Last note</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{tableDialog.table.notes || 'No notes yet'}</p>
                </div>
              </div>

              {(tableDialog.mode === 'reserve' || tableDialog.mode === 'book') && (
                <div className="grid gap-4 lg:grid-cols-2">
                  <label className="block text-sm text-slate-700 dark:text-slate-200">
                    Customer name
                    <input value={tableForm.customerName} onChange={(e) => setTableForm((prev) => ({ ...prev, customerName: e.target.value }))} required className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
                  </label>
                  <label className="block text-sm text-slate-700 dark:text-slate-200">
                    Phone number
                    <input value={tableForm.phoneNumber} onChange={(e) => setTableForm((prev) => ({ ...prev, phoneNumber: e.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
                  </label>
                </div>
              )}

              {(tableDialog.mode === 'reserve' || tableDialog.mode === 'book' || tableDialog.mode === 'manage') && (
                <div className="grid gap-4 lg:grid-cols-2">
                  <label className="block text-sm text-slate-700 dark:text-slate-200">
                    Guest count
                    <input type="number" min="1" value={tableForm.guestCount} onChange={(e) => setTableForm((prev) => ({ ...prev, guestCount: e.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
                  </label>
                  <label className="block text-sm text-slate-700 dark:text-slate-200">
                    Assigned staff
                    <input value={tableForm.assignedStaff} onChange={(e) => setTableForm((prev) => ({ ...prev, assignedStaff: e.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
                  </label>
                </div>
              )}

              {tableDialog.mode === 'reserve' && (
                <label className="block text-sm text-slate-700 dark:text-slate-200">
                  Reservation time
                  <input type="datetime-local" value={tableForm.reservationDateTime} onChange={(e) => setTableForm((prev) => ({ ...prev, reservationDateTime: e.target.value }))} required className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
                </label>
              )}

              {(tableDialog.mode === 'status') && (
                <div className="grid gap-4 lg:grid-cols-2">
                  <label className="block text-sm text-slate-700 dark:text-slate-200">
                    New status
                    <select value={tableForm.status} onChange={(e) => setTableForm((prev) => ({ ...prev, status: e.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
                      {tableStatusLegend.map((item) => (
                        <option key={item.value} value={item.value}>{item.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm text-slate-700 dark:text-slate-200">
                    Customer name
                    <input value={tableForm.customerName} onChange={(e) => setTableForm((prev) => ({ ...prev, customerName: e.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
                  </label>
                </div>
              )}

              {(tableDialog.mode === 'manage' || tableDialog.mode === 'reserve' || tableDialog.mode === 'book' || tableDialog.mode === 'status') && (
                <label className="block text-sm text-slate-700 dark:text-slate-200">
                  Notes
                  <textarea value={tableForm.notes} onChange={(e) => setTableForm((prev) => ({ ...prev, notes: e.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" rows={4} />
                </label>
              )}

              {tableDialog.mode === 'details' && (
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Status</p>
                    <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{getTableStatusMeta(tableDialog.table.status).label}</p>
                  </div>
                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Guests</p>
                    <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{tableDialog.table.guestCount || '—'}</p>
                  </div>
                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Customer</p>
                    <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{tableDialog.table.customerName || '—'}</p>
                  </div>
                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Assigned staff</p>
                    <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{tableDialog.table.assignedStaff || '—'}</p>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-3 pt-4">
                {tableDialog.mode !== 'details' ? (
                  <button type="submit" disabled={tableActionPending} className="rounded-2xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300">
                    {tableActionPending ? 'Saving...' : tableDialog.mode === 'reserve' ? 'Reserve table' : tableDialog.mode === 'book' ? 'Book table' : tableDialog.mode === 'manage' ? 'Save changes' : tableDialog.mode === 'status' ? 'Update status' : 'Save'}
                  </button>
                ) : null}
                <button type="button" onClick={closeTableDialog} className="rounded-2xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {tableConfirm.open && tableConfirm.table ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-xl rounded-[28px] bg-white p-6 shadow-[0_22px_60px_rgba(15,23,42,0.18)] dark:bg-slate-900 dark:text-slate-100">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{tableConfirm.title}</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">{tableConfirm.message}</p>
              </div>
              <button type="button" onClick={closeTableConfirm} className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">Close</button>
            </div>
            <div className="grid gap-4">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Table</p>
                <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{tableConfirm.table.label || `Table ${tableConfirm.table.number}`}</p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Current status</p>
                <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{getTableStatusMeta(tableConfirm.table.status).label}</p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Customer</p>
                <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{tableConfirm.table.customerName || 'None'}</p>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <button type="button" onClick={confirmTableAction} disabled={tableActionPending} className="rounded-2xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300">
                {tableActionPending ? 'Processing...' : 'Confirm'}
              </button>
              <button type="button" onClick={closeTableConfirm} className="rounded-2xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">Cancel</button>
            </div>
          </div>
        </div>
      ) : null}

      {orderModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-3xl rounded-[28px] bg-white p-6 shadow-[0_22px_60px_rgba(15,23,42,0.18)]">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">New Order</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Create a new order with products and quantities.</p>
              </div>
              <button type="button" onClick={() => setOrderModalOpen(false)} className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">Close</button>
            </div>
            <form onSubmit={handleCreateOrder} className="grid gap-4">
              <div className="grid gap-4 lg:grid-cols-2">
                <label className="block text-sm text-slate-700 dark:text-slate-200">
                  Customer name
                  <input value={orderDraft.customerName} onChange={(e) => setOrderDraft((prev) => ({ ...prev, customerName: e.target.value }))} required className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
                </label>
                <label className="block text-sm text-slate-700 dark:text-slate-200">
                  Table
                  <select value={orderDraft.tableNumber} onChange={(e) => setOrderDraft((prev) => ({ ...prev, tableNumber: e.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
                    <option value="">-- No table / Takeaway --</option>
                    {tables.map((table) => <option key={table.number} value={table.number}>{table.label || `Table ${table.number}`}</option>)}
                  </select>
                </label>
              </div>
              <div className="space-y-4">
                {orderDraft.items.map((item, index) => (
                  <div key={index} className="grid gap-4 lg:grid-cols-[1.5fr_0.7fr_0.8fr_0.5fr]">
                    <label className="block text-sm text-slate-700 dark:text-slate-200">
                      Product
                      <select value={item.menuItemId} onChange={(e) => {
                        const next = [...orderDraft.items];
                        next[index].menuItemId = e.target.value;
                        setOrderDraft((prev) => ({ ...prev, items: next }));
                      }} required className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
                        <option value="">-- Select a menu item --</option>
                        {menuItems.filter((menuItem) => menuItem.available).map((menuItem) => <option key={menuItem.id} value={menuItem.id}>{menuItem.name} - ${menuItem.price.toFixed(2)}</option>)}
                      </select>
                    </label>
                    <label className="block text-sm text-slate-700 dark:text-slate-200">
                      Quantity
                      <input type="number" min="1" value={item.quantity} onChange={(e) => {
                        const next = [...orderDraft.items];
                        next[index].quantity = Number(e.target.value) || 1;
                        setOrderDraft((prev) => ({ ...prev, items: next }));
                      }} required className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
                    </label>
                    <div className="block text-sm text-slate-700 dark:text-slate-200">
                      <span className="mb-2 block">Item Amount</span>
                      <div className="mt-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
                        {formatMoney(menuItems.find((menuItem) => menuItem.id === item.menuItemId)?.price * item.quantity || 0)}
                      </div>
                    </div>
                    <button type="button" onClick={() => {
                      if (orderDraft.items.length === 1) return;
                      const next = orderDraft.items.filter((_, idx) => idx !== index);
                      setOrderDraft((prev) => ({ ...prev, items: next }));
                    }} className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700">Remove</button>
                  </div>
                ))}
              </div>
              <button type="button" onClick={() => setOrderDraft((prev) => ({ ...prev, items: [...prev.items, { menuItemId: '', quantity: 1 }] }))} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-800">+ Add another product</button>
              <div className="grid gap-4 lg:grid-cols-[1fr_0.8fr]">
                <label className="block text-sm text-slate-700 dark:text-slate-200">
                  Status
                  <select value={orderDraft.status} onChange={(e) => setOrderDraft((prev) => ({ ...prev, status: e.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
                    {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}
                  </select>
                </label>
                <div className="block text-sm text-slate-700 dark:text-slate-200">
                  <span className="mb-2 block">Total Amount</span>
                  <div className="mt-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">{formatMoney(orderDraft.items.reduce((sum, item) => {
                    const menu = menuItems.find((m) => m.id === item.menuItemId);
                    return sum + (menu ? menu.price * item.quantity : 0);
                  }, 0))}</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-3 pt-4">
                <button type="submit" className="rounded-2xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800">Create Order</button>
                <button type="button" onClick={() => setOrderModalOpen(false)} className="rounded-2xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {viewModalOpen && viewOrder ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-2xl rounded-[28px] bg-white p-6 shadow-[0_22px_60px_rgba(15,23,42,0.18)] dark:bg-slate-900 dark:text-slate-100">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Order Details</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Update status or review the order metadata.</p>
              </div>
              <button type="button" onClick={() => setViewModalOpen(false)} className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">Close</button>
            </div>
            <form onSubmit={async (event) => {
              event.preventDefault();
              if (!viewOrder) return;
              try {
                await updateOrder(viewOrder.id, { status: viewOrder.status });
                setOrders((prev) => prev.map((order) => order.id === viewOrder.id ? viewOrder : order));
                setViewModalOpen(false);
                success('Order updated');
              } catch (error) {
                console.error(error);
                error('Unable to update order.');
              }
            }} className="grid gap-4">
              <div className="grid gap-4 lg:grid-cols-2">
                <label className="block text-sm text-slate-700 dark:text-slate-200">
                  Order ID
                  <input value={viewOrder.id} readOnly className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
                </label>
                <label className="block text-sm text-slate-700 dark:text-slate-200">
                  Customer
                  <input value={viewOrder.customerName} onChange={(e) => setViewOrder((prev) => ({ ...prev, customerName: e.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
                </label>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <label className="block text-sm text-slate-700 dark:text-slate-200">
                  Product
                  <input value={viewOrder.product} onChange={(e) => setViewOrder((prev) => ({ ...prev, product: e.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
                </label>
                <label className="block text-sm text-slate-700 dark:text-slate-200">
                  Amount
                  <input type="number" step="0.01" value={viewOrder.amount} onChange={(e) => setViewOrder((prev) => ({ ...prev, amount: Number(e.target.value) }))} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
                </label>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <label className="block text-sm text-slate-700 dark:text-slate-200">
                  Status
                  <select value={viewOrder.status} onChange={(e) => setViewOrder((prev) => ({ ...prev, status: e.target.value }))} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
                    {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}
                  </select>
                </label>
                <label className="block text-sm text-slate-700 dark:text-slate-200">
                  Date
                  <input value={formatOrderDate(viewOrder.date)} readOnly className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
                </label>
              </div>
              <div className="flex flex-wrap gap-3 pt-4">
                <button type="submit" className="rounded-2xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800">Save Changes</button>
                <button type="button" onClick={() => setViewModalOpen(false)} className="rounded-2xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">Close</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {menuItemModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-2xl rounded-[28px] bg-white p-6 shadow-[0_22px_60px_rgba(15,23,42,0.18)] dark:bg-slate-900 dark:text-slate-100">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{editingMenuItem ? 'Edit Menu Item' : 'Add Menu Item'}</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Save menu items and inventory for order creation.</p>
              </div>
              <button type="button" onClick={() => { setMenuItemModalOpen(false); setEditingMenuItem(null); }} className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">Close</button>
            </div>
            <form onSubmit={handleMenuItemSave} className="grid gap-4">
              <input type="hidden" name="menuItemId" value={editingMenuItem?.key || ''} />
              <div className="grid gap-4 lg:grid-cols-2">
                <label className="block text-sm text-slate-700 dark:text-slate-200">
                  Item name
                  <input name="menuItemName" defaultValue={editingMenuItem?.name || ''} required className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
                </label>
                <label className="block text-sm text-slate-700 dark:text-slate-200">
                  Category
                  <input name="menuItemCategory" defaultValue={editingMenuItem?.category || ''} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
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
                <button type="button" onClick={() => { setMenuItemModalOpen(false); setEditingMenuItem(null); }} className="rounded-2xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default OrdersPage;
