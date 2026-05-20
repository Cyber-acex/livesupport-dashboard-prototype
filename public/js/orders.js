
// Orders management
let allOrders = [];
let filteredOrders = [];
let currentPage = 1;
let ordersPerPage = 10;
const selectedOrders = new Set();
let currentSort = 'date_desc';
let menuItems = [];
let filteredMenuItems = [];
let currentMenuCategory = 'All';
let currentMenuTag = 'All';
let currentMenuSort = 'score_desc';

function formatOrderTimestamp(value) {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  loadStaffName();
  loadOrders();
  loadMenu();
  setupThemeToggle();
  setupRealtimeUpdates();
});
let socket = null;
function setupRealtimeUpdates() {
  try {
    socket = io();
  } catch (e) {
    console.warn('Socket.io not available:', e);
    return;
  }
  socket.on('connect', () => {
    console.log('Connected to socket server');
  });
  socket.on('order-created', (payload) => {
    console.log('order-created', payload);
    const order = {
      id: payload.id,
      customerName: payload.customerName || 'Customer',
      product: payload.product || '',
      amount: Number(payload.amount || 0),
      status: payload.status || 'pending',
      date: payload.date || new Date().toISOString()
    };
    // Insert at top
    allOrders.unshift(order);
    filteredOrders = [...allOrders];
    currentPage = 1;
    displayOrders();
    showNotification(`New order ${order.id} received`);
  });
  socket.on('order-updated', (data) => {
    console.log('order-updated', data);
    const oid = data.orderId || data.order_id || data.id;
    const newStatus = data.status;
    let changed = false;
    for (const o of allOrders) {
      if (o.id === oid) {
        o.status = newStatus;
        changed = true;
      }
    }
    if (changed) displayOrders();
  });
  socket.on('delivery-update', (data) => {
    try {
      const orderId = data.order_id || data.orderId || (data.order && data.order.order_id) || null;
      const delivery = data.delivery || data;
      if (!orderId) return;
      let changed = false;
      for (const o of allOrders) {
        if (o.id === orderId) {
          if (delivery && delivery.status) o.status = delivery.status;
          changed = true;
        }
      }
      if (changed) displayOrders();
    } catch (e) {
      console.error('Error handling delivery-update', e);
    }
  });
}
// Load staff name from API
function loadStaffName() {
  fetch("/api/user")
    .then(response => response.json())
    .then(data => {
      document.getElementById('staffName').textContent = data.role;
    })
    .catch(error => {
      console.log("User fetch error:", error);
      document.getElementById('staffName').textContent = 'User';
    });
}
// Load orders from server
async function loadOrders() {
  try {
    const response = await fetch('/api/orders');
    if (response.ok) {
      allOrders = await response.json();
      // normalize amount and date fields for safety
      allOrders = allOrders.map(o => ({
        ...o,
        amount: Number(o.amount || o.total || 0),
        date: o.date || (o.created_at || o.createdAt) || new Date().toISOString()
      }));
      filteredOrders = [...allOrders];
      displayOrders();
    } else {
      showEmptyState();
    }
  } catch (error) {
    console.error('Error loading orders:', error);
    showEmptyState();
  }
}

function updateOrderMetrics() {
  const totalOrders = allOrders.length;
  const transitStatuses = new Set(['processing', 'in transit', 'shipping', 'shipped', 'out for delivery', 'delivering', 'transit']);
  const inTransitOrders = allOrders.filter(order => {
    const status = (order.status || '').toString().toLowerCase();
    return transitStatuses.has(status);
  }).length;

  const totalOrdersEl = document.getElementById('totalOrdersCount');
  const transitOrdersEl = document.getElementById('ordersInTransitCount');

  if (totalOrdersEl) totalOrdersEl.textContent = totalOrders.toLocaleString();
  if (transitOrdersEl) transitOrdersEl.textContent = inTransitOrders.toLocaleString();
}

