import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { CALL_STATES, callService } from '../services/callService';
import { WebRTCService } from '../services/webrtcService';
import { SocketCallService } from '../services/socketCallService';
import { useCallSession } from '../hooks/useCallSession';
import IncomingCallModal from './IncomingCallModal';
import OutgoingCallPanel from './OutgoingCallPanel';

const VoiceCallPanel = ({ contact, currentUser, onClose, onCallEnded }) => {
  const [showIncoming, setShowIncoming] = useState(false);
  const [peerStream, setPeerStream] = useState(null);
  const [debugLog, setDebugLog] = useState([]);
  const audioRef = useRef(null);

  const webrtcServiceRef = useRef(null);
  const socketServiceRef = useRef(null);
  const pendingCallRef = useRef(null);

  const session = useCallSession({ initialContact: contact, onStateChange: (nextStatus) => {
    if (nextStatus === CALL_STATES.connected) {
      setDebugLog((prev) => [...prev, `Connected to ${contact?.name || 'peer'}`]);
    }
  } });

  const addLog = (message) => {
    setDebugLog((prev) => [...prev.slice(-9), message]);
  };

  useEffect(() => {
    if (!webrtcServiceRef.current) {
      webrtcServiceRef.current = new WebRTCService({ debug: import.meta.env.DEV });
    }
    if (!socketServiceRef.current) {
      const service = new SocketCallService({ debug: import.meta.env.DEV, onEvent: (event) => {
        if (event.type === 'socket:connected') {
          addLog('Socket connected');
        }
      }});
      socketServiceRef.current = service;
      service.connect();
      service.on('call:incoming', (payload) => {
        if (payload?.callId && payload.callId !== pendingCallRef.current?.callId) {
          pendingCallRef.current = payload;
          setShowIncoming(true);
          session.setContact(payload.caller);
          session.setStatus(CALL_STATES.ringing, { contact: payload.caller, clearError: true });
          addLog(`Incoming call from ${payload.caller?.name || 'unknown'}`);
        }
      });
      service.on('webrtc:offer', async (payload) => {
        try {
          const service = webrtcServiceRef.current;
          session.setStatus(CALL_STATES.connecting, { clearError: true });
          await service.createPeerConnection();
          await service.setRemoteDescription(new RTCSessionDescription(payload.offer));
          const answer = await service.createAnswer(payload.offer);
          service.peerConnection?.getSenders();
          service.addIceCandidates(payload.iceCandidates || []);
          service.peerConnection && service.peerConnection.localDescription && service.sendAnswer({
            callId: payload.callId,
            answer: service.peerConnection.localDescription.toJSON()
          });
          session.setStatus(CALL_STATES.connected, { clearError: true });
          addLog('Offer answered');
        } catch (error) {
          session.setStatus(CALL_STATES.failed, { error: error.message || 'Unable to connect' });
        }
      });
      service.on('webrtc:answer', async (payload) => {
        try {
          const service = webrtcServiceRef.current;
          await service.setRemoteDescription(new RTCSessionDescription(payload.answer));
          session.setStatus(CALL_STATES.connected, { clearError: true });
          addLog('Answer received');
        } catch (error) {
          session.setStatus(CALL_STATES.failed, { error: error.message || 'Unable to connect' });
        }
      });
      service.on('webrtc:icecandidate', async (payload) => {
        await webrtcServiceRef.current?.addIceCandidate(new RTCIceCandidate(payload.candidate));
      });
      service.on('call:accepted', () => {
        session.setStatus(CALL_STATES.connecting, { clearError: true });
        addLog('Call accepted');
      });
      service.on('call:declined', () => {
        session.setStatus(CALL_STATES.declined, { clearError: true });
        addLog('Call declined');
      });
      service.on('call:ended', () => {
        cleanup();
        if (typeof onCallEnded === 'function') {
          onCallEnded();
        }
      });
    }

    return () => {
      cleanup();
    };
  }, []);

  useEffect(() => {
    if (audioRef.current && peerStream) {
      audioRef.current.srcObject = peerStream;
      audioRef.current.play().catch(() => {});
    }
  }, [peerStream]);

  const cleanup = () => {
    webrtcServiceRef.current?.cleanup();
    socketServiceRef.current?.disconnect();
    setShowIncoming(false);
  };

  const initiateCall = async () => {
    try {
      if (!contact?.id) {
        session.setStatus(CALL_STATES.failed, { error: 'No contact selected' });
        return;
      }

      session.setStatus(CALL_STATES.calling, { clearError: true, contact });
      const stream = await webrtcServiceRef.current.acquireMicrophone();
      webrtcServiceRef.current.attachLocalStream(stream);
      const pc = webrtcServiceRef.current.createPeerConnection();
      webrtcServiceRef.current.onRemoteStream = (stream) => setPeerStream(stream);
      webrtcServiceRef.current.onStateChange = (state) => {
        if (state === 'connected') {
          session.setStatus(CALL_STATES.connected, { clearError: true });
        }
      };
      const offer = await webrtcServiceRef.current.createOffer();
      pendingCallRef.current = { callId: `${Date.now()}`, caller: currentUser, recipient: contact };
      socketServiceRef.current?.startCall({ callId: pendingCallRef.current.callId, caller: currentUser, recipient: contact, offer: offer.toJSON() });
      session.setStatus(CALL_STATES.ringing, { clearError: true, contact });
      addLog('Offer sent');
    } catch (error) {
      session.setStatus(CALL_STATES.failed, { error: error.message || 'Call failed to start' });
      addLog(error.message || 'Call failed');
    }
  };

  const acceptIncoming = async () => {
    try {
      setShowIncoming(false);
      session.setStatus(CALL_STATES.connecting, { clearError: true });
      const stream = await webrtcServiceRef.current.acquireMicrophone();
      webrtcServiceRef.current.attachLocalStream(stream);
      const pc = webrtcServiceRef.current.createPeerConnection();
      webrtcServiceRef.current.onRemoteStream = (stream) => setPeerStream(stream);
      webrtcServiceRef.current.onStateChange = (state) => {
        if (state === 'connected') {
          session.setStatus(CALL_STATES.connected, { clearError: true });
        }
      };
      const offer = pendingCallRef.current?.offer;
      if (offer) {
        const answer = await webrtcServiceRef.current.createAnswer(offer);
        socketServiceRef.current?.sendAnswer({ callId: pendingCallRef.current.callId, answer: answer.toJSON() });
        session.setStatus(CALL_STATES.connected, { clearError: true });
      }
    } catch (error) {
      session.setStatus(CALL_STATES.failed, { error: error.message || 'Unable to accept call' });
    }
  };

  const declineIncoming = () => {
    setShowIncoming(false);
    socketServiceRef.current?.declineCall({ callId: pendingCallRef.current?.callId });
    session.setStatus(CALL_STATES.declined, { clearError: true });
  };

  const endCall = () => {
    socketServiceRef.current?.endCall({ callId: pendingCallRef.current?.callId });
    cleanup();
    session.setStatus(CALL_STATES.ended, { clearError: true });
    if (typeof onCallEnded === 'function') {
      onCallEnded();
    }
  };

  const toggleMute = () => {
    session.toggleMute();
    webrtcServiceRef.current?.setMute(session.isMuted);
  };

  const statusLabel = useMemo(() => callService.getStatusLabel(session.status), [session.status]);

  return (
    <div className="rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-xl backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-brand-600 to-cyan-500 text-lg font-semibold text-white">
            {contact?.name?.charAt(0)?.toUpperCase() || 'C'}
          </div>
          <div>
            <p className="text-base font-semibold text-slate-900 dark:text-white">{contact?.name || 'Call panel'}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">{statusLabel}</p>
          </div>
        </div>
        <button type="button" onClick={onClose} className="rounded-full border border-slate-200 px-3 py-1.5 text-sm text-slate-500 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300">Close</button>
      </div>

      <div className="mt-4 rounded-[24px] border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/70">
        {session.status === CALL_STATES.idle ? (
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">Ready to place a call</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Use the call button to begin a new conversation</p>
            </div>
            <button type="button" onClick={initiateCall} className="rounded-2xl bg-brand-600 px-4 py-2.5 font-semibold text-white transition hover:bg-brand-700">Start call</button>
          </div>
        ) : (
          <>
            <OutgoingCallPanel contact={contact} status={statusLabel} duration={callService.formatDuration(session.duration)} onCancel={endCall} />
            <div className="mt-4 flex items-center justify-center gap-3">
              <button type="button" onClick={toggleMute} className={`rounded-full px-4 py-2.5 text-sm font-semibold ${session.isMuted ? 'bg-rose-500/10 text-rose-500' : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200'}`}>
                {session.isMuted ? 'Unmute' : 'Mute'}
              </button>
              <button type="button" onClick={() => session.toggleSpeaker()} className={`rounded-full px-4 py-2.5 text-sm font-semibold ${session.isSpeakerEnabled ? 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200' : 'bg-brand-500/10 text-brand-500'}`}>
                {session.isSpeakerEnabled ? 'Speaker on' : 'Speaker off'}
              </button>
              <button type="button" onClick={endCall} className="rounded-full bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-600">End call</button>
            </div>
            <div className="mt-4 flex items-center justify-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <span className={`h-3 w-3 rounded-full ${session.status === CALL_STATES.connected ? 'animate-pulse bg-emerald-500' : 'bg-slate-400'}`} />
              <span>Microphone active</span>
            </div>
          </>
        )}
      </div>

      <audio ref={audioRef} autoPlay playsInline />

      <IncomingCallModal open={showIncoming} caller={contact} onAccept={acceptIncoming} onDecline={declineIncoming} />

      {import.meta.env.DEV && (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-950/95 p-3 text-xs text-slate-300">
          <div className="font-semibold text-white">Debug log</div>
          <ul className="mt-2 space-y-1">
            {debugLog.map((entry, index) => <li key={`${entry}-${index}`}>{entry}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
};

export default VoiceCallPanel;
