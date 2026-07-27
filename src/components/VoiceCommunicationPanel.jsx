import { AnimatePresence, motion } from 'framer-motion';
import { Mic, MicOff, PhoneCall, PhoneOff, Search, ShieldCheck, Sparkles, Users, Volume2, X, Wifi, Circle } from 'lucide-react';
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
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'busy':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'in-call':
      return 'bg-rose-50 text-rose-700 border-rose-200';
    case 'away':
      return 'bg-slate-100 text-slate-600 border-slate-200';
    default:
      return 'bg-slate-100 text-slate-600 border-slate-200';
  }
}

function PanelButton({ children, onClick, className = '', active = false, tone = 'default' }) {
  const toneClasses = {
    default: 'border-[#ECEEF3] bg-white text-[#111827] hover:bg-[#F8FAFC]',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
    danger: 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100',
    muted: 'border-[#ECEEF3] bg-[#FAFAFC] text-[#6B7280] hover:bg-[#F3F4F6]'
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
    toggleMute,
    toggleHold,
    cycleVolume,
    verifySecurity,
    toggleBoost,
    toggleBroadcastMute,
    toggleBroadcastLock,
    inviteStaffToBroadcast,
    cancelOutgoingCall
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
        className="fixed bottom-5 right-5 z-[90] flex h-16 w-16 items-center justify-center rounded-full border border-[#E5E7EB] bg-gradient-to-br from-[#4F7CFF] via-[#6D5DFD] to-[#8B5CF6] text-3xl text-white shadow-[0_16px_40px_rgba(79,124,255,0.2)]"
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
        className="fixed bottom-5 right-5 z-[90] w-[min(92vw,430px)] overflow-hidden rounded-[24px] border border-[#ECEEF3] bg-[#FFFFFF] shadow-[0_18px_45px_rgba(17,24,39,0.08)]"
      >
        <div className="relative flex items-center justify-between border-b border-[#F0F2F5] px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#4F7CFF] via-[#6D5DFD] to-[#8B5CF6] text-lg shadow-[0_10px_30px_rgba(79,124,255,0.24)]">
              <ShieldCheck className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-[15px] font-semibold leading-5 text-[#111827]">Staff Voice</p>
              <p className="text-[12px] text-[#6B7280]">{connectionState === 'secure' ? 'Connected • Secure' : connectionState === 'reconnecting' ? 'Reconnecting' : 'Connected • Ready'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
              <span className="h-2 w-2 rounded-full bg-emerald-500" /> Secure
            </div>
            <button type="button" onClick={() => setPanelOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-full border border-[#ECEEF3] bg-white text-[#6B7280] transition hover:-translate-y-0.5 hover:shadow-sm">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="relative px-3 pt-2">
          <div className="flex border-b border-[#F0F2F5]">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className="relative flex-1 px-3 pb-2 text-[13px] font-semibold transition-all"
              >
                <span className={`relative inline-flex items-center justify-center ${activeTab === tab.id ? 'text-[#4F7CFF]' : 'text-[#6B7280]'}`}>
                  {tab.label}
                  {activeTab === tab.id && (
                    <motion.span layoutId="voice-tab-underline" className="absolute -bottom-[1px] left-0 h-[2px] w-full rounded-full bg-gradient-to-r from-[#4F7CFF] to-[#8B5CF6]" />
                  )}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="relative max-h-[66vh] overflow-y-auto px-3 pb-3 scrollbar-thin scrollbar-thumb-[#E5E7EB] scrollbar-track-transparent hover:scrollbar-thumb-[#D1D5DB]">
          {activeTab === 'staff' && (
            <div className="space-y-2 pt-2">
              <div className="flex items-center gap-2 rounded-[14px] border border-[#ECEEF3] bg-[#FAFAFC] px-2.5 py-2">
                <Search className="h-4 w-4 text-[#6B7280]" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search staff..."
                  className="w-full bg-transparent text-[13px] text-[#111827] outline-none placeholder:text-[#9CA3AF]"
                  aria-label="Search staff"
                />
              </div>
              <div className="flex gap-2">
                <select value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)} className="flex-1 rounded-[12px] border border-[#ECEEF3] bg-white px-2.5 py-2 text-[12px] text-[#111827] outline-none">
                  {departments.map((department) => <option key={department} value={department}>{department}</option>)}
                </select>
                <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} className="flex-1 rounded-[12px] border border-[#ECEEF3] bg-white px-2.5 py-2 text-[12px] text-[#111827] outline-none">
                  {roles.map((role) => <option key={role} value={role}>{role}</option>)}
                </select>
                <button type="button" onClick={() => setSortOrder((value) => value === 'alpha' ? 'availability' : 'alpha')} className="rounded-[12px] border border-[#ECEEF3] bg-white px-2.5 py-2 text-[12px] font-medium text-[#111827]">
                  {sortOrder === 'alpha' ? 'A–Z' : 'Status'}
                </button>
              </div>

              <div className="space-y-2 pt-1">
                {!isHydrated ? (
                  <div className="rounded-[16px] border border-[#ECEEF3] bg-[#FAFAFC] p-3 text-[13px] text-[#6B7280]">Loading real staff presence…</div>
                ) : null}
                {filteredStaff.map((staff, index) => (
                  <motion.div key={staff.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.03 }} layout className="flex items-center gap-2 rounded-[16px] border border-[#ECEEF3] bg-white p-2.5 shadow-[0_8px_20px_rgba(17,24,39,0.04)]">
                    <div className="relative flex h-10 w-10 items-center justify-center rounded-[14px] bg-gradient-to-br from-[#4F7CFF] to-[#8B5CF6] font-semibold text-white">
                      {staff.avatar}
                      <span className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white ${staff.online ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-[13px] font-semibold text-[#111827]">{staff.name}</p>
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${staff.online ? getStatusPill(staff.status) : 'border-slate-200 bg-slate-100 text-slate-600'}`}>
                          {staff.online ? staff.availability : 'Offline'}
                        </span>
                      </div>
                      <p className="truncate text-[11px] text-[#6B7280]">{staff.role} • {staff.department}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => openCall(staff)}
                      disabled={!staff.online || String(staff.id) === String(currentUser.id) || staff.status === 'busy' || staff.status === 'in-call'}
                      className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-gradient-to-br from-[#4F7CFF] to-[#6D5DFD] text-white shadow-[0_8px_18px_rgba(79,124,255,0.18)] transition hover:-translate-y-0.5 hover:scale-[1.02] disabled:cursor-not-allowed disabled:bg-[#E5E7EB] disabled:text-[#9CA3AF] disabled:shadow-none"
                    >
                      {String(staff.id) === String(currentUser.id) ? <span className="text-[11px] font-semibold">You</span> : <PhoneCall className="h-4 w-4" />}
                    </button>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'general' && (
            <div className="space-y-2 pt-2">
              <div className="rounded-[18px] border border-[#ECEEF3] bg-[#FAFAFC] p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.24em] text-[#6B7280]">Branch broadcast</p>
                    <p className="mt-1 text-[15px] font-semibold text-[#111827]">42 staff online</p>
                  </div>
                  <div className="flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" /> Live
                  </div>
                </div>
                <button type="button" onClick={startBroadcast} className="mt-3 w-full rounded-[14px] bg-gradient-to-r from-[#4F7CFF] to-[#8B5CF6] px-3 py-2 text-[13px] font-semibold text-white shadow-[0_10px_24px_rgba(79,124,255,0.18)]">Start Branch Broadcast</button>
              </div>

              {broadcast ? (
                <div className="rounded-[18px] border border-[#ECEEF3] bg-white p-3 shadow-[0_8px_20px_rgba(17,24,39,0.04)]">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[13px] font-semibold text-[#111827]">Broadcast active</p>
                      <p className="text-[12px] text-[#6B7280]">{broadcast.connectedCount} connected • {broadcast.status}</p>
                    </div>
                    <PanelButton onClick={endBroadcast} tone="danger">End</PanelButton>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <PanelButton onClick={toggleBroadcastMute} tone={broadcast?.isMuted ? 'danger' : 'muted'}>{broadcast?.isMuted ? 'Unmute' : 'Mute'}</PanelButton>
                    <PanelButton onClick={inviteStaffToBroadcast} tone="muted">Invite</PanelButton>
                    <PanelButton onClick={toggleBroadcastLock} tone={broadcast?.isLocked ? 'success' : 'muted'}>{broadcast?.isLocked ? 'Unlock' : 'Lock'}</PanelButton>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {activeTab === 'session' && (
            <div className="space-y-2 pt-2">
              {!session ? (
                <div className="rounded-[18px] border border-[#ECEEF3] bg-[#FAFAFC] p-4 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[#4F7CFF] to-[#8B5CF6] text-white">
                    <Mic className="h-5 w-5" />
                  </div>
                  <h3 className="mt-3 text-[14px] font-semibold text-[#111827]">No active voice session</h3>
                  <p className="mt-1 text-[12px] text-[#6B7280]">Start a call from the staff tab or join a branch broadcast.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="rounded-[18px] border border-[#ECEEF3] bg-[#FAFAFC] p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.24em] text-[#6B7280]">Live session</p>
                        <p className="mt-1 text-[14px] font-semibold text-[#111827]">{session.peer?.name || 'Call in progress'}</p>
                      </div>
                      <div className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">{session.quality}</div>
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-[12px] text-[#6B7280]">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                      Live • {session.duration || 0}s
                    </div>
                  </div>
                  <div className="rounded-[18px] border border-[#ECEEF3] bg-white p-2.5 shadow-[0_8px_20px_rgba(17,24,39,0.04)]">
                    <div className="grid grid-cols-2 gap-2">
                      <PanelButton onClick={toggleMute} tone={session.isMuted ? 'danger' : 'default'}>{session.isMuted ? <span className="flex items-center gap-2"><MicOff className="h-4 w-4" /> Unmute</span> : <span className="flex items-center gap-2"><Mic className="h-4 w-4" /> Mute</span>}</PanelButton>
                      <PanelButton onClick={cycleVolume} tone="default"><span className="flex items-center gap-2"><Volume2 className="h-4 w-4" /> {session.volume ? `${Math.round(session.volume * 100)}%` : '100%'}</span></PanelButton>
                      <PanelButton onClick={verifySecurity} tone={session.securityVerified ? 'success' : 'default'}><span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> {session.securityVerified ? 'Secure' : 'Verify'}</span></PanelButton>
                      <PanelButton onClick={toggleHold} tone={session.isHeld ? 'muted' : 'default'}><span className="flex items-center gap-2"><Users className="h-4 w-4" /> {session.isHeld ? 'Resume' : 'Hold'}</span></PanelButton>
                      <PanelButton onClick={toggleBoost} tone={session.boosted ? 'success' : 'default'} className="col-span-2"><span className="flex items-center justify-center gap-2"><Sparkles className="h-4 w-4" /> {session.boosted ? 'Boosted' : 'Boost call quality'}</span></PanelButton>
                      <PanelButton tone="danger" onClick={endSession} className="col-span-2"><span className="flex items-center justify-center gap-2"><PhoneOff className="h-4 w-4" /> End call</span></PanelButton>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>

      <div className="fixed bottom-3 right-5 z-[90] flex items-center gap-2 rounded-full border border-[#ECEEF3] bg-white px-3 py-1.5 text-[11px] font-medium text-[#6B7280] shadow-[0_8px_18px_rgba(17,24,39,0.06)]">
        <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
        LiveVoice Hub • Connected
      </div>

      <AnimatePresence>
        {outgoingCall ? (
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 14 }} className="fixed inset-x-4 top-4 z-[95] rounded-[18px] border border-[#ECEEF3] bg-white p-3 shadow-[0_16px_36px_rgba(17,24,39,0.08)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.24em] text-[#6B7280]">Calling</p>
                <p className="text-[14px] font-semibold text-[#111827]">{outgoingCall.contact?.name}</p>
              </div>
              <button type="button" onClick={cancelOutgoingCall} className="rounded-[12px] border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[12px] font-semibold text-rose-700">Cancel</button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {toast ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="fixed left-1/2 top-4 z-[95] -translate-x-1/2 rounded-full border border-[#ECEEF3] bg-white px-3 py-1.5 text-[12px] text-[#111827] shadow-[0_10px_24px_rgba(17,24,39,0.08)]">
            {toast.message}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
