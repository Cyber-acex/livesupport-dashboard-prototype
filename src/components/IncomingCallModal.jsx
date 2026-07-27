import React, { useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const IncomingCallModal = ({ open, caller, onAccept, onDecline }) => {
  const audioRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = 0;
      audio.play().catch(() => {});
    }

    return () => {
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
    };
  }, [open]);

  const callerInitials = useMemo(() => {
    if (!caller?.name) return 'SC';
    return caller.name.split(' ').slice(0, 2).map((segment) => segment[0]).join('').toUpperCase();
  }, [caller?.name]);

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/75 px-4 backdrop-blur-xl"
      >
        <audio ref={audioRef} preload="auto" src="/uploads/Notification sounds/notification.wav" />
        <motion.div
          initial={{ y: 24, scale: 0.96, opacity: 0 }}
          animate={{ y: 0, scale: 1, opacity: 1 }}
          exit={{ y: 12, scale: 0.98, opacity: 0 }}
          className="w-full max-w-lg overflow-hidden rounded-[32px] border border-cyan-400/20 bg-slate-900/95 shadow-[0_30px_80px_rgba(2,6,23,0.45)]"
        >
          <div className="relative bg-gradient-to-r from-sky-600 via-cyan-500 to-violet-500 px-6 py-6 text-white">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.2),_transparent_45%)]" />
            <div className="relative flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.38em] text-white/70">Incoming voice call</p>
                <h3 className="mt-2 text-3xl font-semibold">{caller?.name || 'Unknown caller'}</h3>
                <p className="mt-2 text-sm text-white/80">{caller?.role || 'Support staff'} • Secure live audio</p>
              </div>
              <div className="relative flex h-16 w-16 items-center justify-center rounded-full border border-white/25 bg-white/10 text-3xl shadow-lg">
                <motion.span
                  animate={{ scale: [1, 1.16, 1], opacity: [0.7, 1, 0.7] }}
                  transition={{ duration: 1.3, repeat: Infinity, ease: 'easeInOut' }}
                  className="absolute inset-0 rounded-full border border-white/50"
                />
                <span className="relative">📞</span>
              </div>
            </div>
            <div className="relative mt-5 flex items-center justify-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white/90">
              <span className="inline-flex h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-300" />
              <span>Ringing • Tap to answer</span>
            </div>
          </div>
          <div className="space-y-5 px-6 py-6 text-center">
            <div className="rounded-[24px] border border-slate-800 bg-slate-950/70 p-5 text-left">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-violet-500 font-semibold text-white">
                  {callerInitials}
                </div>
                <div>
                  <p className="text-lg font-semibold text-white">{caller?.name || 'Unknown caller'}</p>
                  <p className="text-sm text-slate-400">{caller?.department || 'Operations'} • {caller?.branch || 'Current branch'}</p>
                </div>
              </div>
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
