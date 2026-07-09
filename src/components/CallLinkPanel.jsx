import React from 'react';

function CallLinkPanel({ callLink, status, onCopy }) {
  if (!callLink) return null;

  return (
    <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">Customer call link</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Share this secure link with the customer to answer the incoming call.</p>
        </div>
        <button
          type="button"
          onClick={onCopy}
          className="rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
        >
          Copy link
        </button>
      </div>
      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-3 text-sm text-slate-800 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
        {callLink}
      </div>
      <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">This link expires after {process.env.CALL_SESSION_EXPIRY_MINUTES || 15} minutes.</p>
    </div>
  );
}

export default CallLinkPanel;
