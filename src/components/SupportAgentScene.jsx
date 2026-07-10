import { motion } from 'framer-motion';

const floatingCards = [
  {
    id: 1,
    title: 'Incoming message',
    subtitle: 'Customer asked about an order update',
    accent: 'from-sky-500/90 to-cyan-400/90',
    className: 'left-4 top-8 md:left-6 md:top-10',
  },
  {
    id: 2,
    title: 'Voice call',
    subtitle: '2 min • Priority support',
    accent: 'from-emerald-500/90 to-teal-400/90',
    className: 'right-4 top-20 md:right-8 md:top-24',
  },
  {
    id: 3,
    title: 'Order ready',
    subtitle: 'Kitchen confirmed pickup',
    accent: 'from-orange-500/90 to-amber-300/90',
    className: 'bottom-24 left-8 md:bottom-28 md:left-10',
  },
  {
    id: 4,
    title: 'Track delivery',
    subtitle: 'Live GPS synced',
    accent: 'from-violet-500/90 to-fuchsia-400/90',
    className: 'bottom-16 right-8 md:bottom-20 md:right-12',
  },
];

function SupportAgentScene() {
  return (
    <div className="relative mx-auto flex aspect-[4/5] w-full max-w-[560px] items-center justify-center overflow-hidden rounded-[2rem] border border-white/70 bg-gradient-to-br from-sky-100 via-white to-cyan-50 p-4 shadow-[0_30px_120px_-30px_rgba(59,130,246,0.35)] sm:p-6 lg:p-8">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.18),_transparent_35%),radial-gradient(circle_at_bottom_right,_rgba(34,211,238,0.22),_transparent_30%)]" />
      <div className="absolute inset-x-6 top-6 h-24 rounded-full bg-white/70 blur-3xl" />

      {floatingCards.map((card, index) => (
        <motion.div
          key={card.id}
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: [0.75, 1, 0.75], y: [0, -10, 0] }}
          transition={{ duration: 4.2 + index * 0.7, repeat: Infinity, ease: 'easeInOut' }}
          className={`absolute ${card.className} min-w-[170px] max-w-[210px] rounded-2xl border border-white/70 bg-white/70 p-3 shadow-lg backdrop-blur-xl`}
        >
          <div className={`mb-2 h-2.5 w-16 rounded-full bg-gradient-to-r ${card.accent}`} />
          <p className="text-sm font-semibold text-slate-800">{card.title}</p>
          <p className="mt-1 text-xs text-slate-600">{card.subtitle}</p>
        </motion.div>
      ))}

      <motion.div
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: [0, -6, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        className="relative z-10 w-full max-w-[430px]"
      >
        <svg viewBox="0 0 420 520" className="w-full" aria-label="Animated support representative illustration">
          <rect x="44" y="352" width="332" height="128" rx="24" fill="#f8fbff" stroke="#dbeafe" strokeWidth="2" />
          <rect x="72" y="384" width="120" height="74" rx="18" fill="#fff" stroke="#dbeafe" strokeWidth="2" />
          <rect x="228" y="384" width="120" height="74" rx="18" fill="#fff" stroke="#dbeafe" strokeWidth="2" />
          <rect x="100" y="396" width="64" height="8" rx="4" fill="#bae6fd" />
          <rect x="256" y="396" width="64" height="8" rx="4" fill="#bae6fd" />

          <motion.g animate={{ y: [0, -3, 0], rotate: [0, -0.8, 0] }} transition={{ duration: 4.3, repeat: Infinity, ease: 'easeInOut' }}>
            <rect x="118" y="250" width="184" height="92" rx="32" fill="#ffffff" stroke="#dbeafe" strokeWidth="2" />
            <rect x="140" y="270" width="140" height="48" rx="24" fill="#3b82f6" />
            <rect x="154" y="284" width="34" height="10" rx="5" fill="#eff6ff" />
            <rect x="194" y="284" width="58" height="10" rx="5" fill="#eff6ff" />
          </motion.g>

          <motion.g animate={{ y: [0, -2, 0], rotate: [0, 0.7, 0] }} transition={{ duration: 3.8, repeat: Infinity, ease: 'easeInOut' }}>
            <ellipse cx="210" cy="222" rx="72" ry="78" fill="#fde2c9" />
            <path d="M159 214c8-42 37-64 77-64 25 0 44 10 57 27-12 9-24 13-35 14-20 2-32 14-39 31-7 18-12 31-22 37-12-15-26-26-38-45z" fill="#1f2937" opacity="0.92" />
            <rect x="166" y="150" width="90" height="40" rx="20" fill="#1f2937" />
            <rect x="184" y="138" width="56" height="20" rx="10" fill="#0f172a" />
            <rect x="174" y="182" width="76" height="30" rx="12" fill="#f8fafc" />
            <circle cx="188" cy="220" r="6" fill="#111827" />
            <circle cx="234" cy="220" r="6" fill="#111827" />
            <path d="M188 244c10 8 22 8 34 0" stroke="#c2410c" strokeWidth="4" strokeLinecap="round" />
            <path d="M176 206c10 10 22 14 36 14 14 0 26-4 38-14" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" opacity="0.72" />
            <rect x="161" y="216" width="32" height="16" rx="8" fill="#fce6d1" opacity="0.7" />
            <rect x="224" y="216" width="32" height="16" rx="8" fill="#fce6d1" opacity="0.7" />
          </motion.g>

          <motion.g animate={{ y: [0, -1.5, 0] }} transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}>
            <path d="M155 258c18-24 38-36 76-36 35 0 59 18 78 42" fill="none" stroke="#3b82f6" strokeWidth="10" strokeLinecap="round" />
            <path d="M148 254c-8 24-14 40-14 63 0 10 10 18 21 18h31" fill="#e0f2fe" />
            <path d="M274 254c8 24 14 40 14 63 0 10-10 18-21 18h-31" fill="#e0f2fe" />
            <path d="M160 318h112c12 0 22 10 22 22v23H138v-23c0-12 10-22 22-22z" fill="#ffffff" stroke="#dbeafe" strokeWidth="2" />
            <rect x="166" y="322" width="100" height="22" rx="11" fill="#eff6ff" />
          </motion.g>

          <motion.g animate={{ x: [0, 2, 0], y: [0, -1.5, 0] }} transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut' }}>
            <rect x="122" y="302" width="56" height="24" rx="10" fill="#0f172a" />
            <rect x="180" y="302" width="60" height="24" rx="10" fill="#0f172a" />
            <rect x="240" y="302" width="56" height="24" rx="10" fill="#0f172a" />
            <rect x="122" y="330" width="56" height="14" rx="7" fill="#3b82f6" />
            <rect x="180" y="330" width="60" height="14" rx="7" fill="#3b82f6" />
            <rect x="240" y="330" width="56" height="14" rx="7" fill="#3b82f6" />
          </motion.g>

          <motion.g animate={{ y: [0, -2, 0] }} transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut' }}>
            <rect x="86" y="332" width="60" height="18" rx="9" fill="#f8fafc" stroke="#dbeafe" strokeWidth="2" />
            <rect x="96" y="338" width="26" height="4" rx="2" fill="#3b82f6" />
            <rect x="126" y="338" width="12" height="4" rx="2" fill="#67e8f9" />
          </motion.g>

          <motion.g animate={{ rotate: [0, -2, 0], y: [0, -3, 0] }} transition={{ duration: 5.2, repeat: Infinity, ease: 'easeInOut' }}>
            <rect x="278" y="274" width="82" height="56" rx="18" fill="#ffffff" stroke="#dbeafe" strokeWidth="2" />
            <rect x="290" y="286" width="58" height="32" rx="8" fill="#0f172a" />
            <circle cx="304" cy="302" r="4" fill="#f8fafc" />
            <circle cx="318" cy="302" r="4" fill="#f8fafc" />
            <circle cx="332" cy="302" r="4" fill="#f8fafc" />
          </motion.g>

          <motion.g animate={{ y: [0, -2, 0], rotate: [0, 1, 0] }} transition={{ duration: 3.6, repeat: Infinity, ease: 'easeInOut' }}>
            <rect x="94" y="190" width="64" height="88" rx="20" fill="#ffffff" stroke="#dbeafe" strokeWidth="2" />
            <rect x="108" y="204" width="36" height="14" rx="7" fill="#3b82f6" />
            <rect x="108" y="224" width="22" height="10" rx="5" fill="#67e8f9" />
            <circle cx="126" cy="252" r="10" fill="#f9d423" />
            <path d="M122 258c6 6 13 9 21 9" stroke="#f59e0b" strokeWidth="4" strokeLinecap="round" />
          </motion.g>

          <motion.g animate={{ y: [0, -4, 0] }} transition={{ duration: 4.8, repeat: Infinity, ease: 'easeInOut' }}>
            <rect x="292" y="172" width="32" height="70" rx="16" fill="#ffffff" stroke="#dbeafe" strokeWidth="2" />
            <path d="M300 182h16" stroke="#3b82f6" strokeWidth="4" strokeLinecap="round" />
            <path d="M300 196h12" stroke="#67e8f9" strokeWidth="4" strokeLinecap="round" />
            <path d="M300 210h8" stroke="#93c5fd" strokeWidth="4" strokeLinecap="round" />
          </motion.g>
        </svg>
      </motion.div>

      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.65, ease: 'easeOut' }}
        className="absolute bottom-8 left-1/2 h-4 w-56 -translate-x-1/2 rounded-full bg-white/80 blur-3xl"
      />
    </div>
  );
}

export default SupportAgentScene;
