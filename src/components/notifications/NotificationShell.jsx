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
      className={`relative isolate h-[50px] overflow-hidden rounded-[28px] border border-white/10 bg-slate-950/70 p-2 shadow-[0_28px_90px_rgba(2,6,23,0.72)] backdrop-blur-2xl ${panelClassName}`}
      role="status"
      aria-live="polite"
    >
      <div className="pointer-events-none absolute inset-0 rounded-[28px] bg-gradient-to-br from-white/10 via-transparent to-transparent" />
      <div className={`pointer-events-none absolute inset-0 rounded-[28px] opacity-80 blur-3xl ${glowClassName}`} />
      <div className="pointer-events-none absolute -left-10 top-8 h-24 w-24 rounded-full bg-white/5 blur-3xl" />
      <div className="pointer-events-none absolute bottom-4 right-8 h-24 w-24 rounded-full bg-white/5 blur-3xl" />
      <div className="relative flex h-full items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <motion.div
            initial={prefersReducedMotion ? undefined : { scale: 0.96, rotate: -4 }}
            animate={prefersReducedMotion ? undefined : { scale: [1, 1.03, 1], rotate: [-2, 2, -2] }}
            transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut' }}
            className={`relative flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-slate-900/70 backdrop-blur-xl ${iconClassName}`}
          >
            <div className={`absolute inset-1 rounded-[18px] blur-[1px] ${iconGlowClassName}`} />
            <div className="relative z-10 flex h-full w-full items-center justify-center">{icon}</div>
          </motion.div>

          <div className="min-w-0 flex-1 overflow-hidden">
            <div className="flex items-center gap-1">
              <h3 className="truncate text-xs font-semibold leading-4 text-white">
                {title}
              </h3>
              {badgeLabel ? (
                <span className={`inline-flex items-center rounded-full border border-white/10 px-2.5 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.2em] ${badgeClassName}`}>
                  {badgeLabel}
                </span>
              ) : null}
            </div>
            <p className="truncate text-[10px] leading-3 text-slate-300">{description}</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {ctaLabel ? (
            <motion.button
              whileHover={prefersReducedMotion ? undefined : { y: -2, scale: 1.02, boxShadow: '0 20px 40px rgba(56, 189, 248, 0.24)' }}
              whileTap={{ scale: 0.97 }}
              type="button"
              onClick={onAction}
              className="sr-only"
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
            className="flex h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-slate-900/70 text-slate-200"
          >
            <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
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
