import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useVoiceSocket } from '../hooks/useVoiceSocket';
import '../voice.css';

const VoiceIcon = ({ name, className = '' }) => {
  const commonProps = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '1.8',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    className: `voice-icon ${className}`.trim(),
    'aria-hidden': 'true',
  };

  switch (name) {
    case 'mic':
      return (
        <svg {...commonProps}>
          <path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Z" />
          <path d="M19 11a7 7 0 0 1-14 0" />
          <path d="M12 19v3" />
          <path d="M9 22h6" />
        </svg>
      );
    case 'mic-off':
      return (
        <svg {...commonProps}>
          <path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Z" />
          <path d="M19 11a7 7 0 0 1-14 0" />
          <path d="M12 19v3" />
          <path d="M9 22h6" />
          <path d="m4 4 16 16" />
        </svg>
      );
    case 'phone':
      return (
        <svg {...commonProps}>
          <path d="M8 5h3a2 2 0 0 1 2 2v1a1 1 0 0 1-.3.7l-1.4 1.4a1 1 0 0 0-.3.7v2.2a1 1 0 0 0 .3.7l1.4 1.4a1 1 0 0 1 .3.7v1a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />
          <path d="M16 8h3" />
          <path d="M16 12h3" />
          <path d="M16 16h3" />
        </svg>
      );
    case 'phone-off':
      return (
        <svg {...commonProps}>
          <path d="M8 5h3a2 2 0 0 1 2 2v1a1 1 0 0 1-.3.7l-1.4 1.4a1 1 0 0 0-.3.7v2.2a1 1 0 0 0 .3.7l1.4 1.4a1 1 0 0 1 .3.7v1a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />
          <path d="M16 8h3" />
          <path d="M16 12h3" />
          <path d="M16 16h3" />
          <path d="m4 4 16 16" />
        </svg>
      );
    case 'user-plus':
      return (
        <svg {...commonProps}>
          <path d="M16 19a4 4 0 0 0-8 0" />
          <circle cx="12" cy="9" r="3" />
          <path d="M20 8v4" />
          <path d="M22 10h-4" />
        </svg>
      );
    case 'log-in':
      return (
        <svg {...commonProps}>
          <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
          <path d="m10 17 5-5-5-5" />
          <path d="M15 12H3" />
        </svg>
      );
    case 'log-out':
      return (
        <svg {...commonProps}>
          <path d="M9 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4" />
          <path d="m16 17 5-5-5-5" />
          <path d="M21 12H9" />
        </svg>
      );
    case 'radio':
      return (
        <svg {...commonProps}>
          <path d="M16 8.5a6 6 0 0 1 0 7" />
          <path d="M12 10.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Z" />
          <path d="M8 8.5a8.5 8.5 0 0 1 0 7" />
          <path d="M4 6.5a11.5 11.5 0 0 1 0 11" />
        </svg>
      );
    case 'shield':
      return (
        <svg {...commonProps}>
          <path d="M12 3 5 6v6c0 5 3.5 8 7 9 3.5-1 7-4 7-9V6l-7-3Z" />
        </svg>
      );
    case 'shield-off':
      return (
        <svg {...commonProps}>
          <path d="M5 6v6c0 5 3.5 8 7 9 1.4-.4 2.7-1.1 3.8-2.2" />
          <path d="M9.3 3.8 12 3l7 3v6c0 2-1 3.8-2.7 5.1" />
          <path d="m4 4 16 16" />
        </svg>
      );
    case 'volume-2':
      return (
        <svg {...commonProps}>
          <path d="M11 5 7 9H4v6h3l4 4V5Z" />
          <path d="M15.5 8.5a5 5 0 0 1 0 7" />
          <path d="M17.7 6.3a8 8 0 0 1 0 11.4" />
        </svg>
      );
    case 'volume-x':
      return (
        <svg {...commonProps}>
          <path d="M11 5 7 9H4v6h3l4 4V5Z" />
          <path d="m15 9 6 6" />
          <path d="m21 9-6 6" />
        </svg>
      );
    case 'check':
      return (
        <svg {...commonProps}>
          <path d="m5 12 4 4 10-10" />
        </svg>
      );
    case 'x':
      return (
        <svg {...commonProps}>
          <path d="M6 6l12 12" />
          <path d="M18 6 6 18" />
        </svg>
      );
    case 'users':
      return (
        <svg {...commonProps}>
          <path d="M16 19a4 4 0 0 0-8 0" />
          <circle cx="12" cy="9" r="3" />
          <path d="M20 19a3 3 0 0 0-2-3" />
          <path d="M4 19a3 3 0 0 1 2-3" />
        </svg>
      );
    case 'headphones':
      return (
        <svg {...commonProps}>
          <path d="M4 12a8 8 0 1 1 16 0" />
          <path d="M4 12v3a2 2 0 0 0 2 2h1v-5H6a2 2 0 0 0-2 2Z" />
          <path d="M20 12v3a2 2 0 0 1-2 2h-1v-5h1a2 2 0 0 1 2 2Z" />
        </svg>
      );
    default:
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="12" r="8" />
        </svg>
      );
  }
};

