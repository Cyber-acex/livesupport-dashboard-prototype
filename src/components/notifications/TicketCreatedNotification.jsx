import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import NotificationShell from './NotificationShell';

export default function TicketCreatedNotification({ title, description, timestamp, onClose, onAction }) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <NotificationShell
      accent="Queue updated"
      title={title || 'Tickets created'}
      description={description || '3 new tickets have been created successfully.'}
      timestamp={timestamp || '2m ago'}
      badgeLabel="Success"
      badgeClassName="border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
      onClose={onClose}
      onAction={onAction}
      panelClassName="border-emerald-400/20 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.16),_transparent_42%),linear-gradient(135deg,rgba(6,17,29,0.95),rgba(9,20,38,0.9),rgba(3,10,20,0.96))]"
      glowClassName="bg-emerald-500/20"
      iconClassName="border-emerald-400/25 bg-emerald-500/10"
      iconGlowClassName="bg-emerald-400/20"
      decoration={
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[28px]">
          <div className="absolute right-8 top-6 h-24 w-24 rounded-full border border-emerald-400/10" />
          <div className="absolute bottom-5 left-12 h-2 w-28 rounded-full bg-gradient-to-r from-emerald-400/0 via-emerald-300/25 to-emerald-400/0 blur-xl" />
          <motion.div
            initial={prefersReducedMotion ? { opacity: 0.4, x: -6 } : { opacity: 0.4, x: -6 }}
            animate={prefersReducedMotion ? { opacity: 0.55, x: 0 } : { opacity: [0.35, 0.65, 0.35], x: [0, 10, 0] }}
            transition={{ duration: 6.2, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute bottom-6 left-10 h-[1px] w-28 bg-gradient-to-r from-emerald-400/0 via-emerald-300/70 to-emerald-400/0"
          />
          <div className="absolute right-14 top-12 h-1.5 w-1.5 rounded-full bg-emerald-300/80 shadow-[0_0_12px_rgba(110,231,183,0.8)]" />
          <div className="absolute left-20 top-8 h-1 w-1 rounded-full bg-emerald-200/60 shadow-[0_0_10px_rgba(167,243,208,0.7)]" />
        </div>
      }
      icon={
        <svg viewBox="0 0 24 24" className="relative h-7 w-7 text-emerald-300" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <motion.path
            d="M6 4.5h12a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H8l-3 3V5.5a1 1 0 0 1 1-1Z"
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0.9, scale: 0.96 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: [0.9, 1, 0.9], scale: [0.96, 1, 0.96] }}
            transition={{ duration: 2.7, repeat: Infinity, ease: 'easeInOut' }}
            style={{ filter: 'drop-shadow(0 0 7px rgba(52,211,153,0.45))' }}
          />
          <path d="M9 8.5h6" />
          <path d="M9 11.5h4" />
          <path d="M8 16.5l-2 2" />
        </svg>
      }
    />
  );
}
