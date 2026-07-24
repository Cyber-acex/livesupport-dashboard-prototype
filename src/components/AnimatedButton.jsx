export default function AnimatedButton({ children, className = '', variant = 'primary', ...props }) {
  const variantClasses = {
    primary: 'bg-gradient-to-r from-orange-500 via-amber-500 to-rose-500 text-white shadow-lg shadow-orange-500/20 hover:-translate-y-0.5 hover:shadow-orange-500/40',
    secondary: 'border border-slate-200 bg-white/90 text-slate-700 hover:border-sky-200 hover:bg-sky-50/60'
  };

  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-sm font-semibold transition duration-200 ${variantClasses[variant] || variantClasses.primary} ${className}`.trim()}
    >
      {children}
    </button>
  );
}
