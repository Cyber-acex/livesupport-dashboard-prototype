
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
let currentMenuSpecialCategory = 'All';
let currentMenuSort = 'score_desc';
let currentMenuSection = 'items';
let tableLayout = [];
const MENU_STORAGE_KEY = 'ls_menu_items_cache';
let pendingAIDraftOrder = null;

function loadAIDraftFromStorage() {
  try {
    const raw = localStorage.getItem('ls_aiOrderDraft');
    if (!raw) return null;
    localStorage.removeItem('ls_aiOrderDraft');
    return JSON.parse(raw);
  } catch (err) {
    console.warn('Failed to load AI order draft:', err);
    return null;
  }
}

function findMenuItemBySummaryName(name) {
  if (!name) return null;
  const lowerName = name.toLowerCase().trim();
  let match = menuItems.find(item => item.name.toLowerCase() === lowerName);
  if (match) return match;
  match = menuItems.find(item => item.name.toLowerCase().includes(lowerName));
  if (match) return match;
  if (/pizza/.test(lowerName)) return menuItems.find(item => item.category.toLowerCase() === 'pizza' && item.available && item.stock > 0);
  if (/burger/.test(lowerName)) return menuItems.find(item => item.category.toLowerCase() === 'burgers' && item.available && item.stock > 0);
  if (/fries|side|loaded/.test(lowerName)) return menuItems.find(item => item.category.toLowerCase() === 'sides' && item.available && item.stock > 0) || menuItems.find(item => item.name.toLowerCase().includes('fries'));
  if (/salad/.test(lowerName)) return menuItems.find(item => item.category.toLowerCase() === 'salads' && item.available && item.stock > 0);
  if (/pasta/.test(lowerName)) return menuItems.find(item => item.category.toLowerCase() === 'pasta' && item.available && item.stock > 0);
  if (/wrap/.test(lowerName)) return menuItems.find(item => item.name.toLowerCase().includes('wrap') && item.available && item.stock > 0);
  return null;
}

function buildDraftOrderItems(itemsSummary) {
  if (!itemsSummary || typeof itemsSummary !== 'string') return [];
  const raw = itemsSummary.replace(/\band\b/gi, ',');
  const parts = raw.split(/[,;]+/).map(part => part.trim()).filter(Boolean);
  const rows = [];

  for (const part of parts) {
    let qty = 1;
    let name = part;
    const match = part.match(/^(\d+)\s*x?\s*(.+)$/i);
    if (match) {
      qty = Number(match[1]) || 1;
      name = match[2].trim();
    }

    const menuItem = findMenuItemBySummaryName(name);
    if (menuItem) {
      rows.push({ menuItemId: menuItem.id, quantity: qty, name: menuItem.name });
    } else {
      rows.push({ name, quantity: qty });
    }
  }

  return rows;
}

function processPendingAIDraft() {
  if (!pendingAIDraftOrder) return;
  openNewOrderModal(pendingAIDraftOrder);
  pendingAIDraftOrder = null;
}