// Generate sample orders for demo
function generateSampleOrders() {
  return [
    {
      id: 'ORD-001',
      customerName: 'John Doe',
      product: 'Premium Package',
      amount: 5000,
      status: 'completed',
      date: new Date(2026, 3, 20).toLocaleDateString()
    },
    {
      id: 'ORD-002',
      customerName: 'Jane Smith',
      product: 'Basic Package',
      amount: 2500,
      status: 'processing',
      date: new Date(2026, 3, 22).toLocaleDateString()
    },
    {
      id: 'ORD-003',
      customerName: 'Mike Johnson',
      product: 'Enterprise Package',
      amount: 10000,
      status: 'pending',
      date: new Date(2026, 3, 23).toLocaleDateString()
    },
    {
      id: 'ORD-004',
      customerName: 'Sarah Williams',
      product: 'Standard Package',
      amount: 3500,
      status: 'completed',
      date: new Date(2026, 3, 21).toLocaleDateString()
    },
    {
      id: 'ORD-005',
      customerName: 'Robert Brown',
      product: 'Premium Package',
      amount: 5000,
      status: 'cancelled',
      date: new Date(2026, 3, 19).toLocaleDateString()
    }
  ];
}
// Display orders in table
function displayOrders() {
  const tbody = document.getElementById('ordersTableBody');
  const emptyState = document.getElementById('emptyState');
  if (filteredOrders.length === 0) {
    tbody.innerHTML = '';
    emptyState.style.display = 'block';
    document.getElementById('pagination').innerHTML = '';
    updateOrderMetrics();
    return;
  }
  emptyState.style.display = 'none';
  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / ordersPerPage));
  if (currentPage > totalPages) currentPage = totalPages;
  const startIndex = (currentPage - 1) * ordersPerPage;
  const endIndex = startIndex + ordersPerPage;
  const paginatedOrders = filteredOrders.slice(startIndex, endIndex);
  // Build table rows
  tbody.innerHTML = paginatedOrders.map(order => {
    const checked = selectedOrders.has(order.id) ? 'checked' : '';
    const statusLabel = (order.status || '').toString();
    const statusText = statusLabel.charAt(0).toUpperCase() + statusLabel.slice(1);
    const displayDate = formatOrderTimestamp(order.date);
    return `
    <tr data-order-id="${order.id}">
      <td><input type="checkbox" class="row-select" ${checked} onchange="toggleSelectRow(event, '${order.id}')"></td>
      <td>
        <div class="order-id-cell">
          <span class="order-id" onclick="viewOrderDetails('${order.id}')">${order.id}</span>
          <button type="button" class="copy-order-btn" onclick="copyOrderId(event, '${order.id}')" aria-label="Copy order ID">📋</button>
        </div>
      </td>
      <td>${order.customerName || ''}</td>
      <td>${order.product || ''}</td>
      <td>$${Number(order.amount || 0).toLocaleString('en-US')}</td>
      <td>
        <span class="status-badge status-${statusLabel}">
          ${statusText}
        </span>
      </td>
      <td>${displayDate}</td>
      <td>
        <div class="order-actions">
          <button class="action-btn view-btn" onclick="viewOrderDetails('${order.id}')">View</button>
          <button class="action-btn edit-btn" onclick="editOrder('${order.id}')">Completed</button>
          <button class="action-btn cancel-btn" onclick="cancelOrder('${order.id}')">Cancel</button>
        </div>
      </td>
    </tr>
    `;
  }).join('');
  updateOrderMetrics();
  // Build pagination
  const paginationDiv = document.getElementById('pagination');
  paginationDiv.innerHTML = '';
  if (totalPages > 1) {
    // Previous button
    if (currentPage > 1) {
      const prevBtn = document.createElement('button');
      prevBtn.textContent = '← Previous';
      prevBtn.onclick = () => goToPage(currentPage - 1);
      paginationDiv.appendChild(prevBtn);
    }
    // Page numbers
    for (let i = 1; i <= totalPages; i++) {
      const pageBtn = document.createElement('button');
      pageBtn.textContent = i;
      if (i === currentPage) {
        pageBtn.classList.add('active');
      }
      pageBtn.onclick = () => goToPage(i);
      paginationDiv.appendChild(pageBtn);
    }
    // Next button
    if (currentPage < totalPages) {
      const nextBtn = document.createElement('button');
      nextBtn.textContent = 'Next →';
      nextBtn.onclick = () => goToPage(currentPage + 1);
      paginationDiv.appendChild(nextBtn);
    }
  }
}
// Go to page
function goToPage(page) {
  currentPage = page;
  displayOrders();
  window.scrollTo(0, 0);
}
// Apply filters
function applyFilters() {
  const searchText = document.getElementById('searchInput').value.toLowerCase();
  const statusFilter = document.getElementById('statusFilter').value;
  const dateFilter = document.getElementById('dateFilter').value;
  filteredOrders = allOrders.filter(order => {
    // Search filter
    const matchesSearch = (order.id || '').toString().toLowerCase().includes(searchText) || 
                         (order.customerName || '').toString().toLowerCase().includes(searchText);
    // Status filter
    const matchesStatus = !statusFilter || order.status === statusFilter;
    // Date filter
    let matchesDate = true;
    if (dateFilter) {
      const orderDate = new Date(order.date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (dateFilter === 'today') {
        matchesDate = orderDate.toDateString() === today.toDateString();
      } else if (dateFilter === 'week') {
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        matchesDate = orderDate >= weekAgo && orderDate <= today;
      } else if (dateFilter === 'month') {
        matchesDate = orderDate.getMonth() === today.getMonth() &&
                     orderDate.getFullYear() === today.getFullYear();
      }
    }
    return matchesSearch && matchesStatus && matchesDate;
  });
  currentPage = 1;
  // apply sorting after filtering
  sortArray(filteredOrders, currentSort);
  displayOrders();
}
// Clear filters
function clearFilters() {
  document.getElementById('searchInput').value = '';
  document.getElementById('statusFilter').value = '';
  document.getElementById('dateFilter').value = '';
  filteredOrders = [...allOrders];
  currentPage = 1;
  displayOrders();
}
// Open new order modal
function openNewOrderModal() {
  document.getElementById('orderModal').style.display = 'flex';
}
// Close order modal
function closeOrderModal() {
  document.getElementById('orderModal').style.display = 'none';
  document.getElementById('orderForm').reset();
}
// Handle create order
async function handleCreateOrder(event) {
  event.preventDefault();
  const customerName = document.getElementById('customerName').value;
  const product = document.getElementById('product').value;
  const amount = parseFloat(document.getElementById('amount').value);
  const status = document.getElementById('orderStatus').value;
  try {
    const response = await fetch('/api/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        customerName,
        product,
        amount,
        status
      })
    });
    if (response.ok) {
      const data = await response.json();
      showNotification('Order created successfully!');
      closeOrderModal();
      loadOrders(); // Reload orders from database
    } else {
      const error = await response.json();
      alert('Failed to create order: ' + (error.error || 'Unknown error'));
    }
  } catch (error) {
    console.error('Error creating order:', error);
    alert('Error creating order: ' + error.message);
  }
}
// View order details
function viewOrderDetails(orderId) {
  openOrderModal(orderId);
}

