export default function FeatureCard({ icon, title, subtitle }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-xl">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-orange-300">
          {icon}
        </div>
        <div>
          <p className="text-sm font-semibold text-white">{title}</p>
          <p className="mt-1 text-sm leading-6 text-slate-300">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}