const SAMPLE_MENU_ITEMS = [
  { id: 'm1', name: 'Margherita', category: 'Pizza', subtype: 'Classic', price: 8.99, available: true, stock: 24, tags: ['Featured', 'Premium'], description: 'Tomato sauce, fresh mozzarella, basil' },
  { id: 'm2', name: 'Pepperoni', category: 'Pizza', subtype: 'Classic', price: 9.99, available: true, stock: 18, tags: ['Popular', 'Discount'], description: 'Pepperoni, mozzarella' },
  { id: 'm3', name: 'BBQ Chicken', category: 'Pizza', subtype: 'Signature', price: 12.50, available: true, stock: 15, tags: ['Popular'], description: 'Smoky barbecue sauce, chicken, red onion' },
  { id: 'm4', name: 'Four Cheese', category: 'Pizza', subtype: 'Vegetarian', price: 11.75, available: true, stock: 14, tags: ['Vegetarian'], description: 'Mozzarella, cheddar, parmesan, goat cheese' },
  { id: 'm5', name: 'Hawaiian', category: 'Pizza', subtype: 'Classic', price: 10.99, available: true, stock: 12, tags: ['Sweet & Savory'], description: 'Ham, pineapple, mozzarella' },
  { id: 'm6', name: 'Spicy Thai', category: 'Pizza', subtype: 'Premium', price: 13.50, available: true, stock: 10, tags: ['Premium', 'Spicy'], description: 'Peanut sauce, chicken, chili, cilantro' },
  { id: 'm7', name: 'Classic Burger', category: 'Burgers', subtype: 'Beef', price: 8.99, available: true, stock: 25, tags: ['Popular'], description: 'Beef patty, lettuce, tomato, onion, pickles' },
  { id: 'm8', name: 'Cheese Burger', category: 'Burgers', subtype: 'Beef', price: 9.99, available: true, stock: 22, tags: ['Popular', 'Discount'], description: 'Beef patty, cheddar, caramelized onions' },
  { id: 'm9', name: 'Double Burger', category: 'Burgers', subtype: 'Beef', price: 12.99, available: true, stock: 16, tags: ['Hearty'], description: 'Two beef patties, cheese, bacon, secret sauce' },
  { id: 'm10', name: 'Veggie Deluxe', category: 'Burgers', subtype: 'Vegetarian', price: 10.50, available: true, stock: 18, tags: ['Vegetarian'], description: 'Grilled veggie patty, avocado, sprouts, aioli' },
  { id: 'm11', name: 'Crispy Chicken', category: 'Burgers', subtype: 'Chicken', price: 11.25, available: true, stock: 20, tags: ['Crispy'], description: 'Fried chicken, slaw, spicy mayo' },
  { id: 'm12', name: 'Avocado Wrap', category: 'Sandwiches', subtype: 'Fresh', price: 9.50, available: true, stock: 18, tags: ['Healthy'], description: 'Avocado, spinach, hummus, tomato in a tortilla' },
  { id: 'm13', name: 'BLT Sandwich', category: 'Sandwiches', subtype: 'Classic', price: 9.99, available: true, stock: 17, tags: ['Classic'], description: 'Bacon, lettuce, tomato, mayo on sourdough' },
  { id: 'm14', name: 'Steak Sandwich', category: 'Sandwiches', subtype: 'Premium', price: 13.75, available: true, stock: 9, tags: ['Premium'], description: 'Sliced steak, caramelized onions, peppercorn sauce' },
  { id: 'm15', name: 'Chicken Caesar Wrap', category: 'Sandwiches', subtype: 'Classic', price: 10.25, available: true, stock: 19, tags: ['Popular'], description: 'Grilled chicken, romaine, parmesan, Caesar dressing' },
  { id: 'm16', name: 'Greek Salad', category: 'Salads', subtype: 'Fresh', price: 10.99, available: true, stock: 20, tags: ['Vegetarian'], description: 'Cucumber, feta, olives, tomato, oregano dressing' },
  { id: 'm17', name: 'Cobb Salad', category: 'Salads', subtype: 'Protein', price: 11.50, available: true, stock: 18, tags: ['Protein'], description: 'Chicken, bacon, egg, avocado, blue cheese' },
  { id: 'm18', name: 'Harvest Bowl', category: 'Bowls', subtype: 'Seasonal', price: 12.75, available: true, stock: 15, tags: ['Healthy'], description: 'Quinoa, roasted vegetables, grilled chicken, tahini' },
  { id: 'm19', name: 'Pesto Pasta', category: 'Pasta', subtype: 'Vegetarian', price: 11.99, available: true, stock: 16, tags: ['Vegetarian'], description: 'Penne tossed with basil pesto and parmesan' },
  { id: 'm20', name: 'Shrimp Alfredo', category: 'Pasta', subtype: 'Seafood', price: 14.50, available: true, stock: 12, tags: ['Premium'], description: 'Fettuccine in creamy Alfredo with sautéed shrimp' },
  { id: 'm21', name: 'Mushroom Risotto', category: 'Pasta', subtype: 'Vegetarian', price: 13.25, available: true, stock: 14, tags: ['Rich'], description: 'Creamy arborio rice with wild mushrooms and parmesan' },
  { id: 'm22', name: 'Loaded Fries', category: 'Sides', subtype: 'Snack', price: 7.50, available: true, stock: 26, tags: ['Popular'], description: 'Crispy fries topped with cheese, bacon, and jalapeños' },
  { id: 'm23', name: 'Garlic Bread', category: 'Sides', subtype: 'Classic', price: 5.99, available: true, stock: 28, tags: ['Classic'], description: 'Toasted baguette with garlic butter and herbs' },
  { id: 'm24', name: 'Onion Rings', category: 'Sides', subtype: 'Crispy', price: 6.50, available: true, stock: 24, tags: ['Crispy'], description: 'Beer-battered onion rings with dipping sauce' },
  { id: 'm25', name: 'Cheese Sticks', category: 'Sides', subtype: 'Snack', price: 7.25, available: true, stock: 22, tags: ['Cheesy'], description: 'Breaded mozzarella sticks with marinara' },
  { id: 'm26', name: 'Chocolate Lava Cake', category: 'Desserts', subtype: 'Sweet', price: 8.50, available: true, stock: 15, tags: ['Dessert'], description: 'Warm chocolate cake with molten core' },
  { id: 'm27', name: 'Tiramisu', category: 'Desserts', subtype: 'Classic', price: 8.99, available: true, stock: 14, tags: ['Classic'], description: 'Coffee-soaked ladyfingers, mascarpone cream' },
  { id: 'm28', name: 'Berry Parfait', category: 'Desserts', subtype: 'Fresh', price: 7.99, available: true, stock: 18, tags: ['Healthy'], description: 'Greek yogurt layered with berries and granola' },
  { id: 'm29', name: 'Iced Lemon Tea', category: 'Drinks', subtype: 'Cold', price: 3.99, available: true, stock: 40, tags: ['Refreshing'], description: 'Lemon iced tea with mint and honey' },
  { id: 'm30', name: 'Sparkling Water', category: 'Drinks', subtype: 'Cold', price: 2.99, available: true, stock: 50, tags: ['Light'], description: 'Chilled sparkling mineral water' },
];

function saveMenuItemsToStorage() {
  try {
    localStorage.setItem(MENU_STORAGE_KEY, JSON.stringify(menuItems));
  } catch (e) {
    console.warn('Could not save menu items to localStorage', e);
  }
}

