import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { createWebRTCService } from '../services/webrtcService';

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

  const pushToast = useCallback((message, tone = 'info') => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    setToast({ id: Date.now(), message, tone });
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2200);
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('voice-panel-open', JSON.stringify(isOpen));
      window.localStorage.setItem('voice-panel-tab', activeTab);
      window.localStorage.setItem('voice-current-user', JSON.stringify(currentUser));
    }
  }, [activeTab, currentUser, isOpen]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const socket = io(window.location.origin, { transports: ['websocket', 'polling'], reconnection: true });
    socketRef.current = socket;

    const cleanupWebRtc = () => {
      webRtcRef.current?.cleanup();
      webRtcRef.current = null;
      pendingIceCandidatesRef.current = [];
    };

    const createWebRtc = async () => {
      console.log('[Voice] createWebRtc called, webRtcRef.current:', !!webRtcRef.current);
      if (!webRtcRef.current) {
        const service = createWebRTCService({ debug: true });
        console.log('[Voice] Created WebRTCService instance');
        service.onIceCandidate = (candidate) => {
          if (!callPeerIdRef.current || !callIdRef.current) return;
          console.log('[Voice] Sending ICE candidate', { callId: callIdRef.current, toUserId: callPeerIdRef.current });
          socket.emit('webrtc:icecandidate', {
            callId: callIdRef.current,
            toUserId: callPeerIdRef.current,
            fromUserId: currentUser.id,
            candidate
          });
        };
        service.onStateChange = (state) => {
          console.log('[Voice] Connection state:', state);
          if (state === 'failed' || state === 'disconnected') {
            pushToast('Voice connection interrupted', 'warning');
          } else if (state === 'connected' || state === 'completed') {
            console.log('[Voice] ✅ Peer connection established!');
            pushToast('Voice connection established', 'success');
          }
        };
        service.onRemoteStream = (stream) => {
          console.log('[Voice] Remote stream received with tracks:', stream.getAudioTracks().length);
          if (!stream || stream.getAudioTracks().length === 0) {
            console.error('[Voice] ❌ Remote stream has no audio tracks!');
            pushToast('Remote audio stream has no audio tracks', 'warning');
            return;
          }

          const audio = document.createElement('audio');
          audio.autoplay = true;
          audio.setAttribute('playsinline', 'true');
          audio.srcObject = stream;
          audio.dataset.voiceCall = callIdRef.current || '';
          audio.volume = 1.0;
          audio.muted = false;
          audio.crossOrigin = 'anonymous';
          audio.style.position = 'fixed';
          audio.style.left = '-9999px';
          audio.style.width = '1px';
          audio.style.height = '1px';
          document.body.appendChild(audio);

          console.log('[Voice] Audio element created:', {
            autoplay: audio.autoplay,
            muted: audio.muted,
            volume: audio.volume,
            tracks: stream.getAudioTracks().map((t) => ({ label: t.label, enabled: t.enabled, readyState: t.readyState }))
          });

          if (typeof window !== 'undefined') {
            window.voiceComm = window.voiceComm || {};
            window.voiceComm.remoteAudio = audio;
          }

          const tryPlayAudio = async () => {
            try {
              const playPromise = audio.play();
              if (playPromise !== undefined) {
                await playPromise;
              }
              console.log('[Voice] ✅ Remote audio playing successfully');
              pushToast('Audio connected', 'success');
            } catch (e) {
              console.error('[Voice] ❌ Audio play failed:', e.name, e.message, { muted: audio.muted });
              if (!audio.muted) {
                audio.muted = true;
                console.log('[Voice] Retrying playback muted to satisfy autoplay policy');
                try {
                  await audio.play();
                  console.log('[Voice] ✅ Remote audio playing muted successfully');
                  pushToast('Audio connected (muted fallback)', 'success');
                  window.addEventListener('pointerdown', () => {
                    audio.muted = false;
                    audio.play().catch(() => {});
                  }, { once: true });
                  return;
                } catch (mutedError) {
                  console.error('[Voice] Still cannot play muted:', mutedError?.name, mutedError?.message);
                }
              }

              const retry = () => {
                audio.play().catch((retryError) => {
                  console.error('[Voice] Still cannot play after retry:', retryError?.name, retryError?.message);
                });
              };

              window.addEventListener('pointerdown', retry, { once: true });
              window.setTimeout(retry, 1000);
              pushToast(`Audio: ${e.message}`, 'warning');
            }
          };

          audio.addEventListener('loadedmetadata', tryPlayAudio, { once: true });
          audio.addEventListener('canplay', tryPlayAudio, { once: true });
          audio.addEventListener('canplaythrough', tryPlayAudio, { once: true });
          requestAnimationFrame(tryPlayAudio);
        };
        webRtcRef.current = service;
        console.log('[Voice] WebRTCService assigned to webRtcRef');
      }
      const service = webRtcRef.current;
      if (!service.localStream) {
        console.log('[Voice] Acquiring microphone...');
        await service.acquireMicrophone({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          video: false
        });
        console.log('[Voice] ✅ Microphone acquired with', service.localStream.getAudioTracks().length, 'audio tracks');
      } else {
        console.log('[Voice] Microphone already acquired');
      }
      if (!service.peerConnection) {
        console.log('[Voice] Creating peer connection...');
        service.createPeerConnection();
        console.log('[Voice] ✅ Peer connection created');
      } else {
        console.log('[Voice] Peer connection already exists');
      }
      console.log('[Voice] createWebRtc returning service');
      return service;
    };

    const registerPresence = () => {
      if (!currentUser.id) return;
      socket.emit('agent:register', {
        userId: currentUser.id,
        name: currentUser.name,
        role: currentUser.role,
        department: currentUser.department,
        branch: currentUser.branch,
        avatar: currentUser.avatar,
        status: 'online'
      });
      socket.emit('voice:register', {
        userId: currentUser.id,
        name: currentUser.name,
        role: currentUser.role,
        department: currentUser.department,
        branch: currentUser.branch,
        avatar: currentUser.avatar,
        status: 'online'
      });
    };

    socket.on('connect', () => {
      setConnectionState('online');
      registerPresence();
    });

    socket.on('connect_error', () => {
      setConnectionState('reconnecting');
    });

    socket.on('presenceUpdate', (payload) => {
      const onlineById = new Map((Array.isArray(payload) ? payload : []).map((entry) => [String(entry.userId), entry]));
      setStaffDirectory((previous) => {
        const next = previous.map((staff) => {
          const presence = onlineById.get(String(staff.id));
          if (!presence) {
            return { ...staff, online: false, status: 'offline', availability: 'Offline' };
          }
          const status = presence.status === 'busy' ? 'busy' : presence.status === 'away' ? 'away' : 'available';
          return { ...staff, online: true, status, availability: status === 'busy' ? 'Busy' : status === 'away' ? 'Away' : 'Available' };
        });
        directoryRef.current = next;
        return next;
      });
      setIsHydrated(true);
    });

    socket.on('call:incoming', (payload) => {
      console.log('[Voice Socket] 📞 call:incoming received:', payload);
      setIncomingCall(payload);
      pushToast(`${payload?.caller?.name || 'Staff'} is calling`, 'info');
    });

    socket.on('call:accepted', (payload) => {
      console.log('[Voice Socket] ✅ call:accepted received:', payload);
      setSession({
        id: payload.callId,
        caller: payload.caller || currentUser,
        peer: payload.peer || currentUser,
        startedAt: Date.now(),
        duration: 0,
        quality: 'Excellent'
      });
      setActiveTab('session');
      setOutgoingCall(null);
      pushToast('Call accepted', 'success');

      const establishCallerMedia = async () => {
        try {
          console.log('[Voice] Establishing caller media (caller side)...');
          const service = await createWebRtc();
          console.log('[Voice] ✅ Microphone acquired, creating offer...');
          const offer = await service.createOffer();
          console.log('[Voice] 📤 Sending offer:', { callId: payload.callId, hasAudio: offer.sdp?.includes('m=audio') });
          socket.emit('webrtc:offer', {
            callId: payload.callId || callIdRef.current,
            toUserId: payload.fromUserId || callPeerIdRef.current,
            fromUserId: currentUser.id,
            offer
          });
        } catch (error) {
          console.error('[Voice] Error establishing caller media:', error);
          cleanupWebRtc();
          pushToast(error?.name === 'NotAllowedError' ? 'Microphone permission is required' : 'Unable to start voice audio', 'warning');
        }
      };
      establishCallerMedia();
    });

    socket.on('webrtc:offer', async (payload) => {
      if (!payload?.offer) {
        console.error('[Voice Socket] 📥 webrtc:offer received but payload.offer is missing:', payload);
        return;
      }
      console.log('[Voice Socket] 📥 webrtc:offer received from', payload.fromUserId);
      callIdRef.current = payload.callId || callIdRef.current;
      callPeerIdRef.current = payload.fromUserId || callPeerIdRef.current;
      try {
        console.log('[Voice] Creating peer connection and preparing answer (answerer side)...');
        const service = await createWebRtc();
        console.log('[Voice] ✅ Microphone acquired, creating answer...');
        const answer = await service.createAnswer(payload.offer);
        console.log('[Voice] 📤 Sending answer:', { callId: payload.callId, hasAudio: answer.sdp?.includes('m=audio') });
        await service.addIceCandidates(pendingIceCandidatesRef.current);
        pendingIceCandidatesRef.current = [];
        socket.emit('webrtc:answer', {
          callId: payload.callId,
          toUserId: payload.fromUserId,
          fromUserId: currentUser.id,
          answer
        });
      } catch (error) {
        console.error('[Voice] Error handling offer:', error);
        cleanupWebRtc();
        pushToast(error?.name === 'NotAllowedError' ? 'Microphone permission is required' : 'Unable to answer voice call', 'warning');
      }
    });

    socket.on('webrtc:answer', async (payload) => {
      console.log('[Voice] 📥 Received answer from', payload.fromUserId);
      if (!payload?.answer || !webRtcRef.current) return;
      try {
        console.log('[Voice] Setting remote description with answer...');
        await webRtcRef.current.setRemoteDescription(payload.answer);
        console.log('[Voice] ✅ Answer set, adding pending ICE candidates:', pendingIceCandidatesRef.current.length);
        await webRtcRef.current.addIceCandidates(pendingIceCandidatesRef.current);
        pendingIceCandidatesRef.current = [];
      } catch (error) {
        console.error('[Voice] Error handling answer:', error);
        pushToast('Unable to complete voice connection', 'warning');
      }
    });

    socket.on('webrtc:icecandidate', async (payload) => {
      if (!payload?.candidate) return;
      console.log('[Voice] 📥 Received ICE candidate, remote description set?', !!webRtcRef.current?.peerConnection?.remoteDescription);
      if (webRtcRef.current?.peerConnection?.remoteDescription) {
        console.log('[Voice] Adding ICE candidate immediately...');
        await webRtcRef.current.addIceCandidate(payload.candidate);
      } else {
        console.log('[Voice] Buffering ICE candidate (remote description not yet set)');
        pendingIceCandidatesRef.current.push(payload.candidate);
      }
    });

    socket.on('call:declined', () => {
      setOutgoingCall(null);
      cleanupWebRtc();
      pushToast('Call declined', 'warning');
    });

    socket.on('call:ended', () => {
      cleanupWebRtc();
      setOutgoingCall(null);
      setIncomingCall(null);
      setSession(null);
      pushToast('Call ended', 'info');
    });

    socket.on('call:error', (payload) => {
      if (payload?.message) {
        pushToast(payload.message, 'warning');
      }
    });

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

        const me = mapped.find((entry) => String(entry.id) === String(authenticatedUser?.id || currentUser.id));
        if (!me && (authenticatedUser?.id || currentUser.id)) {
          mapped.unshift({
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

        const primaryDirectory = mapped.length > 0 ? mapped : [];
        directoryRef.current = primaryDirectory;
        setStaffDirectory(primaryDirectory);
        setIsHydrated(true);
      } catch (error) {
        console.warn('Unable to hydrate voice staff directory', error);
        const fallback = [];
        directoryRef.current = fallback;
        setStaffDirectory(fallback);
        setIsHydrated(true);
      }
    };

    hydrateDirectory();

    return () => {
      cleanupWebRtc();
      document.querySelectorAll('audio[data-voice-call]').forEach((audio) => audio.remove());
      socket.disconnect();
      socketRef.current = null;
    };
  }, [currentUser.avatar, currentUser.branch, currentUser.department, currentUser.id, currentUser.name, currentUser.role, pushToast]);

  const setPanelOpen = useCallback((value) => setIsOpen(value), []);

  const togglePanel = useCallback(() => setIsOpen((value) => !value), []);

  const openCall = useCallback((staff) => {
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
      status: 'Calling…',
      startedAt: Date.now()
    });
    setActiveTab('session');
    if (socketRef.current) {
      console.log('[Voice Socket] 📤 Emitting call:start:', { recipientId: staff.id, callId, caller: currentUser });
      socketRef.current.emit('call:start', {
        recipientId: staff.id,
        callId,
        caller: currentUser,
        offer: null
      });
    } else {
      console.error('[Voice] Socket not connected!');
    }
    pushToast(`Calling ${staff.name}`, 'info');
  }, [currentUser, pushToast]);

  const acceptIncomingCall = useCallback(() => {
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
      quality: 'Excellent'
    });
    setActiveTab('session');
    setIncomingCall(null);
    if (socketRef.current) {
      console.log('[Voice Socket] 📤 Emitting call:accept:', { callId: incomingCall.id, toUserId: incomingCall.caller?.id || incomingCall.fromUserId, fromUserId: currentUser.id });
      socketRef.current.emit('call:accept', {
        callId: incomingCall.id,
        toUserId: incomingCall.caller?.id || incomingCall.fromUserId,
        fromUserId: currentUser.id
      });
    }
    pushToast('Call connected', 'success');
  }, [currentUser.id, incomingCall, pushToast]);

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
    if (peerId && callId && socketRef.current) {
      socketRef.current.emit('call:end', { callId, toUserId: peerId, fromUserId: currentUser.id });
    }
    webRtcRef.current?.cleanup();
    webRtcRef.current = null;
    document.querySelectorAll('audio[data-voice-call]').forEach((audio) => audio.remove());
    callPeerIdRef.current = null;
    callIdRef.current = null;
    setOutgoingCall(null);
    setIncomingCall(null);
    setSession(null);
    pushToast('Call ended', 'info');
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
    toggleMute
  }), [activeTab, acceptIncomingCall, broadcast, connectionState, currentUser, departmentFilter, declineIncomingCall, endBroadcast, endSession, incomingCall, isOpen, openCall, outgoingCall, pushToast, roleFilter, search, session, setActiveTab, setCurrentUser, setDepartmentFilter, setIncomingCall, setOutgoingCall, setPanelOpen, setRoleFilter, setSearch, setSession, setSortOrder, setToast, sortOrder, startBroadcast, toggleMute, staffDirectory, togglePanel]);

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
