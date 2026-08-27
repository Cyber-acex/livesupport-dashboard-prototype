import React from 'react';
import { motion } from 'framer-motion';

const OutgoingCallPanel = ({ contact, status, duration, onCancel }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-[24px] border border-slate-200 bg-white/90 p-5 shadow-lg backdrop-blur dark:border-slate-800 dark:bg-slate-950/90"
    >
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-brand-600 to-cyan-500 text-xl font-semibold text-white">
          {contact?.name?.charAt(0)?.toUpperCase() || 'C'}
        </div>
        <div className="flex-1">
          <p className="text-lg font-semibold text-slate-900 dark:text-white">{contact?.name || 'Connecting'}</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">{status}</p>
        </div>
        <div className="text-right text-sm text-slate-500 dark:text-slate-400">
          <div className="font-semibold text-slate-900 dark:text-white">{duration}</div>
          <div>Call timer</div>
        </div>
      </div>
      <div className="mt-5 flex items-center justify-center">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 font-semibold text-rose-500 transition hover:bg-rose-500/20"
        >
          Cancel call
        </button>
      </div>
    </motion.div>
  );
};

export default OutgoingCallPanel;
