export const CALL_STATES = {
  idle: 'idle',
  calling: 'calling',
  ringing: 'ringing',
  connecting: 'connecting',
  connected: 'connected',
  ended: 'ended',
  declined: 'declined',
  failed: 'failed',
  busy: 'busy',
  offline: 'offline',
  cancelled: 'cancelled'
};

export class CallService {
  constructor(debug = false) {
    this.debug = debug;
  }

  log(...args) {
    if (this.debug) {
      console.info('[CallService]', ...args);
    }
  }

  getStatusLabel(status) {
    const labels = {
      idle: 'Idle',
      calling: 'Calling...',
      ringing: 'Ringing...',
      connecting: 'Connecting...',
      connected: 'Connected',
      ended: 'Ended',
      declined: 'Declined',
      failed: 'Failed',
      busy: 'Busy',
      offline: 'Offline',
      cancelled: 'Cancelled'
    };
    return labels[status] || 'Unknown';
  }

  formatDuration(seconds = 0) {
    const safe = Math.max(0, Math.floor(seconds));
    const minutes = Math.floor(safe / 60).toString().padStart(2, '0');
    const remainingSeconds = (safe % 60).toString().padStart(2, '0');
    return `${minutes}:${remainingSeconds}`;
  }

  isTerminalState(status) {
    return ['ended', 'declined', 'failed', 'busy', 'offline', 'cancelled'].includes(status);
  }
}

export const callService = new CallService(false);
