export const VoiceCallState = Object.freeze({
  Idle: 'Idle',
  Calling: 'Calling',
  Ringing: 'Ringing',
  Incoming: 'Incoming',
  Connecting: 'Connecting',
  Connected: 'Connected',
  Reconnecting: 'Reconnecting',
  Busy: 'Busy',
  Rejected: 'Rejected',
  Missed: 'Missed',
  Failed: 'Failed',
  Ended: 'Ended',
  Disconnected: 'Disconnected'
});

const validTransitions = {
  [VoiceCallState.Idle]: [VoiceCallState.Calling, VoiceCallState.Incoming, VoiceCallState.Busy, VoiceCallState.Failed],
  [VoiceCallState.Calling]: [VoiceCallState.Ringing, VoiceCallState.Connecting, VoiceCallState.Busy, VoiceCallState.Rejected, VoiceCallState.Missed, VoiceCallState.Failed, VoiceCallState.Ended, VoiceCallState.Disconnected],
  [VoiceCallState.Ringing]: [VoiceCallState.Connecting, VoiceCallState.Rejected, VoiceCallState.Missed, VoiceCallState.Failed, VoiceCallState.Ended, VoiceCallState.Disconnected],
  [VoiceCallState.Incoming]: [VoiceCallState.Connecting, VoiceCallState.Rejected, VoiceCallState.Missed, VoiceCallState.Failed, VoiceCallState.Ended, VoiceCallState.Disconnected],
  [VoiceCallState.Connecting]: [VoiceCallState.Connected, VoiceCallState.Reconnecting, VoiceCallState.Failed, VoiceCallState.Ended, VoiceCallState.Disconnected],
  [VoiceCallState.Connected]: [VoiceCallState.Reconnecting, VoiceCallState.Ended, VoiceCallState.Disconnected, VoiceCallState.Busy],
  [VoiceCallState.Reconnecting]: [VoiceCallState.Connected, VoiceCallState.Failed, VoiceCallState.Ended, VoiceCallState.Disconnected],
  [VoiceCallState.Busy]: [VoiceCallState.Idle],
  [VoiceCallState.Rejected]: [VoiceCallState.Idle],
  [VoiceCallState.Missed]: [VoiceCallState.Idle],
  [VoiceCallState.Failed]: [VoiceCallState.Idle],
  [VoiceCallState.Ended]: [VoiceCallState.Idle],
  [VoiceCallState.Disconnected]: [VoiceCallState.Idle]
};

export function transitionState(currentState, nextState) {
  if (!currentState || !nextState) return nextState || currentState;
  if (currentState === nextState) return currentState;
  if ((validTransitions[currentState] || []).includes(nextState)) return nextState;
  return currentState;
}

export function describeState(state) {
  switch (state) {
    case VoiceCallState.Connecting:
      return 'Connecting';
    case VoiceCallState.Connected:
      return 'Connected';
    case VoiceCallState.Reconnecting:
      return 'Reconnecting';
    case VoiceCallState.Busy:
      return 'Busy';
    case VoiceCallState.Ended:
      return 'Ended';
    default:
      return state || VoiceCallState.Idle;
  }
}
