function StatCard({ icon, label, value, change, changeType = 'positive' }) {
  const changeClasses = changeType === 'negative' ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400';

  return (
    <div className="flex items-center gap-5 rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
      <div className={`flex h-16 w-16 items-center justify-center rounded-2xl ${changeType === 'negative' ? 'bg-sky-500/15 text-sky-400' : 'bg-emerald-500/15 text-emerald-400'}`}>
        <div className="h-8 w-8">{icon}</div>
      </div>
      <div className="flex-1">
        <div className="mb-2 text-sm font-medium text-white/65">{label}</div>
        <div className="flex items-center gap-3">
          <div className="text-3xl font-semibold text-white">{value}</div>
          {change !== null && change !== undefined ? (
            <div className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-semibold ${changeClasses}`}>
              {changeType === 'negative' ? <span>↓</span> : <span>↑</span>}
              <span>{change}%</span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default StatCard;
