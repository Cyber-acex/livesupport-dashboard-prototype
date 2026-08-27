import { io } from 'socket.io-client';

export class SignalingService {
  constructor({ socketUrl, onEvent, onConnected, onDisconnected, onError, logger = () => {} } = {}) {
    this.socketUrl = socketUrl;
    this.onEvent = onEvent;
    this.onConnected = onConnected;
    this.onDisconnected = onDisconnected;
    this.onError = onError;
    this.logger = logger;
    this.socket = null;
    this.heartbeatTimer = null;
    this.heartbeatIntervalMs = 25000;
    this.isConnected = false;
  }

  connect({ user, url } = {}) {
    if (this.socket) return this.socket;
    const targetUrl = url || this.socketUrl || window.location.origin;
    this.socket = io(targetUrl, {
      transports: ['polling', 'websocket'],
      upgrade: true,
      reconnection: true,
      reconnectionDelay: 600
    });

    this.socket.on('connect', () => {
      this.isConnected = true;
      this.logger('voice-signaling connected');
      this.onConnected?.();
      this.startHeartbeat();
    });

    this.socket.on('disconnect', () => {
      this.isConnected = false;
      this.stopHeartbeat();
      this.onDisconnected?.();
    });

    this.socket.on('connect_error', (error) => {
      this.logger('voice-signaling connect_error', error);
      this.onError?.(error);
    });

    const eventNames = ['call:incoming', 'call:accepted', 'call:declined', 'call:busy', 'call:ended', 'call:error', 'webrtc:offer', 'webrtc:answer', 'webrtc:icecandidate', 'voice:presence', 'voice:presenceUpdate', 'voice:error', 'voice:ping'];
    eventNames.forEach((eventName) => {
      this.socket.on(eventName, (payload) => this.onEvent?.(eventName, payload));
    });

    if (user) {
      this.register(user);
    }

    return this.socket;
  }

  register(user) {
    if (!this.socket || !user?.id) return;
    this.emit('voice:register', {
      userId: user.id,
      name: user.name,
      role: user.role,
      department: user.department,
      branch: user.branch,
      branchId: user.branchId || user.branch || null,
      avatar: user.avatar,
      status: 'online'
    });
  }

  emit(eventName, payload) {
    if (!this.socket) return;
    this.socket.emit(eventName, payload);
  }

  call(staffId, callId, caller, offer, branchId) {
    this.emit('call:start', {
      recipientId: staffId,
      callId,
      caller: {
        ...caller,
        userId: caller.id || caller.userId || null
      },
      offer,
      branchId,
      timestamp: Date.now()
    });
  }

  accept(callId, toUserId, fromUserId, branchId) {
    this.emit('call:accept', { callId, toUserId, fromUserId, branchId, timestamp: Date.now() });
  }

  reject(callId, toUserId, fromUserId, branchId) {
    this.emit('call:decline', { callId, toUserId, fromUserId, branchId, timestamp: Date.now() });
  }

  cancel(callId, toUserId, fromUserId, branchId) {
    this.emit('call:end', { callId, toUserId, fromUserId, branchId, timestamp: Date.now() });
  }

  answer(callId, toUserId, fromUserId, answer, branchId) {
    this.emit('webrtc:answer', { callId, toUserId, fromUserId, answer, branchId, timestamp: Date.now() });
  }

  sendIceCandidate(callId, toUserId, fromUserId, candidate, branchId) {
    this.emit('webrtc:icecandidate', { callId, toUserId, fromUserId, candidate, branchId, timestamp: Date.now() });
  }

  sendPresence(payload) {
    this.emit('voice:presence', payload);
  }

  ping() {
    this.emit('voice:ping', { timestamp: Date.now() });
  }

  startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = window.setInterval(() => {
      this.ping();
    }, this.heartbeatIntervalMs);
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) {
      window.clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  dispose() {
    this.stopHeartbeat();
    this.socket?.disconnect();
    this.socket = null;
    this.isConnected = false;
  }
}
