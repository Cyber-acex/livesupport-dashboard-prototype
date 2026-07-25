import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import NotificationShell from './NotificationShell';

export default function OrderCreatedNotification({ title, description, timestamp, onClose, onAction }) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <NotificationShell
      accent="Order ready"
      title={title || 'Order created'}
      description={description || 'Your order #ORD-7824 has been created successfully.'}
      timestamp={timestamp || '1h ago'}
      badgeLabel="Completed"
      badgeClassName="border-violet-400/20 bg-violet-400/10 text-violet-200"
      onClose={onClose}
      onAction={onAction}
      ctaLabel="View Order"
      panelClassName="border-violet-400/20 bg-[radial-gradient(circle_at_top_left,_rgba(139,92,246,0.16),_transparent_42%),linear-gradient(135deg,rgba(6,17,29,0.95),rgba(9,20,38,0.9),rgba(3,10,20,0.96))]"
      glowClassName="bg-violet-500/20"
      iconClassName="border-violet-400/25 bg-violet-500/10"
      iconGlowClassName="bg-violet-400/20"
      decoration={
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[28px]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(139,92,246,0.16),transparent_24%),radial-gradient(circle_at_80%_80%,rgba(167,139,250,0.14),transparent_22%)]" />
          <div className="absolute left-8 top-7 h-24 w-24 rounded-full border border-violet-400/10" />
          <div className="absolute bottom-5 left-12 h-2 w-28 rounded-full bg-gradient-to-r from-violet-400/0 via-violet-300/24 to-violet-400/0 blur-xl" />
          <motion.div
            initial={prefersReducedMotion ? { opacity: 0.4, x: -6 } : { opacity: 0.4, x: -6 }}
            animate={prefersReducedMotion ? { opacity: 0.55, x: 0 } : { opacity: [0.35, 0.62, 0.35], x: [0, 10, 0] }}
            transition={{ duration: 6.3, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute bottom-6 left-10 h-[1px] w-28 bg-gradient-to-r from-violet-400/0 via-violet-300/70 to-violet-400/0"
          />
          <div className="absolute right-10 top-10 h-1.5 w-1.5 rounded-full bg-violet-300/80 shadow-[0_0_12px_rgba(167,139,250,0.8)]" />
          <div className="absolute right-16 bottom-8 h-1 w-1 rounded-full bg-violet-200/60 shadow-[0_0_10px_rgba(233,213,255,0.7)]" />
        </div>
      }
      icon={
        <svg viewBox="0 0 24 24" className="relative h-7 w-7 text-violet-300" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <motion.path
            d="M7 6h10a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z"
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0.9, scale: 0.96 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: [0.9, 1, 0.9], scale: [0.96, 1, 0.96] }}
            transition={{ duration: 2.7, repeat: Infinity, ease: 'easeInOut' }}
            style={{ filter: 'drop-shadow(0 0 7px rgba(139,92,246,0.45))' }}
          />
          <path d="M8 11h8" />
          <path d="M8 14h5" />
          <path d="M9 6V4" />
          <path d="M15 6V4" />
        </svg>
      }
    />
  );
}
