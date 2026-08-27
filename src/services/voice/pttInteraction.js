export function isTouchFirstDevice() {
  if (typeof window === 'undefined') return false;
  const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches;
  return Boolean(coarsePointer && navigator.maxTouchPoints > 0) || 'ontouchstart' in window;
}

export function createPttState(active = false) {
  return { active: Boolean(active), pressed: false };
}

export function reducePttState(state, action) {
  const current = state || createPttState();
  switch (action?.type) {
    case 'desktop-press': return { active: true, pressed: true };
    case 'desktop-release':
    case 'cancel':
    case 'reset': return createPttState();
    case 'mobile-toggle': return createPttState(!current.active);
    default: return current;
  }
}

export function getPttLabel({ active, mobile }) {
  if (mobile) return active ? 'Push to talk active - tap to stop' : 'Push to talk - tap to start';
  return active ? 'Push to talk active - release to stop' : 'Push to talk - hold to speak';
}

export function canTransmit({ inVoiceChannel, pttActive, muted, microphoneAvailable }) {
  return Boolean(inVoiceChannel && pttActive && !muted && microphoneAvailable);
}
