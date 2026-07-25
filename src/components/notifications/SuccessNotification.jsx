import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import NotificationShell from './NotificationShell';

export default function SuccessNotification({ title, description, timestamp, onClose, onAction }) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <NotificationShell
      accent="Live sync"
      title={title || 'Changes saved'}
      description={description || 'Your changes have been saved successfully.'}
      timestamp={timestamp || 'Just now'}
      onClose={onClose}
      onAction={onAction}
      panelClassName="border-emerald-400/20 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.16),_transparent_42%),linear-gradient(135deg,rgba(6,17,29,0.95),rgba(9,20,38,0.9),rgba(3,10,20,0.96))]"
      glowClassName="bg-emerald-500/25"
      iconClassName="border-emerald-400/25 bg-emerald-500/10"
      iconGlowClassName="bg-emerald-400/20"
      decoration={
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[28px]">
          <div className="absolute -left-8 top-7 h-16 w-40 rounded-full border border-emerald-400/15" />
          <div className="absolute right-6 top-5 h-24 w-24 rounded-full border border-emerald-400/10" />
          <div className="absolute bottom-4 left-12 h-2 w-24 rounded-full bg-gradient-to-r from-emerald-400/0 via-emerald-400/30 to-emerald-400/0 blur-xl" />
          <motion.div
            initial={prefersReducedMotion ? { opacity: 0.4, x: -6 } : { opacity: 0.4, x: -12 }}
            animate={prefersReducedMotion ? { opacity: 0.5, x: 0 } : { opacity: [0.35, 0.7, 0.35], x: [0, 18, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute bottom-5 left-10 h-[1px] w-32 bg-gradient-to-r from-emerald-400/0 via-emerald-300/70 to-emerald-400/0"
          />
          <div className="absolute right-10 top-10 h-1.5 w-1.5 rounded-full bg-emerald-300/80 shadow-[0_0_12px_rgba(110,231,183,0.8)]" />
          <div className="absolute right-16 bottom-8 h-1 w-1 rounded-full bg-emerald-200/60 shadow-[0_0_10px_rgba(167,243,208,0.7)]" />
        </div>
      }
      icon={
        <svg viewBox="0 0 24 24" className="relative h-7 w-7 text-emerald-300" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <motion.path
            d="M5 12.5l4.2 4.2L19 7"
            initial={prefersReducedMotion ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
            animate={prefersReducedMotion ? { pathLength: 1, opacity: 1 } : { pathLength: 1, opacity: 1 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
            style={{ filter: 'drop-shadow(0 0 7px rgba(52,211,153,0.55))' }}
          />
          <circle cx="12" cy="12" r="9" strokeOpacity="0.24" />
        </svg>
      }
    />
  );
}
