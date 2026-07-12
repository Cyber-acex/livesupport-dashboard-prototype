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

    const registerVoiceSocket = (socketInstance) => {
      if (!socketInstance || socketInstance.__voiceRegistrationPromise) {
        return socketInstance?.__voiceRegistrationPromise || null;
      }

      const registerPayload = {
        userId: user.id,
        name: user.name || user.displayName || 'Staff',
        role: user.role || 'agent'
      };

      socketInstance.__voiceRegistrationPromise = new Promise((resolve) => {
        const finish = (response) => {
          clearTimeout(timeoutId);
          resolve(response || { ok: true });
        };

        const timeoutId = setTimeout(() => {
          finish({ ok: false, timedOut: true });
        }, 5000);

        if (socketInstance.connected) {
          socketInstance.emit('voice:register', registerPayload, finish);
        } else {
          const onConnect = () => {
            socketInstance.off('connect', onConnect);
            socketInstance.emit('voice:register', registerPayload, finish);
          };
          socketInstance.once('connect', onConnect);
        }
      });

      socketInstance.waitForVoiceRegistration = () => socketInstance.__voiceRegistrationPromise;
      return socketInstance.__voiceRegistrationPromise;
    };

    if (!activeSocket) {
      const newSocket = io({ transports: ['websocket', 'polling'] });
      socketRef.current = newSocket;
      setSocket(newSocket);
      activeSocket = newSocket;

      connectListener = () => {
        console.log('Voice socket connected:', newSocket.id);
        registerVoiceSocket(newSocket);
      };
      connectErrorListener = (error) => {
        console.error('Voice socket connection error:', error);
      };

      newSocket.on('connect', connectListener);
      newSocket.on('connect_error', connectErrorListener);
    } else if (activeSocket.connected) {
      registerVoiceSocket(activeSocket);
    }

    const eventMap = [
      ['voice:presenceUpdate', 'onPresenceUpdate'],
      ['voice:channels', 'onChannelsUpdate'],
      ['voice:private:incoming', 'onPrivateIncoming'],
      ['voice:private:accepted', 'onPrivateAccepted'],
      ['voice:private:started', 'onPrivateStarted'],
      ['voice:private:error', 'onPrivateError'],
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
