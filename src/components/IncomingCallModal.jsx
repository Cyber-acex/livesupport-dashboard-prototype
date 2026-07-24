import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const IncomingCallModal = ({ open, caller, onAccept, onDecline }) => {
  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/70 px-4 backdrop-blur"
      >
        <motion.div
          initial={{ y: 24, scale: 0.96, opacity: 0 }}
          animate={{ y: 0, scale: 1, opacity: 1 }}
          exit={{ y: 12, scale: 0.98, opacity: 0 }}
          className="w-full max-w-md overflow-hidden rounded-[28px] border border-white/10 bg-slate-900/95 shadow-2xl"
        >
          <div className="bg-gradient-to-r from-brand-600 via-cyan-500 to-sky-500 px-6 py-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.32em] text-white/70">Incoming voice call</p>
                <h3 className="mt-2 text-2xl font-semibold">{caller?.name || 'Unknown caller'}</h3>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/25 bg-white/10 text-2xl">📞</div>
            </div>
            <div className="mt-4 flex items-center justify-center gap-2">
              <span className="inline-flex h-3 w-3 animate-pulse rounded-full bg-white" />
              <span className="text-sm font-medium text-white/90">Ringing…</span>
            </div>
          </div>
          <div className="space-y-4 px-6 py-6 text-center">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-300">
              {caller?.role ? `${caller.role}` : 'Support staff'}
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onDecline}
                className="flex-1 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 font-semibold text-rose-300 transition hover:bg-rose-500/20"
              >
                Decline
              </button>
              <button
                type="button"
                onClick={onAccept}
                className="flex-1 rounded-2xl bg-emerald-500 px-4 py-3 font-semibold text-white transition hover:bg-emerald-400"
              >
                Accept
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default IncomingCallModal;
