import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

export default function NotificationShell({
  accent,
  icon,
  title,
  description,
  timestamp,
  badgeLabel,
  badgeClassName,
  ctaLabel,
  onAction,
  onClose,
  glowClassName,
  panelClassName,
  decoration,
  iconClassName,
  iconGlowClassName,
}) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      initial={prefersReducedMotion ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: -24, scale: 0.96 }}
      animate={prefersReducedMotion ? { opacity: 1, y: 0, scale: 1 } : { opacity: 1, y: 0, scale: 1 }}
      exit={prefersReducedMotion ? { opacity: 0, y: -12, scale: 0.97 } : { opacity: 0, y: -18, scale: 0.97 }}
      whileHover={prefersReducedMotion ? undefined : { y: -4, scale: 1.01, boxShadow: '0 30px 90px rgba(2, 6, 23, 0.68)' }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className={`relative isolate overflow-hidden rounded-[28px] border border-white/10 bg-slate-950/70 p-4 shadow-[0_28px_90px_rgba(2,6,23,0.72)] backdrop-blur-2xl sm:p-5 ${panelClassName}`}
      role="status"
      aria-live="polite"
    >
      <div className="pointer-events-none absolute inset-0 rounded-[28px] bg-gradient-to-br from-white/10 via-transparent to-transparent" />
      <div className={`pointer-events-none absolute inset-0 rounded-[28px] opacity-80 blur-3xl ${glowClassName}`} />
      <div className="pointer-events-none absolute -left-10 top-8 h-24 w-24 rounded-full bg-white/5 blur-3xl" />
      <div className="pointer-events-none absolute bottom-4 right-8 h-24 w-24 rounded-full bg-white/5 blur-3xl" />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <motion.div
            initial={prefersReducedMotion ? undefined : { scale: 0.96, rotate: -4 }}
            animate={prefersReducedMotion ? undefined : { scale: [1, 1.03, 1], rotate: [-2, 2, -2] }}
            transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut' }}
            className={`relative flex h-16 w-16 shrink-0 items-center justify-center rounded-[22px] border border-white/15 bg-slate-900/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_20px_45px_rgba(15,23,42,0.45)] backdrop-blur-xl ${iconClassName}`}
          >
            <div className={`absolute inset-1 rounded-[18px] blur-[1px] ${iconGlowClassName}`} />
            <div className="relative z-10 flex h-full w-full items-center justify-center">{icon}</div>
          </motion.div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-[1.05rem] font-semibold tracking-[-0.02em] text-white sm:text-[1.2rem]">
                {title}
              </h3>
              {badgeLabel ? (
                <span className={`inline-flex items-center rounded-full border border-white/10 px-2.5 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.2em] ${badgeClassName}`}>
                  {badgeLabel}
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-sm leading-6 text-slate-300 sm:text-[0.95rem]">
              {description}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-[0.7rem] uppercase tracking-[0.22em] text-slate-500">
              <span>{timestamp}</span>
              {accent ? <span className="text-slate-400">{accent}</span> : null}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {ctaLabel ? (
            <motion.button
              whileHover={prefersReducedMotion ? undefined : { y: -2, scale: 1.02, boxShadow: '0 20px 40px rgba(56, 189, 248, 0.24)' }}
              whileTap={{ scale: 0.97 }}
              type="button"
              onClick={onAction}
              className="rounded-2xl border border-cyan-400/25 bg-gradient-to-r from-cyan-400/20 via-slate-900/80 to-cyan-500/10 px-3.5 py-2 text-sm font-semibold text-cyan-100 shadow-[0_14px_35px_rgba(34,211,238,0.16)] transition-all duration-200 hover:border-cyan-300/40 hover:text-white"
            >
              {ctaLabel}
            </motion.button>
          ) : null}
          <motion.button
            whileHover={prefersReducedMotion ? undefined : { rotate: 90, scale: 1.06, boxShadow: '0 18px 40px rgba(15, 23, 42, 0.4)' }}
            whileTap={{ scale: 0.95 }}
            type="button"
            aria-label="Dismiss notification"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-slate-900/70 text-slate-200 shadow-[0_16px_40px_rgba(2,6,23,0.4)] transition-colors hover:border-white/20 hover:text-white"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M6 6l12 12" />
              <path d="M18 6L6 18" />
            </svg>
          </motion.button>
        </div>
      </div>

      {decoration}
    </motion.div>
  );
}
