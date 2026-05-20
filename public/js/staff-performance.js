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

    list.forEach(s => {
      const responseTime = s.avg_response_time != null ? `${s.avg_response_time}s` : '—';
      const resolvedRate = s.resolution_rate != null ? `${Math.round(s.resolution_rate)}%` : '—';
      const handled = s.messages_handled || 0;
      const progressValue = s.resolution_rate != null ? Math.min(100, Math.max(12, Math.round(s.resolution_rate))) : Math.min(100, Math.max(12, 110 - (s.avg_response_time || 60)));
      const tags = s.team ? `<span class="staff-meta">${escapeHtml(s.team)}</span>` : `<span class="staff-meta">Support</span>`;
      const row = document.createElement('div');
      row.className = 'staff-row';
      row.innerHTML = `
        <div class="staff-identity">
          <span class="staff-avatar">${escapeHtml((s.name||'')[0]||'S')}</span>
          <div class="staff-info">
            <span class="staff-name">${escapeHtml(s.name||'—')}</span>
            ${tags}
          </div>
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
          <span class="label">${progressValue}% efficiency</span>
          <div class="performance-bar"><div class="performance-fill" style="width:${progressValue}%"></div></div>
        </div>
        <div class="staff-button">
          <button type="button">Details</button>
        </div>
      `;

      row.querySelector('button').onclick = () => openStaffModal(s);
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
    const info = document.createElement('div');
    info.innerHTML = `<p>Handled: <strong>${s.messages_handled||0}</strong></p><p>Avg response: <strong>${s.avg_response_time!=null? s.avg_response_time+'s' : '—'}</strong></p><p>Avg resolution: <strong>${s.avg_resolution_time!=null? s.avg_resolution_time+'s' : '—'}</strong></p>`;
    body.appendChild(info);

    const c = document.createElement('canvas');
    c.style.width = '100%';
    c.style.height = '160px';
    body.appendChild(c);
    // last_week chart
    const ctx = c.getContext('2d');
    const labels = (s.last_week && s.last_week.length) ? s.last_week.map((_,i)=>`-${6-i}d`) : [];
    new Chart(ctx, { type:'line', data: { labels, datasets:[{ label:'Replies', data: s.last_week || [], borderColor:'#4f46e5', backgroundColor:'rgba(79,70,229,0.08)', tension:0.3 }] }, options:{responsive:true, maintainAspectRatio:false} });

    modal.setAttribute('aria-hidden','false');
    modal.style.display = 'block';
    document.getElementById('modalClose').onclick = ()=> { modal.setAttribute('aria-hidden','true'); modal.style.display='none'; };
  }

  function escapeHtml(str){ return String(str).replace(/[&<>\"']/g, function(m){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'})[m]; }); }

  // Wire events
  document.addEventListener('DOMContentLoaded', ()=>{
    if ($search()) $search().addEventListener('input', renderStaffList);
    if ($sort()) $sort().addEventListener('change', renderStaffList);
    if ($refresh()) $refresh().addEventListener('click', fetchMetrics);
    fetchMetrics();
  });

})();
