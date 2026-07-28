import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { buildSecureAudioConstraints } from '../services/webrtcService';
import { CallManager } from '../services/voice/callManager';
import { PresenceService } from '../services/voice/presenceService';
import { SignalingService } from '../services/voice/signalingService';
import { WebRTCManager } from '../services/voice/webrtcManager';
import { VoiceCallState } from '../services/voice/stateMachine';
import { mergePresenceIntoDirectory } from '../utils/voicePresence';

const initialDirectory = [];

const defaultCurrentUser = {
  id: null,
  name: 'Staff',
  role: 'staff',
  department: 'Operations',
  branch: 'Current Branch',
  status: 'available',
  avatar: 'ST',
  availability: 'Available'
};

const VoiceCommunicationContext = createContext(null);

function resolveCurrentUser() {
  if (typeof window === 'undefined') return defaultCurrentUser;

  const windowUser = window.currentUser || window.__CURRENT_USER__ || null;
  if (windowUser) {
    return {
      ...defaultCurrentUser,
      id: windowUser.id || windowUser.userId || null,
      name: windowUser.name || windowUser.displayName || 'Staff',
      role: windowUser.role || 'staff',
      department: windowUser.department || windowUser.team || 'Operations',
      branch: windowUser.branchName || windowUser.branch || 'Current Branch',
      avatar: windowUser.avatar_url || windowUser.avatarUrl || defaultCurrentUser.avatar,
      status: 'available',
      availability: 'Available'
    };
  }

  return defaultCurrentUser;
}