// Open view/edit modal
function openOrderModal(orderId) {
  const order = allOrders.find(o => o.id === orderId);
  if (!order) return showNotification('Order not found');
  document.getElementById('view_order_id').value = order.id;
  document.getElementById('view_customerName').value = order.customerName || '';
  document.getElementById('view_product').value = order.product || '';
  document.getElementById('view_amount').value = Number(order.amount || 0).toFixed(2);
  document.getElementById('view_status').value = order.status || 'pending';
  document.getElementById('view_date').value = formatOrderTimestamp(order.date);
  document.getElementById('orderViewModal').style.display = 'flex';
}

function closeOrderViewModal() {
  document.getElementById('orderViewModal').style.display = 'none';
  document.getElementById('orderViewForm').reset();
}

async function saveOrderChanges(event) {
  event.preventDefault();
  const id = document.getElementById('view_order_id').value;
  const customerName = document.getElementById('view_customerName').value;
  const product = document.getElementById('view_product').value;
  const amount = parseFloat(document.getElementById('view_amount').value) || 0;
  const status = document.getElementById('view_status').value;
  try {
    const res = await fetch(`/api/orders/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ customerName, product, amount, status })
    });
    if (res.ok) {
      // update local copy
      const order = allOrders.find(o => o.id === id);
      if (order) {
        order.customerName = customerName;
        order.product = product;
        order.amount = amount;
        order.status = status;
      }
      showNotification('Order updated');
      closeOrderViewModal();
      displayOrders();
    } else {
      const err = await res.json().catch(()=>({}));
      alert('Failed to save: ' + (err.error || res.statusText));
    }
  } catch (e) {
    console.error('Save order error', e);
    alert('Error saving order');
  }
}
function copyOrderId(event, orderId) {
  event.stopPropagation();
  event.preventDefault();
  if (!orderId) {
    return showNotification('Order ID not available');
  }
  const textToCopy = String(orderId);

  const tryClipboardApi = async () => {
    if (!navigator.clipboard || !navigator.clipboard.writeText) {
      throw new Error('Clipboard API unavailable');
    }
    if (navigator.permissions && navigator.permissions.query) {
      try {
        const permission = await navigator.permissions.query({ name: 'clipboard-write' });
        if (permission.state === 'denied') {
          throw new Error('Clipboard permission denied');
        }
      } catch (_err) {
        // Permission query may not be supported in all browsers; continue.
      }
    }
    return navigator.clipboard.writeText(textToCopy);
  };

  const tryExecCommandFallback = () => {
    return new Promise((resolve, reject) => {
      const textarea = document.createElement('textarea');
      textarea.value = textToCopy;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      textarea.style.top = '0';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      textarea.setSelectionRange(0, textarea.value.length);
      let successful = false;
      try {
        successful = document.execCommand('copy');
      } catch (err) {
        successful = false;
      }
      document.body.removeChild(textarea);
      window.getSelection().removeAllRanges();
      if (successful) resolve();
      else reject(new Error('Fallback copy failed'));
    });
  };

  Promise.resolve()
    .then(() => tryClipboardApi())
    .catch(() => tryExecCommandFallback())
    .then(() => {
      showNotification(`Copied ${orderId} to clipboard.`);
    })
    .catch(error => {
      console.error('Copy failed:', error);
      showNotification('Automatic copy failed. Please try again in a secure browser context.');
    });
}

// Toggle select all
function toggleSelectAll(checkbox) {
  const rows = document.querySelectorAll('.row-select');
  rows.forEach(r => {
    r.checked = checkbox.checked;
    const id = r.closest('tr')?.getAttribute('data-order-id');
    if (checkbox.checked && id) selectedOrders.add(id);
    if (!checkbox.checked && id) selectedOrders.delete(id);
  });
}
function toggleSelectRow(event, orderId) {
  event.stopPropagation();
  if (event.target.checked) selectedOrders.add(orderId);
  else selectedOrders.delete(orderId);
  // sync header checkbox
  const allRow = document.querySelectorAll('.row-select');
  const checked = document.querySelectorAll('.row-select:checked');
  document.getElementById('selectAllCheckbox').checked = allRow.length === checked.length;
}

function applyBulkAction() {
  const action = document.getElementById('bulkActionSelect').value;
  if (!action) return showNotification('Select a bulk action first');
  if (selectedOrders.size === 0) return showNotification('No orders selected');
  const ids = Array.from(selectedOrders);
  if (action === 'mark_completed') {
    ids.forEach(id => {
      const o = allOrders.find(x => x.id === id);
      if (o) o.status = 'completed';
    });
    // send batch update to server if available
    fetch('/api/orders/bulk', {method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ids, status:'completed'})}).catch(()=>{});
    showNotification(`Marked ${ids.length} orders completed`);
  } else if (action === 'cancel') {
    if (!confirm(`Cancel ${ids.length} orders?`)) return;
    ids.forEach(id => {
      const o = allOrders.find(x => x.id === id);
      if (o) o.status = 'cancelled';
    });
    fetch('/api/orders/bulk', {method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ids, status:'cancelled'})}).catch(()=>{});
    showNotification(`Cancelled ${ids.length} orders`);
  }
  // clear selection after action
  selectedOrders.clear();
  document.getElementById('selectAllCheckbox').checked = false;
  displayOrders();
}

function exportCSV() {
  if (filteredOrders.length === 0) return showNotification('No orders to export');
  const rows = filteredOrders.map(o => ({
    id: o.id,
    customerName: o.customerName,
    product: o.product,
    amount: o.amount,
    status: o.status,
    date: o.date
  }));
  const csv = [Object.keys(rows[0]).join(',')].concat(rows.map(r => Object.values(r).map(v => '"' + String(v).replace(/"/g,'""') + '"').join(','))).join('\n');
  const blob = new Blob([csv], {type: 'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `orders-export-${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function setPerPage(val) {
  ordersPerPage = Number(val) || 10;
  currentPage = 1;
  displayOrders();
}

function sortOrders(val) {
  currentSort = val;
  sortArray(filteredOrders, val);
  displayOrders();
}

function sortArray(arr, val) {
  if (!arr || !arr.sort) return;
  if (val === 'date_desc') arr.sort((a,b)=> new Date(b.date) - new Date(a.date));
  else if (val === 'date_asc') arr.sort((a,b)=> new Date(a.date) - new Date(b.date));
  else if (val === 'amount_desc') arr.sort((a,b)=> Number(b.amount) - Number(a.amount));
  else if (val === 'amount_asc') arr.sort((a,b)=> Number(a.amount) - Number(b.amount));
}

function switchPage(page) {
  const ordersView = document.getElementById('ordersView');
  const menuView = document.getElementById('menuView');
  const orderTabs = document.querySelectorAll('.page-tab[data-page="orders"]');
  const menuTabs = document.querySelectorAll('.page-tab[data-page="menu"]');
  const pageTitle = document.getElementById('pageTitle');
  const ordersAction = document.getElementById('ordersActionGroup');
  const isMenu = page === 'menu';

  if (isMenu) {
    ordersView.style.display = 'none';
    menuView.style.display = 'block';
    pageTitle.textContent = 'Menu';
    if (ordersAction) ordersAction.style.display = 'none';
    refreshMenu();
  } else {
    ordersView.style.display = 'block';
    menuView.style.display = 'none';
    pageTitle.textContent = 'Orders';
    if (ordersAction) ordersAction.style.display = 'flex';
  }

  orderTabs.forEach(btn => {
    btn.classList.toggle('active', !isMenu);
    btn.setAttribute('aria-selected', String(!isMenu));
  });
  menuTabs.forEach(btn => {
    btn.classList.toggle('active', isMenu);
    btn.setAttribute('aria-selected', String(isMenu));
  });
}

function loadMenu() {
  // Try to fetch menu from backend API; fallback to local sample
  fetch('/api/menu')
    .then(r => r.json())
    .then(data => {
      // API returns object grouped by category: { category: { key_name: { name, price, available, image_url } } }
      const arr = [];
      for (const cat of Object.keys(data || {})) {
        const group = data[cat] || {};
        for (const key of Object.keys(group)) {
          const it = group[key];
          arr.push({ id: key, key, name: it.name || key, category: cat, subtype: '', price: parseFloat(it.price || 0), available: !!it.available, stock: it.available || 0, tags: [], description: it.description || '', image_url: it.image_url || null });
        }
      }
      if (arr.length === 0) {
        // fallback sample
        menuItems = [
          { id: 'm1', name: 'Margherita', category: 'Pizza', subtype: 'Classic', price: 8.99, available: true, stock: 24, tags: ['Featured'], description: 'Tomato sauce, fresh mozzarella, basil' },
          { id: 'm2', name: 'Pepperoni', category: 'Pizza', subtype: 'Classic', price: 9.99, available: true, stock: 18, tags: ['Popular', 'Discount'], description: 'Pepperoni, mozzarella' },
        ];
      } else {
        menuItems = arr;
      }
      filteredMenuItems = [...menuItems];
      buildMenuChips();
      renderMenu();
    }).catch(err => {
      console.warn('Failed to load /api/menu, using sample', err);
      menuItems = [
        { id: 'm1', name: 'Margherita', category: 'Pizza', subtype: 'Classic', price: 8.99, available: true, stock: 24, tags: ['Featured'], description: 'Tomato sauce, fresh mozzarella, basil' },
        { id: 'm2', name: 'Pepperoni', category: 'Pizza', subtype: 'Classic', price: 9.99, available: true, stock: 18, tags: ['Popular', 'Discount'], description: 'Pepperoni, mozzarella' },
      ];
      filteredMenuItems = [...menuItems];
      buildMenuChips();
      renderMenu();
    });
}

function buildMenuChips() {
  const categorySet = new Set(menuItems.map(i => i.category));
  const categories = ['All', ...categorySet];
  const tagSet = new Set(menuItems.flatMap(i => i.tags || []));
  const tags = ['All', ...tagSet];

  const catContainer = document.getElementById('menuCategoryChips');
  const tagContainer = document.getElementById('menuTagChips');
  if (catContainer) {
    catContainer.innerHTML = categories.map(category => {
      const activeClass = category === currentMenuCategory ? 'active' : '';
      return `<button type="button" class="menu-chip ${activeClass}" onclick="setMenuCategory('${category}')">${category}</button>`;
    }).join('');
  }
  if (tagContainer) {
    tagContainer.innerHTML = tags.map(tag => {
      const activeClass = tag === currentMenuTag ? 'active' : '';
      return `<button type="button" class="menu-chip ${activeClass}" onclick="setMenuTag('${tag}')">${tag}</button>`;
    }).join('');
  }
}

function setMenuCategory(category) {
  currentMenuCategory = category;
  applyMenuFilters();
  buildMenuChips();
}

function setMenuTag(tag) {
  currentMenuTag = tag;
  applyMenuFilters();
  buildMenuChips();
}

function applyMenuFilters() {
  const query = (document.getElementById('menuSearchInput')?.value || '').toLowerCase();
  filteredMenuItems = menuItems.filter(item => {
    const matchesCategory = currentMenuCategory === 'All' || item.category === currentMenuCategory;
    const matchesTag = currentMenuTag === 'All' || (item.tags || []).includes(currentMenuTag);
    const matchesSearch = item.name.toLowerCase().includes(query) || (item.description || '').toLowerCase().includes(query) || (item.tags || []).some(t => t.toLowerCase().includes(query));
    return matchesCategory && matchesTag && matchesSearch;
  });
  sortMenuItems(currentMenuSort, false);
  renderMenu();
}

function sortMenuItems(val, rerender = true) {
  currentMenuSort = val;
  if (val === 'price_asc') {
    filteredMenuItems.sort((a,b) => a.price - b.price);
  } else if (val === 'price_desc') {
    filteredMenuItems.sort((a,b) => b.price - a.price);
  } else if (val === 'stock_desc') {
    filteredMenuItems.sort((a,b) => (b.stock || b.inventory || 0) - (a.stock || a.inventory || 0));
  } else {
    // Recommended: featured first, then available, then by price
    filteredMenuItems.sort((a,b) => {
      const af = (a.tags||[]).includes('Featured') ? 1 : 0;
      const bf = (b.tags||[]).includes('Featured') ? 1 : 0;
      if (af !== bf) return bf - af;
      if ((a.available?1:0) !== (b.available?1:0)) return (b.available?1:0) - (a.available?1:0);
      return a.price - b.price;
    });
  }
  if (rerender) renderMenu();
}

function renderMenu() {
  const grid = document.getElementById('menuGrid');
  const body = document.getElementById('menuTableBody');
  const totalEl = document.getElementById('totalMenuItems');
  const itemCount = document.getElementById('menuItemCount');
  const featuredCountEl = document.getElementById('menuTrendCount');
  const previewCount = document.getElementById('menuPreviewCount');
  const balance = document.getElementById('menuBalance');
  const highConvert = document.getElementById('menuHighConvert');
  const freshness = document.getElementById('menuFreshness');

  if (!grid || !body) return;

  grid.innerHTML = filteredMenuItems.map(item => {
    const tags = (item.tags || []).map(tag => `<span class="menu-card-tag">${tag}</span>`).join(' ');
    const avail = item.available ? `<span style="color:green;font-weight:700">Available</span>` : `<span style="color:#b91c1c;font-weight:700">Out</span>`;
    return `
      <article class="menu-card">
        <div class="menu-card-content">
          <h3>${item.name}</h3>
          <p>${item.description || ''}</p>
          <div class="menu-card-meta">
            <span><strong>Price</strong><strong>$${item.price.toFixed(2)}</strong></span>
            <span><strong>Category</strong><strong>${item.category}</strong></span>
            <span><strong>Stock</strong><strong>${item.stock || item.inventory || 0}</strong></span>
          </div>
          <div style="margin-top: 12px; display:flex; gap:8px; align-items:center;">
            ${tags}
            <div style="margin-left:auto">${avail}</div>
          </div>
          <div style="margin-top:12px; display:flex; gap:8px;">
            <button class="filter-btn" onclick="openMenuItemModal('${item.id}')">Edit</button>
            <button class="filter-btn" style="background:#dc3545" onclick="deleteMenuItem('${item.id}')">Delete</button>
          </div>
        </div>
      </article>
    `;
  }).join('');

  body.innerHTML = filteredMenuItems.map(item => `
    <tr>
      <td>${item.name}</td>
      <td>${item.category}${item.subtype?(' / '+item.subtype):''}</td>
      <td>$${item.price.toFixed(2)}</td>
      <td>${item.available ? 'Yes' : 'No'}</td>
      <td>${item.stock || item.inventory || 0}</td>
      <td>${(item.tags||[]).join(', ')}</td>
      <td>
        <button class="filter-btn" onclick="openMenuItemModal('${item.id}')">Edit</button>
        <button class="filter-btn" style="background:#dc3545" onclick="deleteMenuItem('${item.id}')">Delete</button>
      </td>
    </tr>
  `).join('');

  if (totalEl) totalEl.textContent = String(menuItems.length);
  if (itemCount) itemCount.textContent = String(filteredMenuItems.filter(i=>i.available).length);
  if (featuredCountEl) featuredCountEl.textContent = String(filteredMenuItems.filter(i=> (i.tags||[]).includes('Featured')).length);
  if (previewCount) previewCount.textContent = String(filteredMenuItems.length);
  if (balance) balance.textContent = `${Math.min(100, 60 + filteredMenuItems.length * 3)}%`;
  if (highConvert) highConvert.textContent = filteredMenuItems.filter(i=> (i.tags||[]).includes('Featured')).length;
  if (freshness) freshness.textContent = `${Math.min(100, 85 + filteredMenuItems.length)}%`;
}

function refreshMenu() {
  applyMenuFilters();
  showNotification('Menu intelligence refreshed');
}

function toggleMenuMode() {
  const btn = document.getElementById('menuModeBtn');
  if (!btn) return;
  const active = btn.classList.toggle('active');
  btn.textContent = active ? 'Adaptive Mode On' : 'Adaptive Mode';
  showNotification(active ? 'Adaptive menu optimization engaged' : 'Adaptive mode paused');
}

function showLaunchpad() {
  showNotification('Launchpad enabled — draft new menu concepts instantly');
}

function bulkGenerateMenuReport() {
  showNotification('Menu analytics report generated');
}

// Menu item modal handlers
function openMenuItemModal(id) {
  const modal = document.getElementById('menuItemModal');
  const title = document.getElementById('menuItemModalTitle');
  const delBtn = document.getElementById('menuItemDeleteBtn');
  const form = document.getElementById('menuItemForm');
  form.reset();
  document.getElementById('menuItemId').value = '';
  if (!id) {
    title.textContent = 'Add Menu Item';
    if (delBtn) delBtn.style.display = 'none';
  } else {
    const item = menuItems.find(i => i.id === id);
    if (item) {
      title.textContent = 'Edit Menu Item';
      document.getElementById('menuItemId').value = item.id;
      document.getElementById('menuItemName').value = item.name || '';
      document.getElementById('menuItemCategory').value = item.category || '';
      document.getElementById('menuItemSubtype').value = item.subtype || '';
      document.getElementById('menuItemPrice').value = item.price || 0;
      document.getElementById('menuItemStock').value = item.stock || item.inventory || 0;
      document.getElementById('menuItemTags').value = (item.tags||[]).join(',');
      document.getElementById('menuItemDesc').value = item.description || '';
      document.getElementById('menuItemAvailable').checked = !!item.available;
      if (delBtn) delBtn.style.display = 'inline-block';
    }
  }
  if (modal) modal.style.display = 'flex';
}

function closeMenuItemModal() {
  const modal = document.getElementById('menuItemModal');
  const form = document.getElementById('menuItemForm');
  if (form) form.reset();
  if (modal) modal.style.display = 'none';
}

function handleMenuItemSave(event) {
  event.preventDefault();
  const id = document.getElementById('menuItemId').value;
  const name = document.getElementById('menuItemName').value.trim();
  const category = document.getElementById('menuItemCategory').value.trim() || 'Uncategorized';
  const subtype = document.getElementById('menuItemSubtype').value.trim();
  const price = parseFloat(document.getElementById('menuItemPrice').value) || 0;
  const stock = parseInt(document.getElementById('menuItemStock').value) || 0;
  const tags = (document.getElementById('menuItemTags').value || '').split(',').map(t=>t.trim()).filter(Boolean);
  const description = document.getElementById('menuItemDesc').value || '';
  const available = !!document.getElementById('menuItemAvailable').checked;

  // Prepare payload for backend
  const keyFromName = name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
  const key = (id && !id.startsWith('m')) ? id : keyFromName;
  const payload = { category, key, name, price, available: stock, image_url: null };

  fetch('/api/menu/item', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) })
    .then(r => r.json())
    .then(resp => {
      if (resp && resp.success) {
        // update local cache
        const idx = menuItems.findIndex(i=>i.id===id || i.id===key);
        const entry = { id: key, key, name, category, subtype, price, stock, tags, description, available };
        if (idx !== -1) menuItems[idx] = entry;
        else menuItems.push(entry);
        buildMenuChips();
        applyMenuFilters();
        closeMenuItemModal();
        showNotification('Menu item saved');
      } else {
        // fallback local update
        const idx = menuItems.findIndex(i=>i.id===id);
        if (idx !== -1) menuItems[idx] = { ...menuItems[idx], name, category, subtype, price, stock, tags, description, available };
        else menuItems.push({ id: key, key, name, category, subtype, price, stock, tags, description, available });
        buildMenuChips();
        applyMenuFilters();
        closeMenuItemModal();
        showNotification('Menu item saved (offline)');
      }
    }).catch(err => {
      console.warn('Save menu item failed', err);
      // fallback local update
      const idx = menuItems.findIndex(i=>i.id===id);
      if (idx !== -1) menuItems[idx] = { ...menuItems[idx], name, category, subtype, price, stock, tags, description, available };
      else menuItems.push({ id: key, key, name, category, subtype, price, stock, tags, description, available });
      buildMenuChips();
      applyMenuFilters();
      closeMenuItemModal();
      showNotification('Menu item saved (offline)');
    });
}

function deleteMenuItem(id) {
  if (!confirm('Delete this menu item?')) return;
  const item = menuItems.find(i=>i.id===id);
  if (!item) return showNotification('Item not found');
  const category = item.category || 'other';
  const key = item.key || item.id;
  fetch(`/api/menu/item/${encodeURIComponent(category)}/${encodeURIComponent(key)}`, { method: 'DELETE' })
    .then(r => r.json())
    .then(resp => {
      if (resp && resp.success) {
        const idx = menuItems.findIndex(i=>i.id===id);
        if (idx !== -1) menuItems.splice(idx,1);
        buildMenuChips();
        applyMenuFilters();
        showNotification('Menu item deleted');
      } else {
        // fallback: local delete
        const idx = menuItems.findIndex(i=>i.id===id);
        if (idx !== -1) menuItems.splice(idx,1);
        buildMenuChips();
        applyMenuFilters();
        showNotification('Menu item deleted (offline)');
      }
    }).catch(err => {
      console.warn('Delete menu item failed', err);
      const idx = menuItems.findIndex(i=>i.id===id);
      if (idx !== -1) menuItems.splice(idx,1);
      buildMenuChips();
      applyMenuFilters();
      showNotification('Menu item deleted (offline)');
    });
}

function deleteMenuItemFromModal() {
  const id = document.getElementById('menuItemId').value;
  if (!id) return;
  deleteMenuItem(id);
  closeMenuItemModal();
}

// Mark order completed
function editOrder(orderId) {
  const order = allOrders.find(o => o.id === orderId);
  if (!order || order.status === 'completed') {
    return;
  }
  fetch(`/api/orders/${orderId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ status: 'completed' })
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      order.status = 'completed';
      displayOrders();
      showNotification(`Order ${orderId} marked completed.`);
    } else {
      alert('Failed to update order');
    }
  })
  .catch(error => {
    console.error('Error updating order:', error);
    alert('Error updating order');
  });
}
// Cancel order
function cancelOrder(orderId) {
  if (confirm('Are you sure you want to cancel this order?')) {
    const order = allOrders.find(o => o.id === orderId);
    if (order) {
      // Update status on server
      fetch(`/api/orders/${orderId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: 'cancelled' })
      })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          order.status = 'cancelled';
          displayOrders();
          showNotification(`Order ${orderId} cancelled!`);
        } else {
          alert('Failed to cancel order');
        }
      })
      .catch(error => {
        console.error('Error cancelling order:', error);
        alert('Error cancelling order');
      });
    }
  }
}
// Show empty state
function showEmptyState() {
  document.getElementById('ordersTableBody').innerHTML = '';
  document.getElementById('emptyState').style.display = 'block';
  document.getElementById('pagination').innerHTML = '';
}
// Show notification
function showNotification(message) {
  const notificationBar = document.getElementById('notificationBar');
  const notificationText = document.getElementById('notificationText');
  notificationText.textContent = message;
  notificationBar.style.display = 'block';
  setTimeout(() => {
    notificationBar.style.display = 'none';
  }, 3000);
}
// Theme toggle
function setupThemeToggle() {
  const theme = localStorage.getItem('theme') || 'Light';
  if (theme === 'Dark') {
    document.documentElement.classList.add('dark-theme');
  }
}

// Close modal when clicking outside
document.addEventListener('click', (e) => {
  const modal = document.getElementById('orderModal');
  if (e.target === modal) {
    closeOrderModal();
  }
});
// Search on Enter key
document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        applyFilters();
      }
    });
  }
});
