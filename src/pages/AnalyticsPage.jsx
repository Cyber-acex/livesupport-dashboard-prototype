import { useEffect, useMemo, useRef, useState } from 'react';
import { useNotification } from '../contexts/NotificationContext';
import { io } from 'socket.io-client';
import ApexCharts from 'apexcharts';
import { Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, CalendarRange, Download, Filter, Gauge, MessageCircle, RefreshCw, Users, Zap } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import TopBar from '../components/TopBar';
import MonthlySalesChart from '../components/MonthlySalesChart';
import StatisticsChart from '../components/StatisticsChart';
import { fetchAnalytics, fetchMyMetrics, fetchMessagesMonthly, fetchTicketStats, fetchTicketsByPeriod, fetchStaffMetrics, fetchStaffPresence } from '../services/analyticsService';

const socket = io();

function createBarChart(ctx, data) {
  if (!ctx || !window.Chart) return null;
  return new window.Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Today', 'This Week', 'This Month'],
      datasets: [{
        label: 'Tickets Created',
        data,
        backgroundColor: ['#3b82f6', '#10b981', '#6366f1'],
        borderRadius: 10,
        maxBarThickness: 48
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: true, position: 'top' } },
      scales: { y: { beginAtZero: true } }
    }
  });
}

function createSupportActivityChart(element, data) {
  if (!element) return null;
  return new ApexCharts(element, {
    chart: { type: 'bar', height: 320, toolbar: { show: false }, animations: { enabled: true, speed: 550 } },
    series: [{ name: 'Conversations', data }],
    colors: ['#0f766e', '#f59e0b', '#6366f1'],
    plotOptions: { bar: { distributed: true, borderRadius: 9, columnWidth: '42%' } },
    dataLabels: { enabled: true, style: { colors: ['#102a2c'] }, offsetY: -18 },
    legend: { show: false },
    xaxis: { categories: ['Active chats', 'Total tickets', 'AI feedback'], axisBorder: { show: false }, axisTicks: { show: false }, labels: { style: { colors: '#64748b', fontSize: '12px' } } },
    yaxis: { min: 0, forceNiceScale: true, labels: { style: { colors: '#94a3b8' } } },
    grid: { borderColor: '#e2e8f0', strokeDashArray: 5 },
    tooltip: { y: { formatter: (value) => `${value} conversations` } }
  });
}

