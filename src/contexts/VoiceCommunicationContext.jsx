import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Room, RoomEvent, Track } from 'livekit-client';
import { io } from 'socket.io-client';

const VoiceCommunicationContext = createContext(null);
const debugVoice = (...args) => { if (import.meta.env.DEV || import.meta.env.VITE_VOICE_DEBUG === 'true') console.debug('[VOICE]', ...args); };

export function VoiceCommunicationProvider({ children }) {
  const [connectionState, setConnectionState] = useState('connecting');
  const [channelState, setChannelState] = useState('disconnected');
  const [microphoneState, setMicrophoneState] = useState('idle');
  const [currentUser, setCurrentUser] = useState(null);
  const [activeStaff, setActiveStaff] = useState([]);
  const [activeParticipants, setActiveParticipants] = useState([]);
  const [muted, setMuted] = useState(false);
  const [deafened, setDeafened] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState(null);
  const [diagnostics, setDiagnostics] = useState({ transport: 'livekit', room: null, localMicrophone: 'none', published: false, remoteAudioTracks: 0, activeSpeaker: null });
  const socketRef = useRef(null);
  const roomRef = useRef(null);
  const audioElementsRef = useRef(new Map());
  const currentUserRef = useRef(null);
  const mutedRef = useRef(false);
  const deafenedRef = useRef(false);
  const joinedChannelRef = useRef(null);

  const mapParticipant = useCallback((participant) => ({
    userId: participant.identity,
    name: participant.name || participant.identity,
    role: participant.metadata || 'staff',
    speaking: participant.isSpeaking,
    muted: !participant.isMicrophoneEnabled
  }), []);

  const syncParticipants = useCallback((room) => {
    const participants = Array.from(room.remoteParticipants.values()).map(mapParticipant);
    setActiveParticipants(participants);
    setDiagnostics((previous) => ({ ...previous, room: room.name, remoteAudioTracks: participants.reduce((count, participant) => count + (room.remoteParticipants.get(String(participant.userId))?.audioTrackPublications?.size || 0), 0) }));
  }, [mapParticipant]);

  const attachAudio = useCallback((track, publication, participant) => {
    const elements = track.attach();
    elements.forEach((element) => { element.autoplay = true; element.muted = deafenedRef.current; element.setAttribute('aria-hidden', 'true'); });
    audioElementsRef.current.set(`${participant.identity}:${publication.trackSid}`, elements);
    setDiagnostics((previous) => ({ ...previous, remoteAudioTracks: audioElementsRef.current.size }));
    debugVoice('remote audio subscribed', { participant: participant.identity });
  }, []);

  const detachAudio = useCallback((track, publication, participant) => {
    track.detach().forEach((element) => element.remove());
    audioElementsRef.current.delete(`${participant.identity}:${publication.trackSid}`);
    setDiagnostics((previous) => ({ ...previous, remoteAudioTracks: audioElementsRef.current.size }));
  }, []);

  useEffect(() => {
    let mounted = true;
    const socket = io({ autoConnect: false, withCredentials: true });
    const room = new Room({ adaptiveStream: true, dynacast: true });
    socketRef.current = socket;
    roomRef.current = room;

    socket.on('connect', () => { if (mounted) setConnectionState('connected'); });
    socket.on('disconnect', () => { if (mounted) setConnectionState('reconnecting'); });
    socket.on('connect_error', () => { if (mounted) { setConnectionState('error'); setError('LiveSupport connection failed.'); } });
    socket.on('voice:presence', (entries) => { if (mounted && Array.isArray(entries)) setActiveStaff(entries.filter((entry) => entry.status === 'active')); });
    room.on(RoomEvent.ConnectionStateChanged, (state) => {
      if (!mounted) return;
      debugVoice('LiveKit connection state', state);
      setChannelState(state === 'connected' ? 'connected' : state === 'reconnecting' ? 'reconnecting' : 'disconnected');
      setDiagnostics((previous) => ({ ...previous, connection: state }));
    });
    room.on(RoomEvent.ParticipantConnected, () => syncParticipants(room));
    room.on(RoomEvent.ParticipantDisconnected, (participant) => { setActiveParticipants((previous) => previous.filter((entry) => String(entry.userId) !== String(participant.identity))); });
    room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => { if (track.kind === Track.Kind.Audio) attachAudio(track, publication, participant); syncParticipants(room); });
    room.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => { if (track.kind === Track.Kind.Audio) detachAudio(track, publication, participant); syncParticipants(room); });
    room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => { const activeSpeaker = speakers[0] ? speakers[0].identity : null; setSpeaking(Boolean(currentUserRef.current && activeSpeaker === String(currentUserRef.current.id))); setActiveParticipants((previous) => previous.map((participant) => ({ ...participant, speaking: speakers.some((speaker) => String(speaker.identity) === String(participant.userId)) }))); setDiagnostics((previous) => ({ ...previous, activeSpeaker })); });
    room.on(RoomEvent.LocalTrackPublished, () => setDiagnostics((previous) => ({ ...previous, published: true })));
    room.on(RoomEvent.LocalTrackUnpublished, () => setDiagnostics((previous) => ({ ...previous, published: false })));

    fetch('/api/user', { credentials: 'same-origin' }).then((response) => response.ok ? response.json() : null).then((user) => { if (mounted && user) { currentUserRef.current = user; setCurrentUser(user); socket.connect(); } }).catch(() => { if (mounted) setConnectionState('error'); });
    return () => { mounted = false; room.disconnect(); audioElementsRef.current.forEach((elements) => elements.forEach((element) => element.remove())); audioElementsRef.current.clear(); socket.removeAllListeners(); socket.disconnect(); };
  }, [attachAudio, detachAudio, syncParticipants]);

  const joinVoice = useCallback(async () => {
    if (!currentUser || !roomRef.current || channelState === 'connected' || channelState === 'reconnecting') return;
    setError(null); setMicrophoneState('requesting');
    const channelId = `branch:${currentUser.branchId || 'none'}`;
    try {
      const response = await fetch('/api/voice/livekit-token', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ channelId }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error === 'livekit_not_configured' ? 'LiveKit voice is not configured yet.' : data.error || 'Voice authorization failed.');
      const room = roomRef.current;
      await room.connect(data.url, data.token);
      await room.localParticipant.setMicrophoneEnabled(true);
      await room.localParticipant.setMicrophoneEnabled(false);
      joinedChannelRef.current = channelId;
      setMicrophoneState('ready');
      setChannelState('connected');
      setDiagnostics((previous) => ({ ...previous, room: room.name, localMicrophone: 'ready', connection: 'connected' }));
      syncParticipants(room);
    } catch (joinError) {
      setMicrophoneState(joinError.name === 'NotAllowedError' ? 'denied' : 'error');
      setChannelState('error');
      setError(joinError.message || 'Voice connection failed.');
    }
  }, [currentUser, channelState, syncParticipants]);

  const setTransmitting = useCallback((value) => {
    const room = roomRef.current;
    if (!room || room.state !== 'connected') return;
    const shouldTransmit = Boolean(value) && !mutedRef.current;
    room.localParticipant.setMicrophoneEnabled(shouldTransmit).then(() => { setSpeaking(shouldTransmit); setDiagnostics((previous) => ({ ...previous, published: shouldTransmit })); }).catch(() => setError('Unable to change microphone state.'));
  }, []);

  const leaveVoice = useCallback(() => {
    roomRef.current?.disconnect();
    audioElementsRef.current.forEach((elements) => elements.forEach((element) => element.remove()));
    audioElementsRef.current.clear();
    joinedChannelRef.current = null;
    setActiveParticipants([]); setChannelState('disconnected'); setMicrophoneState('idle'); setSpeaking(false);
    setDiagnostics({ transport: 'livekit', room: null, localMicrophone: 'none', published: false, remoteAudioTracks: 0, activeSpeaker: null });
  }, []);

  const toggleMute = useCallback(() => { const next = !mutedRef.current; mutedRef.current = next; setMuted(next); if (next) setTransmitting(false); else if (roomRef.current?.state === 'connected') roomRef.current.localParticipant.setMicrophoneEnabled(false).catch(() => {}); }, [setTransmitting]);
  const toggleDeafen = useCallback(() => { const next = !deafenedRef.current; deafenedRef.current = next; setDeafened(next); audioElementsRef.current.forEach((elements) => elements.forEach((element) => { element.muted = next; })); }, []);
  const value = useMemo(() => ({ connectionState, channelState, microphoneState, currentUser, activeStaff, activeParticipants, localParticipant: currentUser, muted, deafened, speaking, error, diagnostics, joinVoice, leaveVoice, setTransmitting, toggleMute, toggleDeafen, clearError: () => setError(null) }), [connectionState, channelState, microphoneState, currentUser, activeStaff, activeParticipants, muted, deafened, speaking, error, diagnostics, joinVoice, leaveVoice, setTransmitting, toggleMute, toggleDeafen]);
  return <VoiceCommunicationContext.Provider value={value}>{children}</VoiceCommunicationContext.Provider>;
}

export function useVoiceCommunication() { const context = useContext(VoiceCommunicationContext); if (!context) throw new Error('useVoiceCommunication must be used within VoiceCommunicationProvider'); return context; }
