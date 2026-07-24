export function normalizeEscalationMetadata(raw = {}) {
  const detection = raw.detection || raw;
  const confidence = Number(
    detection?.confidence ?? raw.ai_confidence ?? raw.confidence ?? raw.score ?? 0
  );
  const detectedIntent = detection?.detectedIntent || raw.detected_intent || raw.detectedIntent || raw.intent || null;
  const escalationReason = detection?.escalationReason || raw.escalation_reason || raw.escalationReason || raw.reason || null;
  const detectedAt = raw.escalated_at || raw.detected_at || raw.timestamp || raw.created_at || null;
  const originalMessage = raw.original_message || raw.message || raw.originalMessage || null;
  const isHighRisk = Boolean(detectedIntent || escalationReason || raw.isHighRisk || raw.shouldEscalate || raw.status === 'Escalated');

  return {
    isHighRisk,
    shouldEscalate: Boolean(raw.shouldEscalate || raw.shouldStopAutomation || isHighRisk),
    detectedIntent,
    escalationReason,
    confidence: Number.isFinite(confidence) ? confidence : 0,
    detectedAt,
    originalMessage,
    reason: escalationReason || (detectedIntent ? 'High-risk intent flagged' : 'Escalated conversation')
  };
}
