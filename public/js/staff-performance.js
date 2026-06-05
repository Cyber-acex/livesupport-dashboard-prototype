// staff-performance.js
(function(){
  let staffData = [];
  let messagesChart = null;
  let avgRespChart = null;

  const $staffList = () => document.getElementById('staffList');
  const $activityCanvas = () => document.getElementById('activityChart');
  const $avgRespCanvas = () => document.getElementById('avgResponseChart');
  const $search = () => document.getElementById('searchInput');
  const $sort = () => document.getElementById('sortBy');
  const $refresh = () => document.getElementById('refreshBtn');

  function fetchMetrics(){
    fetch('/api/staff-metrics').then(r=>r.json()).then(data=>{
      staffData = Array.isArray(data) ? data : [];
      renderStaffList();
      renderOverviewCharts();
      renderSummary();
    }).catch(err=>{
      console.error('Failed to load staff metrics', err);
      if ($staffList()) $staffList().textContent = 'Failed to load staff metrics';
    });
  }

  function renderStaffList(){
    const el = $staffList();
    if (!el) return;
    const q = ($search() && $search().value || '').toLowerCase();
    const sortVal = $sort() ? $sort().value : 'name';
    let list = staffData.slice();
    if (q) list = list.filter(s => (s.name||'').toLowerCase().includes(q));
    // sorting
    list.sort((a,b)=>{
      if (sortVal === 'name') return (a.name||'').localeCompare(b.name||'');
      if (sortVal === 'messages_handled') return (b.messages_handled||0) - (a.messages_handled||0);
      if (sortVal === 'avg_response_time') return (a.avg_response_time||0) - (b.avg_response_time||0);
      if (sortVal === '-avg_response_time') return (b.avg_response_time||0) - (a.avg_response_time||0);
      return 0;
    });

    el.innerHTML = '';
    if (list.length === 0) { el.textContent = 'No staff found'; return; }

    const totalHandled = staffData.reduce((acc, s) => acc + Number(s.messages_handled || 0), 0);

    list.forEach(s => {
      const responseTime = s.avg_response_time != null ? `${s.avg_response_time}s` : '—';
      const resolvedRate = s.resolution_rate != null ? `${Math.round(s.resolution_rate)}%` : '—';
      const handled = Number(s.messages_handled || 0);
      const progressValue = totalHandled ? Math.round((handled / totalHandled) * 100) : 0;
      const progressLabel = totalHandled ? `${progressValue}% messages` : '0% messages';
      const tags = s.team ? `<span class="staff-meta">${escapeHtml(s.team)}</span>` : `<span class="staff-meta">Support</span>`;
      const statusText = s.status ? escapeHtml(s.status.charAt(0).toUpperCase() + s.status.slice(1)) : '—';
      const row = document.createElement('div');
      row.className = 'staff-row';
      row.dataset.staffId = String(s.id || '');
      row.innerHTML = `
        <div class="staff-identity">
          <span class="staff-avatar">${escapeHtml((s.name||'')[0]||'S')}</span>
          <div class="staff-info">
            <span class="staff-name">${escapeHtml(s.name||'—')}</span>
            ${tags}
          </div>
        </div>
        <div>
          <span class="label">Status</span>
          <strong>${statusText}</strong>
        </div>
        <div>
          <span class="label">Handled</span>
          <strong>${handled}</strong>
        </div>
        <div>
          <span class="label">Avg Resp</span>
          <strong>${escapeHtml(responseTime)}</strong>
        </div>
        <div>
          <span class="label">Resolution</span>
          <strong>${escapeHtml(resolvedRate)}</strong>
        </div>
        <div class="staff-progress-cell">
          <span class="label">${progressLabel}</span>
          <div class="performance-bar"><div class="performance-fill" style="width:${progressValue}%"></div></div>
        </div>
        <div class="staff-button">
          <button type="button">Details</button>
        </div>
      `;

      el.appendChild(row);
    });
  }

  function renderOverviewCharts(){
    const labels = staffData.map(s=> s.name || '—');
    const handled = staffData.map(s=> s.messages_handled || 0);
    const avgResp = staffData.map(s=> s.avg_response_time != null ? s.avg_response_time : 0);

    // Messages handled bar chart
    const actCtx = $activityCanvas() && $activityCanvas().getContext ? $activityCanvas().getContext('2d') : null;
    if (actCtx){
      if (messagesChart) messagesChart.destroy();
      messagesChart = new Chart(actCtx, {
        type: 'bar',
        data: { labels, datasets: [{ label: 'Messages handled', data: handled, backgroundColor: '#4f46e5' }] },
        options: { responsive:true, maintainAspectRatio:false }
      });
    }

    // Avg response small line/doughnut
    const sumAvg = avgResp.filter(v=>v>0).length ? Math.round((avgResp.reduce((a,b)=>a+b,0) / (avgResp.filter(v=>v>0).length)) ) : 0;
    const avgCtx = $avgRespCanvas() && $avgRespCanvas().getContext ? $avgRespCanvas().getContext('2d') : null;
    if (avgCtx){
      if (avgRespChart) avgRespChart.destroy();
      avgRespChart = new Chart(avgCtx, {
        type: 'doughnut',
        data: { labels:['Avg response (s)','Remaining'], datasets:[{ data:[sumAvg, Math.max(0, Math.round(sumAvg*1.5))], backgroundColor:['#0ea5e9','#e6eef9'] }] },
        options: { responsive:true, maintainAspectRatio:false, cutout: '60%' }
      });
    }
  }

  function renderSummary(){
    const totalHandled = staffData.reduce((acc,s)=> acc + (s.messages_handled||0), 0);
    const avgRespValues = staffData.filter(s=>s.avg_response_time!=null).map(s=>s.avg_response_time);
    const avgRespVal = avgRespValues.length ? Math.round(avgRespValues.reduce((a,b)=>a+b,0) / avgRespValues.length) : '—';
    const resolutionValues = staffData.filter(s=>s.resolution_rate!=null).map(s=>s.resolution_rate);
    const resolutionRate = resolutionValues.length ? Math.round(resolutionValues.reduce((a,b)=>a+b,0) / resolutionValues.length) : (avgRespVal !== '—' ? Math.max(54, Math.min(96, 110 - avgRespVal)) : '—');
    const liveLoad = totalHandled ? Math.min(100, Math.round(Math.min(1, totalHandled / 420) * 100)) : 0;

    const totalEl = document.getElementById('kpi-totalHandled');
    const avgEl = document.getElementById('kpi-avgResponse');
    const resolutionEl = document.getElementById('kpi-resolutionRate');
    const summaryTotalEl = document.getElementById('summaryTotalHandled');
    const summaryRespEl = document.getElementById('summaryAvgResp');
    const summaryResolutionEl = document.getElementById('summaryResolutionRate');
    const flowFill = document.getElementById('summaryFlowFill');
    const flowText = document.getElementById('summaryFlowText');

    if (totalEl) totalEl.textContent = totalHandled;
    if (avgEl) avgEl.textContent = avgRespVal !== '—' ? `${avgRespVal}s` : '—';
    if (resolutionEl) resolutionEl.textContent = resolutionRate !== '—' ? `${resolutionRate}%` : '—';
    if (summaryTotalEl) summaryTotalEl.textContent = totalHandled;
    if (summaryRespEl) summaryRespEl.textContent = avgRespVal !== '—' ? `${avgRespVal}s` : '—';
    if (summaryResolutionEl) summaryResolutionEl.textContent = resolutionRate !== '—' ? `${resolutionRate}%` : '—';
    if (flowFill) flowFill.style.width = `${liveLoad}%`;
    if (flowText) flowText.textContent = `${liveLoad}% team utilization`;
  }

  function openStaffModal(s){
    const modal = document.getElementById('staffModal');
    if (!modal) return;
    document.getElementById('modalName').textContent = s.name || 'Staff';
    const body = document.getElementById('modalBody');
    body.innerHTML = '';

    const details = document.createElement('div');
    details.className = 'staff-detail-summary';
    details.innerHTML = `
      <div class="staff-detail-row"><span>Team</span><strong>${escapeHtml(s.team || 'Support')}</strong></div>
      <div class="staff-detail-row"><span>Handled</span><strong>${s.messages_handled || 0}</strong></div>
      <div class="staff-detail-row"><span>Avg response</span><strong>${s.avg_response_time != null ? escapeHtml(s.avg_response_time + 's') : '—'}</strong></div>
      <div class="staff-detail-row"><span>Avg resolution</span><strong>${s.avg_resolution_time != null ? escapeHtml(s.avg_resolution_time + 's') : '—'}</strong></div>
      <div class="staff-detail-row"><span>Resolution rate</span><strong>${s.resolution_rate != null ? escapeHtml(s.resolution_rate + '%') : '—'}</strong></div>
    `;
    body.appendChild(details);

    const chartContainer = document.createElement('div');
    chartContainer.className = 'staff-detail-chart';
    const chartLabel = document.createElement('div');
    chartLabel.className = 'staff-detail-chart-label';
    chartLabel.textContent = 'Replies in the last 7 days';
    chartContainer.appendChild(chartLabel);

    const c = document.createElement('canvas');
    c.style.width = '100%';
    c.style.height = '180px';
    chartContainer.appendChild(c);
    body.appendChild(chartContainer);

    const labels = (s.last_week && s.last_week.length) ? s.last_week.map((_,i)=>`Day ${i+1}`) : [];
    const chartData = Array.isArray(s.last_week) ? s.last_week : [];
    const ctx = c.getContext('2d');
    new Chart(ctx, {
      type:'line',
      data: {
        labels,
        datasets:[{
          label:'Replies',
          data: chartData,
          borderColor:'#4f46e5',
          backgroundColor:'rgba(79,70,229,0.12)',
          fill:true,
          tension:0.3,
          pointRadius:4
        }]
      },
      options:{
        responsive:true,
        maintainAspectRatio:false,
        scales: {
          x: { grid: { display: false } },
          y: { beginAtZero:true, ticks: { precision:0 } }
        }
      }
    });

    modal.setAttribute('aria-hidden','false');
    modal.style.display = 'block';
    document.getElementById('modalClose').onclick = ()=> { modal.setAttribute('aria-hidden','true'); modal.style.display='none'; };
    modal.onclick = (event) => {
      if (event.target === modal) {
        modal.setAttribute('aria-hidden','true');
        modal.style.display='none';
      }
    };
  }

  function escapeHtml(str){ return String(str).replace(/[&<>\"']/g, function(m){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'})[m]; }); }

  // ============ Live Staff Presence Map ============
  let staffPresence = [];
  let currentPresenceFilter = 'all';

  const $presenceGrid = () => document.getElementById('presenceGrid');
  const $presenceFilterBtns = () => document.querySelectorAll('.filter-btn');

  function getStatusColor(status) {
    const colors = {
      online: '#10b981',
      away: '#f59e0b',
      busy: '#ef4444',
      offline: '#9ca3af'
    };
    return colors[status] || '#9ca3af';
  }

  function getStatusEmoji(status) {
    const emojis = {
      online: '🟢',
      away: '🟡',
      busy: '🔴',
      offline: '⚫'
    };
    return emojis[status] || '⚫';
  }

  function fetchPresence() {
    fetch('/api/staff-presence').then(r=>r.json()).then(data=>{
      staffPresence = Array.isArray(data) ? data : [];
      renderPresenceMap();
    }).catch(err=>{
      console.error('Failed to load staff presence', err);
      if ($presenceGrid()) {
        $presenceGrid().innerHTML = '<div class="presence-empty"><div class="presence-empty-icon">⚠️</div><div class="presence-empty-text">Failed to load staff presence</div></div>';
      }
    });
  }

  function renderPresenceMap() {
    const grid = $presenceGrid();
    if (!grid) return;

    let filtered = staffPresence.filter(staff => {
      if (currentPresenceFilter === 'all') return true;
      return staff.status === currentPresenceFilter;
    });

    grid.innerHTML = '';
    if (filtered.length === 0) {
      grid.innerHTML = '<div class="presence-empty"><div class="presence-empty-icon">👋</div><div class="presence-empty-text">No staff ' + (currentPresenceFilter === 'all' ? 'online' : 'with status ' + currentPresenceFilter) + '</div></div>';
      return;
    }

    filtered.forEach(staff => {
      const card = document.createElement('div');
      card.className = 'presence-card';
      const initials = escapeHtml(staff.name).split(' ').map(n=>n[0]).join('').substring(0,2).toUpperCase();
      const statusLabel = staff.status ? staff.status.charAt(0).toUpperCase() + staff.status.slice(1) : 'Offline';
      
      card.innerHTML = `
        <div class="presence-card-header">
          <div class="presence-avatar">${initials}</div>
          <div class="presence-info">
            <div class="presence-name">${escapeHtml(staff.name || '—')}</div>
            <div class="presence-role">${escapeHtml(staff.role || 'agent')}</div>
          </div>
        </div>
        <div class="presence-status">
          <span class="status-indicator ${staff.status || 'offline'}"></span>
          <span>${getStatusEmoji(staff.status || 'offline')} ${statusLabel}</span>
        </div>
        <div class="presence-details">
          <div class="presence-detail-item">
            <span class="presence-detail-label">Last active:</span>
            <span class="presence-detail-value">${escapeHtml(staff.lastActive || '—')}</span>
          </div>
          ${staff.activeConversation ? `
          <div class="presence-detail-item">
            <span class="presence-detail-label">On chat:</span>
            <span class="presence-activity">
              <span class="presence-activity-icon"></span>
              <span>Active</span>
            </span>
          </div>
          ` : `
          <div class="presence-detail-item">
            <span class="presence-detail-label">Status:</span>
            <span class="presence-detail-value">Available</span>
          </div>
          `}
        </div>
      `;
      grid.appendChild(card);
    });
  }

  function setupPresenceFilters() {
    const filterBtns = $presenceFilterBtns();
    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentPresenceFilter = btn.dataset.filter;
        renderPresenceMap();
      });
    });
  }

  // ============ Socket.IO Real-time Presence Updates ============
  if (typeof io !== 'undefined') {
    const socket = io();
    
    socket.on('presenceUpdate', (data) => {
      if (Array.isArray(data)) {
        // Update staff presence with latest data from socket
        staffPresence = staffPresence.map(staff => {
          const updated = data.find(d => d.userId === staff.userId);
          if (updated) {
            return {
              ...staff,
              status: updated.status || staff.status,
              activeConversation: updated.activeConversation !== undefined ? updated.activeConversation : staff.activeConversation
            };
          }
          return staff;
        });
        renderPresenceMap();
      }
    });

    socket.on('connect', () => {
      console.log('Connected to presence updates');
    });
  }

  function handleStaffDetailsClick(event) {
    const button = event.target.closest('button');
    if (!button) return;
    const row = button.closest('.staff-row');
    if (!row || !row.dataset.staffId) return;
    const staff = staffData.find(s => String(s.id) === row.dataset.staffId);
    if (!staff) return;
    openStaffModal(staff);
  }

  // Wire events
  document.addEventListener('DOMContentLoaded', ()=>{
    if ($search()) $search().addEventListener('input', renderStaffList);
    if ($sort()) $sort().addEventListener('change', renderStaffList);
    if ($refresh()) $refresh().addEventListener('click', fetchMetrics);
    if ($staffList()) $staffList().addEventListener('click', handleStaffDetailsClick);
    
    // Setup presence map
    setupPresenceFilters();
    fetchPresence();
    
    fetchMetrics();
  });

})();
