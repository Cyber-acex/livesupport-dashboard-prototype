import { useCallback, useEffect, useRef, useState } from 'react';

const ICE_CONFIG = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

export const useCallWebRTC = ({ localStream, onRemoteStream, socket, token, userId, targetId }) => {
  const pcRef = useRef(null);
  const [connectionState, setConnectionState] = useState('new');

  const createPeerConnection = useCallback(() => {
    if (pcRef.current) return pcRef.current;
    const pc = new RTCPeerConnection(ICE_CONFIG);

    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('call:ice', { secureToken: token, targetId, candidate: event.candidate });
      }
    };

    pc.onconnectionstatechange = () => {
      setConnectionState(pc.connectionState);
      if (socket) {
        socket.emit('connection:status', { secureToken: token, state: pc.connectionState });
      }
    };

    pc.ontrack = (event) => {
      if (typeof onRemoteStream === 'function') {
        onRemoteStream(event.streams[0]);
      }
    };

    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        pc.addTrack(track, localStream);
      });
    }

    pcRef.current = pc;
    return pc;
  }, [localStream, onRemoteStream, socket, token, targetId]);

  const closePeerConnection = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.getSenders().forEach((sender) => {
        if (sender.track) sender.track.stop();
      });
      pcRef.current.close();
      pcRef.current = null;
    }
  }, []);

  const createOffer = useCallback(async () => {
    if (!socket) throw new Error('Socket not connected');
    const pc = createPeerConnection();
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit('call:offer', {
      secureToken: token,
      targetId,
      offer
    });
  }, [createPeerConnection, socket, token, targetId]);

  const createAnswer = useCallback(async (remoteOffer) => {
    if (!socket) throw new Error('Socket not connected');
    const pc = createPeerConnection();
    await pc.setRemoteDescription(remoteOffer);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket.emit('call:answer', {
      secureToken: token,
      targetId,
      answer
    });
  }, [createPeerConnection, socket, token, targetId]);

  const addIceCandidate = useCallback(async (candidate) => {
    if (!pcRef.current || !candidate) return;
    try {
      await pcRef.current.addIceCandidate(candidate);
    } catch (err) {
      console.warn('Failed to add ICE candidate', err);
    }
  }, []);

  const setRemoteDescription = useCallback(async (description) => {
    if (!pcRef.current || !description) return;
    try {
      await pcRef.current.setRemoteDescription(description);
    } catch (err) {
      console.warn('Failed to set remote description', err);
    }
  }, []);

  useEffect(() => {
    return () => closePeerConnection();
  }, [closePeerConnection]);

  return {
    pc: pcRef.current,
    connectionState,
    createOffer,
    createAnswer,
    addIceCandidate,
    setRemoteDescription,
    closePeerConnection
  };
};
