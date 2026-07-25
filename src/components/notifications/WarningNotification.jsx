import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import NotificationShell from './NotificationShell';

export default function WarningNotification({ title, description, timestamp, onClose, onAction }) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <NotificationShell
      accent="Needs attention"
      title={title || 'Action required'}
      description={description || 'You are about to delete a permanent resource.'}
      timestamp={timestamp || '1 min ago'}
      onClose={onClose}
      onAction={onAction}
      ctaLabel="Try Again"
      panelClassName="border-amber-400/20 bg-[radial-gradient(circle_at_top_left,_rgba(245,158,11,0.16),_transparent_42%),linear-gradient(135deg,rgba(6,17,29,0.95),rgba(9,20,38,0.9),rgba(3,10,20,0.96))]"
      glowClassName="bg-amber-500/20"
      iconClassName="border-amber-400/25 bg-amber-500/10"
      iconGlowClassName="bg-amber-400/20"
      decoration={
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[28px]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(251,191,36,0.16),transparent_24%),radial-gradient(circle_at_80%_80%,rgba(245,158,11,0.12),transparent_22%)]" />
          <div className="absolute left-8 top-6 h-24 w-24 rounded-full border border-amber-400/10" />
          <div className="absolute bottom-5 left-14 h-2 w-28 rounded-full bg-gradient-to-r from-amber-400/0 via-amber-300/30 to-amber-400/0 blur-xl" />
          <motion.div
            initial={prefersReducedMotion ? { opacity: 0.4, x: -6 } : { opacity: 0.4, x: -8 }}
            animate={prefersReducedMotion ? { opacity: 0.5, x: 0 } : { opacity: [0.35, 0.62, 0.35], x: [0, 12, 0] }}
            transition={{ duration: 5.8, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute bottom-6 left-10 h-[1px] w-28 bg-gradient-to-r from-amber-400/0 via-amber-300/70 to-amber-400/0"
          />
          <div className="absolute right-10 top-10 h-1.5 w-1.5 rounded-full bg-amber-300/80 shadow-[0_0_12px_rgba(250,204,21,0.8)]" />
          <div className="absolute right-16 bottom-8 h-1 w-1 rounded-full bg-amber-200/60 shadow-[0_0_10px_rgba(253,230,138,0.7)]" />
        </div>
      }
      icon={
        <svg viewBox="0 0 24 24" className="relative h-7 w-7 text-amber-300" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <motion.path
            d="M11 5.5l-6.5 12a1 1 0 0 0 .87 1.5h13a1 1 0 0 0 .87-1.5L13 5.5a1 1 0 0 0-1.74 0Z"
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0.8, scale: 0.95 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: [0.8, 1, 0.8], scale: [0.96, 1, 0.96] }}
            transition={{ duration: 2.7, repeat: Infinity, ease: 'easeInOut' }}
            style={{ filter: 'drop-shadow(0 0 7px rgba(251,191,36,0.45))' }}
          />
          <path d="M12 9.5v3.5" />
          <circle cx="12" cy="15.2" r="0.8" fill="currentColor" stroke="none" />
        </svg>
      }
    />
  );
}