function loadMenuItemsFromStorage() {
  try {
    const raw = localStorage.getItem(MENU_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch (e) {
    console.warn('Could not load menu items from localStorage', e);
    return null;
  }
}

function mergeMenuItems(baseItems, extraItems) {
  const itemsById = new Map();
  baseItems.forEach(item => {
    if (item && item.id) itemsById.set(item.id, { ...item });
  });
  extraItems.forEach(item => {
    if (item && item.id && !itemsById.has(item.id)) {
      itemsById.set(item.id, { ...item });
    }
  });
  return Array.from(itemsById.values());
}

function normalizeDate(value) {
  if (!value) return new Date().toISOString();
  // Numbers may be seconds (unix) or milliseconds. Treat small numbers as seconds.
  if (typeof value === 'number') {
    return value < 1e10 ? new Date(value * 1000).toISOString() : new Date(value).toISOString();
  }
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    const n = Number(value);
    return n < 1e10 ? new Date(n * 1000).toISOString() : new Date(n).toISOString();
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toISOString();
}

function formatOrderTimestamp(value) {
  if (!value) return 'Unknown';
  // Accept either ISO strings or numeric epochs (seconds/ms)
  let dateObj;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    dateObj = new Date(value);
  } else if (typeof value === 'string' && /^\d+$/.test(value)) {
    const n = Number(value);
    dateObj = n < 1e10 ? new Date(n * 1000) : new Date(n);
  } else if (typeof value === 'number') {
    dateObj = value < 1e10 ? new Date(value * 1000) : new Date(value);
  } else {
    dateObj = new Date(value);
  }
  if (Number.isNaN(dateObj.getTime())) return String(value);
  return dateObj.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

function applyOrderPageHash() {
  const hash = window.location.hash;
  if (hash === '#menu') {
    switchPage('menu');
  }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  loadStaffName();
  pendingAIDraftOrder = loadAIDraftFromStorage();
  loadOrders();
  loadMenu();
  loadTableLayout();
  applyOrderPageHash();
  setupThemeToggle();
  setupRealtimeUpdates();
  setInterval(refreshTableLayout, 30000);
});

window.addEventListener('hashchange', applyOrderPageHash);
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
      date: normalizeDate(payload.date || new Date().toISOString())
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
      allOrders = allOrders.map(o => {
        const amount = Number(o.amount || o.total || 0);
        const rawDate = o.date ?? o.created_at ?? o.createdAt ?? new Date().toISOString();
        const date = normalizeDate(rawDate);
        return { ...o, amount, date };
      });
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
      date: new Date(2026, 3, 20).toISOString()
    },
    {
      id: 'ORD-002',
      customerName: 'Jane Smith',
      product: 'Basic Package',
      amount: 2500,
      status: 'processing',
      date: new Date(2026, 3, 22).toISOString()
    },
    {
      id: 'ORD-003',
      customerName: 'Mike Johnson',
      product: 'Enterprise Package',
      amount: 10000,
      status: 'pending',
      date: new Date(2026, 3, 23).toISOString()
    },
    {
      id: 'ORD-004',
      customerName: 'Sarah Williams',
      product: 'Standard Package',
      amount: 3500,
      status: 'completed',
      date: new Date(2026, 3, 21).toISOString()
    },
    {
      id: 'ORD-005',
      customerName: 'Robert Brown',
      product: 'Premium Package',
      amount: 5000,
      status: 'cancelled',
      date: new Date(2026, 3, 19).toISOString()
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
    const quantityText = order.quantity ? ` x${order.quantity}` : '';
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
      <td>${order.product || ''}${quantityText}</td>
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
          <button class="action-btn receipt-btn" onclick="generateOrderReceipt('${order.id}')">Receipt</button>
          <button class="action-btn edit-btn" onclick="editOrder('${order.id}')" ${order.status === 'completed' ? 'disabled' : ''}>Completed</button>
          <button class="action-btn cancel-btn" onclick="cancelOrder('${order.id}')" ${order.status === 'cancelled' ? 'disabled' : ''}>Cancel</button>
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
function updateOrderTableOptions(selectedTableNumber) {
  const tableSelect = document.getElementById('orderTableNumber');
  if (!tableSelect) return;

  let tables = Array.isArray(tableLayout) && tableLayout.length ? tableLayout : [];
  if (tables.length === 0) {
    tables = Array.from({ length: 40 }, (_, i) => ({ number: i + 1, label: `Table ${i + 1}`, status: 'vacant' }));
  }

  const sortedTables = tables.slice().sort((a, b) => Number(a.number) - Number(b.number));
  const options = ['<option value="">-- No table / Takeaway --</option>'];
  sortedTables.forEach(table => {
    const statusLabel = table.status ? ` — ${String(table.status).charAt(0).toUpperCase() + String(table.status).slice(1)}` : '';
    options.push(`<option value="${Number(table.number)}">Table ${Number(table.number)}${statusLabel}</option>`);
  });
  tableSelect.innerHTML = options.join('');
  if (selectedTableNumber !== undefined && selectedTableNumber !== null) {
    tableSelect.value = String(selectedTableNumber);
  }
}

function openNewOrderModal(orderData = {}) {
  const container = document.getElementById('orderItemsContainer');
  container.innerHTML = '';
  const items = Array.isArray(orderData.items) && orderData.items.length ? orderData.items : buildDraftOrderItems(orderData.itemsSummary || '');
  if (items.length > 0) {
    items.forEach(item => addOrderItemRow(item));
  } else {
    addOrderItemRow();
  }

  const customerNameInput = document.getElementById('customerName');
  if (customerNameInput) customerNameInput.value = orderData.customerName || '';
  const tableSelect = document.getElementById('orderTableNumber');
  if (tableLayout.length === 0) {
    loadTableLayout().then(() => updateOrderTableOptions(orderData.tableNumber || null));
  } else {
    updateOrderTableOptions(orderData.tableNumber || null);
  }
  const statusSelect = document.getElementById('orderStatus');
  if (statusSelect) statusSelect.value = orderData.status || 'pending';

  if (orderData.amount !== undefined && orderData.amount !== null) {
    document.getElementById('amount').value = Number(orderData.amount).toFixed(2);
  } else {
    updateOrderAmount();
  }

  document.getElementById('orderModal').style.display = 'flex';
}
window.openOrderModalWithData = openNewOrderModal;

function updateOrderAmount() {
  const container = document.getElementById('orderItemsContainer');
  const rows = container.querySelectorAll('.order-item-row');
  let total = 0;
  rows.forEach(row => {
    const select = row.querySelector('.menuItemSelect');
    const qtyInput = row.querySelector('.orderQuantity');
    const itemAmountInput = row.querySelector('.itemAmount');
    const qty = parseInt(qtyInput.value) || 1;
    if (!select.value) {
      itemAmountInput.value = '';
      return;
    }
    const item = menuItems.find(i => i.id === select.value);
    if (item) {
      const itemTotal = parseFloat((item.price * qty).toFixed(2));
      itemAmountInput.value = itemTotal;
      total += itemTotal;
    } else {
      itemAmountInput.value = '';
    }
  });
  document.getElementById('amount').value = total ? total.toFixed(2) : '';
}
// Close order modal
function closeOrderModal() {
  document.getElementById('orderModal').style.display = 'none';
  document.getElementById('orderForm').reset();
  const container = document.getElementById('orderItemsContainer');
  if (container) container.innerHTML = '';
}
// Handle create order
async function handleCreateOrder(event) {
  event.preventDefault();
  const customerName = document.getElementById('customerName').value;
  const amount = parseFloat(document.getElementById('amount').value) || 0;
  // Collect item rows
  const container = document.getElementById('orderItemsContainer');
  const rows = container.querySelectorAll('.order-item-row');
  const items = [];
  let totalQuantity = 0;
  for (const row of rows) {
    const select = row.querySelector('.menuItemSelect');
    const qtyInput = row.querySelector('.orderQuantity');
    const qty = parseInt(qtyInput.value) || 1;
    if (!select.value) {
      alert('Please select a menu item for each row');
      return;
    }
    const item = menuItems.find(i => i.id === select.value);
    if (!item) {
      alert('Menu item not found');
      return;
    }
    if (qty > item.stock) {
      alert(`Insufficient stock for ${item.name}. Available: ${item.stock}`);
      return;
    }
    items.push({ menuItemId: item.id, name: item.name, quantity: qty, price: item.price });
    totalQuantity += qty;
  }
  const status = document.getElementById('orderStatus').value;

  if (items.length === 0) {
    alert('Please add at least one product');
    return;
  }
  
  try {
    const tableNumberValue = document.getElementById('orderTableNumber')?.value;
  const tableNumber = tableNumberValue ? Number(tableNumberValue) : null;

  const response = await fetch('/api/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
          customerName,
          tableNumber,
          product: items.map(i=>i.name).join(', '),
          menuItemId: items[0] ? items[0].menuItemId : null,
          quantity: totalQuantity,
          amount,
          status,
          items
      })
    });
    if (response.ok) {
      const data = await response.json();
        // Decrease stock locally for each item
        items.forEach(it => {
          const mi = menuItems.find(m=>m.id===it.menuItemId);
          if (mi) mi.stock -= it.quantity;
        });

      const tableNumberValue = document.getElementById('orderTableNumber')?.value;
      const tableNumber = tableNumberValue ? Number(tableNumberValue) : null;
      if (tableNumber) {
        const expiration = new Date(Date.now() + 15 * 60 * 1000).toISOString();
        await persistTableState(tableNumber, 'occupied', customerName, expiration, false);
      }

      applyMenuFilters();
      renderMenu();
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

// Add new order item row
function addOrderItemRow(item = {}) {
  const container = document.getElementById('orderItemsContainer');
  const row = document.createElement('div');
  row.className = 'modal-grid order-item-row';
  
  const availableItems = menuItems.filter(item => item.available && item.stock > 0);
  const optionsHtml = availableItems.map(item => 
    `<option value="${item.id}">${item.name} - $${item.price.toFixed(2)} (Stock: ${item.stock})</option>`
  ).join('');
  
  row.innerHTML = `
    <div class="modal-field">
      <label>Menu Item</label>
      <select class="menuItemSelect" required onchange="updateOrderAmount()">
        <option value="">-- Select a menu item --</option>
        ${optionsHtml}
      </select>
    </div>
    <div class="modal-field">
      <label>Quantity</label>
      <input class="orderQuantity" type="number" step="1" min="1" value="1" required onchange="updateOrderAmount()">
    </div>
    <div class="modal-field">
      <label>Item Amount</label>
      <input class="itemAmount" type="number" step="0.01" readonly placeholder="0.00">
    </div>
    <div class="modal-field" style="align-self:center;">
      <button type="button" class="btn btn-secondary" onclick="removeOrderItemRow(this)" style="height:36px;">Remove</button>
    </div>
  `;
  
  container.appendChild(row);

  if (item && typeof item === 'object') {
    const select = row.querySelector('.menuItemSelect');
    const qtyInput = row.querySelector('.orderQuantity');
    if (item.menuItemId) {
      select.value = item.menuItemId;
    } else if (item.name) {
      const found = findMenuItemBySummaryName(item.name);
      if (found) select.value = found.id;
    }
    if (item.quantity) {
      qtyInput.value = item.quantity;
    }
  }

  updateOrderAmount();
}

// Remove order item row
function removeOrderItemRow(button) {
  const row = button.closest('.order-item-row');
  const container = document.getElementById('orderItemsContainer');
  if (container.querySelectorAll('.order-item-row').length > 1) {
    row.remove();
    updateOrderAmount();
  } else {
    alert('You must have at least one product');
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
  const productDisplay = order.quantity ? `${order.product} x${order.quantity}` : order.product;
  document.getElementById('view_product').value = productDisplay || '';
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
  const amount = parseFloat(document.getElementById('view_amount').value) || 0;
  const newStatus = document.getElementById('view_status').value;
  const order = allOrders.find(o => o.id === id);
  
  try {
    // If status is changing to cancelled, restore stock
    if (order && order.status !== 'cancelled' && newStatus === 'cancelled') {
      if (order.menuItemId) {
        const item = menuItems.find(i => i.id === order.menuItemId);
        if (item) {
          item.stock += (order.quantity || 1);
          applyMenuFilters();
          renderMenu();
        }
      }
    }
    
    const res = await fetch(`/api/orders/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ customerName, amount, status: newStatus })
    });
    if (res.ok) {
      // update local copy
      if (order) {
        order.customerName = customerName;
        order.amount = amount;
        order.status = newStatus;
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
function generateOrderReceipt(orderId) {
  const order = allOrders.find(o => o.id === orderId);
  if (!order) return showNotification('Order not found');

  const receiptHtml = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Receipt ${escapeHtml(order.id)}</title><style>
      @page { size: auto; margin: 12mm; }
      html, body { width: 100%; margin: 0; padding: 0; }
      body { font-family: Arial, sans-serif; color: #111; background: #fff; }
      .receipt-box { width: min(720px, 100%); margin: 0 auto; padding: 24px; border: 1px solid #ddd; border-radius: 12px; box-sizing: border-box; }
      .receipt-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
      .receipt-title { font-size: 1.5rem; margin: 0; }
      .receipt-meta { color: #555; font-size: 0.95rem; line-height: 1.6; }
      .receipt-table { width: 100%; border-collapse: collapse; margin-top: 18px; }
      .receipt-table th, .receipt-table td { padding: 12px 10px; border: 1px solid #e5e7eb; }
      .receipt-table th { background: #f3f4f6; text-align: left; }
      .receipt-total { text-align: right; margin-top: 20px; font-size: 1.1rem; font-weight: 700; }
      .receipt-footer { margin-top: 30px; color: #555; font-size: 0.95rem; }
      @media print {
        body { margin: 0; }
        .receipt-box { border: none; border-radius: 0; page-break-inside: avoid; }
      }
    </style></head><body>
      <div class="receipt-box">
        <div class="receipt-header">
          <div>
            <h1 class="receipt-title">Order Receipt</h1>
            <div class="receipt-meta">Order ID: ${escapeHtml(order.id)}<br>Customer: ${escapeHtml(order.customerName || 'N/A')}<br>Status: ${escapeHtml(order.status || 'pending')}</div>
          </div>
          <div class="receipt-meta">Date: ${escapeHtml(formatOrderTimestamp(order.date))}</div>
        </div>
        <table class="receipt-table">
          <thead>
            <tr><th>Item</th><th>Qty</th><th>Amount</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>${escapeHtml(order.product || 'Order item')}</td>
              <td>${escapeHtml(String(order.quantity || 1))}</td>
              <td>$${Number(order.amount || 0).toLocaleString('en-US')}</td>
            </tr>
          </tbody>
        </table>
        <div class="receipt-total">Total: $${Number(order.amount || 0).toLocaleString('en-US')}</div>
        <div class="receipt-footer">Thank you for your purchase.</div>
      </div>
    </body></html>`;

  const printWindow = window.open('', '_blank', 'width=900,height=700');
  if (!printWindow) {
    return showNotification('Popup blocked. Allow popups to generate a receipt.');
  }
  printWindow.document.write(receiptHtml);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
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

function switchMenuSection(view) {
  currentMenuSection = view;
  const menuItems = document.getElementById('menuItemsView');
  const tableFloor = document.getElementById('tableFloorView');
  const buttons = document.querySelectorAll('.menu-view-switcher .page-tab');
  const showItems = view === 'items';
  if (menuItems) menuItems.style.display = showItems ? 'block' : 'none';
  if (tableFloor) tableFloor.style.display = showItems ? 'none' : 'block';
  buttons.forEach(btn => {
    const isItems = btn.getAttribute('data-menu-view') === 'items';
    btn.classList.toggle('active', showItems ? isItems : !isItems);
    btn.setAttribute('aria-selected', String(showItems ? isItems : !isItems));
  });
  if (!showItems && tableLayout.length === 0) {
    loadTableLayout();
  }
}

function getRandomTableStatus() {
  const pool = ['vacant','vacant','vacant','vacant','vacant','reserved','reserved','occupied','occupied','occupied'];
  return pool[Math.floor(Math.random() * pool.length)];
}

function getRandomOccupiedDurationMinutes() {
  const options = [15, 20, 45];
  return options[Math.floor(Math.random() * options.length)];
}

function getOccupiedUntil(now = new Date()) {
  const minutes = getRandomOccupiedDurationMinutes();
  return new Date(now.getTime() + minutes * 60 * 1000).toISOString();
}

function generateTableLayout() {
  tableLayout = [];
  for (let i = 1; i <= 40; i += 1) {
    tableLayout.push({ number: i, label: `Table ${i}`, status: 'vacant' });
  }
  renderTableLayout();
}

async function loadTableLayout() {
  try {
    const response = await fetch('/api/tables');
    if (!response.ok) {
      throw new Error(`Failed to load tables: ${response.status}`);
    }
    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) {
      generateTableLayout();
      return;
    }
    tableLayout = data.map(table => ({
      number: Number(table.number),
      label: table.label || `Table ${table.number}`,
      status: table.status || 'vacant',
      customerName: table.customerName || undefined,
      reservedUntil: table.reservedUntil || undefined,
      isBooking: !!table.isBooking
    }));
    renderTableLayout();
  } catch (error) {
    console.warn('Error loading table layout:', error);
    generateTableLayout();
  }
}

function renderTableLayout() {
  const grid = document.getElementById('tableGrid');
  const total = tableLayout.length;
  const vacantCount = tableLayout.filter(t => t.status === 'vacant').length;
  const reservedCount = tableLayout.filter(t => t.status === 'reserved').length;
  const occupiedCount = tableLayout.filter(t => t.status === 'occupied').length;
  if (grid) {
    grid.innerHTML = tableLayout.map(table => {
      const reservationLabel = getTableReservationLabel(table);
      const statusText = table.status === 'vacant' ? 'Vacant' : table.status === 'reserved' ? 'Reserved' : 'Occupied';
      return `
      <div class="table-card ${table.status}" data-table-number="${table.number}">
        <button type="button" class="table-action-trigger" onclick="event.stopPropagation(); toggleTableActionMenu(${table.number})">⋮</button>
        <div class="table-action-menu" id="tableActionMenu-${table.number}">
          <button type="button" class="table-action-item" onclick="event.stopPropagation(); openTableActionModal(${table.number}, 'reserve')">Walk-ins</button>
          <button type="button" class="table-action-item" onclick="event.stopPropagation(); markTableVacant(${table.number})">Mark as Vacant</button>
          <button type="button" class="table-action-item" onclick="event.stopPropagation(); openTableActionModal(${table.number}, 'book')">Book</button>
        </div>
        <div class="table-label">${table.label}</div>
        <div class="table-status">${statusText}</div>
        <div class="table-detail">${reservationLabel || 'Tap the menu to manage this table.'}</div>
      </div>
    `;
    }).join('');
  }
  const totalEl = document.getElementById('totalTablesCount');
  const vacantEl = document.getElementById('vacantTablesCount');
  const reservedEl = document.getElementById('reservedTablesCount');
  const occupiedEl = document.getElementById('occupiedTablesCount');
  if (totalEl) totalEl.textContent = String(total);
  if (vacantEl) vacantEl.textContent = String(vacantCount);
  if (reservedEl) reservedEl.textContent = String(reservedCount);
  if (occupiedEl) occupiedEl.textContent = String(occupiedCount);
}

function refreshTableLayout() {
  loadTableLayout();
  showNotification('Table statuses refreshed');
}

function closeAllTableActionMenus() {
  document.querySelectorAll('.table-action-menu.open').forEach(menu => menu.classList.remove('open'));
  document.querySelectorAll('.table-card.menu-open').forEach(card => card.classList.remove('menu-open'));
}

function toggleTableActionMenu(tableNumber) {
  const menu = document.getElementById(`tableActionMenu-${tableNumber}`);
  if (!menu) return;
  const card = document.querySelector(`.table-card[data-table-number="${tableNumber}"]`);
  const isOpen = menu.classList.contains('open');
  closeAllTableActionMenus();
  if (!isOpen) {
    menu.classList.add('open');
    if (card) card.classList.add('menu-open');
  }
}

function getTableReservationLabel(table) {
  if (!table.reservedUntil) return '';
  const date = new Date(table.reservedUntil);
  if (isNaN(date)) return '';
  if (table.status === 'occupied') {
    return `${table.customerName ? `Occupied by ${table.customerName} until` : 'Occupied until'} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
  if (!table.customerName) return '';
  if (table.status === 'reserved') {
    if (table.isBooking) {
      return `Booked for ${table.customerName} on ${date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })} at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    return `Reserved for ${table.customerName} at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
  return '';
}

function openTableActionModal(tableNumber, action) {
  closeAllTableActionMenus();
  const modal = document.getElementById('tableActionModal');
  const title = document.getElementById('tableActionModalTitle');
  const subtitle = document.getElementById('tableActionModalSubtitle');
  const typeInput = document.getElementById('tableActionType');
  const tableInput = document.getElementById('tableActionTableNumber');
  const dateField = document.getElementById('tableDateField');
  const timeField = document.getElementById('tableTimeField');
  const dateInput = document.getElementById('tableCustomerDate');
  const timeInput = document.getElementById('tableCustomerTime');
  const customerInput = document.getElementById('tableCustomerName');

  customerInput.value = '';
  timeInput.value = '';
  dateInput.value = '';
  typeInput.value = action;
  tableInput.value = String(tableNumber);

  dateInput.required = action === 'book';
  timeInput.required = true;
  customerInput.required = true;

  if (action === 'reserve') {
    title.textContent = `Walk-ins ${tableLayout[tableNumber-1]?.label || 'Table'}`;
    subtitle.textContent = 'Check in without prior booking; it becomes occupied when the time arrives.';
    dateField.style.display = 'none';
    timeField.style.display = 'block';
  } else {
    title.textContent = `Book ${tableLayout[tableNumber-1]?.label || 'Table'}`;
    subtitle.textContent = 'Book by date and time using the calendar.';
    dateField.style.display = 'block';
    timeField.style.display = 'block';
  }
  if (modal) modal.style.display = 'flex';
}

function closeTableActionModal() {
  const modal = document.getElementById('tableActionModal');
  if (modal) modal.style.display = 'none';
  closeAllTableActionMenus();
}

async function handleTableActionSave(event) {
  event.preventDefault();
  const type = document.getElementById('tableActionType').value;
  const number = Number(document.getElementById('tableActionTableNumber').value);
  const customerName = document.getElementById('tableCustomerName').value.trim();
  const timeValue = document.getElementById('tableCustomerTime').value;
  const dateValue = document.getElementById('tableCustomerDate').value;
  if (!customerName || !timeValue || (type === 'book' && !dateValue)) {
    return alert('Please fill in all required fields.');
  }
  if (type === 'reserve') {
    await reserveTable(number, customerName, timeValue);
  } else if (type === 'book') {
    await bookTable(number, customerName, dateValue, timeValue);
  }
  closeTableActionModal();
}

async function reserveTable(tableNumber, customerName, timeValue) {
  const [hours, minutes] = timeValue.split(':').map(Number);
  const now = new Date();
  const target = new Date(now);
  target.setHours(hours, minutes, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1);
  await persistTableState(tableNumber, 'reserved', customerName, target.toISOString(), false);
}

async function bookTable(tableNumber, customerName, dateValue, timeValue) {
  const target = new Date(`${dateValue}T${timeValue}`);
  if (isNaN(target.getTime())) return alert('Invalid date or time selected.');
  await persistTableState(tableNumber, 'reserved', customerName, target.toISOString(), true);
}

async function markTableVacant(tableNumber) {
  await persistTableState(tableNumber, 'vacant', undefined, undefined, false);
}

async function persistTableState(tableNumber, status, customerName, reservedUntil, isBooking) {
  try {
    const body = {
      status,
      customerName: customerName || null,
      reservedUntil: reservedUntil || (status === 'occupied' ? getOccupiedUntil() : null),
      isBooking: !!isBooking
    };
    const response = await fetch(`/api/tables/${tableNumber}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.error || `Unable to update table ${tableNumber}`);
    }
    const updated = await response.json();
    const index = tableLayout.findIndex(t => t.number === tableNumber);
    const nextState = {
      number: tableNumber,
      label: `Table ${tableNumber}`,
      status: updated.status,
      customerName: updated.customerName || undefined,
      reservedUntil: updated.reservedUntil || undefined,
      isBooking: !!updated.isBooking
    };
    if (index >= 0) {
      tableLayout[index] = nextState;
    } else {
      tableLayout.push(nextState);
      tableLayout.sort((a, b) => a.number - b.number);
    }
    renderTableLayout();
  } catch (error) {
    console.error('Error updating table state:', error);
    alert(error.message || 'Failed to update table status.');
    throw error;
  }
}

