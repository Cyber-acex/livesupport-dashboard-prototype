import { Mic, MicOff, Radio, Volume2, VolumeX, Users, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useVoiceCommunication } from '../contexts/VoiceCommunicationContext';

function VoiceWidget() {
  const { connectionState, channelState, microphoneState, currentUser, activeStaff, activeParticipants, muted, deafened, speaking, error, diagnostics, joinVoice, leaveVoice, setTransmitting, toggleMute, toggleDeafen } = useVoiceCommunication();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const stop = () => setTransmitting(false);
    const handleKey = (event) => { if (event.code === 'Space' && !event.repeat) { event.preventDefault(); setTransmitting(true); } };
    const handleKeyUp = (event) => { if (event.code === 'Space') { event.preventDefault(); setTransmitting(false); } };
    window.addEventListener('blur', stop);
    window.addEventListener('keydown', handleKey);
    window.addEventListener('keyup', handleKeyUp);
    return () => { window.removeEventListener('blur', stop); window.removeEventListener('keydown', handleKey); window.removeEventListener('keyup', handleKeyUp); };
  }, [setTransmitting]);

  if (!currentUser) return null;

  const isConnected = connectionState === 'connected';
  const peers = activeStaff.filter((staff) => String(staff.userId) !== String(currentUser.id));
  const statusLabel = channelState === 'connected' ? (speaking ? 'Speaking' : muted ? 'Muted' : deafened ? 'Deafened' : 'Connected') : channelState === 'reconnecting' || connectionState === 'reconnecting' ? 'Reconnecting' : isConnected ? 'Ready to join' : connectionState === 'error' ? 'Staff voice unavailable' : 'Connecting to staff voice';

  return (
    <div className="fixed bottom-5 right-5 z-[60] flex flex-col items-end gap-3" style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 60 }}>
      {open && (
        <section className="w-[min(21rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900" aria-label="Staff voice panel">
          <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
            <div><p className="text-sm font-semibold text-slate-900 dark:text-white">Staff Voice</p><p className="text-xs text-slate-500 dark:text-slate-400">{currentUser.branchName || 'Your branch'} · {statusLabel}</p></div>
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:hover:bg-slate-800" aria-label="Close staff voice"><X size={17} /></button>
          </header>
          <div className="px-4 py-3">
            <div className="mb-3 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"><span className="flex items-center gap-2"><Users size={14} /> Active staff</span><span>{peers.length}</span></div>
            <div className="space-y-2">
              {peers.length === 0 && <p className="py-3 text-sm text-slate-500 dark:text-slate-400">No other active staff in your branch.</p>}
              {peers.map((staff) => <div key={staff.userId} className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800/70"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" aria-hidden="true" /><span className="min-w-0 truncate text-sm font-medium text-slate-800 dark:text-slate-100">{staff.name}</span></div>)}
            </div>
            {activeParticipants.length > 0 && <div className="mt-4 border-t border-slate-200 pt-3 dark:border-slate-700"><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">In voice</p>{activeParticipants.map((participant) => <div key={participant.userId} className="flex items-center gap-2 py-1 text-sm text-slate-700 dark:text-slate-200"><Mic size={14} className={participant.speaking ? 'text-rose-500' : 'text-cyan-600'} />{participant.name}{participant.speaking && <span className="text-xs text-rose-500">Speaking</span>}</div>)}</div>}
            {error && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">{error}</p>}
            {import.meta.env.DEV && <details className="mt-3 text-[11px] text-slate-500 dark:text-slate-400"><summary className="cursor-pointer">Voice diagnostics</summary><pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap">{JSON.stringify({ connectionState, channelState, microphoneState, muted, deafened, speaking, activeParticipants: activeParticipants.length, ...diagnostics }, null, 2)}</pre></details>}
            {channelState === 'connected' ? <>
              <button type="button" onPointerDown={() => setTransmitting(true)} onPointerUp={() => setTransmitting(false)} onPointerCancel={() => setTransmitting(false)} onPointerLeave={() => setTransmitting(false)} className={`mt-4 flex w-full touch-none items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white ${speaking ? 'bg-rose-600' : 'bg-cyan-600 hover:bg-cyan-700'}`} aria-label="Hold to talk"><Mic size={17} /> {speaking ? 'Speaking' : 'Hold to talk'}</button>
              <div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={toggleMute} className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200" aria-label="Mute microphone">{muted ? <MicOff size={15} /> : <Mic size={15} />} {muted ? 'Unmute' : 'Mute'}</button><button type="button" onClick={toggleDeafen} className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200" aria-label="Deafen voice">{deafened ? <VolumeX size={15} /> : <Volume2 size={15} />} {deafened ? 'Undeafen' : 'Deafen'}</button></div>
              <button type="button" onClick={leaveVoice} className="mt-2 w-full rounded-xl px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10" aria-label="Leave staff voice">Leave voice</button>
            </> : <button type="button" onClick={joinVoice} disabled={!isConnected || microphoneState === 'requesting'} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-slate-700" aria-label="Join staff voice"><Radio size={17} /> {microphoneState === 'requesting' ? 'Requesting microphone...' : 'Join voice'}</button>}
          </div>
        </section>
      )}
      <button type="button" onClick={() => setOpen((value) => !value)} className={`flex h-14 w-14 items-center justify-center rounded-full text-white shadow-xl transition hover:scale-105 focus:outline-none focus:ring-4 focus:ring-cyan-300 ${isConnected ? 'bg-cyan-600' : connectionState === 'error' ? 'bg-rose-600' : 'bg-slate-500'}`} aria-label={open ? 'Close staff voice' : 'Open staff voice'} title={statusLabel}><Mic size={23} /></button>
    </div>
  );
}

export default VoiceWidget;