const DEFAULT_MODE = 'assist';

const SUPPORTED_MODES = new Set(['assist', 'auto', 'manual']);

export function normalizeAutopilotMode(mode) {
  const normalized = String(mode || '').trim().toLowerCase();
  return SUPPORTED_MODES.has(normalized) ? normalized : DEFAULT_MODE;
}

export function canUseAiReply(mode) {
  const normalized = normalizeAutopilotMode(mode);
  return normalized === 'assist' || normalized === 'auto';
}

export function canAutoSendReplies(mode) {
  const normalized = normalizeAutopilotMode(mode);
  return normalized === 'auto';
}