function loadMenu() {
  // Try to fetch menu from backend API; fallback to local sample
  fetch('/api/menu', { credentials: 'same-origin' })
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
        menuItems = SAMPLE_MENU_ITEMS.map(item => ({ ...item }));
      } else {
        menuItems = arr;
      }
      const stored = loadMenuItemsFromStorage();
      if (stored && stored.length > 0) {
        menuItems = mergeMenuItems(menuItems, stored);
      }
      filteredMenuItems = [...menuItems];
      buildMenuChips();
      renderMenu();
      processPendingAIDraft();
    }).catch(err => {
      console.warn('Failed to load /api/menu, using sample', err);
      menuItems = SAMPLE_MENU_ITEMS.map(item => ({ ...item }));
      const stored = loadMenuItemsFromStorage();
      if (stored && stored.length > 0) {
        menuItems = mergeMenuItems(menuItems, stored);
      }
      filteredMenuItems = [...menuItems];
      buildMenuChips();
      renderMenu();
      processPendingAIDraft();
    });
}

function bulkAddSampleMenuItems() {
  const existingIds = new Set(menuItems.map(item => item.id));
  const itemsToAdd = SAMPLE_MENU_ITEMS.filter(item => !existingIds.has(item.id)).map(item => ({ ...item }));
  if (itemsToAdd.length === 0) {
    showNotification('Sample menu already loaded');
    return;
  }

  const payload = itemsToAdd.map(item => ({
    category: item.category,
    key: item.id,
    name: item.name,
    price: item.price,
    available: item.stock || 0,
    image_url: item.image_url || null
  }));

  fetch('/api/menu/bulk', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ items: payload })
  })
    .then(r => r.json())
    .then(resp => {
      if (resp && resp.success) {
        menuItems = menuItems.concat(itemsToAdd);
        saveMenuItemsToStorage();
        buildMenuChips();
        applyMenuFilters();
        showNotification(`Added ${itemsToAdd.length} sample menu items`);
      } else {
        menuItems = menuItems.concat(itemsToAdd);
        saveMenuItemsToStorage();
        buildMenuChips();
        applyMenuFilters();
        showNotification('Added sample menu items locally');
      }
    })
    .catch(err => {
      console.warn('Bulk sample menu save failed', err);
      menuItems = menuItems.concat(itemsToAdd);
      saveMenuItemsToStorage();
      buildMenuChips();
      applyMenuFilters();
      showNotification('Added sample menu items locally');
    });
}

