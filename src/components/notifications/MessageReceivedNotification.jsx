import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import NotificationShell from './NotificationShell';

export default function MessageReceivedNotification({ title, description, timestamp, onClose, onAction }) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <NotificationShell
      accent="New message"
      title={title || 'Message received'}
      description={description || 'You have a new message from Jane Cooper.'}
      timestamp={timestamp || '5m ago'}
      badgeLabel="New"
      badgeClassName="border-cyan-400/20 bg-cyan-400/10 text-cyan-200"
      onClose={onClose}
      onAction={onAction}
      ctaLabel="View Message"
      panelClassName="border-cyan-400/20 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.16),_transparent_42%),linear-gradient(135deg,rgba(6,17,29,0.95),rgba(9,20,38,0.9),rgba(3,10,20,0.96))]"
      glowClassName="bg-cyan-500/20"
      iconClassName="border-cyan-400/25 bg-cyan-500/10"
      iconGlowClassName="bg-cyan-400/20"
      decoration={
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[28px]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(34,211,238,0.16),transparent_24%),radial-gradient(circle_at_80%_80%,rgba(56,189,248,0.12),transparent_22%)]" />
          <div className="absolute left-8 top-7 h-24 w-24 rounded-full border border-cyan-400/10" />
          <div className="absolute bottom-5 left-12 h-2 w-28 rounded-full bg-gradient-to-r from-cyan-400/0 via-cyan-300/24 to-cyan-400/0 blur-xl" />
          <motion.div
            initial={prefersReducedMotion ? { opacity: 0.4, x: -6 } : { opacity: 0.4, x: -4 }}
            animate={prefersReducedMotion ? { opacity: 0.55, x: 0 } : { opacity: [0.35, 0.65, 0.35], x: [0, 8, 0] }}
            transition={{ duration: 5.4, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute bottom-6 left-10 h-[1px] w-28 bg-gradient-to-r from-cyan-400/0 via-cyan-300/70 to-cyan-400/0"
          />
          <div className="absolute right-10 top-10 h-1.5 w-1.5 rounded-full bg-cyan-300/80 shadow-[0_0_12px_rgba(103,232,249,0.8)]" />
          <div className="absolute right-16 bottom-8 h-1 w-1 rounded-full bg-cyan-200/60 shadow-[0_0_10px_rgba(186,230,253,0.7)]" />
        </div>
      }
      icon={
        <svg viewBox="0 0 24 24" className="relative h-7 w-7 text-cyan-300" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <motion.path
            d="M6 7h12a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H9l-3 3V9a2 2 0 0 1 2-2Z"
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0.9, scale: 0.96 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: [0.9, 1, 0.9], scale: [0.96, 1, 0.96] }}
            transition={{ duration: 2.7, repeat: Infinity, ease: 'easeInOut' }}
            style={{ filter: 'drop-shadow(0 0 7px rgba(34,211,238,0.45))' }}
          />
          <path d="M8 10.5h8" />
          <path d="M8 13h5" />
          <circle cx="17.5" cy="8.5" r="1.5" fill="currentColor" stroke="none" />
        </svg>
      }
    />
  );
}
