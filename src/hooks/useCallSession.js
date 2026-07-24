import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CALL_STATES, callService } from '../services/callService';

export const useCallSession = ({ initialContact = null, onStateChange = null } = {}) => {
  const [status, setStatus] = useState(CALL_STATES.idle);
  const [duration, setDuration] = useState(0);
  const [contact, setContact] = useState(initialContact);
  const [error, setError] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerEnabled, setIsSpeakerEnabled] = useState(true);
  const [isMicSupported, setIsMicSupported] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const timerRef = useRef(null);
  const startedAtRef = useRef(null);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    stopTimer();
    startedAtRef.current = Date.now();
    timerRef.current = setInterval(() => {
      setDuration(Math.floor((Date.now() - startedAtRef.current) / 1000));
    }, 1000);
  }, [stopTimer]);

  const setSessionState = useCallback((nextStatus, details = {}) => {
    setStatus(nextStatus);
    if (details.error) {
      setError(details.error);
    }
    if (details.contact) {
      setContact(details.contact);
    }
    if (details.clearError) {
      setError('');
    }
    if (typeof onStateChange === 'function') {
      onStateChange(nextStatus, details);
    }
  }, [onStateChange]);

  useEffect(() => {
    if ([CALL_STATES.connected].includes(status)) {
      startTimer();
      return stopTimer;
    }
    stopTimer();
    return undefined;
  }, [status, startTimer, stopTimer]);

  useEffect(() => {
    if (typeof navigator?.mediaDevices?.getUserMedia !== 'function') {
      setIsMicSupported(false);
      setSessionState(CALL_STATES.failed, { error: 'This browser does not support microphone access.' });
    }
  }, [setSessionState]);

  const reset = useCallback(() => {
    stopTimer();
    setDuration(0);
    setStatus(CALL_STATES.idle);
    setError('');
    setIsMuted(false);
    setIsSpeakerEnabled(true);
    setIsConnecting(false);
    startedAtRef.current = null;
  }, [stopTimer]);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
  }, []);

  const toggleSpeaker = useCallback(() => {
    setIsSpeakerEnabled((prev) => !prev);
  }, []);

  return useMemo(() => ({
    status,
    duration,
    contact,
    error,
    isMuted,
    isSpeakerEnabled,
    isMicSupported,
    isConnecting,
    setStatus: setSessionState,
    setContact,
    setError,
    setIsConnecting,
    toggleMute,
    toggleSpeaker,
    reset,
    label: callService.getStatusLabel(status),
    canDisplayTimer: [CALL_STATES.connected, CALL_STATES.calling, CALL_STATES.ringing, CALL_STATES.connecting].includes(status)
  }), [
    status,
    duration,
    contact,
    error,
    isMuted,
    isSpeakerEnabled,
    isMicSupported,
    isConnecting,
    setSessionState,
    toggleMute,
    toggleSpeaker,
    reset
  ]);
};
