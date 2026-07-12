import { useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import Sidebar from '../components/Sidebar';
import TopBar from '../components/TopBar';
import InfoCard from '../components/InfoCard';
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

function createSupportActivityBarChart(ctx, data) {
  if (!ctx || !window.Chart) return null;
  return new window.Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Active Chats', 'Total Tickets', 'Feedback Count'],
      datasets: [{
        label: 'Support Activity',
        data,
        backgroundColor: ['#3b82f6', '#10b981', '#6366f1'],
        borderRadius: 12,
        maxBarThickness: 48
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { enabled: true }
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#334155' } },
        y: { beginAtZero: true, ticks: { color: '#334155' }, grid: { color: 'rgba(148,163,184,0.18)', borderDash: [4, 4] } }
      }
    }
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
  const [notification, setNotification] = useState('');
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
    if (window.Chart && barRef.current) {
      const chartData = [analytics.activeChats || 0, analytics.numTickets || 0, analytics.aiFeedbackCount || 0];
      const chart = barChart || createSupportActivityBarChart(barRef.current.getContext('2d'), chartData);
      if (!barChart) setBarChart(chart);
    }
  }, [analytics, barChart]);

  useEffect(() => {
    if (!socket) return;
    socket.on('ticketCreated', () => setNotification('Ticket created.'));
    socket.on('ticketDeleted', () => setNotification('Ticket deleted.'));
    socket.on('ticketEscalated', () => setNotification('Ticket escalated.'));
    socket.on('receiptCreated', () => setNotification('Receipt created.'));
    socket.on('receiptDeleted', () => setNotification('Receipt deleted.'));
    socket.on('connect', () => console.log('Socket connected'));
    return () => {
      socket.off('ticketCreated');
      socket.off('ticketDeleted');
      socket.off('ticketEscalated');
      socket.off('receiptCreated');
      socket.off('receiptDeleted');
      socket.off('connect');
    };
  }, []);

  const staffCards = useMemo(() => staffMetrics.map((metric) => (
    <div key={metric.id} className="rounded-[22px] border border-slate-200/80 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.07)]">
      <h3 className="text-sm uppercase tracking-[0.18em] text-slate-500">{metric.name}</h3>
      <p className="mt-3 text-3xl font-bold text-slate-900">{metric.messages_handled || 0}</p>
      <p className="mt-2 text-sm text-slate-500">Avg response {metric.avg_response_time ?? '—'}s</p>
    </div>
  )), [staffMetrics]);

  const presenceFiltered = useMemo(() => staffPresence.filter((agent) => filter === 'all' || agent.status === filter), [staffPresence, filter]);

  return (
    <div className="flex h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.18),_transparent_32%),linear-gradient(135deg,_#f8fbff_0%,_#f4f7fb_100%)] text-slate-900">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {notification ? (
            <div className="mb-5 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700">
              {notification}
            </div>
          ) : null}

          <div className="mb-6 overflow-hidden rounded-[32px] border border-slate-200/70 bg-slate-950 p-6 text-white shadow-[0_40px_90px_rgba(2,6,23,0.24)]">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-200">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                  Live operations center
                </div>
                <h1 className="mt-4 text-3xl font-semibold sm:text-4xl">Support analytics with a sharper pulse</h1>
                <p className="mt-3 text-sm leading-7 text-slate-300 sm:text-base">
                  Track demand, response quality, and team momentum from one immersive control room designed to feel fast and premium.
                </p>
              </div>
              <div className="rounded-[24px] border border-white/10 bg-white/10 px-4 py-4 backdrop-blur">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-300">Sync status</p>
                <p className="mt-2 text-2xl font-semibold text-white">24/7</p>
                <p className="mt-2 text-sm text-slate-300">All systems aligned</p>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-slate-200">
                Active chats: <span className="ml-2 font-semibold text-white">{analytics.activeChats ?? '—'}</span>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-slate-200">
                Avg response: <span className="ml-2 font-semibold text-white">{analytics.avgResponseSeconds ? Math.round(analytics.avgResponseSeconds) : '—'}s</span>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-slate-200">
                Feedback: <span className="ml-2 font-semibold text-white">{analytics.aiFeedbackAvg != null ? Number(analytics.aiFeedbackAvg).toFixed(2) : '—'}</span>
              </div>
            </div>
          </div>

          <div className="mb-6 inline-flex rounded-full border border-slate-200/70 bg-white/80 p-1.5 shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur">
            {['analytics', 'staff'].map((tab) => (
              <button
                key={tab}
                type="button"
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${activeTab === tab ? 'bg-slate-900 text-white shadow-lg' : 'bg-transparent text-slate-700 hover:bg-slate-100'}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab === 'analytics' ? 'Analytics' : 'Staff Performance'}
              </button>
            ))}
          </div>

          {activeTab === 'analytics' ? (
            <section className="space-y-6">
              <div className="grid gap-4 lg:grid-cols-[minmax(220px,1fr)_minmax(220px,1fr)_minmax(220px,1fr)_minmax(220px,1fr)]">
                <div className="rounded-[24px] border border-slate-200/70 bg-white/80 p-5 shadow-[0_20px_50px_rgba(15,23,42,0.08)] backdrop-blur-xl">
                  <label className="mb-2 block text-sm font-semibold text-slate-600">From</label>
                  <input value={startDate} onChange={(event) => setStartDate(event.target.value)} type="date" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none" />
                </div>
                <div className="rounded-[24px] border border-slate-200/70 bg-white/80 p-5 shadow-[0_20px_50px_rgba(15,23,42,0.08)] backdrop-blur-xl">
                  <label className="mb-2 block text-sm font-semibold text-slate-600">To</label>
                  <input value={endDate} onChange={(event) => setEndDate(event.target.value)} type="date" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none" />
                </div>
                <div className="rounded-[24px] border border-slate-200/70 bg-white/80 p-5 shadow-[0_20px_50px_rgba(15,23,42,0.08)] backdrop-blur-xl">
                  <label className="mb-2 block text-sm font-semibold text-slate-600">Branch</label>
                  <select value={branch} onChange={(event) => setBranch(event.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none">
                    <option value="all">All</option>
                    <option value="ikeja">Ikeja</option>
                  </select>
                </div>
                <div className="flex flex-col gap-3 rounded-[24px] border border-slate-200/70 bg-white/80 p-5 shadow-[0_20px_50px_rgba(15,23,42,0.08)] backdrop-blur-xl">
                  <button type="button" onClick={() => setNotification('Filters applied.')} className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">Apply</button>
                  <button type="button" onClick={() => setNotification('CSV export prepared.')} className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-200">Export CSV</button>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <InfoCard title="Total Tickets" value={analytics.numTickets ?? '—'} description="Created in selected range" />
                <InfoCard title="Avg Response (s)" value={analytics.avgResponseSeconds ? Math.round(analytics.avgResponseSeconds) : '—'} description="Average first response time" />
                <InfoCard title="Resolution Time" value={analytics.avgResolutionSeconds ? Math.round(analytics.avgResolutionSeconds) : '—'} description="Average seconds to resolve" />
                <InfoCard title="Active Chats" value={analytics.activeChats ?? '—'} description="Currently live" />
                <InfoCard title="AI Feedback Avg" value={analytics.aiFeedbackAvg != null ? Number(analytics.aiFeedbackAvg).toFixed(2) : '—'} description="Average rating from staff/customers" />
                <InfoCard title="Feedback Count" value={analytics.aiFeedbackCount ?? '—'} description="Total feedback entries" />
              </div>

              <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
                <div className="rounded-[30px] border border-slate-200/70 bg-white/80 p-5 shadow-[0_20px_50px_rgba(15,23,42,0.08)] backdrop-blur-xl">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-semibold text-slate-900">Support Activity</h3>
                      <p className="mt-1 text-sm text-slate-500">Traffic and productivity at a glance</p>
                    </div>
                    <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">Realtime</span>
                  </div>
                  <div className="h-[360px] rounded-[24px] bg-slate-50 p-4">
                    <canvas ref={barRef} />
                  </div>
                </div>

                <div className="rounded-[30px] border border-slate-200/70 bg-slate-950 p-6 text-white shadow-[0_20px_50px_rgba(15,23,42,0.12)]">
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

              <div className="grid gap-6 xl:grid-cols-2">
                <div className="rounded-[30px] border border-slate-200/70 bg-white/80 p-5 shadow-[0_20px_50px_rgba(15,23,42,0.08)] backdrop-blur-xl">
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

              <div className="rounded-[28px] border border-slate-200/70 bg-white/80 p-6 shadow-[0_20px_50px_rgba(15,23,42,0.08)] backdrop-blur-xl">
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
                <aside className="rounded-[28px] border border-slate-200/70 bg-white/80 p-6 shadow-[0_20px_50px_rgba(15,23,42,0.08)] backdrop-blur-xl">
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

                <div className="rounded-[28px] border border-slate-200/70 bg-white/80 p-6 shadow-[0_20px_50px_rgba(15,23,42,0.08)] backdrop-blur-xl">
                  <div className="mb-4 flex flex-wrap items-center gap-3">
                    <input placeholder="Search staff by name" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none sm:w-auto" />
                    <select className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none">
                      <option value="name">Name</option>
                      <option value="avg_response_time">Avg response (asc)</option>
                      <option value="-avg_response_time">Avg response (desc)</option>
                      <option value="messages_handled">Handled</option>
                    </select>
                  </div>
                  <div className="grid gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
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
