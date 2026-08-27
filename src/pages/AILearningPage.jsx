import { useEffect, useRef, useState } from 'react';
import ApexCharts from 'apexcharts';
import { BrainCircuit, Check, X } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import TopBar from '../components/TopBar';

const chartOptions = { toolbar: { show: false }, animations: { enabled: true, easing: 'easeinout', speed: 450 } };

function AILearningPage() {
  const [days, setDays] = useState(7);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const progressRef = useRef(null);
  const activityRef = useRef(null);

  useEffect(() => {
    let active = true;
    setData(null);
    setError('');
    fetch(`/api/ai-learning?days=${days}`, { credentials: 'same-origin' })
      .then((response) => { if (!response.ok) throw new Error('Unable to load learning data'); return response.json(); })
      .then((payload) => { if (active) setData(payload); })
      .catch((loadError) => { if (active) setError(loadError.message); });
    return () => { active = false; };
  }, [days]);

  useEffect(() => {
    if (!data) return undefined;
    const progress = data.history || [];
    const activity = data.activityHistory || [];
    const charts = [];
    if (progressRef.current) charts.push(new ApexCharts(progressRef.current, { chart: { ...chartOptions, type: 'line', height: 290 }, series: [{ name: 'Accuracy', data: progress.map((item) => item.accuracy == null ? null : Math.round(item.accuracy * 100)) }], xaxis: { categories: progress.map((item) => String(item.date).slice(0, 10)) }, yaxis: { min: 0, max: 100, labels: { formatter: (value) => `${value}%` } }, colors: ['#0f766e'], stroke: { curve: 'smooth', width: 3 }, dataLabels: { enabled: false }, noData: { text: 'Not enough data yet' } }));
    if (activityRef.current) charts.push(new ApexCharts(activityRef.current, { chart: { ...chartOptions, type: 'area', height: 290 }, series: [{ name: 'Corrections', data: activity.map((item) => item.corrections) }, { name: 'Candidates', data: activity.map((item) => item.candidates) }, { name: 'Approved', data: activity.map((item) => item.approved) }, { name: 'Successful', data: activity.map((item) => item.successful) }], xaxis: { categories: activity.map((item) => String(item.date).slice(0, 10)) }, colors: ['#e11d48', '#f59e0b', '#0f766e', '#0284c7'], stroke: { curve: 'smooth', width: 2 }, dataLabels: { enabled: false }, noData: { text: 'Not enough data yet' } }));
    charts.forEach((chart) => chart.render());
    return () => charts.forEach((chart) => chart.destroy());
  }, [data]);

  async function review(id, status) {
    const response = await fetch(`/api/ai-learning/candidates/${id}/review`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ status }) });
    if (!response.ok) { setError('Unable to update learning candidate'); return; }
    const refreshed = await fetch(`/api/ai-learning?days=${days}`, { credentials: 'same-origin' });
    setData(await refreshed.json());
  }

  const metric = data?.metrics || {};
  const cards = [['Accuracy', metric.accuracy == null ? 'Not enough data yet' : `${Math.round(metric.accuracy * 100)}%`], ['Resolution', metric.resolutionRate == null ? 'Not enough data yet' : `${Math.round(metric.resolutionRate * 100)}%`], ['Correction rate', metric.correctionRate == null ? 'Not enough data yet' : `${Math.round(metric.correctionRate * 100)}%`], ['Knowledge items', Number(metric.rules || 0) + Number(metric.examples || 0)]];
  return <div className="flex h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(20,184,166,0.15),_transparent_32%),linear-gradient(135deg,_#f8fafc,_#ecfeff)] text-slate-900 dark:bg-slate-950 dark:text-white"><Sidebar /><div className="flex min-w-0 flex-1 flex-col overflow-hidden"><TopBar /><main className="flex-1 overflow-y-auto p-4 sm:p-7 lg:p-10"><header className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-teal-700"><BrainCircuit size={16} /> Intelligence loop</p><h1 className="mt-2 text-3xl font-bold tracking-tight">AI Learning</h1><p className="mt-2 max-w-2xl text-sm text-slate-500 dark:text-slate-400">Monitor how LiveSupport's AI improves through feedback, outcomes, and approved knowledge.</p></div><select value={days} onChange={(event) => setDays(Number(event.target.value))} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-900"><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option></select></header>{error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-700">{error}</div> : !data ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">Loading learning data...</div> : <><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(([label, value]) => <div key={label} className="rounded-2xl border border-slate-200/80 bg-white/85 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/80"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p><p className="mt-3 text-2xl font-bold">{value}</p></div>)}</div><div className="mt-6 grid gap-6 xl:grid-cols-2"><section className="rounded-3xl border border-slate-200/80 bg-white/85 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/80"><h2 className="text-lg font-semibold">AI Learning Progress</h2><p className="mt-1 text-sm text-slate-500">Accuracy by Nigeria-local day.</p><div ref={progressRef} className="mt-4 min-h-[290px]" /></section><section className="rounded-3xl border border-slate-200/80 bg-white/85 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/80"><h2 className="text-lg font-semibold">Learning Activity</h2><p className="mt-1 text-sm text-slate-500">Corrections, candidates, approvals, and successes.</p><div ref={activityRef} className="mt-4 min-h-[290px]" /></section></div><section className="mt-6 rounded-3xl border border-slate-200/80 bg-white/85 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/80"><h2 className="text-lg font-semibold">Learning candidates</h2>{data.candidates.filter((item) => item.status === 'PENDING').length === 0 ? <p className="mt-4 rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">Your AI hasn't accumulated enough learning data yet.</p> : <div className="mt-4 space-y-3">{data.candidates.filter((item) => item.status === 'PENDING').map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 p-4 dark:border-slate-700"><div><h3 className="font-semibold">{item.title}</h3><p className="mt-1 text-sm text-slate-500">{item.description}</p><p className="mt-2 text-xs text-teal-700">Evidence {item.evidence_count} · Confidence {Math.round((item.confidence || 0) * 100)}%</p></div><div className="flex gap-2"><button onClick={() => review(item.id, 'APPROVED')} className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white"><Check size={15} /> Approve</button><button onClick={() => review(item.id, 'REJECTED')} className="inline-flex items-center gap-1 rounded-xl border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700"><X size={15} /> Reject</button></div></div>)}</div>}</section></>}</main></div></div>;
}

export default AILearningPage;
