import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

/**
 * Custom hook for managing voice socket connections and events
 */
export const useVoiceSocket = (user, handlers = {}) => {
  const socketRef = useRef(null);
  const [socket, setSocket] = useState(null);
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
      setSocket(null);
      return;
    }

    let activeSocket = socketRef.current;
    let connectListener;
    let connectErrorListener;
    let disconnectListener;

    if (!activeSocket) {
      const newSocket = io({ transports: ['websocket', 'polling'] });
      socketRef.current = newSocket;
      setSocket(newSocket);
      activeSocket = newSocket;

      connectListener = () => {
        console.log('Voice socket connected:', newSocket.id);
        newSocket.emit('voice:register', {
          userId: user.id,
          name: user.name || user.displayName || 'Staff',
          role: user.role || 'agent'
        });
      };
      connectErrorListener = (error) => {
        console.error('Voice socket connection error:', error);
      };

      newSocket.on('connect', connectListener);
      newSocket.on('connect_error', connectErrorListener);
    } else if (activeSocket.connected) {
      activeSocket.emit('voice:register', {
        userId: user.id,
        name: user.name || user.displayName || 'Staff',
        role: user.role || 'agent'
      });
    }

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
        activeSocket.on(event, handler);
      }
    });

    disconnectListener = () => {
      console.warn('Voice socket disconnected');
    };
    activeSocket.on('disconnect', disconnectListener);

    return () => {
      eventMap.forEach(([event, key]) => {
        const handler = handlersRef.current[key];
        if (typeof handler === 'function') {
          activeSocket.off(event, handler);
        }
      });
      if (connectListener) activeSocket.off('connect', connectListener);
      if (connectErrorListener) activeSocket.off('connect_error', connectErrorListener);
      if (disconnectListener) activeSocket.off('disconnect', disconnectListener);
    };
  }, [user?.id, user?.name, user?.role]);

  return socket;
};
