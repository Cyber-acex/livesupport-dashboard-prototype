import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

export const useCallSocket = ({ token, role, userId, name }, handlers = {}) => {
  const [socket, setSocket] = useState(null);
  const socketRef = useRef(null);
  const handlersRef = useRef(handlers);

  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  useEffect(() => {
    if (!token || !role) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setSocket(null);
      return undefined;
    }

    const createdSocket = io({ transports: ['websocket', 'polling'] });
    socketRef.current = createdSocket;
    setSocket(createdSocket);

    const emitRegister = () => {
      createdSocket.emit('call:register', {
        secureToken: token,
        role,
        userId: userId || null,
        name: name || null
      });
    };

    createdSocket.on('connect', () => {
      emitRegister();
      if (typeof handlersRef.current.onConnect === 'function') {
        handlersRef.current.onConnect();
      }
    });

    createdSocket.on('disconnect', (reason) => {
      if (typeof handlersRef.current.onDisconnect === 'function') {
        handlersRef.current.onDisconnect(reason);
      }
    });

    const events = [
      ['call:created', 'onCreated'],
      ['call:status', 'onStatus'],
      ['call:ringing', 'onRinging'],
      ['call:answered', 'onAnswered'],
      ['call:rejected', 'onRejected'],
      ['call:ended', 'onEnded'],
      ['call:missed', 'onMissed'],
      ['call:offer', 'onOffer'],
      ['call:answer', 'onAnswer'],
      ['call:ice', 'onIce'],
      ['connection:status', 'onConnectionStatus'],
      ['call:error', 'onError']
    ];

    events.forEach(([event, key]) => {
      const handler = handlersRef.current[key];
      if (typeof handler === 'function') {
        createdSocket.on(event, handler);
      }
    });

    createdSocket.on('connect_error', (error) => {
      if (typeof handlersRef.current.onError === 'function') {
        handlersRef.current.onError(error);
      }
    });

    return () => {
      events.forEach(([event, key]) => {
        const handler = handlersRef.current[key];
        if (typeof handler === 'function') {
          createdSocket.off(event, handler);
        }
      });
      createdSocket.off('connect');
      createdSocket.off('disconnect');
      createdSocket.off('connect_error');
      createdSocket.disconnect();
      socketRef.current = null;
      setSocket(null);
    };
  }, [token, role, userId, name]);

  return socket;
};
