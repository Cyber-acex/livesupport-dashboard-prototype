import { AnimatePresence, motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { useVoiceCommunication } from '../contexts/VoiceCommunicationContext';

const tabs = [
  { id: 'staff', label: 'Staff' },
  { id: 'general', label: 'General' },
  { id: 'session', label: 'Session' }
];

function getStatusPill(status) {
  switch (status) {
    case 'available':
      return 'bg-emerald-500/15 text-emerald-500';
    case 'busy':
      return 'bg-amber-500/15 text-amber-500';
    case 'in-call':
      return 'bg-rose-500/15 text-rose-500';
    case 'away':
      return 'bg-slate-500/15 text-slate-500';
    default:
      return 'bg-slate-500/10 text-slate-500';
  }
}

function PanelButton({ children, onClick, className = '', active = false, tone = 'default' }) {
  const toneClasses = {
    default: 'border-white/10 bg-white/10 text-slate-100 hover:bg-white/20',
    success: 'border-emerald-400/25 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25',
    danger: 'border-rose-400/25 bg-rose-500/15 text-rose-300 hover:bg-rose-500/25',
    muted: 'border-slate-400/20 bg-slate-900/40 text-slate-200 hover:bg-slate-800/60'
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border px-3 py-2 text-sm font-medium transition-all duration-200 ${toneClasses[tone]} ${active ? 'ring-2 ring-cyan-400/40' : ''} ${className}`}
    >
      {children}
    </button>
  );
}

export default function VoiceCommunicationPanel() {
  const {
    isOpen,
    setPanelOpen,
    activeTab,
    setActiveTab,
    search,
    setSearch,
    departmentFilter,
    setDepartmentFilter,
    roleFilter,
    setRoleFilter,
    sortOrder,
    setSortOrder,
    staffDirectory,
    currentUser,
    isHydrated,
    incomingCall,
    outgoingCall,
    session,
    broadcast,
    toast,
    connectionState,
    pushToast,
    openCall,
    acceptIncomingCall,
    declineIncomingCall,
    endSession,
    startBroadcast,
    endBroadcast,
    toggleMute
  } = useVoiceCommunication();
  const [isDragging, setIsDragging] = useState(false);

  const filteredStaff = useMemo(() => {
    return [...staffDirectory]
      .filter((staff) => {
        const matchesSearch = `${staff.name} ${staff.role} ${staff.department}`.toLowerCase().includes(search.toLowerCase());
        const matchesDepartment = departmentFilter === 'All' || staff.department === departmentFilter;
        const matchesRole = roleFilter === 'All' || staff.role === roleFilter;
        return matchesSearch && matchesDepartment && matchesRole;
      })
      .sort((a, b) => {
        if (sortOrder === 'availability') {
          const order = { available: 0, away: 1, busy: 2, 'in-call': 3 };
          return order[a.status] - order[b.status];
        }
        return a.name.localeCompare(b.name);
      });
  }, [departmentFilter, roleFilter, search, sortOrder, staffDirectory]);

  const departments = ['All', ...new Set(staffDirectory.map((staff) => staff.department))];
  const roles = ['All', ...new Set(staffDirectory.map((staff) => staff.role))];

  if (!isOpen) {
    return (
      <motion.button
        type="button"
        onClick={() => setPanelOpen(true)}
        whileHover={{ scale: 1.04, y: -3 }}
        whileTap={{ scale: 0.96 }}
        className="fixed bottom-5 right-5 z-[90] flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-gradient-to-br from-sky-500 via-cyan-500 to-violet-500 text-3xl text-white shadow-[0_20px_60px_rgba(14,165,233,0.35)] backdrop-blur-xl"
        aria-label="Open voice communication panel"
      >
        🎤
      </motion.button>
    );
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 220, damping: 24 }}
        className="fixed bottom-5 right-5 z-[90] w-[min(92vw,420px)] overflow-hidden rounded-[30px] border border-white/15 bg-slate-950/80 shadow-[0_30px_80px_rgba(2,6,23,0.45)] backdrop-blur-2xl"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.18),_transparent_40%),radial-gradient(circle_at_bottom_right,_rgba(129,140,248,0.2),_transparent_50%)]" />
        <div className="relative flex items-center justify-between border-b border-white/10 px-4 py-3"> 
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-violet-500 text-lg shadow-lg">🎙️</div>
            <div>
              <p className="text-sm font-semibold text-white">LiveVoice Hub</p>
              <p className="text-xs text-slate-400">{connectionState === 'online' ? 'Connected • ready' : 'Reconnecting'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setIsDragging((value) => !value)} className="rounded-2xl border border-white/10 bg-white/10 p-2 text-slate-200">⋮⋮</button>
            <button type="button" onClick={() => setPanelOpen(false)} className="rounded-2xl border border-white/10 bg-white/10 p-2 text-slate-200">✕</button>
          </div>
        </div>

        <div className="relative px-4 py-3">
          <div className="flex rounded-2xl border border-white/10 bg-slate-900/70 p-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition-all ${activeTab === tab.id ? 'text-white' : 'text-slate-400'}`}
              >
                {activeTab === tab.id && (
                  <motion.span layoutId="voice-tab-pill" className="absolute inset-0 rounded-xl bg-gradient-to-r from-sky-500 to-violet-500" />
                )}
                <span className="relative">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="relative max-h-[70vh] overflow-y-auto px-4 pb-4">
          {activeTab === 'staff' && (
            <div className="space-y-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search staff"
                  className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none"
                  aria-label="Search staff"
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  <select value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)} className="rounded-xl border border-white/10 bg-slate-950/70 px-2 py-2 text-sm text-white">
                    {departments.map((department) => <option key={department} value={department}>{department}</option>)}
                  </select>
                  <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} className="rounded-xl border border-white/10 bg-slate-950/70 px-2 py-2 text-sm text-white">
                    {roles.map((role) => <option key={role} value={role}>{role}</option>)}
                  </select>
                  <button type="button" onClick={() => setSortOrder((value) => value === 'alpha' ? 'availability' : 'alpha')} className="rounded-xl border border-white/10 bg-slate-950/70 px-2 py-2 text-sm text-white">
                    Sort: {sortOrder === 'alpha' ? 'A–Z' : 'Availability'}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                {!isHydrated ? (
                  <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-3 text-sm text-slate-400">Loading real staff presence…</div>
                ) : null}
                {filteredStaff.map((staff) => (
                  <motion.div key={staff.id} layout className="rounded-2xl border border-white/10 bg-slate-900/70 p-3 shadow-lg">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-violet-600 font-semibold text-white">
                        {staff.avatar}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-white">{staff.name}</p>
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${staff.online ? getStatusPill(staff.status) : 'bg-slate-500/15 text-slate-400'}`}>
                            <span className={`mr-1 inline-block h-1.5 w-1.5 rounded-full ${staff.online ? (staff.status === 'busy' ? 'bg-amber-400' : staff.status === 'away' ? 'bg-slate-400' : 'bg-emerald-400') : 'bg-slate-500'}`} />
                            {staff.online ? staff.availability : 'Offline'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400">{staff.role} • {staff.department}</p>
                        <p className="text-xs text-slate-500">{staff.branch}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => openCall(staff)}
                        disabled={!staff.online || String(staff.id) === String(currentUser.id) || staff.status === 'busy' || staff.status === 'in-call'}
                        className="rounded-2xl bg-cyan-500/15 px-3 py-2 text-sm font-semibold text-cyan-300 transition hover:bg-cyan-500/25 disabled:cursor-not-allowed disabled:bg-white/5 disabled:text-slate-500"
                      >
                        {String(staff.id) === String(currentUser.id) ? 'You' : staff.online ? 'Call' : 'Offline'}
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'general' && (
            <div className="space-y-3">
              <div className="rounded-3xl border border-cyan-400/20 bg-gradient-to-br from-cyan-500/15 to-violet-500/15 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Branch broadcast</p>
                    <p className="mt-1 text-2xl font-semibold text-white">42 Staff Online</p>
                  </div>
                  <div className="rounded-full border border-cyan-400/30 bg-cyan-500/15 px-3 py-1 text-sm font-medium text-cyan-300">Live</div>
                </div>
                <button type="button" onClick={startBroadcast} className="mt-4 w-full rounded-2xl bg-gradient-to-r from-cyan-500 to-violet-500 px-4 py-3 font-semibold text-white shadow-lg">Start Branch Broadcast</button>
              </div>

              {broadcast ? (
                <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-white">Broadcast Active</p>
                      <p className="text-xs text-slate-400">{broadcast.connectedCount} connected • {broadcast.status}</p>
                    </div>
                    <PanelButton onClick={endBroadcast} tone="danger">End</PanelButton>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <PanelButton tone="muted">Mute Myself</PanelButton>
                    <PanelButton tone="muted">Invite Staff</PanelButton>
                    <PanelButton tone="muted">Lock</PanelButton>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {activeTab === 'session' && (
            <div className="space-y-3">
              {!session ? (
                <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-cyan-400/30 bg-cyan-500/10 text-3xl">🎧</div>
                  <h3 className="mt-4 text-lg font-semibold text-white">No Active Voice Session</h3>
                  <p className="mt-2 text-sm text-slate-400">Start a call from the Staff tab or join a branch broadcast.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-3xl border border-cyan-400/20 bg-gradient-to-br from-slate-900 to-slate-800 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Live session</p>
                        <p className="mt-1 text-xl font-semibold text-white">{session.peer?.name || 'Call in progress'}</p>
                      </div>
                      <div className="rounded-full border border-cyan-400/30 bg-cyan-500/15 px-3 py-1 text-sm text-cyan-300">{session.quality}</div>
                    </div>
                    <div className="mt-4 flex items-center justify-center gap-2">
                      <div className="h-3 w-3 animate-pulse rounded-full bg-emerald-400" />
                      <span className="text-sm font-medium text-slate-300">Live • {session.duration || 0}s</span>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-3">
                    <div className="grid grid-cols-2 gap-2">
                      <PanelButton onClick={toggleMute} tone={session.isMuted ? 'danger' : 'default'}>{session.isMuted ? 'Unmute Mic' : 'Mute Mic'}</PanelButton>
                      <PanelButton tone="default">Volume</PanelButton>
                      <PanelButton tone="default">Audio Output</PanelButton>
                      <PanelButton tone="default">Invite</PanelButton>
                      <PanelButton tone="default">Raise Hand</PanelButton>
                      <PanelButton tone="danger" onClick={endSession}>End</PanelButton>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>

      <AnimatePresence>
        {incomingCall ? (
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 14 }} className="fixed inset-x-4 bottom-4 z-[95] rounded-[24px] border border-white/15 bg-slate-950/90 p-4 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Incoming call</p>
                <p className="text-base font-semibold text-white">{incomingCall?.caller?.name || 'Incoming call'}</p>
              </div>
              <div className="rounded-full border border-cyan-400/30 bg-cyan-500/15 px-3 py-1 text-sm text-cyan-300">Ringing</div>
            </div>
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={declineIncomingCall} className="flex-1 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-sm font-semibold text-rose-300">Decline</button>
              <button type="button" onClick={acceptIncomingCall} className="flex-1 rounded-2xl bg-emerald-500 px-3 py-2 text-sm font-semibold text-white">Accept</button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {outgoingCall ? (
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 14 }} className="fixed inset-x-4 top-4 z-[95] rounded-[24px] border border-white/15 bg-slate-950/90 p-4 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Calling</p>
                <p className="text-base font-semibold text-white">{outgoingCall.contact?.name}</p>
              </div>
              <button type="button" onClick={() => setOutgoingCall(null)} className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-sm font-semibold text-rose-300">Cancel</button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {toast ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="fixed left-1/2 top-4 z-[95] -translate-x-1/2 rounded-full border border-white/10 bg-slate-900/90 px-4 py-2 text-sm text-white shadow-xl backdrop-blur-xl">
            {toast.message}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
