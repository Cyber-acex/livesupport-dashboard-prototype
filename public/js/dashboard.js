document.addEventListener('DOMContentLoaded', ()=>{
  // animate counters
  const counters = document.querySelectorAll('.value[data-target]');
  counters.forEach(el=>{
    const target = parseFloat(el.getAttribute('data-target'));
    const isFloat = String(target).includes('.')
    const steps = 36;
    let cur = 0;
    const increment = target/steps;
    const iv = setInterval(()=>{
      cur += increment;
      if(cur >= target - 0.0001){
        el.textContent = isFloat ? target.toFixed(1) : Math.round(target);
        clearInterval(iv);
      } else {
        el.textContent = isFloat ? cur.toFixed(1) : Math.round(cur);
      }
    }, 18);
  });

  // inbox button
  const openBtn = document.getElementById('openInbox');
  if(openBtn){
    openBtn.addEventListener('click', ()=>{
      window.location.href = 'inbox.html';
    });
  }
  // topnav Inbox link
  const openNavLink = document.getElementById('openInboxNav');
  if(openNavLink){
    openNavLink.addEventListener('click', (e)=>{
      e.preventDefault();
      window.location.href = 'inbox.html';
    });
  }

  // live clock
  const clock = document.getElementById('clock');
  function updateClock(){
    if(!clock) return;
    const d = new Date();
    const hh = String(d.getHours()).padStart(2,'0');
    const mm = String(d.getMinutes()).padStart(2,'0');
    clock.textContent = `${hh}:${mm}`;
  }
  updateClock();
  setInterval(updateClock, 1000);

  function getSharedNotifications(limit = 5) {
    try {
      return JSON.parse(localStorage.getItem('liveSupportNotifications') || '[]').slice(0, limit);
    } catch (e) {
      return [];
    }
  }

  function saveSharedNotification(message, source = 'System', type = 'general') {
    try {
      const key = 'liveSupportNotifications';
      const list = JSON.parse(localStorage.getItem(key) || '[]');
      list.unshift({ message, source, type, time: new Date().toISOString() });
      localStorage.setItem(key, JSON.stringify(list.slice(0, 25)));
    } catch (e) {
      console.error('Shared notification save failed', e);
    }
  }

  const notifBtn = document.getElementById('notifBtn');
  const notifPopup = document.getElementById('notifPopup');
  const notifClose = document.getElementById('notifClose');
  const notifList = document.querySelector('.notif-list');

  async function fetchDashboardNotifications(limit = 5) {
    try {
      const [messagesRes, ticketsRes] = await Promise.all([
        fetch('/api/recent-messages?limit=' + limit),
        fetch('/api/recent-tickets?limit=' + limit)
      ]);
      if (!messagesRes.ok || !ticketsRes.ok) throw new Error('Failed to load notification data');
      const [messages, tickets] = await Promise.all([messagesRes.json(), ticketsRes.json()]);

      const sharedNotifications = getSharedNotifications(limit).map((n, index) => ({
        id: `shared-${index}-${n.time}`,
        title: n.source || 'System',
        body: n.message || 'New event',
        meta: new Date(n.time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}),
        time: n.time,
        icon: (n.source || 'S').charAt(0).toUpperCase()
      }));

      const messageNotifications = (messages || []).map((m) => ({
        id: `msg-${m.id}`,
        title: m.customer_name || m.phone || 'Customer',
        body: m.message || 'New message received',
        meta: `${new Date(m.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}`,
        time: m.created_at,
        icon: m.customer_name || m.phone ? String(m.customer_name || m.phone).charAt(0).toUpperCase() : 'C'
      }));

      const ticketNotifications = (tickets || []).map((t) => ({
        id: `ticket-${t.id}`,
        title: `Ticket #${t.id}`,
        body: t.last_message ? String(t.last_message).slice(0, 80) : `${t.status || 'Open'} ticket updated`,
        meta: `${t.status || 'Open'} · ${new Date(t.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}`,
        time: t.created_at,
        icon: `#${t.id}`
      }));

      return [...messageNotifications, ...ticketNotifications, ...sharedNotifications]
        .sort((a, b) => new Date(b.time) - new Date(a.time))
        .slice(0, limit);
    } catch (err) {
      console.error('Failed loading notifications', err);
      return getSharedNotifications(limit).map((n, index) => ({
        id: `shared-${index}-${n.time}`,
        title: n.source || 'System',
        body: n.message || 'New event',
        meta: new Date(n.time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}),
        time: n.time,
        icon: (n.source || 'S').charAt(0).toUpperCase()
      }));
    }
  }

  function updateNotifBadge(count) {
    if (!notifBtn) return;
    const badge = notifBtn.querySelector('.notif-badge');
    if (!badge) return;
    if (count > 0) {
      badge.classList.add('show');
      badge.setAttribute('aria-label', `${count} new notifications`);
    } else {
      badge.classList.remove('show');
      badge.removeAttribute('aria-label');
    }
  }

  function renderNotifications(items) {
    if (!notifList) return;
    if (!items || items.length === 0) {
      notifList.innerHTML = '<div class="notif-empty">No recent notifications</div>';
      return;
    }
    notifList.innerHTML = items.map(item => `
      <a href="#" class="notif-item">
        <div class="notif-avatar"><span>${escapeHtml(String(item.icon || 'N'))}</span></div>
        <div class="notif-body">
          <strong>${escapeHtml(item.title)}</strong>
          <p>${escapeHtml(item.body)}</p>
          <small>${escapeHtml(item.meta)}</small>
        </div>
      </a>
    `).join('');
  }

  async function loadNotifications() {
    const items = await fetchDashboardNotifications(5);
    renderNotifications(items);
    updateNotifBadge(items.length);
    return items;
  }

  function calculatePercentageChange(current, previous) {
    if (!previous || previous === 0) return 0;
    return ((current - previous) / previous) * 100;
  }

  function updateStatChange(element, percentage) {
    if (!element) return;
    const span = element.querySelector('span');
    if (percentage === null || typeof percentage === 'undefined') {
      element.classList.remove('positive', 'negative');
      if (span) span.textContent = '—';
      return;
    }
    const isPositive = Number(percentage) >= 0;
    element.classList.toggle('positive', isPositive);
    element.classList.toggle('negative', !isPositive);
    if (span) {
      span.textContent = `${Math.abs(Number(percentage)).toFixed(2)}%`;
    }
  }

  async function loadDashboardStats() {
    try {
      // Instant change mode: fetch last instant snapshot from server (falls back to null)
      let prevSnapshot = {};
      try {
        const snapRes = await fetch('/api/dashboard-snapshot/instant');
        if (snapRes.ok) {
          const snapJson = await snapRes.json();
          prevSnapshot = snapJson.data || {};
        }
      } catch (e) {
        console.warn('Failed to load previous dashboard snapshot from server', e);
        prevSnapshot = {};
      }

      // Fetch conversations to get chat count
      const convRes = await fetch('/api/conversations');
      if (!convRes.ok) throw new Error('Failed to load conversations');
      const conversations = await convRes.json();
      const customersEl = document.getElementById('customersCount');
      const customersChangeEl = document.getElementById('customersChange');

      const chatCount = Array.isArray(conversations) ? conversations.length : 0;
      const currentCount = Number(chatCount);
      if (customersEl) customersEl.textContent = currentCount.toLocaleString();

      // Instant comparison: prefer server-provided calculation, otherwise compute against saved previous values
      try {
        if (typeof prevSnapshot.customers_change !== 'undefined' && prevSnapshot.customers_change !== null) {
          updateStatChange(customersChangeEl, Number(prevSnapshot.customers_change));
        } else {
          const prevCustomers = (typeof prevSnapshot.customers !== 'undefined') ? Number(prevSnapshot.customers) : null;
          if (prevCustomers === null) {
            updateStatChange(customersChangeEl, null);
          } else {
            const percentChange = calculatePercentageChange(currentCount, prevCustomers);
            updateStatChange(customersChangeEl, percentChange);
          }
        }
      } catch (e) {
        console.warn('Failed to compute instant customers change', e);
        updateStatChange(customersChangeEl, null);
      }

      // Fetch orders count
      const res = await fetch('/api/dashboard-stats');
      if (res.ok) {
        const data = await res.json();
        const ordersEl = document.getElementById('ordersCount');
        const ordersChangeEl = document.getElementById('ordersChange');

        if (ordersEl) {
          const currentOrders = Number(data.orders || 0);
          ordersEl.textContent = currentOrders.toLocaleString();

          // Instant comparison for orders: prefer server-provided calculation
          try {
            if (typeof prevSnapshot.orders_change !== 'undefined' && prevSnapshot.orders_change !== null) {
              updateStatChange(ordersChangeEl, Number(prevSnapshot.orders_change));
            } else {
              const prevOrders = (typeof prevSnapshot.orders !== 'undefined') ? Number(prevSnapshot.orders) : null;
              if (prevOrders === null) {
                updateStatChange(ordersChangeEl, null);
              } else {
                const percentChange = calculatePercentageChange(currentOrders, prevOrders);
                updateStatChange(ordersChangeEl, percentChange);
              }
            }
          } catch (e) {
            console.warn('Failed to compute instant orders change', e);
            updateStatChange(ordersChangeEl, null);
          }

          // Persist instant snapshot to server for next comparison and use server-calculated deltas
          try {
            const postRes = await fetch('/api/dashboard-snapshot', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'same-origin',
              body: JSON.stringify({ name: 'instant', data: { customers: currentCount, orders: currentOrders, ts: new Date().toISOString() } })
            });
            if (postRes.ok) {
              const postJson = await postRes.json();
              if (postJson && postJson.data) {
                if (typeof postJson.data.customers_change !== 'undefined') updateStatChange(customersChangeEl, postJson.data.customers_change);
                if (typeof postJson.data.orders_change !== 'undefined') updateStatChange(ordersChangeEl, postJson.data.orders_change);
              }
            }
          } catch (e) {
            console.warn('Failed to persist instant dashboard snapshot to server', e);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load dashboard stats', err);
    }
  }

  async function loadRecentOrders(limit = 5) {
    try {
      const res = await fetch('/api/orders');
      if (!res.ok) throw new Error('Failed to load orders');
      const orders = await res.json();
      const recent = (orders || []).slice(0, limit);
      const tbody = document.getElementById('recentOrdersBody');
      if (!tbody) return;
      if (recent.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="muted">No recent orders available</td></tr>';
        return;
      }
      tbody.innerHTML = recent.map(order => {
        const status = String(order.status || 'pending').toLowerCase();
        const statusText = status.charAt(0).toUpperCase() + status.slice(1);
        const amount = Number(order.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        return `
          <tr>
            <td>
              <div class="product-cell">
                <div class="product-info">
                  <strong>${escapeHtml(order.product || 'Unknown product')}</strong>
                  <span class="variants">${escapeHtml(order.id || '')}</span>
                </div>
              </div>
            </td>
            <td>${escapeHtml(order.customerName || 'N/A')}</td>
            <td>$${escapeHtml(amount)}</td>
            <td><span class="status-badge ${escapeHtml(status)}">${escapeHtml(statusText)}</span></td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      console.error('Failed to load recent orders', err);
      const tbody = document.getElementById('recentOrdersBody');
      if (tbody) {
        tbody.innerHTML = '<tr><td colspan="4" class="muted">Unable to load recent orders</td></tr>';
      }
    }
  }

  loadDashboardStats();
  loadRecentOrders();

  if (notifBtn && notifPopup) {
    notifBtn.addEventListener('click', async (event) => {
      event.stopPropagation();
      notifPopup.classList.toggle('show');
      const isOpen = notifPopup.classList.contains('show');
      notifPopup.setAttribute('aria-hidden', !isOpen);
      if (isOpen) await loadNotifications();
    });

    if (notifClose) {
      notifClose.addEventListener('click', (event) => {
        event.stopPropagation();
        notifPopup.classList.remove('show');
        notifPopup.setAttribute('aria-hidden', 'true');
      });
    }

    document.addEventListener('click', (ev) => {
      if (!notifBtn.contains(ev.target) && notifPopup && !notifPopup.contains(ev.target)) {
        notifPopup.classList.remove('show');
        notifPopup.setAttribute('aria-hidden', 'true');
      }
    });

    // initial badge state
    loadNotifications();
  }

  // search filter for tickets & activity
  const search = document.getElementById('searchInput');
  if(search){
    search.addEventListener('input', ()=>{
      const q = search.value.toLowerCase();
      // filter activity
      document.querySelectorAll('#activityList li').forEach(li=>{
        li.style.display = li.textContent.toLowerCase().includes(q) ? '' : 'none';
      });
      // filter tickets
      document.querySelectorAll('#ticketsTable tbody tr').forEach(tr=>{
        tr.style.display = tr.textContent.toLowerCase().includes(q) ? '' : 'none';
      });
    });
  }

  // simple theme toggle (light/dark)
  const themeToggle = document.getElementById('themeToggle');
  if(themeToggle){
    themeToggle.addEventListener('click', ()=>{
      document.documentElement.classList.toggle('light');
      const isLight = document.documentElement.classList.contains('light');
      themeToggle.textContent = isLight ? 'Dark' : 'Light';
    });
  }

  // load recent tickets from tickets table (show last 4 created)
  async function loadRecentTickets(){
    try{
      const res = await fetch('/api/recent-tickets-tickets');
      if(!res.ok) throw new Error('Network');
      const data = await res.json();
      const tbody = document.querySelector('#ticketsTable tbody');
      if(!tbody) return;
      tbody.innerHTML = '';
      data.forEach(t => {
        const tr = document.createElement('tr');
        const snippet = t.snippet ? String(t.snippet).slice(0,80) : '';
        tr.innerHTML = `<td>#${t.id}</td><td>${escapeHtml(t.subject||'(No subject)')}<div class="muted">${escapeHtml(snippet)}</div></td><td>${escapeHtml(t.assignee||'')}</td><td>${escapeHtml(t.status||'Open')}</td><td><a class="btn" href="tickets.html">View</a></td>`;
        tbody.appendChild(tr);
      });
    }catch(err){
      console.error('Failed loading recent tickets', err);
    }
  }
  loadRecentTickets();

  // live-update recent tickets via Socket.IO
  function initDashboardSocket() {
    try{
      const socket = io();
      socket.on && socket.on('ticketCreated', (t) => {
        loadRecentTickets();
        try { saveSharedNotification(`Ticket #${t.id} created successfully!`, 'Ticket', 'ticket'); } catch (e) {}
        loadNotifications();
      });
      socket.on && socket.on('ticketDeleted', (d) => {
        loadRecentTickets();
        try { saveSharedNotification(`Ticket #${d.id} deleted.`, 'Ticket', 'ticket'); } catch (e) {}
        loadNotifications();
      });
      socket.on && socket.on('ticketResolved', (d) => {
        loadRecentTickets();
        const msg = d.resolved_by ? `Ticket #${d.ticket_id} resolved by ${d.resolved_by}` : `Ticket #${d.ticket_id} marked resolved`;
        try { saveSharedNotification(msg, 'Ticket', 'ticket'); } catch (e) {}
        loadNotifications();
      });
      socket.on && socket.on('ticketEscalated', (d) => {
        loadRecentTickets();
        try { saveSharedNotification(`Ticket #${d.ticket_id} escalated!`, 'Ticket', 'ticket'); } catch (e) {}
        loadNotifications();
      });

      socket.on && socket.on('newMessage', (m) => {
        try{
          const sender = (m && m.sender) ? String(m.sender).toLowerCase() : '';
          if(sender === 'sent') return;
          loadRecentMessages();
          if (m && m.message) saveSharedNotification(m.message, 'Inbox', 'message');
          loadNotifications();
        }catch(e){}
      });
    }catch(e){
      // Socket.IO not available or connection failed; ignore silently
    }
  }

  if(typeof io === 'undefined'){
    const iv = setInterval(()=>{ if(typeof io !== 'undefined'){ clearInterval(iv); initDashboardSocket(); } }, 200);
    document.addEventListener('DOMContentLoaded', ()=>{ if(typeof io !== 'undefined') initDashboardSocket(); });
  } else {
    initDashboardSocket();
  }

  // load recent customer messages (last 5)
  async function loadRecentMessages(){
    try{
      const res = await fetch('/api/recent-messages?limit=5');
      if(!res.ok) throw new Error('Network');
      const data = await res.json();
      const ul = document.getElementById('recentMessagesList');
      if(!ul) return;
      ul.innerHTML = '';
      if(!data || data.length === 0){
        ul.innerHTML = '<li class="muted">No recent messages</li>';
        return;
      }
      data.forEach(m => {
        const li = document.createElement('li');
        const name = m.customer_name || m.phone || 'Customer';
        const snippet = m.message ? String(m.message).slice(0,120) : '';
        const time = m.created_at ? new Date(m.created_at).toLocaleString() : '';
        li.innerHTML = `
          <div class="avatar">${escapeHtml((name||'C').charAt(0).toUpperCase())}</div>
          <div class="message-content">
            <strong>${escapeHtml(name)}</strong>
            <div class="message-snippet muted">${escapeHtml(snippet)}</div>
          </div>
          <div class="message-time">${escapeHtml(time)}</div>
        `;
        li.style.cursor = 'pointer';
        li.setAttribute('role','button');
        li.addEventListener('click', ()=>{
          if(m.conversation_id) window.location.href = `inbox.html?conversation_id=${m.conversation_id}`;
        });
        ul.appendChild(li);
      });
    }catch(err){
      console.error('Failed loading recent messages', err);
    }
  }
  loadRecentMessages();

  // simple helper to avoid HTML injection when inserting text
  function escapeHtml(str){
    return String(str).replace(/[&<>"'`]/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;","`":"&#96;"})[s]);
  }

  // Profile dropdown: load staff name from settings (fallback to /api/user)
  async function initProfile(){
    const profileNameEl = document.getElementById('profileName');
    const profileBtn = document.getElementById('profileBtn');
    const profileDropdown = document.getElementById('profileDropdown');
    const logoutBtn = document.getElementById('logoutBtn');
    const avatarSm = document.querySelector('.avatar-sm');
    const avatarImg = document.querySelector('.avatar-sm-img');
    if(!profileBtn || !profileDropdown) return;

    let currentSessionInfo = { loginTime: null, lastActivity: null };
    async function loadSessionInfo() {
      try {
        const res = await fetch('/api/session', { credentials: 'same-origin' });
        if (res.ok) {
          const data = await res.json();
          if (data) {
            currentSessionInfo.loginTime = data.loginTime || null;
            currentSessionInfo.lastActivity = data.lastActivity || null;
            if (currentSessionInfo.loginTime) localStorage.setItem('loginTime', currentSessionInfo.loginTime);
            if (currentSessionInfo.lastActivity) localStorage.setItem('lastActivity', currentSessionInfo.lastActivity);
          }
        }
      } catch (e) {
        console.error('Failed to load session info', e);
      }
    }
    try{
      let displayName = null;
      const sres = await fetch('/api/settings');
      if(sres.ok){
        const settings = await sres.json();
        if(settings && settings.displayName) displayName = settings.displayName;
        // try common image fields
        var profileImage = settings && (settings.image_url || settings.avatar_url || settings.avatar || settings.profile_image || settings.avatarUrl || settings.imageUrl) ? (settings.image_url || settings.avatar_url || settings.avatar || settings.profile_image || settings.avatarUrl || settings.imageUrl) : null;
      }
      if(!displayName){
        const ures = await fetch('/api/user');
        if(ures.ok){
          const user = await ures.json();
          displayName = user && (user.name || user.displayName) ? (user.name || user.displayName) : null;
          // try user avatar fields as fallback
          if(!profileImage) profileImage = user && (user.avatar || user.image || user.avatar_url || user.image_url) ? (user.avatar || user.image || user.avatar_url || user.image_url) : null;
        }
      }
      displayName = displayName || 'Staff';
      if(profileNameEl) profileNameEl.textContent = displayName;
      if(avatarSm) avatarSm.textContent = (displayName || 'S').charAt(0).toUpperCase();
      // default: show initials
      if(avatarSm) avatarSm.style.display = '';
      if(avatarImg) avatarImg.style.display = 'none';

      if(profileImage && avatarImg){
        try{
          let src = String(profileImage || '').trim();
          if(src && src.charAt(0) === '/') src = (window.location.origin || '') + src;
          // set image and show it; on error revert to initials
          avatarImg.src = src;
          avatarImg.style.display = 'inline-block';
          avatarImg.onload = function(){ if(avatarSm) avatarSm.style.display = 'none'; };
          avatarImg.onerror = function(){ avatarImg.style.display = 'none'; if(avatarSm) avatarSm.style.display = ''; };
        }catch(e){
          console.error('profile image set error', e);
        }
      }
    }catch(e){
      console.error('Failed to load profile name', e);
    }

    profileBtn.addEventListener('click', (e)=>{
      e.stopPropagation();
      const isOpen = profileDropdown.classList.toggle('show');
      profileBtn.setAttribute('aria-expanded', String(!!isOpen));
    });
    document.addEventListener('click', (ev)=>{
      if(!profileBtn.contains(ev.target) && !profileDropdown.contains(ev.target)){
        profileDropdown.classList.remove('show');
        profileBtn.setAttribute('aria-expanded','false');
      }
    });

    // Status Toggle Functionality
    const statusBtns = profileDropdown.querySelectorAll('.status-btn');
    const statusIndicator = document.getElementById('statusIndicator');
    const statusDot = statusIndicator?.querySelector('.status-dot');
    const statusText = statusIndicator?.querySelector('.status-text');

    function updateStatusDisplay(status) {
      // Update indicator
      if (statusIndicator && statusDot && statusText) {
        statusDot.className = `status-dot ${status}`;
        statusText.textContent = status.charAt(0).toUpperCase() + status.slice(1);
      }

      // Update mini status indicator on profile button
      const profileStatusMini = document.getElementById('profileStatusMini');
      const statusDotMini = profileStatusMini?.querySelector('.status-dot-mini');
      if (statusDotMini) {
        statusDotMini.className = `status-dot-mini ${status}`;
      }

      // Update active button
      statusBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.status === status);
      });

      // Store status
      localStorage.setItem('userStatus', status);
    }

    // Initialize status from localStorage or default to online
    const initialStatus = localStorage.getItem('userStatus') || 'online';
    updateStatusDisplay(initialStatus);

    // Add click handlers for status buttons
    statusBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const newStatus = btn.dataset.status;
        updateStatusDisplay(newStatus);
      });
    });

    // Session Info Functionality
    function updateSessionInfo() {
      const loginTimeEl = document.getElementById('loginTime');
      const sessionDurationEl = document.getElementById('sessionDuration');
      const lastActivityEl = document.getElementById('lastActivity');

      if (!loginTimeEl || !sessionDurationEl || !lastActivityEl) return;

      // Get or set login time
      let loginTime = currentSessionInfo.loginTime || localStorage.getItem('loginTime');
      if (!loginTime) {
        loginTime = new Date().toISOString();
        localStorage.setItem('loginTime', loginTime);
      }

      const loginDate = new Date(loginTime);
      const now = new Date();

      // Format login time
      const timeOptions = { hour: '2-digit', minute: '2-digit', hour12: false };
      loginTimeEl.textContent = loginDate.toLocaleTimeString([], timeOptions);

      // Calculate session duration
      const durationMs = now - loginDate;
      const hours = Math.floor(durationMs / (1000 * 60 * 60));
      const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
      sessionDurationEl.textContent = `${hours}h ${minutes}m`;

      // Update last activity from server or local fallback
      const lastActivity = currentSessionInfo.lastActivity || localStorage.getItem('lastActivity') || loginTime;
      const lastActivityDate = new Date(lastActivity);
      const timeSince = now - lastActivityDate;
      const minutesSince = Math.floor(timeSince / (1000 * 60));

      if (minutesSince < 1) {
        lastActivityEl.textContent = 'Just now';
      } else if (minutesSince < 60) {
        lastActivityEl.textContent = `${minutesSince}m ago`;
      } else {
        const hoursSince = Math.floor(minutesSince / 60);
        lastActivityEl.textContent = `${hoursSince}h ago`;
      }
    }

    // Update session info immediately and set interval
    await loadSessionInfo();
    updateSessionInfo();
    setInterval(updateSessionInfo, 60000); // Update every minute

    // Update last activity on user interactions
    function updateLastActivity() {
      localStorage.setItem('lastActivity', new Date().toISOString());
    }

    // Track user activity
    ['click', 'keydown', 'scroll', 'mousemove'].forEach(event => {
      document.addEventListener(event, updateLastActivity, { passive: true });
    });

    if(logoutBtn){
      logoutBtn.addEventListener('click', (ev)=>{
        ev.preventDefault();
        const ok = confirm('Are you sure you want to log out?');
        if(ok){
          window.location.href = '/logout';
        }
      });
    }
  }
  initProfile();

  // --- Monthly outward messages chart ---
  function initMessagesChart(){
    const canvas = document.getElementById('messagesChart');
    if(!canvas) return;

    const defaultLabels = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const ctx = canvas.getContext('2d');

    const cfg = {
      type: 'bar',
      data: {
        labels: defaultLabels.slice(),
        datasets: [
          {
            label: 'Outward Messages',
            data: [130, 360, 240, 285, 260, 290, 325, 190, 220, 360, 290, 140],
            backgroundColor: '#2563eb',
            borderRadius: 10,
            borderSkipped: 'bottom',
            maxBarThickness: 28,
            borderWidth: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'nearest', intersect: true },
        hover: { mode: 'nearest', intersect: true },
        plugins: {
          legend: { display: false },
          tooltip: {
            enabled: true,
            backgroundColor: 'rgba(15,23,42,0.95)',
            titleColor: '#fff',
            bodyColor: '#fff',
            borderColor: 'rgba(255,255,255,0.08)',
            borderWidth: 1,
            padding: 10,
            displayColors: false,
            cornerRadius: 8,
            bodyFont: { weight: '600' }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: 'rgba(55,65,81,0.85)', font: { weight: '600' } }
          },
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(15,23,42,0.08)' },
            ticks: { color: 'rgba(55,65,81,0.75)', stepSize: 100 },
            border: { display: false }
          }
        }
      }
    };

    const hoverDetails = document.getElementById('messagesChartDetails');

    function updateHoverDetails(label, value){
      if(!hoverDetails) return;
      hoverDetails.textContent = label ? `${label}: ${value}` : 'Hover over a bar to see details';
    }

    const chart = new Chart(ctx, cfg);
    
    canvas.addEventListener('mousemove', (event) => {
      const elements = chart.getElementsAtEventForMode(event, 'nearest', {intersect:true}, true);
      if(elements && elements.length > 0) {
        const idx = elements[0].index;
        const label = chart.data.labels[idx];
        const value = chart.data.datasets[0].data[idx];
        updateHoverDetails(label, value);
        canvas.style.cursor = 'pointer';
      } else {
        updateHoverDetails(null, null);
        canvas.style.cursor = 'default';
      }
    });

    canvas.addEventListener('mouseleave', () => {
      updateHoverDetails(null, null);
      canvas.style.cursor = 'default';
    });

    async function loadMonthlyData(){
      try{
        const res = await fetch('/api/messages-monthly');
        if(!res.ok) return;
        const js = await res.json();
        if(js && Array.isArray(js.labels) && Array.isArray(js.data)){
          chart.data.labels = js.labels;
          chart.data.datasets[0].data = js.data.map(n => Number(n || 0));
          chart.update();
        }
      }catch(e){
        console.warn('Failed to fetch /api/messages-monthly', e);
      }
    }

    loadMonthlyData();
    setInterval(loadMonthlyData, 5 * 60 * 1000);

    try{
      const socket = io();
      if(socket && socket.on) socket.on('newMessage', loadMonthlyData);
    }catch(e){ }

    chart.options.plugins.tooltip.callbacks = chart.options.plugins.tooltip.callbacks || {};
    chart.options.plugins.tooltip.callbacks.label = function(context){
      const label = chart.data.labels[context.dataIndex];
      const value = chart.data.datasets[0].data[context.dataIndex];
      return `${label}: ${value}`;
    };
    chart.update();
  }
  initMessagesChart();
});
