function InfoCard({ title, value, description, className = '' }) {
  return (
    <div className={`rounded-[22px] border border-slate-200/80 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.07)] ${className}`}>
      <h4 className="text-xs tracking-[0.25em] text-slate-500 uppercase">{title}</h4>
      <p className="mt-3 text-3xl font-bold text-slate-900">{value}</p>
      {description ? <p className="mt-3 text-sm leading-6 text-slate-500">{description}</p> : null}
    </div>
  );
}

export default InfoCard;