const ButtonContent = ({ icon, label }) => (
  <span className="voice-btn-content">
    <span className="voice-btn-icon" aria-hidden="true">
      <VoiceIcon name={icon} />
    </span>
    <span className="voice-btn-label">{label}</span>
  </span>
);

const VoicePanel = () => {
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('staff');
  const [user, setUser] = useState(null);
  const [staff, setStaff] = useState([]);
  const [channels, setChannels] = useState([]);
  const [currentSession, setCurrentSession] = useState(null);
  const [currentChannelId, setCurrentChannelId] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [noiseSuppressionEnabled, setNoiseSuppressionEnabled] = useState(true);
  const [sessionDuration, setSessionDuration] = useState(0);
  const [incomingCall, setIncomingCall] = useState(null);
  const [toasts, setToasts] = useState([]);

  const stateRef = useRef({
    user: null,
    socket: null,
    rawLocalStream: null,
    localStream: null,
    processedLocalStream: null,
    noiseAudioContext: null,
    peers: {},
    isMuted: false,
    isDeafened: false,
    noiseSuppressionEnabled: true,
    callStartedAt: null,
    audioElements: {},
    pttSession: null,
  });

  const timerIntervalRef = useRef(null);

  // Custom socket initialization
  const socket = useVoiceSocket(user, {
    onPresenceUpdate: setStaff,
    onChannelsUpdate: setChannels,
    onPrivateIncoming: handlePrivateIncoming,
    onPrivateAccepted: handlePrivateAccepted,
    onPrivateStarted: handlePrivateStarted,
    onPrivateError: handlePrivateError,
    onSignal: handleSignal,
    onSessionEnded: handleSessionEnded,
    onBroadcastIncoming: handleBroadcastIncoming,
    onBroadcastJoinRequest: handleBroadcastJoinRequest,
    onChannelJoined: handleChannelJoined,
    onChannelMemberUpdate: handleChannelMemberUpdate,
    onChannelMemberLeft: handleChannelMemberLeft,
    onChannelSignal: handleChannelSignal,
    onPrivateRejected: handlePrivateRejected,
    onPTTStart: handlePTTIncoming,
    onPTTEnd: handlePTTEnd,
  });

  useEffect(() => {
    async function loadCurrentUser() {
      try {
        if (typeof window.getCurrentUser === 'function') {
          const u = await window.getCurrentUser();
          if (u) {
            setUser(u);
            stateRef.current.user = u;
            return;
          }
        }

        const res = await fetch('/api/user', { credentials: 'same-origin' });
        if (!res.ok) {
          console.warn('VoicePanel: no current user from /api/user');
          return;
        }
        const u = await res.json();
        if (u) {
          setUser(u);
          stateRef.current.user = u;
          window.currentUser = u;
        }
      } catch (err) {
        console.error('VoicePanel: failed to load current user', err);
      }
    }

    loadCurrentUser();
  }, []);

  const showToast = useCallback((message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3800);
  }, []);

  const showIncomingNotification = useCallback(({ title, message, acceptLabel, rejectLabel, onAccept, onReject, caller }) => {
    setIncomingCall({ title, message, acceptLabel, rejectLabel, onAccept, onReject, caller });
  }, []);

  const clearIncomingNotification = useCallback(() => {
    setIncomingCall(null);
  }, []);

  const waitForVoiceRegistration = useCallback(async () => {
    if (!socket?.waitForVoiceRegistration) return;
    try {
      const response = await socket.waitForVoiceRegistration();
      if (response?.ok === false) {
        console.warn('Voice registration not acknowledged yet', response);
      }
    } catch (err) {
      console.warn('Voice registration wait failed', err);
    }
  }, [socket]);

  const getLocalStream = useCallback(async (forceNew = false) => {
    const state = stateRef.current;
    if (!state.rawLocalStream || forceNew) {
      if (state.rawLocalStream) {
        console.log('🛑 Stopping existing raw audio tracks...');
        state.rawLocalStream.getTracks().forEach(track => track.stop());
        state.rawLocalStream = null;
      }
      try {
        console.log('🎤 Requesting microphone access...');
        const rawStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            noiseSuppression: true,
            echoCancellation: true,
            autoGainControl: true
          }
        });
        console.log('✅ Microphone granted, audio tracks:', rawStream.getAudioTracks().length);
        state.rawLocalStream = rawStream;
      } catch (err) {
        console.error('❌ getUserMedia failed:', err);
        showToast(`Microphone permission required for voice chat. Error: ${err.name}`, 'warning');
        throw err;
      }
    }

    const stream = selectLocalStreamSource();
    if (!stream) {
      console.error('⚠️ selectLocalStreamSource returned null');
      return null;
    }
    console.log(`📤 Local stream ready with ${stream.getAudioTracks().length} audio tracks`);
    stream?.getAudioTracks().forEach((track, idx) => {
      console.log(`  Track ${idx}: enabled=${track.enabled}, state=${track.readyState}`);
      track.enabled = !state.isMuted;
    });
    if (forceNew) {
      replaceLocalAudioTrack(stream);
    }
    return stream;
  }, [showToast]);

  const selectLocalStreamSource = useCallback(() => {
    const state = stateRef.current;
    if (!state.rawLocalStream) return null;

    if (state.noiseSuppressionEnabled) {
      if (!state.processedLocalStream) {
        state.processedLocalStream = createNoiseProcessedStream(state.rawLocalStream);
      }
      state.localStream = state.processedLocalStream;
    } else {
      cleanupNoiseProcessing();
      state.localStream = state.rawLocalStream;
    }
    return state.localStream;
  }, []);

  const createNoiseProcessedStream = useCallback((rawStream) => {
    const state = stateRef.current;
    if (!window.AudioContext || !rawStream) return rawStream;
    cleanupNoiseProcessing();

    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(rawStream);

    const highpass = audioContext.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 100;
    highpass.Q.value = 0.7;

    const lowpass = audioContext.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 8000;
    lowpass.Q.value = 0.7;

    const compressor = audioContext.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-30, audioContext.currentTime);
    compressor.knee.setValueAtTime(10, audioContext.currentTime);
    compressor.ratio.setValueAtTime(4, audioContext.currentTime);
    compressor.attack.setValueAtTime(0.008, audioContext.currentTime);
    compressor.release.setValueAtTime(0.2, audioContext.currentTime);

    const gateGain = audioContext.createGain();
    gateGain.gain.value = 0.1;
    const destination = audioContext.createMediaStreamDestination();

    source.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(compressor);
    compressor.connect(gateGain);
    gateGain.connect(destination);

    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    lowpass.connect(analyser);

    const data = new Float32Array(analyser.fftSize);
    let smoothedGain = 0.1;
    const threshold = 0.003;
    const openGain = 1;
    const closedGain = 0.5;

    function processGate() {
      analyser.getFloatTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i += 1) {
        sum += data[i] * data[i];
      }
      const rms = Math.sqrt(sum / data.length);
      const targetGain = rms > threshold ? openGain : closedGain;
      const smoothing = rms > threshold ? 0.15 : 0.08;
      smoothedGain += (targetGain - smoothedGain) * smoothing;
      gateGain.gain.setTargetAtTime(smoothedGain, audioContext.currentTime, 0.01);
      if (state.noiseAudioContext === audioContext) {
        requestAnimationFrame(processGate);
      }
    }
    processGate();

    state.noiseAudioContext = audioContext;
    return destination.stream;
  }, []);

  const cleanupNoiseProcessing = useCallback(() => {
    const state = stateRef.current;
    if (state.noiseAudioContext) {
      state.noiseAudioContext.close().catch(() => {});
      state.noiseAudioContext = null;
    }
    if (state.processedLocalStream) {
      state.processedLocalStream.getTracks().forEach(track => track.stop());
      state.processedLocalStream = null;
    }
  }, []);

  const replaceLocalAudioTrack = useCallback((stream) => {
    const state = stateRef.current;
    const newTrack = stream?.getAudioTracks()[0];
    if (!newTrack) return;
    Object.values(state.peers).forEach(peer => {
      const pc = peer.pc;
      if (!pc) return;
      const sender = pc.getSenders().find(s => s.track && s.track.kind === 'audio');
      if (sender) {
        sender.replaceTrack(newTrack).catch(err => console.warn('Failed to replace local audio track', err));
      } else {
        pc.addTrack(newTrack, stream);
      }
    });
  }, []);

  const cleanupPeer = useCallback((userId) => {
    const state = stateRef.current;
    const peer = state.peers[userId];
    if (!peer) return;
    if (peer.pc) {
      peer.pc.close();
    }
    if (peer.audio) {
      peer.audio.pause();
      peer.audio.remove();
    }
    delete state.peers[userId];
  }, []);

  const createPeerConnection = useCallback((targetUserId, sessionId, onTrack) => {
    const state = stateRef.current;
    const ICE_CONFIG = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
    const pc = new RTCPeerConnection(ICE_CONFIG);
    console.log(`🔊 Creating peer connection for user ${targetUserId}, session ${sessionId}`);
    
    pc.onicecandidate = event => {
      if (event.candidate && socket) {
        console.log(`📡 ICE candidate for ${targetUserId}:`, event.candidate.candidate);
        socket.emit('voice:signal', {
          targetUserId,
          sessionId,
          signal: { candidate: event.candidate },
          type: 'ice'
        });
      }
    };
    
    pc.ontrack = event => {
      console.log(`🎵 ontrack event received from ${targetUserId}:`, event);
      if (typeof onTrack === 'function') {
        onTrack(event);
      } else {
        console.warn(`No onTrack handler provided for ${targetUserId}`);
      }
    };
    
    pc.onconnectionstatechange = () => {
      console.log(`🔗 Connection state change for ${targetUserId}: ${pc.connectionState}`);
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected' || pc.connectionState === 'closed') {
        console.warn(`Cleaning up peer ${targetUserId} due to connection state: ${pc.connectionState}`);
        cleanupPeer(targetUserId);
      }
    };
    
    if (state.localStream && !state.isDeafened) {
      console.log(`🗣️ Adding local audio tracks for ${targetUserId}`);
      state.localStream.getAudioTracks().forEach((track, idx) => {
        console.log(`  Track ${idx}: enabled=${track.enabled}, kind=${track.kind}, state=${track.readyState}`);
        pc.addTrack(track, state.localStream);
      });
    } else {
      console.warn(`⚠️ No local stream available for ${targetUserId} (isDeafened=${state.isDeafened})`);
    }
    return pc;
  }, [socket, cleanupPeer]);

  const attachRemoteAudio = useCallback((event, userId, meta) => {
    const state = stateRef.current;
    const stream = event.streams && event.streams[0];
    if (!stream) {
      console.warn(`❌ No remote stream in ontrack event for user ${userId}`);
      return;
    }
    console.log(`🔗 Attaching remote audio for user ${userId}:`, stream);
    let audio = state.audioElements[userId];
    if (!audio) {
      console.log(`📻 Creating new audio element for ${userId}`);
      audio = document.createElement('audio');
      audio.id = `remote-audio-${userId}`;
      audio.autoplay = true;
      audio.playsInline = true;
      audio.muted = state.isDeafened;
      try {
        audio.srcObject = stream;
        document.body.appendChild(audio);
        state.audioElements[userId] = audio;
        console.log(`✅ Audio element created and appended: ${audio.id}`);
        audio.play().catch(err => console.warn(`Play error for ${userId}:`, err));
      } catch (err) {
        console.error(`Failed to set up audio element for ${userId}:`, err);
      }
    } else {
      console.log(`🔄 Updating existing audio element for ${userId}`);
      try {
        audio.srcObject = stream;
        audio.play().catch(err => console.warn(`Play error on update for ${userId}:`, err));
      } catch (err) {
        console.error(`Failed to update audio for ${userId}:`, err);
      }
    }
    if (state.isDeafened) audio.muted = true;
  }, []);

  function handlePrivateStarted(payload) {
    if (!payload?.sessionId || !payload?.peer) return;
    console.log('✅ Private call session started with peer:', payload.peer.name);
    setCurrentSession(prev => prev?.id === payload.sessionId
      ? { ...prev, peer: payload.peer, status: 'active' }
      : { id: payload.sessionId, type: 'private', peer: payload.peer, status: 'active' });
  }

  function handlePrivateError(payload) {
    console.warn('Voice private call error:', payload);
    showToast(payload?.message || 'Voice call could not be established', 'warning');
    setCurrentSession(null);
  }

  // Socket event handlers
  function handlePrivateIncoming(payload) {
    if (!payload?.sessionId || !payload?.from) return;
    showIncomingNotification({
      title: `${payload.from.name} is calling`,
      message: 'Incoming private voice call',
      acceptLabel: 'Accept',
      rejectLabel: 'Decline',
      caller: payload.from,
      onAccept: () => {
        setIncomingCall(null);
        setCurrentSession({ id: payload.sessionId, type: 'private', peer: payload.from, status: 'incoming' });
        getLocalStream().then(async () => {
          await waitForVoiceRegistration();
          socket?.emit('voice:private:response', {
            sessionId: payload.sessionId,
            accepted: true,
            responder: {
              userId: user?.id,
              name: user?.name || user?.displayName || 'Staff',
              role: user?.role || 'agent'
            }
          });
        }).catch(async () => {
          await waitForVoiceRegistration();
          socket?.emit('voice:private:response', { sessionId: payload.sessionId, accepted: false });
        });
      },
      onReject: async () => {
        setIncomingCall(null);
        await waitForVoiceRegistration();
        socket?.emit('voice:private:response', { sessionId: payload.sessionId, accepted: false });
      }
    });
  }

  function handlePrivateAccepted(payload) {
    if (!payload?.sessionId || !payload?.peer) return;
    console.log('✅ Call accepted, setting up peer connection for:', payload.peer.name);
    setCurrentSession({ id: payload.sessionId, type: 'private', peer: payload.peer, status: 'active' });
    getLocalStream().then(async () => {
      try {
        await waitForVoiceRegistration();
        const targetId = payload.peer.userId;
        console.log(`📞 Creating offer for ${targetId}...`);
        const pc = createPeerConnection(targetId, payload.sessionId, (event) => attachRemoteAudio(event, targetId, payload.peer));
        stateRef.current.peers[targetId] = { pc, meta: payload.peer, audio: null };
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        console.log(`📤 Sending offer to ${targetId}`);
        socket?.emit('voice:signal', { targetUserId: targetId, sessionId: payload.sessionId, signal: offer, type: 'offer' });
        markSessionStarted();
      } catch (err) {
        console.error('Error in handlePrivateAccepted:', err);
        showToast('Failed to establish voice connection', 'error');
      }
    }).catch((err) => {
      console.error('Failed to get local stream:', err);
      showToast('Microphone access denied', 'error');
    });
  }

  async function handleSignal(payload) {
    if (!payload?.sessionId || !payload?.fromUserId || !payload?.signal) return;
    const fromId = payload.fromUserId;
    console.log(`📡 Received signal from ${fromId}:`, payload.signal.type);
    const peerMeta = (stateRef.current.peers[fromId]?.meta) || { userId: fromId, name: 'Peer' };
    let peerConnection = stateRef.current.peers[fromId]?.pc;
    const createAudioTrack = event => attachRemoteAudio(event, fromId, peerMeta);
    
    if (!peerConnection) {
      console.log(`Creating peer connection for incoming signal from ${fromId}`);
      peerConnection = createPeerConnection(fromId, payload.sessionId, createAudioTrack);
      stateRef.current.peers[fromId] = { pc: peerConnection, meta: peerMeta, audio: null };
    }

    if (payload.signal.type === 'offer') {
      console.log(`📥 Setting remote offer from ${fromId}`);
      await peerConnection.setRemoteDescription(new RTCSessionDescription(payload.signal));
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      console.log(`📤 Sending answer to ${fromId}`);
      await waitForVoiceRegistration();
      socket?.emit('voice:signal', { targetUserId: fromId, sessionId: payload.sessionId, signal: answer, type: 'answer' });
      markSessionStarted();
    } else if (payload.signal.type === 'answer') {
      console.log(`📥 Setting remote answer from ${fromId}`);
      await peerConnection.setRemoteDescription(new RTCSessionDescription(payload.signal));
      markSessionStarted();
    } else if (payload.signal.candidate) {
      try {
        console.log(`❄️ Adding ICE candidate from ${fromId}`);
        await peerConnection.addIceCandidate(new RTCIceCandidate(payload.signal.candidate));
      } catch (err) {
        console.warn('Failed to add ICE candidate', err);
      }
    }
  }

  function handleSessionEnded() {
    showToast('Voice session ended', 'info');
    setCurrentSession(null);
    Object.keys(stateRef.current.peers).forEach(cleanupPeer);
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    setSessionDuration(0);
  }

  function handleBroadcastIncoming(payload) {
    if (!payload?.sessionId || !payload?.from) return;
    showIncomingNotification({
      title: `${payload.from.name} started a broadcast`,
      message: 'Join the broadcast now?',
      acceptLabel: 'Join',
      rejectLabel: 'Ignore',
      caller: payload.from,
      onAccept: () => {
        setIncomingCall(null);
        setCurrentSession({ id: payload.sessionId, type: 'broadcast', status: 'joining', peer: payload.from });
        getLocalStream().then(() => {
          socket?.emit('voice:broadcast:join', { sessionId: payload.sessionId });
        }).catch(() => {});
      },
      onReject: () => {
        setIncomingCall(null);
        showToast('Broadcast ignored', 'warning');
      }
    });
  }

  function handleBroadcastJoinRequest(payload) {
    if (!payload?.sessionId || !payload?.user) return;
    const user = payload.user;
    if (!currentSession || currentSession.id !== payload.sessionId) return;
    getLocalStream().then(async () => {
      const targetId = user.userId;
      const pc = createPeerConnection(targetId, payload.sessionId, (event) => attachRemoteAudio(event, targetId, user));
      stateRef.current.peers[targetId] = { pc, meta: user, audio: null };
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket?.emit('voice:signal', { targetUserId: targetId, sessionId: payload.sessionId, signal: offer, type: 'offer' });
    }).catch(() => {});
  }

  function handleChannelJoined(payload) {
    if (!payload?.channel || !Array.isArray(payload.members)) return;
    setCurrentSession({ id: `channel-${payload.channel.id}`, type: 'channel', channel: payload.channel, status: 'joined' });
    setCurrentChannelId(payload.channel.id);
    stateRef.current.peers = {};
    payload.members.forEach(member => {
      if (String(member.userId) === String(user?.id)) return;
      stateRef.current.peers[member.userId] = { meta: member, pc: null, audio: null };
    });
  }

  function handleChannelMemberUpdate(payload) {
    if (!payload?.channelId || !payload?.user) return;
    if (!currentChannelId || Number(currentChannelId) !== Number(payload.channelId)) return;
    const member = payload.user;
    stateRef.current.peers[member.userId] = { meta: member, pc: null, audio: null };
  }

  function handleChannelMemberLeft(payload) {
    if (!payload?.channelId || !payload?.userId) return;
    if (!currentChannelId || Number(currentChannelId) !== Number(payload.channelId)) return;
    cleanupPeer(payload.userId);
  }

  function handleChannelSignal(payload) {
    if (!payload?.channelId || !payload?.fromUserId || !payload?.signal) return;
    const fromId = payload.fromUserId;
    let peer = stateRef.current.peers[fromId];
    const createAudioTrack = event => attachRemoteAudio(event, fromId, peer?.meta || { userId: fromId, name: 'Peer' });
    if (!peer) {
      peer = { meta: { userId: fromId, name: 'Peer' }, pc: null, audio: null };
      stateRef.current.peers[fromId] = peer;
    }
    if (!peer.pc) {
      peer.pc = createPeerConnection(fromId, `channel-${payload.channelId}`, createAudioTrack);
    }
    const pc = peer.pc;
    if (payload.signal.type === 'offer') {
      pc.setRemoteDescription(new RTCSessionDescription(payload.signal)).then(() => pc.createAnswer())
        .then(answer => pc.setLocalDescription(answer))
        .then(() => {
          socket?.emit('voice:channel:signal', { targetUserId: fromId, channelId: payload.channelId, signal: pc.localDescription });
        }).catch(err => console.warn('Channel answer failed', err));
    } else if (payload.signal.type === 'answer') {
      pc.setRemoteDescription(new RTCSessionDescription(payload.signal)).catch(err => console.warn('Channel answer set failed', err));
    } else if (payload.signal.candidate) {
      pc.addIceCandidate(new RTCIceCandidate(payload.signal.candidate)).catch(err => console.warn('Channel ICE failed', err));
    }
  }

  function handlePrivateRejected() {
    showToast('Call rejected', 'warning');
    setCurrentSession(null);
  }

  function handlePTTIncoming(payload) {
    if (!payload?.sessionId || !payload?.fromUserId) return;
    const fromId = payload.fromUserId;
    const sender = staff.find(s => s.userId === fromId);
    const senderName = sender?.name || 'Staff Member';
    showToast(`🎤 ${senderName} is transmitting...`, 'info');
  }

  function handlePTTEnd(payload) {
    if (!payload?.fromUserId) return;
    const fromId = payload.fromUserId;
    const sender = staff.find(s => s.userId === fromId);
    const senderName = sender?.name || 'Staff Member';
    showToast(`🎤 ${senderName} stopped transmitting`, 'info');
    cleanupPeer(String(fromId));
  }

  const markSessionStarted = useCallback(() => {
    stateRef.current.callStartedAt = Date.now();
    if (!timerIntervalRef.current) {
      timerIntervalRef.current = setInterval(() => {
        const duration = (Date.now() - stateRef.current.callStartedAt) / 1000;
        setSessionDuration(duration);
      }, 1000);
    }
  }, []);

  const toggleMute = useCallback(() => {
    stateRef.current.isMuted = !stateRef.current.isMuted;
    setIsMuted(stateRef.current.isMuted);
    if (stateRef.current.localStream) {
      stateRef.current.localStream.getAudioTracks().forEach(track => {
        track.enabled = !stateRef.current.isMuted;
      });
    }
    showToast(stateRef.current.isMuted ? 'Microphone muted' : 'Microphone unmuted');
  }, [showToast]);

  const toggleDeafen = useCallback(() => {
    stateRef.current.isDeafened = !stateRef.current.isDeafened;
    setIsDeafened(stateRef.current.isDeafened);
    Object.values(stateRef.current.audioElements).forEach(audio => {
      audio.muted = stateRef.current.isDeafened;
    });
    showToast(stateRef.current.isDeafened ? 'Audio muted' : 'Audio enabled');
  }, [showToast]);

  const toggleNoiseSuppression = useCallback(() => {
    stateRef.current.noiseSuppressionEnabled = !stateRef.current.noiseSuppressionEnabled;
    setNoiseSuppressionEnabled(stateRef.current.noiseSuppressionEnabled);
    showToast(`Noise suppression ${stateRef.current.noiseSuppressionEnabled ? 'enabled' : 'disabled'}`);
    if (!stateRef.current.rawLocalStream) {
      getLocalStream();
    } else {
      const stream = selectLocalStreamSource();
      if (stream) {
        replaceLocalAudioTrack(stream);
      }
    }
  }, [showToast, getLocalStream, selectLocalStreamSource, replaceLocalAudioTrack]);

  const leaveCurrentSession = useCallback(() => {
    if (!currentSession) return;
    socket?.emit('voice:end', { sessionId: currentSession.id });
    Object.keys(stateRef.current.peers).forEach(cleanupPeer);
    setCurrentSession(null);
    setCurrentChannelId(null);
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    setSessionDuration(0);
  }, [currentSession, socket]);

  const onPrivateCallClick = useCallback(async (targetUser) => {
    if (!user) {
      showToast('Please sign in to start a call.', 'warning');
      return;
    }
    const sessionId = `private-${Date.now()}-${targetUser.userId}`;
    setCurrentSession({ id: sessionId, type: 'private', peer: targetUser, status: 'calling' });
    await waitForVoiceRegistration();
    socket?.emit('voice:private:request', {
      targetUserId: targetUser.userId,
      sessionId,
      caller: {
        userId: user.id,
        name: user.name || user.displayName || 'Staff',
        role: user.role || 'agent'
      }
    });
    showToast(`Calling ${targetUser.name}...`);
  }, [user, socket, showToast, waitForVoiceRegistration]);

  const onStartBroadcast = useCallback(async () => {
    if (!user) {
      showToast('Please sign in to broadcast.', 'warning');
      return;
    }
    const role = (user.role || '').toLowerCase();
    if (!['admin', 'administrator'].includes(role)) {
      showToast('Only admins can start broadcasts.', 'warning');
      return;
    }
    await getLocalStream();
    const sessionId = `broadcast-${Date.now()}`;
    setCurrentSession({ id: sessionId, type: 'broadcast', status: 'active', createdBy: user?.id, peers: {} });
    socket?.emit('voice:broadcast:start', { sessionId });
    showToast('Broadcast starting...');
  }, [user, socket, showToast, getLocalStream]);

  const onChannelToggle = useCallback((channelId, action) => {
    if (action === 'join') {
      if (currentChannelId === channelId) return;
      socket?.emit('voice:channel:join', { channelId });
    } else if (action === 'leave') {
      socket?.emit('voice:channel:leave', { channelId });
    }
  }, [currentChannelId, socket]);

  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  const getStatusLabel = () => {
    if (!currentSession) return 'Not connected';
    if (currentSession.type === 'private') return 'In call';
    if (currentSession.type === 'broadcast') return 'Broadcast active';
    return 'In channel';
  };

  const handleAcceptIncomingCall = useCallback(() => {
    if (!incomingCall) return;
    incomingCall.onAccept?.();
  }, [incomingCall]);

  const handleRejectIncomingCall = useCallback(() => {
    if (!incomingCall) return;
    incomingCall.onReject?.();
  }, [incomingCall]);

  const displayedStaff = staff.filter(item => item.userId !== user?.id);
  const isAdmin = ['admin', 'administrator'].includes((user?.role || '').toLowerCase());
  const isBroadcastActive = currentSession?.type === 'broadcast';

  return (
    <>
      {incomingCall && (
        <div className="voice-incoming-overlay" role="dialog" aria-modal="true">
          <div className="voice-incoming-notification">
            <div className="voice-notification-backdrop"></div>
            <div className="voice-notification-content">
              <div className="voice-notification-avatar">{incomingCall.caller?.name?.charAt(0).toUpperCase() || 'C'}</div>
              <div className="voice-notification-label">Incoming Call</div>
              <div className="voice-notification-caller">{incomingCall.title}</div>
              <div className="voice-notification-description">{incomingCall.message}</div>
              <div className="voice-notification-actions">
                <button className="voice-btn-accept" onClick={handleAcceptIncomingCall}>
                  <ButtonContent icon="check" label={incomingCall.acceptLabel || 'Accept'} />
                </button>
                <button className="voice-btn-reject" onClick={handleRejectIncomingCall}>
                  <ButtonContent icon="x" label={incomingCall.rejectLabel || 'Decline'} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Voice Floating Button */}
      <div className="voice-floating-control">
        <button
          className="voice-floating-button"
          onClick={() => setIsPanelOpen(!isPanelOpen)}
          aria-label="Open voice chat panel"
        >
          🗣
        </button>

        {/* Voice Panel */}
        <div
          className={`voice-widget ${isPanelOpen ? '' : 'closed'}`}
          aria-hidden={isPanelOpen ? 'false' : 'true'}
        >
          <div className="voice-panel-header">
            <div className="voice-phone-sensor">
              <span></span><span></span>
            </div>
            <div>
              <div className="voice-panel-title">Staff Voice</div>
              <div className="voice-panel-subtitle">Office smart dialer</div>
            </div>
            <button
              className="voice-toggle"
              onClick={() => setIsPanelOpen(false)}
              aria-label="Close voice panel"
            >
              <VoiceIcon name="x" />
            </button>
          </div>

          <div className="voice-panel-body">
            <div className="voice-screen-frame">
              <div className="voice-status-row">
                <span id="voiceStatusLabel">{getStatusLabel()}</span>
                <span id="voiceTimer">{formatTimer(sessionDuration)}</span>
              </div>

              {/* Staff Tab */}
              {activeTab === 'staff' && (
                <div className="voice-tab-panel active">
                  {displayedStaff.length === 0 ? (
                    <div className="voice-empty">No other staff online</div>
                  ) : (
                    displayedStaff.map(item => {
                      const isCallActive = currentSession?.type === 'private' && currentSession?.peer?.userId === item.userId;
                      return (
                        <div key={item.userId} className="voice-staff-card">
                          <div className={`voice-avatar ${item.speaking ? 'speaking' : ''}`}>
                            {item.avatarUrl ? (
                              <img src={item.avatarUrl} alt={item.name} />
                            ) : (
                              item.name?.charAt(0).toUpperCase()
                            )}
                          </div>
                          <div className="voice-details">
                            <div className="voice-name">{item.name || 'Staff'}</div>
                            <div className="voice-meta">{item.role || 'Agent'} · {item.status || 'online'}</div>
                          </div>
                          <div className="voice-actions">
                            <button
                              className="voice-btn voice-btn-ptt"
                              title="Push and hold to talk"
                            >
                              <span className="voice-ptt-icon">
                                <VoiceIcon name="mic" />
                              </span>
                              <span className="voice-ptt-wave"></span>
                            </button>
                            <button
                              className={`voice-btn ${isCallActive ? 'voice-btn-danger' : 'voice-btn-secondary'}`}
                              onClick={() => isCallActive ? leaveCurrentSession() : onPrivateCallClick(item)}
                            >
                              <ButtonContent icon={isCallActive ? 'phone-off' : 'phone'} label={isCallActive ? 'Hang up' : 'Call'} />
                            </button>
                            {!isCallActive && isAdmin && (
                              <button className="voice-btn voice-btn-primary">
                                <ButtonContent icon="user-plus" label="Invite" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* Channels Tab */}
              {activeTab === 'channels' && (
                <div className="voice-tab-panel active">
                  {channels.length === 0 ? (
                    <div className="voice-empty">No voice channels configured</div>
                  ) : (
                    channels.map(channel => {
                      const active = currentChannelId === channel.id;
                      return (
                        <div key={channel.id} className={`voice-channel-card ${active ? 'active' : ''}`}>
                          <div>
                            <div className="voice-channel-name">{channel.name}</div>
                            <div className="voice-channel-meta">{channel.description || ''}</div>
                          </div>
                          <div className="voice-channel-actions">
                            <span className="voice-channel-count">{channel.memberCount || 0} members</span>
                            <button
                              className={`voice-btn ${active ? 'voice-btn-secondary' : 'voice-btn-primary'}`}
                              onClick={() => onChannelToggle(channel.id, active ? 'leave' : 'join')}
                            >
                              <ButtonContent icon={active ? 'log-out' : 'log-in'} label={active ? 'Leave' : 'Join'} />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <button
                    className={`voice-btn voice-btn-wide ${isAdmin ? '' : 'voice-btn-disabled'}`}
                    onClick={onStartBroadcast}
                    disabled={!isAdmin}
                    title={isAdmin ? (isBroadcastActive ? 'End the live broadcast' : 'Start a live broadcast') : 'Only admins can start broadcasts'}
                  >
                    <ButtonContent icon="radio" label={isBroadcastActive ? 'End Broadcast' : 'Start Broadcast'} />
                  </button>
                </div>
              )}

              {/* Active Session Tab */}
              {activeTab === 'active' && (
                <div className="voice-tab-panel active">
                  {!currentSession ? (
                    <div className="voice-empty">No active voice session</div>
                  ) : (
                    <>
                      <div className="voice-session-summary">
                        <div className="voice-session-type">{(currentSession.type || 'unknown').charAt(0).toUpperCase() + currentSession.type.slice(1)} Session</div>
                        <div className="voice-session-timer">{formatTimer(sessionDuration)}</div>
                      </div>
                      <div className="voice-participant-list">
                        {Object.values(stateRef.current.peers).filter(p => p.meta).map(p => (
                          <div key={p.meta.userId} className={`voice-participant-card ${p.meta.speaking ? 'speaking' : ''}`}>
                            <div className={`voice-avatar ${p.meta.speaking ? 'speaking' : ''}`}>
                              {p.meta.name?.charAt(0).toUpperCase()}
                            </div>
                            <div className="voice-details">
                              <div className="voice-name">{p.meta.name}</div>
                              <div className="voice-meta">{p.meta.role || 'Agent'} · {p.meta.muted ? 'Muted' : 'Live'}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="voice-control-row">
                        <button
                          className={`voice-btn ${isMuted ? 'voice-btn-secondary' : 'voice-btn-primary'}`}
                          onClick={toggleMute}
                        >
                          <ButtonContent icon={isMuted ? 'mic-off' : 'mic'} label={isMuted ? 'Unmute' : 'Mute'} />
                        </button>
                        <button
                          className={`voice-btn ${noiseSuppressionEnabled ? 'voice-btn-primary' : 'voice-btn-secondary'}`}
                          onClick={toggleNoiseSuppression}
                        >
                          <ButtonContent icon={noiseSuppressionEnabled ? 'shield' : 'shield-off'} label={noiseSuppressionEnabled ? 'Noise On' : 'Noise Off'} />
                        </button>
                        <button
                          className={`voice-btn ${isDeafened ? 'voice-btn-secondary' : 'voice-btn-primary'}`}
                          onClick={toggleDeafen}
                        >
                          <ButtonContent icon={isDeafened ? 'volume-x' : 'volume-2'} label={isDeafened ? 'Undeafen' : 'Deafen'} />
                        </button>
                        <button
                          className="voice-btn voice-btn-danger"
                          onClick={leaveCurrentSession}
                        >
                          <ButtonContent icon="phone-off" label="Leave" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="voice-toolbar">
              <button
                className={`voice-tab ${activeTab === 'staff' ? 'active' : ''}`}
                onClick={() => setActiveTab('staff')}
                data-tab="staff"
              >
                <span className="voice-tab-icon"><VoiceIcon name="users" /></span>
                <span>Staff</span>
              </button>
              <button
                className={`voice-tab ${activeTab === 'channels' ? 'active' : ''}`}
                onClick={() => setActiveTab('channels')}
                data-tab="channels"
              >
                <span className="voice-tab-icon"><VoiceIcon name="radio" /></span>
                <span>Channel</span>
              </button>
              <button
                className={`voice-tab ${activeTab === 'active' ? 'active' : ''}`}
                onClick={() => setActiveTab('active')}
                data-tab="active"
              >
                <span className="voice-tab-icon"><VoiceIcon name="headphones" /></span>
                <span>Session</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Toast Container */}
      <div className="voice-toast-container">
        {toasts.map(toast => (
          <div key={toast.id} className={`voice-toast voice-toast-${toast.type}`}>
            {toast.message}
          </div>
        ))}
      </div>
    </>
  );
};

export default VoicePanel;
