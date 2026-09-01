import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { MeshVoiceEngine } from '../services/voice/meshVoiceEngine';
import { mergePresenceIntoDirectory } from '../utils/voicePresence';

const VoiceCommunicationContext = createContext(null);
const defaultCurrentUser = { id: null, name: 'Staff', role: 'staff', department: 'Operations', branch: 'Current Branch', status: 'available', avatar: 'ST', availability: 'Available' };

function resolveCurrentUser() {
  if (typeof window === 'undefined') return defaultCurrentUser;
  const user = window.currentUser || window.__CURRENT_USER__;
  const resolvedName = user?.fullName || user?.displayName || user?.name || user?.email || 'Staff';
  return user ? { ...defaultCurrentUser, id: user.id || user.userId || null, name: resolvedName, role: user.role || 'staff', branch: user.branchName || user.branch || 'Current Branch', avatar: user.avatar_url || user.avatarUrl || 'ST' } : defaultCurrentUser;
}

function participantView(participant, speakingIds) {
  return { userId: participant.identity, name: participant.name || participant.displayName || participant.identity, speaking: speakingIds.has(participant.identity), connected: true };
}

export function VoiceCommunicationProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('staff');
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('All');
  const [roleFilter, setRoleFilter] = useState('All');
  const [sortOrder, setSortOrder] = useState('alpha');
  const [staffDirectory, setStaffDirectory] = useState([]);
  const [isHydrated, setIsHydrated] = useState(false);
  const [currentUser, setCurrentUser] = useState(resolveCurrentUser);
  const [channelState, setChannelState] = useState('disconnected');
  const [connectionState, setConnectionState] = useState('connecting');
  const [microphoneState, setMicrophoneState] = useState('idle');
  const [activeParticipants, setActiveParticipants] = useState([]);
  const [muted, setMuted] = useState(false);
  const [deafened, setDeafened] = useState(false);
  const [transmitting, setTransmittingState] = useState(false);
  const [error, setError] = useState('');
  const [diagnostics, setDiagnostics] = useState({ authentication: 'UNKNOWN', branch: 'UNKNOWN', tokenRequest: 'IDLE', room: '', localParticipant: 'DISCONNECTED', microphonePermission: 'UNKNOWN', localMicrophone: 'UNPUBLISHED', remoteParticipants: '0', remoteAudioTracks: '0', activeSpeaker: '', lastError: '', connection: 'connecting' });
  const voiceEngineRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteAudioRef = useRef(new Map());
  const signalingHandlersRef = useRef(null);
  const socketRef = useRef(null);
  const speakingIdsRef = useRef(new Set());
  const peerNamesRef = useRef(new Map());
  const transmitRef = useRef(false);

  const setDiagnostic = useCallback((key, value) => setDiagnostics((previous) => ({ ...previous, [key]: value })), []);
  const refreshParticipants = useCallback(() => {
    const engine = voiceEngineRef.current;
    if (!engine) return;
    const participants = Array.from(engine.peers.keys()).map((peerId) => {
      const peerName = peerNamesRef.current.get(peerId) || peerId;
      return participantView({ identity: peerId, name: peerName }, speakingIdsRef.current);
    });
    setActiveParticipants(participants);
    setDiagnostic('remoteParticipants', String(participants.length));
  }, [setDiagnostic]);
  const applyDeafen = useCallback((value) => {
    remoteAudioRef.current.forEach((audio) => { audio.volume = value ? 0 : 1; });
  }, []);

  const leaveVoice = useCallback(async () => {
    const engine = voiceEngineRef.current;
    voiceEngineRef.current = null;
    setChannelState('disconnected');
    setConnectionState('disconnected');
    setActiveParticipants([]);
    setTransmittingState(false);
    setMuted(false);
    setDeafened(false);
    socketRef.current?.emit('voice:leave');
    if (socketRef.current && signalingHandlersRef.current) {
      Object.entries(signalingHandlersRef.current).forEach(([event, handler]) => socketRef.current.off(event, handler));
      signalingHandlersRef.current = null;
    }
    await engine?.close();
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    remoteAudioRef.current.forEach((audio) => { audio.pause(); audio.srcObject = null; });
    remoteAudioRef.current.clear();
    setDiagnostic('localParticipant', 'DISCONNECTED');
    setDiagnostic('room', '');
  }, [setDiagnostic]);

  const joinVoice = useCallback(async () => {
    if (voiceEngineRef.current || !currentUser?.id) return;
    setError(''); setChannelState('connecting'); setConnectionState('connecting'); setMicrophoneState('requesting'); setDiagnostic('tokenRequest', 'REQUESTING');
    try {
      const socket = socketRef.current;
      if (!socket) throw new Error('Voice signaling is unavailable. Please reload and try again.');
      if (!socket.connected) await new Promise((resolve, reject) => { socket.once('connect', resolve); socket.once('connect_error', reject); socket.connect(); });
      const configResponse = await fetch('/api/voice/config', { credentials: 'same-origin' });
      const voiceConfig = configResponse.ok ? await configResponse.json() : null;
      if (!voiceConfig?.channelId || !Array.isArray(voiceConfig.iceServers)) throw new Error('Voice configuration is unavailable. Please reload and try again.');
      const localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = localStream;
      const engine = new MeshVoiceEngine({ socket, localStream, iceServers: voiceConfig.iceServers, logger: (message, detail) => {
        if (message === 'offer failed' || message === 'remote description failed') setDiagnostic('lastError', detail?.message || message);
      }, onRemoteStream: (peerId, stream) => {
        let audio = remoteAudioRef.current.get(peerId);
        if (!audio) {
          audio = document.createElement('audio');
          audio.autoplay = true;
          audio.playsInline = true;
          audio.setAttribute('playsinline', 'true');
          audio.dataset.voicePeer = peerId;
          document.body.appendChild(audio);
          remoteAudioRef.current.set(peerId, audio);
        }
        audio.srcObject = stream;
        audio.volume = deafened ? 0 : 1;
        void audio.play().catch((playError) => setDiagnostic('lastError', `Remote audio playback failed: ${playError.message}`));
        setDiagnostic('remoteAudioTracks', String(remoteAudioRef.current.size));
      }, onPeerState: (peerId, state) => {
        if (state === 'connected') { setChannelState('connected'); setConnectionState('connected'); refreshParticipants(); }
        if (state === 'failed') { setConnectionState('error'); setDiagnostic('lastError', `Voice connection failed for peer ${peerId}`); }
        if (state === 'disconnected' || state === 'closed') { engine.removePeer(peerId); refreshParticipants(); }
      }});
      voiceEngineRef.current = engine;
      const handlePeerList = (peers = []) => {
        peers.forEach(({ peerId, name }) => {
          if (peerId && name) peerNamesRef.current.set(peerId, name);
          engine.createPeer(peerId);
        });
        refreshParticipants();
      };
      const handlePeerJoined = ({ peerId, name }) => {
        if (peerId && name) peerNamesRef.current.set(peerId, name);
        engine.createPeer(peerId); refreshParticipants();
      };
      const handlePeerLeft = ({ peerId }) => { peerNamesRef.current.delete(peerId); engine.removePeer(peerId); remoteAudioRef.current.get(peerId)?.remove(); remoteAudioRef.current.delete(peerId); refreshParticipants(); };
      const handleOffer = ({ peerId, offer }) => void engine.handleOffer(peerId, offer);
      const handleAnswer = ({ peerId, answer }) => void engine.handleAnswer(peerId, answer);
      const handleCandidate = ({ peerId, candidate }) => void engine.handleCandidate(peerId, candidate);
      socket.on('voice:peer-list', handlePeerList); socket.on('voice:peer-joined', handlePeerJoined); socket.on('voice:peer-left', handlePeerLeft);
      socket.on('voice:offer', handleOffer); socket.on('voice:answer', handleAnswer); socket.on('voice:ice-candidate', handleCandidate);
      signalingHandlersRef.current = { 'voice:peer-list': handlePeerList, 'voice:peer-joined': handlePeerJoined, 'voice:peer-left': handlePeerLeft, 'voice:offer': handleOffer, 'voice:answer': handleAnswer, 'voice:ice-candidate': handleCandidate };
      const joined = await new Promise((resolve, reject) => socket.emit('voice:join', { channelId: voiceConfig.channelId }, (result) => result?.ok ? resolve(result) : reject(new Error(result?.error || 'Unable to join staff voice.'))));
      void joined;
      setChannelState('connected'); setConnectionState('connected'); setMicrophoneState('available'); setDiagnostic('tokenRequest', 'AUTHORIZED'); setDiagnostic('branch', 'AUTHORIZED'); setDiagnostic('localParticipant', 'CONNECTED'); setDiagnostic('microphonePermission', 'GRANTED');
    } catch (joinError) {
      await leaveVoice();
      const message = joinError?.name === 'NotAllowedError' ? 'Microphone access was denied. Please allow microphone access and try again.' : joinError?.message || 'Unable to connect to staff voice.';
      setError(message); setMicrophoneState('error'); setConnectionState('error'); setDiagnostic('lastError', message);
    }
  }, [currentUser?.id, deafened, leaveVoice, refreshParticipants, setDiagnostic]);

  const setTransmitting = useCallback((value) => {
    transmitRef.current = Boolean(value);
    if (!localStreamRef.current || muted) return;
    localStreamRef.current.getAudioTracks().forEach((track) => { track.enabled = Boolean(value); });
    setTransmittingState(Boolean(value));
  }, [muted]);
  const toggleMute = useCallback(() => {
    const nextMuted = !muted; setMuted(nextMuted); if (nextMuted) setTransmittingState(false);
    localStreamRef.current?.getAudioTracks().forEach((track) => { track.enabled = !nextMuted && transmitRef.current; });
  }, [muted]);
  const toggleDeafen = useCallback(() => { const next = !deafened; setDeafened(next); applyDeafen(next); }, [applyDeafen, deafened]);

  useEffect(() => {
    const stop = () => setTransmitting(false);
    window.addEventListener('blur', stop); document.addEventListener('visibilitychange', stop);
    return () => { window.removeEventListener('blur', stop); document.removeEventListener('visibilitychange', stop); void leaveVoice(); };
  }, [leaveVoice, setTransmitting]);
  useEffect(() => {
    let active = true;
    const hydrate = async () => { try {
      const [sessionResponse, staffResponse] = await Promise.all([fetch('/api/user', { credentials: 'same-origin' }), fetch('/api/voice/staff', { credentials: 'same-origin' })]);
      const user = sessionResponse.ok ? await sessionResponse.json() : null;
      if (user?.id && active) {
        const resolvedName = user.fullName || user.displayName || user.name || user.email || 'Staff';
        setCurrentUser({ ...defaultCurrentUser, ...user, branch: user.branchName || user.branch || 'Current Branch', name: resolvedName });
      }
      const staff = staffResponse.ok ? await staffResponse.json() : [];
      if (active) { setStaffDirectory(mergePresenceIntoDirectory(Array.isArray(staff) ? staff : [], Array.isArray(staff) ? staff : [])); setIsHydrated(true); }
      setDiagnostic('authentication', user?.id ? 'AUTHENTICATED' : 'UNAUTHENTICATED');
    } catch { if (active) setIsHydrated(true); } };
    void hydrate(); return () => { active = false; };
  }, [setDiagnostic]);
  useEffect(() => {
    if (!currentUser?.id || socketRef.current) return undefined;
    const socket = io(window.location.origin, { transports: ['polling', 'websocket'] }); socketRef.current = socket;
    socket.on('connect', () => socket.emit('voice:register', {
      userId: currentUser.id,
      name: currentUser.name,
      fullName: currentUser.fullName || currentUser.name,
      displayName: currentUser.displayName || currentUser.name,
      email: currentUser.email,
      role: currentUser.role,
      branch: currentUser.branch,
      status: 'online'
    }));
    socket.on('voice:presenceUpdate', (payload) => setStaffDirectory((previous) => mergePresenceIntoDirectory(previous, Array.isArray(payload) ? payload : [])));
    return () => { socket.disconnect(); socketRef.current = null; };
  }, [currentUser]);

  const togglePanel = useCallback(() => setIsOpen((value) => !value), []);
  const setPanelOpen = useCallback((value) => setIsOpen(value), []);
  const openCall = useCallback(() => { void joinVoice(); }, [joinVoice]);
  const session = channelState === 'connected' ? { peer: { name: 'Branch voice' }, quality: 'WebRTC', duration: 0, isMuted: muted, volume: deafened ? 0 : 1, securityVerified: true, isHeld: false, boosted: false } : null;
  const value = useMemo(() => ({ isOpen, setPanelOpen, togglePanel, activeTab, setActiveTab, search, setSearch, departmentFilter, setDepartmentFilter, roleFilter, setRoleFilter, sortOrder, setSortOrder, staffDirectory, activeStaff: staffDirectory, currentUser, setCurrentUser, isHydrated, incomingCall: null, setIncomingCall: () => {}, outgoingCall: null, setOutgoingCall: () => {}, session, setSession: () => {}, broadcast: null, setBroadcast: () => {}, toast: null, setToast: () => {}, connectionState, channelState, microphoneState, activeParticipants, muted, deafened, speaking: transmitting, transmitting, error, diagnostics, pushToast: () => {}, openCall, acceptIncomingCall: joinVoice, declineIncomingCall: () => {}, endSession: leaveVoice, leaveVoice, joinVoice, setTransmitting, toggleMute, toggleDeafen, cancelOutgoingCall: leaveVoice, startBroadcast: joinVoice, endBroadcast: leaveVoice, toggleHold: () => {}, cycleVolume: () => {}, verifySecurity: () => {}, toggleBoost: () => {}, toggleBroadcastMute: () => {}, toggleBroadcastLock: () => {}, inviteStaffToBroadcast: () => {} }), [activeParticipants, activeTab, channelState, connectionState, currentUser, deafened, departmentFilter, diagnostics, error, isHydrated, isOpen, joinVoice, leaveVoice, microphoneState, muted, openCall, roleFilter, search, session, setPanelOpen, sortOrder, staffDirectory, toggleDeafen, toggleMute, togglePanel, transmitting, setTransmitting]);
  return <VoiceCommunicationContext.Provider value={value}>{children}</VoiceCommunicationContext.Provider>;
}

export function useVoiceCommunication() {
  const context = useContext(VoiceCommunicationContext);
  if (!context) throw new Error('useVoiceCommunication must be used within a VoiceCommunicationProvider');
  return context;
}
