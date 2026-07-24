import BackgroundBlobs from './BackgroundBlobs';
import FeatureCard from './FeatureCard';

export default function HeroSection({ imageSrc, headline, subheadline, features }) {
  return (
    <div className="relative hidden flex-1 overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/70 shadow-[0_40px_120px_-40px_rgba(15,23,42,0.75)] lg:flex">
      <img src={imageSrc} alt="Restaurant support team dashboard" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950/80 via-slate-900/70 to-slate-950/90" />
      <BackgroundBlobs />

      <div className="relative z-10 flex w-full flex-col justify-between p-8 lg:p-10">
        <div className="space-y-5">
          <div className="inline-flex items-center rounded-full border border-orange-400/30 bg-orange-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.36em] text-orange-100">
            LiveSupport AI Desk
          </div>
          <div className="max-w-xl space-y-3">
            <h2 className="text-4xl font-semibold leading-tight tracking-tight text-white">
              {headline}
            </h2>
            <p className="text-lg leading-8 text-slate-300">{subheadline}</p>
          </div>
        </div>

        <div className="mt-8 grid gap-3 md:grid-cols-2">
          {features.map((feature) => (
            <FeatureCard key={feature.title} icon={feature.icon} title={feature.title} subtitle={feature.subtitle} />
          ))}
        </div>
      </div>
    </div>
  );
}