export function VoiceCommunicationProvider({ children }) {
  const [isOpen, setIsOpen] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      const saved = window.localStorage.getItem('voice-panel-open');
      return saved ? JSON.parse(saved) : false;
    } catch (error) {
      return false;
    }
  });
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window === 'undefined') return 'staff';
    try {
      const saved = window.localStorage.getItem('voice-panel-tab');
      return saved || 'staff';
    } catch (error) {
      return 'staff';
    }
  });
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('All');
  const [roleFilter, setRoleFilter] = useState('All');
  const [sortOrder, setSortOrder] = useState('alpha');
  const [staffDirectory, setStaffDirectory] = useState(initialDirectory);
  const [isHydrated, setIsHydrated] = useState(false);
  const [currentUser, setCurrentUser] = useState(resolveCurrentUser);
  const [hydrationAttempted, setHydrationAttempted] = useState(false);
  const [incomingCall, setIncomingCall] = useState(null);
  const [outgoingCall, setOutgoingCall] = useState(null);
  const [session, setSession] = useState(null);
  const [broadcast, setBroadcast] = useState(null);
  const [toast, setToast] = useState(null);
  const [connectionState, setConnectionState] = useState('online');
  const socketRef = useRef(null);
  const directoryRef = useRef([]);
  const webRtcRef = useRef(null);
  const callPeerIdRef = useRef(null);
  const callIdRef = useRef(null);
  const pendingIceCandidatesRef = useRef([]);
  const toastTimerRef = useRef(null);
  const callManagerRef = useRef(null);
  const signalingServiceRef = useRef(null);
  const presenceServiceRef = useRef(null);
  const [voiceState, setVoiceState] = useState(VoiceCallState.Idle);

  const pushToast = useCallback((message, tone = 'info') => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    setToast({ id: Date.now(), message, tone });
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2200);
  }, []);

  const cleanupWebRtc = useCallback(() => {
    webRtcRef.current?.cleanup();
    webRtcRef.current = null;
    pendingIceCandidatesRef.current = [];
    document.querySelectorAll('audio[data-voice-call]').forEach((audio) => audio.remove());
  }, []);

  const ensureVoiceSession = useCallback(async () => {
    if (!webRtcRef.current) {
      const manager = new WebRTCManager({
        onRemoteStream: (stream) => {
          pushToast('Audio connected', 'success');
        },
        onStateChange: (state) => {
          setConnectionState(state.connectionState === 'connected' ? 'secure' : state.connectionState === 'failed' || state.connectionState === 'disconnected' ? 'reconnecting' : 'online');
        },
        logger: (message) => console.info('[Voice]', message)
      });
      webRtcRef.current = manager;
    }

    if (!callManagerRef.current) {
      const signaling = new SignalingService({
        socketUrl: window.location.origin,
        logger: (message) => console.info('[Voice Signaling]', message),
        onEvent: (eventName, payload) => {
          if (eventName === 'call:incoming') {
            setIncomingCall(payload);
            setVoiceState(VoiceCallState.Incoming);
            pushToast(`${payload?.caller?.name || 'Staff'} is calling`, 'info');
          }
          if (eventName === 'call:accepted') {
            setSession({
              id: payload.callId,
              caller: payload.caller || currentUser,
              peer: payload.peer || currentUser,
              startedAt: Date.now(),
              duration: 0,
              quality: 'Excellent',
              isMuted: false,
              isHeld: false,
              volume: 1,
              securityVerified: true,
              boosted: false
            });
            setActiveTab('session');
            setOutgoingCall(null);
            setVoiceState(VoiceCallState.Connected);
            pushToast('Call accepted', 'success');
          }
          if (eventName === 'presenceUpdate' || eventName === 'voice:presenceUpdate') {
            setStaffDirectory((previous) => {
              const next = mergePresenceIntoDirectory(previous, Array.isArray(payload) ? payload : []);
              directoryRef.current = next;
              return next;
            });
            setIsHydrated(true);
          }
          if (eventName === 'webrtc:offer') {
            callManagerRef.current?.handleOffer(payload);
          }
          if (eventName === 'webrtc:answer') {
            callManagerRef.current?.handleAnswer(payload);
          }
          if (eventName === 'webrtc:icecandidate') {
            callManagerRef.current?.handleIceCandidate(payload);
          }
          if (eventName === 'call:declined') {
            setOutgoingCall(null);
            setVoiceState(VoiceCallState.Rejected);
            pushToast('Call declined', 'warning');
          }
          if (eventName === 'call:ended') {
            cleanupWebRtc();
            setOutgoingCall(null);
            setIncomingCall(null);
            setSession(null);
            setVoiceState(VoiceCallState.Ended);
            pushToast('Call ended', 'info');
          }
        },
        onConnected: () => {
          signalingServiceRef.current?.register(currentUser);
          setConnectionState('online');
        },
        onDisconnected: () => {
          setConnectionState('reconnecting');
        },
        onError: (error) => {
          pushToast(error?.message || 'Connection error', 'warning');
        }
      });
      signalingServiceRef.current = signaling;
      callManagerRef.current = new CallManager({
        signalingService: signaling,
        webrtcManager: webRtcRef.current,
        presenceService: presenceServiceRef.current || new PresenceService(),
        onStateChange: (state) => setVoiceState(state),
        onError: (error) => pushToast(error?.message || 'Voice error', 'warning'),
        logger: (message) => console.info('[Voice CallManager]', message)
      });
      presenceServiceRef.current = presenceServiceRef.current || new PresenceService({ onPresenceChanged: () => {} });
    }

    if (!socketRef.current && signalingServiceRef.current) {
      socketRef.current = signalingServiceRef.current.connect({ user: currentUser });
    }

    const service = webRtcRef.current;
    if (!service.localStream) {
      await service.acquireMicrophone(buildSecureAudioConstraints({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false
      }));
    }

    if (service.localStream) {
      service.setMute(false);
    }

    if (!service.peerConnection) {
      service.createPeerConnection();
    }

    return service;
  }, [cleanupWebRtc, currentUser, pushToast]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('voice-panel-open', JSON.stringify(isOpen));
      window.localStorage.setItem('voice-panel-tab', activeTab);
      window.localStorage.setItem('voice-current-user', JSON.stringify(currentUser));
    }
  }, [activeTab, currentUser, isOpen]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const hydrateDirectory = async () => {
      try {
        const [sessionResponse, staffResponse] = await Promise.all([
          fetch('/api/user', { credentials: 'same-origin' }),
          fetch('/api/voice/staff', { credentials: 'same-origin' })
        ]);

        let authenticatedUser = null;
        if (sessionResponse.ok) {
          authenticatedUser = await sessionResponse.json();
          if (authenticatedUser && !authenticatedUser.error) {
            const resolvedUser = {
              ...defaultCurrentUser,
              id: authenticatedUser.id || null,
              name: authenticatedUser.name || 'Staff',
              role: authenticatedUser.role || 'staff',
              department: 'Operations',
              branch: authenticatedUser.branchName || authenticatedUser.branchName || 'Current Branch',
              avatar: authenticatedUser.avatar_url || authenticatedUser.avatarUrl || 'ST',
              status: 'available',
              availability: 'Available'
            };
            setCurrentUser(resolvedUser);
            const seededDirectory = [{
              id: resolvedUser.id,
              name: resolvedUser.name,
              role: resolvedUser.role,
              department: resolvedUser.department || 'Operations',
              branch: resolvedUser.branch || 'Current Branch',
              online: true,
              status: 'available',
              avatar: resolvedUser.avatar || 'ST',
              availability: 'Available'
            }];
            directoryRef.current = seededDirectory;
            setStaffDirectory(seededDirectory);
          }
        }

        const staffUsers = staffResponse.ok ? await staffResponse.json() : [];
        const mapped = (Array.isArray(staffUsers) ? staffUsers : []).map((user) => {
          const normalizedRole = String(user.role || 'staff').replace(/^admin$/i, 'Admin').replace(/^agent$/i, 'Agent').replace(/^viewer$/i, 'Viewer');
          const online = Boolean(user.online);
          const normalizedStatus = online ? (user.status === 'busy' ? 'busy' : user.status === 'away' ? 'away' : 'available') : 'offline';
          return {
            id: user.id,
            name: user.name || user.email || 'Staff',
            role: normalizedRole,
            department: user.department || 'Operations',
            branch: user.branchName || user.branch || 'Current Branch',
            online,
            status: normalizedStatus,
            avatar: (user.name || user.email || 'ST').split(' ').map((segment) => segment[0]).slice(0, 2).join('').toUpperCase(),
            availability: online ? (normalizedStatus === 'busy' ? 'Busy' : normalizedStatus === 'away' ? 'Away' : 'Available') : 'Offline'
          };
        });

        const mergedDirectory = mergePresenceIntoDirectory(mapped, Array.isArray(staffUsers) ? staffUsers : []);

        const me = mergedDirectory.find((entry) => String(entry.id) === String(authenticatedUser?.id || currentUser.id));
        if (!me && (authenticatedUser?.id || currentUser.id)) {
          mergedDirectory.unshift({
            id: authenticatedUser?.id || currentUser.id,
            name: authenticatedUser?.name || currentUser.name || 'Staff',
            role: authenticatedUser?.role || currentUser.role || 'staff',
            department: 'Operations',
            branch: authenticatedUser?.branchName || currentUser.branch || 'Current Branch',
            online: true,
            status: 'available',
            avatar: authenticatedUser?.avatar_url || currentUser.avatar || 'ST',
            availability: 'Available'
          });
        }

        const primaryDirectory = mergedDirectory.length > 0 ? mergedDirectory : [];
        directoryRef.current = primaryDirectory;
        setStaffDirectory(primaryDirectory);
        setIsHydrated(true);
        setHydrationAttempted(true);
      } catch (error) {
        console.warn('Unable to hydrate voice staff directory', error);
        const fallback = [];
        directoryRef.current = fallback;
        setStaffDirectory(fallback);
        setIsHydrated(true);
        setHydrationAttempted(true);
      }
    };

    void ensureVoiceSession().catch(() => {});
    void hydrateDirectory();

    return () => {
      cleanupWebRtc();
      if (signalingServiceRef.current) {
        signalingServiceRef.current.dispose();
        signalingServiceRef.current = null;
      }
      socketRef.current = null;
      callManagerRef.current = null;
      webRtcRef.current = null;
    };
  }, [cleanupWebRtc, currentUser.avatar, currentUser.branch, currentUser.department, currentUser.id, currentUser.name, currentUser.role, ensureVoiceSession]);

  const setPanelOpen = useCallback((value) => setIsOpen(value), []);

  const togglePanel = useCallback(() => setIsOpen((value) => !value), []);

  const openCall = useCallback(async (staff) => {
    console.log('[Voice] openCall triggered for staff:', staff);
    if (String(staff.id) === String(currentUser.id)) {
      console.log('[Voice] Cannot call yourself');
      return;
    }
    if (!staff.online) {
      console.log('[Voice] Staff is offline');
      pushToast('This staff member is offline.', 'warning');
      return;
    }
    if (staff.status === 'busy' || staff.status === 'in-call') {
      console.log('[Voice] Staff is busy or in-call');
      pushToast('User is currently on another call.', 'warning');
      return;
    }

    const callId = `call-${Date.now()}`;
    callIdRef.current = callId;
    callPeerIdRef.current = staff.id;
    setOutgoingCall({
      id: callId,
      contact: staff,
      status: 'Requesting microphone access…',
      startedAt: Date.now()
    });
    setActiveTab('session');

    try {
      const service = await ensureVoiceSession();
      const offer = await service.createOffer();
      if (socketRef.current) {
        console.log('[Voice Socket] 📤 Emitting call:start:', { recipientId: staff.id, callId, caller: currentUser, offerPresent: !!offer });
        socketRef.current.emit('call:start', {
          recipientId: staff.id,
          callId,
          caller: {
            ...currentUser,
            userId: currentUser.id
          },
          offer
        });
        setOutgoingCall((value) => value ? { ...value, status: 'Calling…' } : value);
      } else {
        throw new Error('Socket not connected');
      }
      pushToast(`Calling ${staff.name}`, 'info');
    } catch (error) {
      console.error('[Voice] Error initiating call:', error);
      setOutgoingCall(null);
      pushToast(error?.name === 'NotAllowedError' ? 'Microphone permission is required to start a call' : 'Unable to start a voice call', 'warning');
    }
  }, [currentUser, ensureVoiceSession, pushToast]);

  const acceptIncomingCall = useCallback(async () => {
    console.log('[Voice] acceptIncomingCall triggered with incomingCall:', incomingCall);
    if (!incomingCall) {
      console.error('[Voice] No incoming call to accept');
      return;
    }
    callIdRef.current = incomingCall.id || `call-${Date.now()}`;
    callPeerIdRef.current = incomingCall.caller?.id || incomingCall.fromUserId;
    console.log('[Voice] Setting up session:', { callId: callIdRef.current, peerId: callPeerIdRef.current });
    setSession({
      id: incomingCall.id || `call-${Date.now()}`,
      caller: incomingCall.caller || incomingCall.fromUser || currentUser,
      peer: incomingCall.caller || incomingCall.fromUser || currentUser,
      startedAt: Date.now(),
      duration: 0,
      quality: 'Excellent',
      isMuted: false,
      isHeld: false,
      volume: 1,
      securityVerified: true,
      boosted: false
    });
    setActiveTab('session');
    setIncomingCall(null);

    try {
      await ensureVoiceSession();
      if (socketRef.current) {
        console.log('[Voice Socket] 📤 Emitting call:accept:', { callId: incomingCall.id, toUserId: incomingCall.caller?.id || incomingCall.fromUserId, fromUserId: currentUser.id });
        socketRef.current.emit('call:accept', {
          callId: incomingCall.id,
          toUserId: incomingCall.caller?.id || incomingCall.fromUserId,
          fromUserId: currentUser.id
        });
      }
      pushToast('Call connected', 'success');
    } catch (error) {
      console.error('[Voice] Error enabling microphone on accept:', error);
      pushToast(error?.name === 'NotAllowedError' ? 'Microphone permission is required' : 'Unable to enable microphone', 'warning');
    }
  }, [currentUser.id, ensureVoiceSession, incomingCall, pushToast]);

  const declineIncomingCall = useCallback(() => {
    if (!incomingCall) return;
    setIncomingCall(null);
    if (socketRef.current) {
      socketRef.current.emit('call:decline', {
        callId: incomingCall.id,
        toUserId: incomingCall.caller?.id || incomingCall.fromUserId,
        fromUserId: currentUser.id
      });
    }
    pushToast('Call declined', 'warning');
  }, [currentUser.id, incomingCall, pushToast]);

  const endSession = useCallback(() => {
    const peerId = callPeerIdRef.current;
    const callId = callIdRef.current;
    document.querySelectorAll('audio[data-voice-call]').forEach((audio) => audio.remove());
    if (peerId && callId && socketRef.current) {
      socketRef.current.emit('call:end', { callId, toUserId: peerId, fromUserId: currentUser.id });
    }
    callPeerIdRef.current = null;
    callIdRef.current = null;
    setOutgoingCall(null);
    setIncomingCall(null);
    setSession(null);
    setActiveTab('staff');
    pushToast('Call ended', 'info');
  }, [currentUser.id, pushToast]);

  const cancelOutgoingCall = useCallback(() => {
    if (callPeerIdRef.current && callIdRef.current && socketRef.current) {
      socketRef.current.emit('call:end', {
        callId: callIdRef.current,
        toUserId: callPeerIdRef.current,
        fromUserId: currentUser.id
      });
    }
    setOutgoingCall(null);
    pushToast('Call cancelled', 'info');
  }, [currentUser.id, pushToast]);

  const startBroadcast = useCallback(() => {
    setBroadcast({
      id: `broadcast-${Date.now()}`,
      status: 'Live',
      participants: [currentUser, ...staffDirectory.filter((staff) => String(staff.id) !== String(currentUser.id)).slice(0, 4)],
      connectedCount: 6,
      isLocked: false,
      isMuted: false
    });
    setActiveTab('general');
    pushToast('Branch broadcast started', 'success');
  }, [currentUser, pushToast, staffDirectory]);

  const endBroadcast = useCallback(() => {
    setBroadcast(null);
    pushToast('Broadcast ended', 'info');
  }, [pushToast]);

  const toggleMute = useCallback(() => {
    setSession((value) => {
      if (!value) return value;
      const nextMuted = !value.isMuted;
      webRtcRef.current?.setMute(nextMuted);
      return { ...value, isMuted: nextMuted };
    });
  }, []);

  const toggleHold = useCallback(() => {
    setSession((value) => {
      if (!value) return value;
      const nextHeld = !value.isHeld;
      document.querySelectorAll('audio[data-voice-call]').forEach((audio) => {
        audio.muted = nextHeld;
      });
      return { ...value, isHeld: nextHeld, status: nextHeld ? 'On hold' : 'Live' };
    });
  }, []);

  const cycleVolume = useCallback(() => {
    setSession((value) => {
      if (!value) return value;
      const levels = [0.35, 0.7, 1];
      const currentIndex = levels.indexOf(value.volume ?? 1);
      const nextIndex = currentIndex === -1 ? 1 : (currentIndex + 1) % levels.length;
      const nextVolume = levels[nextIndex];
      document.querySelectorAll('audio[data-voice-call]').forEach((audio) => {
        audio.volume = nextVolume;
      });
      return { ...value, volume: nextVolume };
    });
  }, []);

  const verifySecurity = useCallback(() => {
    setSession((value) => (value ? { ...value, securityVerified: true } : value));
    pushToast('End-to-end encryption is active', 'success');
  }, [pushToast]);

  const toggleBoost = useCallback(() => {
    setSession((value) => {
      if (!value) return value;
      const nextBoosted = !value.boosted;
      return { ...value, boosted: nextBoosted, quality: nextBoosted ? 'Boosted' : 'Excellent' };
    });
    pushToast('Call boost mode updated', 'success');
  }, [pushToast]);

  const toggleBroadcastMute = useCallback(() => {
    setBroadcast((value) => {
      if (!value) return value;
      const nextMuted = !value.isMuted;
      return { ...value, isMuted: nextMuted };
    });
    pushToast('Broadcast mute updated', 'info');
  }, [pushToast]);

  const toggleBroadcastLock = useCallback(() => {
    setBroadcast((value) => {
      if (!value) return value;
      const nextLocked = !value.isLocked;
      return { ...value, isLocked: nextLocked };
    });
    pushToast('Broadcast lock updated', 'info');
  }, [pushToast]);

  const inviteStaffToBroadcast = useCallback(() => {
    setActiveTab('staff');
    pushToast('Staff invite flow opened', 'info');
  }, [pushToast]);

  const value = useMemo(() => ({
    isOpen,
    setPanelOpen,
    togglePanel,
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
    setCurrentUser,
    isHydrated,
    incomingCall,
    setIncomingCall,
    outgoingCall,
    setOutgoingCall,
    session,
    setSession,
    broadcast,
    setBroadcast,
    toast,
    setToast,
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
  }), [acceptIncomingCall, activeTab, broadcast, cancelOutgoingCall, connectionState, currentUser, cycleVolume, departmentFilter, declineIncomingCall, endBroadcast, endSession, incomingCall, inviteStaffToBroadcast, isOpen, openCall, outgoingCall, pushToast, roleFilter, search, session, setActiveTab, setCurrentUser, setDepartmentFilter, setIncomingCall, setOutgoingCall, setPanelOpen, setRoleFilter, setSearch, setSession, setSortOrder, setToast, sortOrder, staffDirectory, startBroadcast, toggleBoost, toggleBroadcastLock, toggleBroadcastMute, toggleHold, toggleMute, togglePanel, verifySecurity]);

  return (
    <VoiceCommunicationContext.Provider value={value}>
      {children}
    </VoiceCommunicationContext.Provider>
  );
}

export function useVoiceCommunication() {
  const context = useContext(VoiceCommunicationContext);
  if (!context) {
    throw new Error('useVoiceCommunication must be used within a VoiceCommunicationProvider');
  }
  return context;
}
