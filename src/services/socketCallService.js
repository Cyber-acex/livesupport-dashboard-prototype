import { io } from 'socket.io-client';

export class SocketCallService {
  constructor({ debug = false, onEvent } = {}) {
    this.debug = debug;
    this.onEvent = onEvent;
    this.socket = null;
    this.connected = false;
    this.pending = new Map();
  }

  log(...args) {
    if (this.debug) {
      console.info('[SocketCallService]', ...args);
    }
  }

  connect(url = undefined) {
    if (this.socket) return this.socket;

    this.socket = io(url, { transports: ['websocket', 'polling'] });
    this.socket.on('connect', () => {
      this.connected = true;
      this.log('Socket connected', this.socket.id);
      if (typeof this.onEvent === 'function') {
        this.onEvent({ type: 'socket:connected' });
      }
    });

    this.socket.on('disconnect', () => {
      this.connected = false;
      this.log('Socket disconnected');
      if (typeof this.onEvent === 'function') {
        this.onEvent({ type: 'socket:disconnected' });
      }
    });

    this.socket.on('connect_error', (error) => {
      this.log('Socket connection error', error);
      if (typeof this.onEvent === 'function') {
        this.onEvent({ type: 'socket:error', payload: error });
      }
    });

    return this.socket;
  }

  emit(event, payload) {
    if (!this.socket) {
      this.connect();
    }
    this.log('Emit', event, payload);
    this.socket.emit(event, payload);
  }

  registerCallContext({ secureToken, role, userId, name }) {
    this.emit('call:register', { secureToken, role, userId, name });
  }

  registerVoiceContext(payload) {
    this.emit('voice:register', payload);
  }

  startCall(payload) {
    this.emit('call:start', payload);
  }

  incomingCall(payload) {
    this.emit('call:incoming', payload);
  }

  acceptCall(payload) {
    this.emit('call:accept', payload);
  }

  declineCall(payload) {
    this.emit('call:decline', payload);
  }

  cancelCall(payload) {
    this.emit('call:cancel', payload);
  }

  endCall(payload) {
    this.emit('call:end', payload);
  }

  sendOffer(payload) {
    this.emit('webrtc:offer', payload);
  }

  sendAnswer(payload) {
    this.emit('webrtc:answer', payload);
  }

  sendIceCandidate(payload) {
    this.emit('webrtc:icecandidate', payload);
  }

  on(event, handler) {
    if (!this.socket) {
      this.connect();
    }
    this.socket.on(event, handler);
  }

  off(event, handler) {
    if (this.socket) {
      this.socket.off(event, handler);
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
    }
  }
}

export const createSocketCallService = (options) => new SocketCallService(options);
