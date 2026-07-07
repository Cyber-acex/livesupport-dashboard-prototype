import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

/**
 * Custom hook for managing voice socket connections and events
 */
export const useVoiceSocket = (user, handlers = {}) => {
  const socketRef = useRef(null);
  const handlersRef = useRef(handlers);

  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  useEffect(() => {
    if (!user?.id) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    if (!socketRef.current) {
      socketRef.current = io();
      if (socketRef.current) {
        socketRef.current.emit('voice:register', {
          userId: user.id,
          name: user.name || user.displayName || 'Staff',
          role: user.role || 'agent'
        });
      }
    }

    const socket = socketRef.current;
    const eventMap = [
      ['voice:presenceUpdate', 'onPresenceUpdate'],
      ['voice:channels', 'onChannelsUpdate'],
      ['voice:private:incoming', 'onPrivateIncoming'],
      ['voice:private:accepted', 'onPrivateAccepted'],
      ['voice:signal', 'onSignal'],
      ['voice:ended', 'onSessionEnded'],
      ['voice:broadcast:incoming', 'onBroadcastIncoming'],
      ['voice:broadcast:joinRequest', 'onBroadcastJoinRequest'],
      ['voice:broadcast:joined', 'onBroadcastJoined'],
      ['voice:channel:joined', 'onChannelJoined'],
      ['voice:channel:memberUpdate', 'onChannelMemberUpdate'],
      ['voice:channel:memberLeft', 'onChannelMemberLeft'],
      ['voice:channel:signal', 'onChannelSignal'],
      ['voice:private:rejected', 'onPrivateRejected'],
      ['voice:ptt:start', 'onPTTStart'],
      ['voice:ptt:end', 'onPTTEnd']
    ];

    eventMap.forEach(([event, key]) => {
      const handler = handlersRef.current[key];
      if (typeof handler === 'function') {
        socket.on(event, handler);
      }
    });

    socket.on('disconnect', () => {
      console.warn('Voice socket disconnected');
    });

    return () => {
      eventMap.forEach(([event, key]) => {
        const handler = handlersRef.current[key];
        if (typeof handler === 'function') {
          socket.off(event, handler);
        }
      });
      socket.off('disconnect');
    };
  }, [user?.id]);

  return socketRef.current;
};
