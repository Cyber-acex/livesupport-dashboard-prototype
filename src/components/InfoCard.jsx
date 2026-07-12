function InfoCard({ title, value, description, className = '' }) {
  const isLiveMetric = typeof value === 'number' || (typeof value === 'string' && value !== '—');

  return (
    <div className={`group relative overflow-hidden rounded-[24px] border border-slate-200/70 bg-white/80 p-5 shadow-[0_20px_50px_rgba(15,23,42,0.08)] backdrop-blur-xl ${className}`}>
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-500 via-cyan-400 to-indigo-600" />
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">{title}</h4>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{value}</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${isLiveMetric ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-600'}`}>
          {isLiveMetric ? 'Live' : 'Pending'}
        </span>
      </div>
      {description ? <p className="mt-3 text-sm leading-6 text-slate-500">{description}</p> : null}
    </div>
  );
}

export default InfoCard;
