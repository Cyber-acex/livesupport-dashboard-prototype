export default function BackgroundBlobs() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -left-10 top-10 h-48 w-48 rounded-full bg-orange-500/20 blur-3xl" />
      <div className="absolute right-0 top-0 h-64 w-64 rounded-full bg-cyan-400/20 blur-3xl" />
      <div className="absolute bottom-0 left-1/3 h-56 w-56 rounded-full bg-indigo-500/20 blur-3xl" />
    </div>
  );
}
