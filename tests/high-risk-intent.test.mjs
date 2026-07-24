import test from 'node:test';
import assert from 'node:assert/strict';
import { detectHighRiskIntent } from '../utils/highRiskIntentDetector.js';
import { normalizeEscalationMetadata } from '../src/utils/highRiskEscalationUi.js';

test('flags refund disputes before automation', () => {
  const result = detectHighRiskIntent('I want my money back and I am contacting my bank.');
  assert.equal(result.isHighRisk, true);
  assert.equal(result.shouldEscalate, true);
  assert.equal(result.detectedIntent, 'Refund / Chargeback Dispute');
  assert.match(result.reply, /forwarded your request/i);
});

test('flags allergy questions and avoids guaranteeing safety', () => {
  const result = detectHighRiskIntent('Is this 100% nut-free?');
  assert.equal(result.isHighRisk, true);
  assert.equal(result.shouldEscalate, true);
  assert.equal(result.detectedIntent, 'Allergy Confirmation');
  assert.match(result.reply, /can.t guarantee allergen-free/i);
});

test('keeps normal messages out of escalation when confidence is sufficient', () => {
  const result = detectHighRiskIntent('Can you tell me the lunch specials today?');
  assert.equal(result.isHighRisk, false);
  assert.equal(result.shouldEscalate, false);
  assert.ok(result.confidence >= 0.75);
});

test('normalizes escalation metadata for inbox rendering', () => {
  const normalized = normalizeEscalationMetadata({
    detection: { detectedIntent: 'Refund / Chargeback Dispute', confidence: 0.93, escalationReason: 'Refund / Chargeback Dispute' },
    detectedIntent: 'Refund / Chargeback Dispute',
    escalationReason: 'Refund / Chargeback Dispute',
    ai_confidence: 0.93,
    detected_intent: 'Refund / Chargeback Dispute',
    original_message: 'I want my money back',
    escalated_at: '2026-07-15T12:00:00.000Z'
  });

  assert.equal(normalized.isHighRisk, true);
  assert.equal(normalized.detectedIntent, 'Refund / Chargeback Dispute');
  assert.equal(normalized.confidence, 0.93);
  assert.match(normalized.reason, /Refund/i);
});