function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState('analytics');
  const [analytics, setAnalytics] = useState({});
  const [myMetrics, setMyMetrics] = useState({});
  const [monthlyMessages, setMonthlyMessages] = useState({ labels: [], ai: [], staff: [] });
  const [ticketStats, setTicketStats] = useState([0, 0, 0]);
  const [staffMetrics, setStaffMetrics] = useState([]);
  const [staffPresence, setStaffPresence] = useState([]);
  const [filter, setFilter] = useState('all');
  const [branch, setBranch] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [timeRange, setTimeRange] = useState('7');
  const { success, info } = useNotification();
  const ticketsRef = useRef(null);
  const barRef = useRef(null);
  const [ticketChart, setTicketChart] = useState(null);
  const [barChart, setBarChart] = useState(null);

  useEffect(() => {
    const today = new Date();
    const prior = new Date();
    prior.setDate(today.getDate() - 30);
    setStartDate(prior.toISOString().slice(0, 10));
    setEndDate(today.toISOString().slice(0, 10));
  }, []);

  useEffect(() => {
    async function loadAll() {
      try {
        const [analyticsRes, myMetricsRes, messagesRes, ticketsRes, staffMetricsRes, staffPresenceRes] = await Promise.all([
          fetchAnalytics({ branch, start: startDate, end: endDate }),
          fetchMyMetrics(),
          fetchMessagesMonthly(),
          fetchTicketStats(),
          fetchStaffMetrics(),
          fetchStaffPresence()
        ]);
        setAnalytics(analyticsRes);
        setMyMetrics(myMetricsRes);
        setMonthlyMessages(messagesRes);
        setTicketStats([ticketsRes.today || 0, ticketsRes.week || 0, ticketsRes.month || 0]);
        setStaffMetrics(staffMetricsRes);
        setStaffPresence(staffPresenceRes);
      } catch (error) {
        console.error(error);
      }
    }
    loadAll();
  }, [branch, startDate, endDate]);

  useEffect(() => {
    if (window.Chart && ticketsRef.current) {
      const chart = ticketChart || createBarChart(ticketsRef.current.getContext('2d'), ticketStats);
      if (!ticketChart) setTicketChart(chart);
    }
  }, [ticketStats, ticketChart]);

  useEffect(() => {
    if (barRef.current) {
      const chartData = [analytics.activeChats || 0, analytics.numTickets || 0, analytics.aiFeedbackCount || 0];
      if (barChart) barChart.destroy();
      const chart = createSupportActivityChart(barRef.current, chartData);
      setBarChart(chart);
      chart?.render();
    }
    return () => barChart?.destroy();
  }, [analytics]);

  useEffect(() => {
    if (!socket) return;
    socket.on('ticketCreated', () => info('Ticket created.'));
    socket.on('ticketDeleted', () => info('Ticket deleted.'));
    socket.on('ticketEscalated', () => info('Ticket escalated.'));
    socket.on('ticketFeedbackSubmitted', async () => {
      try {
        setAnalytics(await fetchAnalytics());
      } catch (error) {
        console.error('Failed to refresh CSAT analytics:', error);
      }
    });
    socket.on('receiptCreated', () => info('Receipt created.'));
    socket.on('receiptDeleted', () => info('Receipt deleted.'));
    socket.on('connect', () => console.log('Socket connected'));
    return () => {
      socket.off('ticketCreated');
      socket.off('ticketDeleted');
      socket.off('ticketEscalated');
      socket.off('ticketFeedbackSubmitted');
      socket.off('receiptCreated');
      socket.off('receiptDeleted');
      socket.off('connect');
    };
  }, []);

  const formatMoney = (value) => {
    if (typeof value !== 'number') return '—';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(value);
  };

  const analyticsBreakdowns = useMemo(() => ({
    issues: Array.isArray(analytics.issueCategories) ? analytics.issueCategories : [],
    revenue: analytics.revenueSaved || {},
    topAgent: analytics.topAgent || null
  }), [analytics]);

  const topIssueCount = Math.max(...analyticsBreakdowns.issues.map((row) => Number(row.count) || 0), 1);

  const staffCards = useMemo(() => staffMetrics.map((metric) => (
    <div key={metric.id} className="rounded-[22px] border border-slate-200/80 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.07)]">
      <h3 className="text-sm uppercase tracking-[0.18em] text-slate-500">{metric.name}</h3>
      <p className="mt-3 text-3xl font-bold text-slate-900">{metric.messages_handled || 0}</p>
      <p className="mt-2 text-sm text-slate-500">Avg response {metric.avg_response_time ?? '—'}s</p>
    </div>
  )), [staffMetrics]);

  const presenceFiltered = useMemo(() => staffPresence.filter((agent) => filter === 'all' || agent.status === filter), [staffPresence, filter]);

  const liveKpis = [
    { label: 'Tickets created', value: typeof analytics.numTickets === 'number' ? analytics.numTickets : '—', detail: 'in selected window', trend: '+12.8%', color: 'bg-[#e7f7f2] text-[#087f68]', icon: MessageCircle, rising: true },
    { label: 'First response', value: typeof analytics.avgResponseSeconds === 'number' ? `${Math.round(analytics.avgResponseSeconds)}s` : '—', detail: 'average time', trend: '-8.4%', color: 'bg-[#fff1e5] text-[#b45309]', icon: Zap, rising: false },
    { label: 'Resolution health', value: analytics.resolutionRate ? `${Math.round(analytics.resolutionRate * 100)}%` : '—', detail: 'of conversations', trend: '+4.2%', color: 'bg-[#eaf1ff] text-[#3159b8]', icon: Gauge, rising: true },
    { label: 'Active right now', value: typeof analytics.activeChats === 'number' ? analytics.activeChats : '—', detail: 'live conversations', trend: 'Live', color: 'bg-[#f7edff] text-[#8746b5]', icon: Users, rising: true }
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.18),_transparent_32%),linear-gradient(135deg,_#f8fbff_0%,_#f4f7fb_100%)] text-slate-900">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-[radial-gradient(circle_at_90%_0%,rgba(251,146,60,0.12),transparent_25%),radial-gradient(circle_at_5%_28%,rgba(20,184,166,0.1),transparent_25%),#f8fafc] p-3 sm:p-6 lg:p-8">
          <div className="mb-6 overflow-hidden rounded-[28px] border border-[#dbe4e5] bg-[#102a2c] p-5 text-white shadow-[0_26px_70px_rgba(16,42,44,0.2)] sm:p-7">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.24em] text-[#8de0c4]"><span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#8de0c4] opacity-70" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#8de0c4]" /></span>Live operations center</div>
                <h1 className="mt-4 max-w-xl text-3xl font-semibold leading-tight tracking-[-0.03em] sm:text-5xl">Know what needs attention before it asks.</h1>
                <p className="mt-4 max-w-xl text-sm leading-7 text-[#b7cbca] sm:text-base">A live read on customer demand, team capacity, and the moments that shape your support experience.</p>
              </div>
              <div className="min-w-[210px] border-l border-white/15 pl-5 lg:pb-1">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#b7cbca]"><Activity size={14} className="text-[#8de0c4]" /> System pulse</div>
                <p className="mt-3 text-3xl font-semibold tracking-tight text-white">24/7 <span className="text-base font-medium text-[#8de0c4]">aligned</span></p>
                <p className="mt-2 text-sm text-[#b7cbca]">Last synced just now</p>
              </div>
            </div>
            <div className="mt-7 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-4">
              {[['Active chats', analytics.activeChats], ['Avg response', typeof analytics.avgResponseSeconds === 'number' ? `${Math.round(analytics.avgResponseSeconds)}s` : '—'], ['AI feedback', analytics.aiFeedbackAvg != null ? Number(analytics.aiFeedbackAvg).toFixed(2) : '—'], ['Recovered value', analytics.revenueSaved?.recoveredAmount != null ? formatMoney(analytics.revenueSaved.recoveredAmount) : '—']].map(([label, value]) => <div key={label} className="bg-white/[0.06] px-4 py-3"><p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#8faead]">{label}</p><p className="mt-1 text-lg font-semibold text-white">{value ?? '—'}</p></div>)}
            </div>
          </div>

          <div className="mb-6 overflow-x-auto">
            <div className="flex min-w-max items-center gap-2 rounded-2xl border border-slate-200/70 bg-white/90 p-1.5 shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur">
              {['analytics', 'staff'].map((tab) => (
                <button
                  key={tab}
                  type="button"
                  className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${activeTab === tab ? 'bg-[#102a2c] text-white shadow-lg' : 'bg-transparent text-slate-700 hover:bg-slate-100'}`}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab === 'analytics' ? 'Analytics' : 'Staff Performance'}
                </button>
              ))}
            </div>
          </div>

          {activeTab === 'analytics' ? (
            <section className="space-y-6">
              <div className="mb-1 flex flex-col gap-4 rounded-2xl border border-slate-200/80 bg-white/85 p-3 shadow-[0_12px_30px_rgba(15,23,42,0.05)] backdrop-blur-xl lg:flex-row lg:items-center">
                <div className="flex items-center gap-2 px-2 text-sm font-semibold text-slate-800"><CalendarRange size={17} className="text-[#0f766e]" /> Date window</div>
                <div className="grid flex-1 gap-2 sm:grid-cols-2">
                  <input aria-label="From date" value={startDate} onChange={(event) => setStartDate(event.target.value)} type="date" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-[#0f766e]" />
                  <input aria-label="To date" value={endDate} onChange={(event) => setEndDate(event.target.value)} type="date" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-[#0f766e]" />
                </div>
                <div className="flex items-center gap-2">
                  <Filter size={16} className="text-slate-400" />
                  <select aria-label="Branch" value={branch} onChange={(event) => setBranch(event.target.value)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-[#0f766e]">
                    <option value="all">All</option>
                    <option value="ikeja">Ikeja</option>
                  </select>
                </div>
                <button type="button" onClick={() => success('Filters applied.')} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#102a2c] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1b4143]"><RefreshCw size={15} /> Apply</button>
                <button type="button" onClick={() => success('CSV export prepared.')} aria-label="Export CSV" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#e7f7f2] px-4 py-2.5 text-sm font-semibold text-[#087f68] transition hover:bg-[#d3f1e7]"><Download size={15} /> Export</button>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {liveKpis.map(({ label, value, detail, trend, color, icon: Icon, rising }) => <div key={label} className="group rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-[0_12px_30px_rgba(15,23,42,0.05)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_34px_rgba(15,23,42,0.1)]"><div className="flex items-start justify-between"><span className={`grid h-10 w-10 place-items-center rounded-xl ${color}`}><Icon size={19} /></span><span className={`inline-flex items-center gap-1 text-xs font-bold ${rising ? 'text-[#087f68]' : 'text-[#b45309]'}`}>{rising ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}{trend}</span></div><p className="mt-5 text-[11px] font-bold uppercase tracking-[0.13em] text-slate-500">{label}</p><p className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">{value}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></div>)}
              </div>

              <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
                <div className="rounded-[30px] border border-slate-200/70 bg-white/80 p-4 shadow-[0_20px_50px_rgba(15,23,42,0.08)] backdrop-blur-xl sm:p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-semibold text-slate-900">Support Activity</h3>
                      <p className="mt-1 text-sm text-slate-500">Traffic and productivity at a glance</p>
                    </div>
                    <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">Realtime</span>
                  </div>
                  <div className="h-[360px] rounded-[24px] bg-slate-50 p-4">
                    <div ref={barRef} className="h-full w-full" aria-label="Support activity chart" />
                  </div>
                </div>

                <div className="rounded-[30px] border border-slate-200/70 bg-slate-950 p-4 text-white shadow-[0_20px_50px_rgba(15,23,42,0.12)] sm:p-6">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Focus score</p>
                  <h3 className="mt-3 text-2xl font-semibold">Smart operations, less friction</h3>
                  <p className="mt-3 text-sm leading-7 text-slate-300">Prioritize high-impact conversations, keep response times sharp, and surface trend shifts before they become issues.</p>
                  <div className="mt-6 space-y-4">
                    <div>
                      <div className="mb-2 flex items-center justify-between text-sm text-slate-300">
                        <span>Coverage</span>
                        <span className="font-semibold text-white">92%</span>
                      </div>
                      <div className="h-2 rounded-full bg-white/10">
                        <div className="h-2 w-[92%] rounded-full bg-gradient-to-r from-sky-500 to-indigo-600" />
                      </div>
                    </div>
                    <div>
                      <div className="mb-2 flex items-center justify-between text-sm text-slate-300">
                        <span>Automation health</span>
                        <span className="font-semibold text-white">87%</span>
                      </div>
                      <div className="h-2 rounded-full bg-white/10">
                        <div className="h-2 w-[87%] rounded-full bg-gradient-to-r from-cyan-400 to-emerald-500" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-6 xl:grid-cols-3">
                <div className="rounded-[30px] border border-slate-200/70 bg-white/90 p-5 shadow-[0_20px_50px_rgba(15,23,42,0.08)] backdrop-blur-xl">
                  <div className="mb-5 flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-xl bg-[#fff1e5] text-[#b45309]"><AlertTriangle size={16} /></span><h3 className="text-xl font-semibold text-slate-900">Top issues</h3></div>
                      <p className="mt-2 text-sm text-slate-500">Where customers need the most help.</p>
                    </div>
                    <span className="rounded-full bg-[#fff1e5] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#b45309]">Attention</span>
                  </div>
                  <div className="space-y-2">
                    {analyticsBreakdowns.issues.length === 0 ? (
                      <div className="rounded-2xl bg-slate-50 p-6 text-center text-slate-500">No top issues identified.</div>
                    ) : analyticsBreakdowns.issues.slice(0, 5).map((row, index) => (
                      <div key={row.issue} className={`rounded-2xl border px-3 py-3 ${index === 0 ? 'border-[#f4c9a5] bg-[#fffaf5]' : 'border-slate-200 bg-slate-50'}`}>
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-3"><span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs font-bold ${index === 0 ? 'bg-[#f59e0b] text-white' : 'bg-white text-slate-500'}`}>{String(index + 1).padStart(2, '0')}</span><span className="truncate text-sm font-semibold text-slate-700">{row.issue}</span></div>
                          <span className="shrink-0 text-sm font-bold text-slate-900">{row.count}</span>
                        </div>
                        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200"><div className={`h-full rounded-full ${index === 0 ? 'bg-[#f59e0b]' : 'bg-[#7aa7a3]'}`} style={{ width: `${Math.max(8, ((Number(row.count) || 0) / topIssueCount) * 100)}%` }} /></div>
                      </div>
                    ))}
                  </div>
                  {analyticsBreakdowns.issues.length > 5 && <p className="mt-4 text-center text-xs font-semibold text-slate-400">+{analyticsBreakdowns.issues.length - 5} more issue categories</p>}
                </div>

                <div className="rounded-[30px] border border-slate-200/70 bg-white/80 p-5 shadow-[0_20px_50px_rgba(15,23,42,0.08)] backdrop-blur-xl">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-xl font-semibold text-slate-900">Revenue saved</h3>
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs uppercase tracking-[0.18em] text-emerald-700">Estimates</span>
                  </div>
                  <div className="space-y-4">
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <div className="text-sm text-slate-500">Prevented cancellations</div>
                      <div className="mt-2 text-2xl font-semibold text-slate-900">{analyticsBreakdowns.revenue.preventedCancellations ?? '—'}</div>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <div className="text-sm text-slate-500">Recovered orders</div>
                      <div className="mt-2 text-2xl font-semibold text-slate-900">{analyticsBreakdowns.revenue.recoveredOrders ?? '—'}</div>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <div className="text-sm text-slate-500">Estimated value</div>
                      <div className="mt-2 text-2xl font-semibold text-slate-900">{analyticsBreakdowns.revenue.recoveredAmount != null ? formatMoney(analyticsBreakdowns.revenue.recoveredAmount) : '—'}</div>
                    </div>
                  </div>
                </div>

                <div className="rounded-[30px] border border-slate-200/70 bg-white/80 p-5 shadow-[0_20px_50px_rgba(15,23,42,0.08)] backdrop-blur-xl">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-xl font-semibold text-slate-900">Agent & AI performance</h3>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs uppercase tracking-[0.18em] text-slate-500">Accuracy</span>
                  </div>
                  <div className="space-y-4">
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <div className="text-sm text-slate-500">Escalation rate</div>
                      <div className="mt-2 text-2xl font-semibold text-slate-900">{analytics.escalationRate ? `${Math.round(analytics.escalationRate * 100)}%` : '—'}</div>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <div className="text-sm text-slate-500">AI performance</div>
                      <div className="mt-2 text-2xl font-semibold text-slate-900">{analytics.aiAccuracy != null ? `${Number(analytics.aiAccuracy).toFixed(2)}%` : '—'}</div>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <div className="text-sm text-slate-500">Top agent</div>
                      <div className="mt-2 text-lg font-semibold text-slate-900">{analyticsBreakdowns.topAgent?.name ?? '—'}</div>
                      <div className="text-sm text-slate-500">Handled {analyticsBreakdowns.topAgent?.messagesHandled ?? '—'} replies</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-6 xl:grid-cols-2">
                <div className="rounded-[30px] border border-slate-200/70 bg-white/80 p-4 shadow-[0_20px_50px_rgba(15,23,42,0.08)] backdrop-blur-xl sm:p-5">
                  <h3 className="mb-4 text-xl font-semibold text-slate-900">AI vs Staff Messages (Monthly)</h3>
                  <div className="h-[360px] rounded-[24px] bg-slate-50 p-4">
                    <StatisticsChart className="h-full w-full" />
                  </div>
                </div>

                <div className="rounded-[30px] border border-slate-200/70 bg-white/80 p-5 shadow-[0_20px_50px_rgba(15,23,42,0.08)] backdrop-blur-xl">
                  <h3 className="mb-4 text-xl font-semibold text-slate-900">Tickets Created</h3>
                  <div className="h-[360px] rounded-[24px] bg-slate-50 p-4">
                    <MonthlySalesChart className="h-full w-full" />
                  </div>
                </div>
              </div>
            </section>
          ) : (
            <section className="space-y-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-sky-500">Staff Performance</p>
                  <h1 className="mt-3 text-3xl font-semibold text-slate-900">Team performance with real-time clarity</h1>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">Track agent efficiency, throughput, and service quality with a compact, engineering-style dashboard.</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button type="button" className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800">Refresh</button>
                  <select value={timeRange} onChange={(event) => setTimeRange(event.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none">
                    <option value="7">Last 7 days</option>
                    <option value="30">Last 30 days</option>
                    <option value="90">Last 90 days</option>
                  </select>
                  <button type="button" className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-200">Export CSV</button>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <InfoCard title="Total handled" value={analytics.numChats ?? '—'} description="Messages processed by the team." />
                <InfoCard title="Avg response" value={analytics.avgResponseSeconds ? Math.round(analytics.avgResponseSeconds) : '—'} description="Average response time in seconds." />
                <InfoCard title="Resolution health" value={analytics.resolutionRate ? `${Math.round(analytics.resolutionRate * 100)}%` : '—'} description="Estimated fulfillment rate." />
                <InfoCard title="Active chats" value={analytics.activeChats ?? '—'} description="Conversations currently in progress." />
                <InfoCard title="AI feedback" value={analytics.aiFeedbackAvg != null ? Number(analytics.aiFeedbackAvg).toFixed(2) : '—'} description="Average quality rating from feedback." />
              </div>

              <div className="rounded-[28px] border border-slate-200/70 bg-white/80 p-4 shadow-[0_20px_50px_rgba(15,23,42,0.08)] backdrop-blur-xl sm:p-6">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
                  <h3 className="text-xl font-semibold text-slate-900">Live Staff Presence Map</h3>
                  <div className="flex flex-wrap gap-2">
                    {['all', 'online', 'away', 'busy'].map((status) => (
                      <button
                        key={status}
                        type="button"
                        onClick={() => setFilter(status)}
                        className={`rounded-2xl px-4 py-2 text-sm font-semibold ${filter === status ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                      >
                        {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {presenceFiltered.length === 0 ? (
                    <div className="rounded-[22px] bg-slate-50 p-10 text-center text-slate-500">No staff presence data available.</div>
                  ) : presenceFiltered.map((agent) => (
                    <div key={agent.userId} className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-[0_20px_40px_rgba(15,23,42,0.08)]">
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-indigo-600 text-lg font-bold text-white">{agent.name?.charAt(0) || 'A'}</div>
                        <div>
                          <div className="text-sm font-semibold text-slate-900">{agent.name}</div>
                          <div className="text-xs uppercase tracking-[0.18em] text-slate-500">{agent.role}</div>
                        </div>
                      </div>
                      <div className="mt-4 space-y-2">
                        <div className="flex items-center justify-between text-sm text-slate-600">
                          <span>Status</span>
                          <span className="font-semibold text-slate-900">{agent.status}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm text-slate-600">
                          <span>Active conversation</span>
                          <span className="font-semibold text-slate-900">{agent.activeConversation || '—'}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm text-slate-600">
                          <span>Last active</span>
                          <span className="font-semibold text-slate-900">{agent.lastActive}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
                <aside className="rounded-[28px] border border-slate-200/70 bg-white/80 p-4 shadow-[0_20px_50px_rgba(15,23,42,0.08)] backdrop-blur-xl sm:p-6">
                  <div className="mb-6">
                    <h4 className="text-xs uppercase tracking-[0.25em] text-slate-500">Performance summary</h4>
                    <p className="mt-4 text-3xl font-bold text-slate-900">{analytics.numChats ?? '—'}</p>
                    <p className="mt-2 text-sm text-slate-500">Total messages handled</p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Avg response</div>
                      <div className="mt-3 text-2xl font-semibold text-slate-900">{analytics.avgResponseSeconds ? Math.round(analytics.avgResponseSeconds) : '—'}</div>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Resolution rate</div>
                      <div className="mt-3 text-2xl font-semibold text-slate-900">{analytics.resolutionRate ? `${Math.round(analytics.resolutionRate * 100)}%` : '—'}</div>
                    </div>
                  </div>
                  <div className="mt-6 rounded-2xl bg-slate-50 p-4">
                    <div className="mb-2 flex items-center justify-between text-sm text-slate-600">
                      <span>Team load</span>
                      <span className="font-semibold text-slate-900">Live load gauge</span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-slate-200">
                      <div className="h-full rounded-full bg-gradient-to-r from-sky-500 to-indigo-600" style={{ width: `${Math.min(100, (analytics.activeChats || 0) * 2)}%` }} />
                    </div>
                  </div>
                  <div className="mt-6 rounded-[22px] bg-white p-4 shadow-[0_16px_32px_rgba(15,23,42,0.06)]">
                    <canvas id="avgResponseChart" className="h-52 w-full" />
                  </div>
                </aside>

                <div className="rounded-[28px] border border-slate-200/70 bg-white/80 p-4 shadow-[0_20px_50px_rgba(15,23,42,0.08)] backdrop-blur-xl sm:p-6">
                  <div className="mb-4 flex flex-wrap items-center gap-3">
                    <input placeholder="Search staff by name" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none sm:w-auto" />
                    <select className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none">
                      <option value="name">Name</option>
                      <option value="avg_response_time">Avg response (asc)</option>
                      <option value="-avg_response_time">Avg response (desc)</option>
                      <option value="messages_handled">Handled</option>
                    </select>
                  </div>
                  <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                    <div className="min-w-[760px] grid gap-3">
                      <div className="grid grid-cols-[1.7fr_0.9fr_0.85fr_0.85fr_0.85fr_1.05fr_0.8fr] gap-3 px-3 py-2 font-semibold uppercase tracking-[0.1em] text-slate-600">
                        <span>Agent</span><span>Status</span><span>Handled</span><span>Avg Resp</span><span>Resolution</span><span>Trend</span><span />
                      </div>
                      {staffMetrics.length === 0 ? (
                        <div className="rounded-2xl bg-white p-6 text-center text-slate-500">Loading...</div>
                      ) : staffMetrics.map((member) => (
                        <div key={member.id} className="grid grid-cols-[1.7fr_0.9fr_0.85fr_0.85fr_0.85fr_1.05fr_0.8fr] gap-3 items-center rounded-2xl bg-white px-3 py-4 text-sm text-slate-700">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-200 text-slate-700">{member.name?.slice(0, 2).toUpperCase()}</div>
                          <div>
                            <div className="font-semibold text-slate-900">{member.name}</div>
                            <div className="text-xs text-slate-500">{member.role || 'Agent'}</div>
                          </div>
                        </div>
                        <div>
                          <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs ${member.status === 'online' ? 'bg-emerald-100 text-emerald-700' : member.status === 'away' ? 'bg-amber-100 text-amber-700' : member.status === 'busy' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-700'}`}>
                            <span className={`h-2.5 w-2.5 rounded-full ${member.status === 'online' ? 'bg-emerald-500' : member.status === 'away' ? 'bg-amber-500' : member.status === 'busy' ? 'bg-rose-500' : 'bg-slate-500'}`} />
                            {member.status}
                          </span>
                        </div>
                        <strong>{member.messages_handled ?? 0}</strong>
                        <strong>{member.avg_response_time ?? '—'}s</strong>
                        <strong>{member.resolution_rate != null ? `${member.resolution_rate}%` : '—'}</strong>
                        <span className="text-slate-500">—</span>
                          <button className="rounded-2xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white">View</button>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="mt-5 h-64 rounded-[22px] bg-slate-50 p-4">
                    <canvas id="activityChart" className="h-full w-full" />
                  </div>
                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
                    <span>Showing {staffMetrics.length} staff members</span>
                    <div className="flex gap-2">
                      <button className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-slate-700">Prev</button>
                      <button className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-slate-700">Next</button>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

export default AnalyticsPage;
