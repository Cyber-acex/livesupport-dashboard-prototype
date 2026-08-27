import { AnimatePresence, motion } from 'framer-motion';
import { Mic, MicOff, PhoneOff, PauseCircle } from 'lucide-react';
import React from 'react';
import { useVoiceCommunication } from '../contexts/VoiceCommunicationContext';

export default function LiveCallHeader() {
  const { session, endSession, toggleMute } = useVoiceCommunication();

  if (!session) return null;

  const peerName = session.peer?.name || session.caller?.name || 'Live call';
  const isMuted = Boolean(session.isMuted);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -16 }}
        className="fixed inset-x-4 top-4 z-[75] rounded-[24px] border border-cyan-400/20 bg-slate-950/90 px-4 py-3 shadow-[0_20px_60px_rgba(2,6,23,0.35)] backdrop-blur-xl"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-violet-500 text-sm font-semibold text-white">
              {peerName.split(' ').slice(0, 2).map((segment) => segment[0]).join('').toUpperCase() || 'LC'}
            </div>
            <div>
              <p className="text-sm font-semibold text-white">{peerName}</p>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                <span>Live • Secured call</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleMute}
              className={`rounded-2xl border px-3 py-2 text-sm font-medium transition ${isMuted ? 'border-rose-400/20 bg-rose-500/10 text-rose-300' : 'border-white/10 bg-white/10 text-slate-200 hover:bg-white/20'}`}
            >
              {isMuted ? <span className="flex items-center gap-2"><MicOff className="h-4 w-4" /> Muted</span> : <span className="flex items-center gap-2"><Mic className="h-4 w-4" /> Mute</span>}
            </button>
            <button
              type="button"
              className="rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/20"
            >
              <span className="flex items-center gap-2"><PauseCircle className="h-4 w-4" /> Hold</span>
            </button>
            <button
              type="button"
              onClick={endSession}
              className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-sm font-medium text-rose-300 transition hover:bg-rose-500/20"
            >
              <span className="flex items-center gap-2"><PhoneOff className="h-4 w-4" /> End</span>
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
