export const DEFAULT_VOICE_CHANNEL = 'branch';
export const MAX_SIGNAL_BYTES = 100000;

export function voiceChannelName(branchId, channelId = DEFAULT_VOICE_CHANNEL) {
  return `voice:${Number(branchId)}:${channelId}`;
}

export function isValidSignalDescription(value) {
  return Boolean(value && typeof value === 'object' && (value.type === 'offer' || value.type === 'answer') && typeof value.sdp === 'string' && value.sdp.length > 0 && value.sdp.length <= MAX_SIGNAL_BYTES);
}

export function isValidIceCandidate(value) {
  return Boolean(value && typeof value === 'object' && (value.candidate == null || (typeof value.candidate === 'string' && value.candidate.length <= 10000)));
}

export function isAuthorizedVoiceTarget(sender, target, channelId = DEFAULT_VOICE_CHANNEL) {
  return Boolean(sender?.branchId != null && target?.branchId === sender.branchId && target.voiceChannelId === channelId && sender.voiceChannelId === channelId);
}

export function createVoiceRateLimiter({ windowMs = 10000, maxEvents = 100 } = {}) {
  let windowStartedAt = 0;
  let eventCount = 0;
  return () => {
    const now = Date.now();
    if (now - windowStartedAt >= windowMs) {
      windowStartedAt = now;
      eventCount = 0;
    }
    eventCount += 1;
    return eventCount <= maxEvents;
  };
}
