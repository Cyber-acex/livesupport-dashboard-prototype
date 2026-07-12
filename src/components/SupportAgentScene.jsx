import { motion } from 'framer-motion';

const floatingCards = [
  {
    id: 1,
    title: 'New customer message',
    subtitle: 'Hi, where is my order?',
    icon: '💬',
    position: 'left-6 top-8',
    colors: 'from-sky-500/95 to-cyan-400/95',
  },
  {
    id: 2,
    title: 'Incoming call',
    subtitle: 'Customer #1028',
    icon: '📞',
    position: 'right-6 top-20',
    colors: 'from-emerald-500/95 to-teal-400/95',
  },
  {
    id: 3,
    title: 'Order delivered',
    subtitle: '#3918 • Success',
    icon: '✅',
    position: 'bottom-28 left-10',
    colors: 'from-slate-400/80 to-slate-200/70',
  },
  {
    id: 4,
    title: 'Driver nearby',
    subtitle: '2.4 km away',
    icon: '📍',
    position: 'bottom-16 right-10',
    colors: 'from-cyan-500/90 to-sky-400/90',
  },
];

function SupportAgentScene({ status = 'idle' }) {
  const eyeBlink = {
    transformBox: 'fill-box',
    transformOrigin: 'center',
  };

  const headTilt = status === 'success'
    ? { rotate: [0, 3, -3, 0] }
    : { rotate: [0, 1.2, 0] };

  const rightHandMotion = status === 'success'
    ? { rotate: [0, -18, 18, -12, 0], y: [0, -4, -4, -2, 0] }
    : status === 'typing'
      ? { x: [0, -2, 0], y: [0, -1, 0] }
      : { x: [0, -1, 0], y: [0, 0, 0] };

  const mouthPath = status === 'success'
    ? 'M170 238c15 18 35 24 55 16 20-8 28-23 34-36'
    : 'M180 250c12 6 28 8 34 0';

  return (
    <div className="relative mx-auto flex aspect-[4/5] w-full max-w-[560px] items-center justify-center overflow-hidden rounded-[2rem] border border-white/70 bg-gradient-to-br from-sky-100 via-white to-cyan-50 p-4 shadow-[0_30px_120px_-30px_rgba(59,130,246,0.35)] sm:p-6 lg:p-8">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.22),_transparent_35%),radial-gradient(circle_at_bottom_right,_rgba(34,211,238,0.18),_transparent_35%)]" />
      <div className="absolute left-6 top-8 h-24 w-24 rounded-full bg-white/40 blur-3xl" />
      <div className="absolute right-6 bottom-12 h-28 w-28 rounded-full bg-cyan-100/70 blur-3xl" />
      <div className="absolute inset-x-10 top-24 h-24 rounded-full bg-white/60 blur-3xl" />

      {floatingCards.map((card, index) => (
        <motion.div
          key={card.id}
          initial={{ opacity: 0, y: 24, scale: 0.95 }}
          animate={{ opacity: [0, 1, 0.92], y: [0, -8, 0], scale: [1, 1.02, 1] }}
          transition={{ duration: 4.8 + index * 0.3, repeat: Infinity, ease: 'easeInOut', delay: index * 0.15 }}
          className={`absolute ${card.position} z-10 min-w-[170px] rounded-3xl border border-white/70 bg-white/90 p-4 shadow-2xl shadow-slate-200/50 backdrop-blur-xl`}
        >
          <div className="mb-3 flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-900/5 text-lg">{card.icon}</span>
            <div>
              <p className="text-sm font-semibold text-slate-900">{card.title}</p>
              <p className="text-xs text-slate-500">{card.subtitle}</p>
            </div>
          </div>
          <div className={`h-1.5 w-14 rounded-full bg-gradient-to-r ${card.colors}`} />
        </motion.div>
      ))}

      <motion.div
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: [0, -4, 0] }}
        transition={{ duration: 1.2, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-[460px]"
      >
        <svg viewBox="0 0 520 620" className="w-full" aria-label="Animated support representative illustration">
          <defs>
            <linearGradient id="deskGlow" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0%" stopColor="#dbeafe" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </linearGradient>
          </defs>

          <motion.g animate={{ y: [0, -4, 0] }} transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}>
            <rect x="32" y="408" width="452" height="120" rx="28" fill="#eff6ff" />
            <path d="M72 512h376" stroke="#c7d2fe" strokeWidth="4" strokeLinecap="round" />
          </motion.g>

          <g>
            <rect x="68" y="344" width="162" height="58" rx="18" fill="#ffffff" stroke="#dbeafe" strokeWidth="2" />
            <rect x="288" y="342" width="146" height="62" rx="18" fill="#ffffff" stroke="#dbeafe" strokeWidth="2" />
            <rect x="96" y="372" width="44" height="6" rx="3" fill="#bfdbfe" />
            <rect x="136" y="372" width="64" height="6" rx="3" fill="#bfdbfe" />
            <rect x="312" y="378" width="54" height="6" rx="3" fill="#bae6fd" />
            <rect x="312" y="390" width="86" height="6" rx="3" fill="#dbeafe" />
            <circle cx="353" cy="391" r="2.5" fill="#0f172a" />
          </g>

          <motion.g animate={headTilt} transition={{ duration: 5.2, repeat: Infinity, ease: 'easeInOut' }}>
            <path d="M250 192c-45-2-102 15-112 48-8 25 14 62 62 78 44 15 86 16 126 0 47-17 63-58 51-92-10-28-64-36-127-34z" fill="#fde2c9" />
            <path d="M182 172c8-28 32-48 62-49 30 0 55 20 63 49" fill="#1f2937" opacity="0.98" />
            <path d="M174 212c7-30 28-50 56-56 26-5 52 7 65 30" fill="#1f2937" opacity="0.18" />
            <motion.circle cx="190" cy="218" r="8" fill="#0f172a" style={eyeBlink} animate={{ scaleY: [1, 0.14, 1] }} transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut', times: [0, 0.08, 1] }} />
            <motion.circle cx="260" cy="218" r="8" fill="#0f172a" style={eyeBlink} animate={{ scaleY: [1, 0.14, 1] }} transition={{ duration: 4.6, repeat: Infinity, ease: 'easeInOut', times: [0, 0.08, 1], delay: 0.8 }} />
            <path d="M160 238c20-12 44-18 68-10" fill="none" stroke="#0f172a" strokeWidth="4" strokeLinecap="round" />
            <path d="M170 236c14 18 34 24 50 14" fill="none" stroke="#0f172a" strokeWidth="4" strokeLinecap="round" />
            <circle cx="204" cy="184" r="10" fill="#fde2c9" />
            <path d="M174 170c-4 14-4 28 4 40" stroke="#111827" strokeWidth="5" strokeLinecap="round" opacity="0.18" />
            <path d="M198 138c24-6 52-5 72 2" stroke="#1f2937" strokeWidth="18" strokeLinecap="round" />
            <path d="M194 132c34-14 72-10 98 8" stroke="#1f2937" strokeWidth="18" strokeLinecap="round" opacity="0.96" />
            <path d="M164 192c-8 18-6 38 0 54" stroke="#fde2c9" strokeWidth="14" strokeLinecap="round" opacity="0.15" />
            <path d="M244 192c10 18 8 34 0 46" stroke="#fde2c9" strokeWidth="14" strokeLinecap="round" opacity="0.15" />
            <path d="M172 152c-4-14 0-28 12-34 16-8 44-8 60 4 12 10 14 30 6 44" fill="none" stroke="#1f2937" strokeWidth="8" strokeLinecap="round" opacity="0.65" />
            <path d="M132 170c-14 4-20 18-18 34 4 24 20 42 36 54" fill="none" stroke="#1f2937" strokeWidth="10" strokeLinecap="round" opacity="0.15" />
            <path d="M120 180c0-18 14-36 34-44" stroke="#1f2937" strokeWidth="10" strokeLinecap="round" opacity="0.12" />
            <path d="M276 164c14 0 28 10 32 26" stroke="#1f2937" strokeWidth="10" strokeLinecap="round" opacity="0.12" />
            <rect x="226" y="154" width="26" height="12" rx="6" fill="#0f172a" opacity="0.7" />
            <path d="M212 200c-22 8-38 6-54-6" stroke="#dbeafe" strokeWidth="10" strokeLinecap="round" opacity="0.35" />
            <path d="M186 182c-5 15-2 32 8 44" stroke="#fde2c9" strokeWidth="14" strokeLinecap="round" opacity="0.13" />
            <path d="M166 166c6-24 24-40 46-44" stroke="#1f2937" strokeWidth="6" strokeLinecap="round" opacity="0.12" />
          </motion.g>

          <motion.g animate={{ y: [0, -3, 0] }} transition={{ duration: 6.2, repeat: Infinity, ease: 'easeInOut' }}>
            <rect x="184" y="252" width="152" height="110" rx="70" fill="#3b82f6" />
            <path d="M185 292c26 28 58 38 96 28 24-7 42-24 50-44" fill="#ffffff" opacity="0.08" />
            <path d="M222 286c12 20 34 26 54 18" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" opacity="0.75" />
          </motion.g>

          <motion.g animate={rightHandMotion} transition={{ duration: status === 'success' ? 0.9 : 1.1, repeat: status === 'success' ? 1 : Infinity, ease: 'easeInOut' }}>
            <rect x="250" y="270" width="60" height="40" rx="20" fill="#fff" />
            <path d="M262 288h32" stroke="#dbeafe" strokeWidth="3" strokeLinecap="round" />
            <path d="M262 304h24" stroke="#dbeafe" strokeWidth="3" strokeLinecap="round" opacity="0.7" />
          </motion.g>

          <g>
            <path d="M130 292c-14 14-24 32-24 52v48h64v-44" fill="#ffffff" stroke="#dbeafe" strokeWidth="2" />
            <path d="M314 296c14 10 24 24 24 40v46h66v-38" fill="#ffffff" stroke="#dbeafe" strokeWidth="2" />
          </g>

          <motion.g animate={{ x: [0, -4, 0] }} transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}>
            <rect x="156" y="364" width="94" height="36" rx="16" fill="#f8fafc" stroke="#dbeafe" strokeWidth="2" />
            <rect x="176" y="378" width="52" height="8" rx="4" fill="#bfdbfe" />
            <rect x="250" y="378" width="34" height="8" rx="4" fill="#93c5fd" />
          </motion.g>

          <motion.g animate={{ y: [0, -2, 0] }} transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut' }}>
            <rect x="300" y="344" width="120" height="60" rx="16" fill="#ffffff" stroke="#dbeafe" strokeWidth="2" />
            <rect x="306" y="354" width="108" height="40" rx="12" fill="#e0f2fe" />
            <rect x="320" y="372" width="72" height="6" rx="3" fill="#3b82f6" />
            <rect x="320" y="382" width="32" height="6" rx="3" fill="#93c5fd" />
          </motion.g>

          <motion.g animate={{ x: [0, 3, 0], y: [0, -1.5, 0] }} transition={{ duration: 3.8, repeat: Infinity, ease: 'easeInOut' }}>
            <path d="M118 306c16 8 28 6 42-6" stroke="#0f172a" strokeWidth="16" strokeLinecap="round" />
            <path d="M136 324c4 18 16 34 34 34" stroke="#0f172a" strokeWidth="16" strokeLinecap="round" />
          </motion.g>

          <motion.g animate={{ x: [0, -3, 0], y: [0, -1, 0] }} transition={{ duration: 3.8, repeat: Infinity, ease: 'easeInOut' }}>
            <path d="M366 304c-14 6-26 6-40-2" stroke="#0f172a" strokeWidth="16" strokeLinecap="round" />
            <path d="M346 328c-2 16-10 30-28 32" stroke="#0f172a" strokeWidth="16" strokeLinecap="round" />
          </motion.g>

          <g>
            <rect x="128" y="424" width="72" height="96" rx="24" fill="#dbeafe" opacity="0.85" />
            <circle cx="164" cy="456" r="8" fill="#ffffff" />
            <rect x="140" y="466" width="48" height="14" rx="7" fill="#93c5fd" />
          </g>

          <g>
            <rect x="402" y="418" width="58" height="92" rx="20" fill="#e0f2fe" opacity="0.9" />
            <rect x="412" y="438" width="36" height="10" rx="5" fill="#22d3ee" />
            <path d="M414 456c8 12 22 16 34 12" stroke="#38bdf8" strokeWidth="4" strokeLinecap="round" />
          </g>
        </svg>
      </motion.div>
    </div>
  );
}

export default SupportAgentScene;