function buildMenuChips() {
  const categorySet = new Set(menuItems.map(i => i.category));
  const categories = ['All', ...categorySet];
  const tagSet = new Set(menuItems.flatMap(i => i.tags || []));
  const tags = ['All', ...tagSet];

  const specialContainer = document.getElementById('menuSpecialChips');
  const catContainer = document.getElementById('menuCategoryChips');
  const tagContainer = document.getElementById('menuTagChips');
  const specials = ['All', 'Premium', 'Festive', 'Discount'];
  if (specialContainer) {
    specialContainer.innerHTML = specials.map(special => {
      const activeClass = special === currentMenuSpecialCategory ? 'active' : '';
      return `<button type="button" class="menu-chip ${activeClass}" onclick="setMenuSpecialCategory('${special}')">${special}</button>`;
    }).join('');
  }
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

function setMenuSpecialCategory(category) {
  currentMenuSpecialCategory = category;
  applyMenuFilters();
  buildMenuChips();
}

function applyMenuFilters() {
  const query = (document.getElementById('menuSearchInput')?.value || '').toLowerCase();
  filteredMenuItems = menuItems.filter(item => {
    const matchesCategory = currentMenuCategory === 'All' || item.category === currentMenuCategory;
    const matchesTag = currentMenuTag === 'All' || (item.tags || []).includes(currentMenuTag);
    const matchesSpecial = currentMenuSpecialCategory === 'All' || (item.tags || []).includes(currentMenuSpecialCategory) || item.category === currentMenuSpecialCategory;
    const matchesSearch = item.name.toLowerCase().includes(query) || (item.description || '').toLowerCase().includes(query) || (item.tags || []).some(t => t.toLowerCase().includes(query));
    return matchesCategory && matchesTag && matchesSpecial && matchesSearch;
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
          <div style="margin-top:12px; display:flex; gap:8px; flex-wrap:wrap;">
            <button class="filter-btn" onclick="openMenuItemModal('${item.id}')">Edit</button>
            <button class="filter-btn" style="background:#dc3545" onclick="deleteMenuItem('${item.id}')">Delete</button>
            <button class="filter-btn" style="background:#ff9800" onclick="reduceMenuItemStock('${item.id}', 1)">- Stock</button>
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
        <button class="filter-btn" style="background:#ff9800; font-size:0.85rem" onclick="reduceMenuItemStock('${item.id}', 1)">- Stock</button>
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
  const rows = filteredMenuItems.map(item => ({
    name: item.name || '',
    category: item.category || '',
    subtype: item.subtype || '',
    price: item.price != null ? `$${item.price.toFixed(2)}` : '',
    available: item.available ? 'Yes' : 'No',
    stock: item.stock != null ? item.stock : (item.inventory != null ? item.inventory : 0),
    tags: (item.tags || []).join(', '),
    description: item.description || ''
  }));

  if (rows.length === 0) {
    return showNotification('No menu items available for report');
  }

  const csvHeader = Object.keys(rows[0]).join(',');
  const csvRows = rows.map(row => Object.values(row).map(value => '"' + String(value).replace(/"/g, '""') + '"').join(','));
  const csv = [csvHeader, ...csvRows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `menu-report-${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showNotification(`Menu report downloaded (${rows.length} items)`);
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

  fetch('/api/menu/item', { method: 'POST', headers: {'Content-Type':'application/json'}, credentials: 'same-origin', body: JSON.stringify(payload) })
    .then(r => r.json())
    .then(resp => {
      if (resp && resp.success) {
        // update local cache
        const idx = menuItems.findIndex(i=>i.id===id || i.id===key);
        const entry = { id: key, key, name, category, subtype, price, stock, tags, description, available };
        if (idx !== -1) menuItems[idx] = entry;
        else menuItems.push(entry);
        saveMenuItemsToStorage();
        buildMenuChips();
        applyMenuFilters();
        closeMenuItemModal();
        showNotification('Menu item saved');
      } else {
        // fallback local update
        const idx = menuItems.findIndex(i=>i.id===id);
        if (idx !== -1) menuItems[idx] = { ...menuItems[idx], name, category, subtype, price, stock, tags, description, available };
        else menuItems.push({ id: key, key, name, category, subtype, price, stock, tags, description, available });
        saveMenuItemsToStorage();
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
      saveMenuItemsToStorage();
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
  fetch(`/api/menu/item/${encodeURIComponent(category)}/${encodeURIComponent(key)}`, { method: 'DELETE', credentials: 'same-origin' })
    .then(r => r.json())
    .then(resp => {
      if (resp && resp.success) {
        const idx = menuItems.findIndex(i=>i.id===id);
        if (idx !== -1) menuItems.splice(idx,1);
        saveMenuItemsToStorage();
        buildMenuChips();
        applyMenuFilters();
        showNotification('Menu item deleted');
      } else {
        // fallback: local delete
        const idx = menuItems.findIndex(i=>i.id===id);
        if (idx !== -1) menuItems.splice(idx,1);
        saveMenuItemsToStorage();
        buildMenuChips();
        applyMenuFilters();
        showNotification('Menu item deleted (offline)');
      }
    }).catch(err => {
      console.warn('Delete menu item failed', err);
      const idx = menuItems.findIndex(i=>i.id===id);
      if (idx !== -1) menuItems.splice(idx,1);
      saveMenuItemsToStorage();
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

// Reduce stock for a menu item
function reduceMenuItemStock(itemId, quantity = 1) {
  const item = menuItems.find(i => i.id === itemId);
  if (!item) {
    showNotification('Item not found');
    return;
  }
  
  const qty = Math.max(1, parseInt(quantity, 10));
  
  // Prepare payload for backend
  const payload = {
    itemId: itemId,
    category: item.category,
    key: item.key || item.id,
    quantity: qty
  };
  
  fetch('/api/menu/item/reduce-stock', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(payload)
  })
    .then(r => r.json())
    .then(resp => {
      if (resp && resp.success) {
        // Update local cache with new stock value
        const idx = menuItems.findIndex(i => i.id === itemId);
        if (idx !== -1) {
          menuItems[idx].stock = resp.stock || Math.max(0, (menuItems[idx].stock || 0) - qty);
        }
        saveMenuItemsToStorage();
        buildMenuChips();
        applyMenuFilters();
        showNotification(`${item.name} stock reduced by ${qty}. New stock: ${resp.stock || menuItems[idx].stock}`);
      } else {
        showNotification('Failed to reduce stock');
      }
    })
    .catch(err => {
      console.warn('Reduce stock failed', err);
      // Fallback: update locally
      const idx = menuItems.findIndex(i => i.id === itemId);
      if (idx !== -1) {
        menuItems[idx].stock = Math.max(0, (menuItems[idx].stock || 0) - qty);
        saveMenuItemsToStorage();
        buildMenuChips();
        applyMenuFilters();
        showNotification(`${item.name} stock reduced by ${qty} (offline). New stock: ${menuItems[idx].stock}`);
      }
    });
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
      // Restore stock if menu item was used
      if (order.menuItemId) {
        const item = menuItems.find(i => i.id === order.menuItemId);
        if (item) {
          item.stock += (order.quantity || 1);
          applyMenuFilters();
          renderMenu();
        }
      }
      
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

// Close modals and action menus when clicking outside
document.addEventListener('click', (e) => {
  const orderModal = document.getElementById('orderModal');
  const tableModal = document.getElementById('tableActionModal');
  if (e.target === orderModal) {
    closeOrderModal();
  }
  if (e.target === tableModal) {
    closeTableActionModal();
  }
  if (!e.target.closest('.table-action-menu') && !e.target.closest('.table-action-trigger')) {
    closeAllTableActionMenus();
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
