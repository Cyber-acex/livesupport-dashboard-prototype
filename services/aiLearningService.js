import { prisma } from '../db/database.js';

export const LEARNING_CANDIDATE_THRESHOLD = Math.max(2, Number(process.env.LEARNING_CANDIDATE_THRESHOLD || 3));

export function safeAiLog(task) {
  Promise.resolve().then(task).catch((error) => console.warn('AI learning log failed:', error?.message || error));
}

export async function logAiActivity(data = {}) { return prisma.aiActivity.create({ data: { ...data, metadata: data.metadata || undefined } }); }
export async function recordDecision(data = {}) { return prisma.aiDecision.create({ data: { ...data, metadata: data.metadata || undefined } }); }
export async function recordAction(data = {}) { return prisma.aiAction.create({ data: { ...data, result: data.result || undefined } }); }
export async function recordSuccessfulExample({ category, action, response }) {
  return prisma.aiExample.create({ data: { situation: `Successful ${category || 'support'} interaction`, successful_response: response ? String(response).slice(0, 1000) : null, action: action || null, outcome: 'SUCCESS', quality_score: 1, source: 'positive_staff_feedback' } });
}

function normalizePattern(category, text) {
  const value = `${category || 'OTHER'} ${text || ''}`.toLowerCase();
  const context = value.includes('branch') ? 'branch_context' : value.includes('refund') ? 'refund_workflow' : value.includes('order') ? 'order_workflow' : value.includes('reservation') ? 'reservation_workflow' : 'general_response';
  const issue = value.includes('repeat') || value.includes('again') || value.includes('already') ? 'repeated_context_request' : value.includes('halluc') || value.includes('invent') ? 'unsupported_claim' : String(category || 'OTHER').toLowerCase();
  return `${context}:${issue}`;
}

function proposedRuleFor(pattern, category) {
  if (pattern.startsWith('branch_context:')) return 'When a valid branch is already present in the current conversation context, reuse it unless the customer explicitly requests a change.';
  if (pattern.startsWith('refund_workflow:')) return 'Never claim that a refund is complete until the refund action has succeeded and is verified.';
  if (pattern.startsWith('order_workflow:')) return 'Never invent or infer an order identifier that is not present in verified order data.';
  return `Review and improve the AI behavior associated with ${category || 'this recurring issue'}.`;
}

export async function generateLearningCandidate(pattern, category, evidenceCount, conversationCount) {
  const proposedRule = proposedRuleFor(pattern, category);
  const existing = await prisma.aiLearningCandidate.findFirst({ where: { proposed_rule: proposedRule, status: { in: ['PENDING', 'APPROVED'] } } });
  if (existing) return existing;
  return prisma.aiLearningCandidate.create({ data: { title: pattern.startsWith('branch_context:') ? 'Avoid repeated branch selection' : `Review recurring ${category || 'AI'} issue`, description: `Recurring pattern detected across ${conversationCount} conversations.`, proposed_rule: proposedRule, category: category || 'OTHER', evidence_count: evidenceCount, confidence: Math.min(0.99, 0.6 + evidenceCount * 0.05), source_feedback: { pattern, conversationCount } } });
}

export async function detectPatterns({ category, text, conversationId, userId }) {
  const config = userId ? await prisma.setting.findUnique({ where: { user_id: Number(userId) }, select: { aiLearningEnabled: true, aiCandidateDetection: true, aiEvidenceThreshold: true } }).catch(() => null) : null;
  if (config?.aiLearningEnabled === false || config?.aiCandidateDetection === false) return null;
  const threshold = Math.max(2, Number(config?.aiEvidenceThreshold || LEARNING_CANDIDATE_THRESHOLD));
  const patternKey = normalizePattern(category, text);
  const feedbackRows = await prisma.aiFeedback.findMany({ where: { category: category || undefined }, select: { conversation_id: true, feedback_text: true, correction: true } });
  const related = feedbackRows.filter((item) => normalizePattern(category, item.correction || item.feedback_text) === patternKey);
  const conversationIds = new Set(related.map((item) => item.conversation_id).filter(Boolean));
  if (conversationId) conversationIds.add(Number(conversationId));
  const evidenceCount = related.length + (conversationId && !related.some((item) => Number(item.conversation_id) === Number(conversationId)) ? 1 : 0);
  const pattern = await prisma.aiMistakePattern.findFirst({ where: { pattern: patternKey } });
  const updatedPattern = pattern ? await prisma.aiMistakePattern.update({ where: { id: pattern.id }, data: { occurrence_count: evidenceCount, last_seen: new Date() } }) : await prisma.aiMistakePattern.create({ data: { pattern: patternKey, occurrence_count: evidenceCount, severity: 'medium' } });
  if (evidenceCount >= threshold && conversationIds.size >= 2) return generateLearningCandidate(patternKey, category, evidenceCount, conversationIds.size);
  return updatedPattern;
}

export async function recordCorrection({ conversationId, messageId, staffId, originalResponse, correctedResponse, explanation, expectedBehavior }) {
  return prisma.aiCorrection.create({ data: { conversation_id: conversationId || null, message_id: messageId || null, staff_id: staffId || null, original_response: originalResponse || null, corrected_response: correctedResponse || null, explanation: explanation || null, expected_behavior: expectedBehavior || null } });
}

export async function recordFeedback({ conversationId, messageId, userId, kind, category, severity, feedbackText, correction, originalResponse, expectedBehavior }) {
  const feedback = await prisma.aiFeedback.create({ data: { conversation_id: conversationId || null, message_id: messageId || null, user_id: userId || null, kind: kind || null, category: category || null, severity: severity || null, feedback_text: feedbackText || null, correction: correction || null } });
  if (correction || expectedBehavior) {
    try {
      await recordCorrection({ conversationId, messageId, staffId: userId, originalResponse, correctedResponse: correction, explanation: feedbackText, expectedBehavior });
    } catch (error) {
      console.warn('AI correction log failed after feedback was stored:', error?.message || error);
    }
  }
  if (kind === 'correct' || category === 'GOOD_RESPONSE') {
    try { await recordSuccessfulExample({ category, response: originalResponse }); } catch (error) { console.warn('Successful AI example log failed:', error?.message || error); }
  }
  safeAiLog(() => detectPatterns({ category, text: correction || feedbackText, conversationId, userId }));
  return feedback;
}

export async function approveLearningCandidate(id, reviewerId, reason = null) {
  const candidateRecord = await prisma.aiLearningCandidate.findUnique({ where: { id: Number(id) } });
  if (!candidateRecord) throw new Error('candidate_not_found');
  const activeRules = await prisma.aiRule.findMany({ where: { active: true, category: candidateRecord.category || undefined }, select: { rule: true } });
  const hasConflict = activeRules.some((item) => (item.rule.includes('Always ask for branch') && candidateRecord.proposed_rule.includes('reuse it')) || (item.rule.includes('Never ask for branch') && candidateRecord.proposed_rule.includes('request a change')));
  if (hasConflict) throw new Error('rule_conflict_requires_review');
  const candidate = await prisma.aiLearningCandidate.update({ where: { id: Number(id) }, data: { status: 'APPROVED', reviewed_by: reviewerId, reviewed_at: new Date(), review_reason: reason || null } });
  const similarRule = await prisma.aiRule.findFirst({ where: { active: true, rule: candidate.proposed_rule } });
  if (!similarRule) await prisma.aiRule.create({ data: { rule: candidate.proposed_rule, category: candidate.category, confidence: candidate.confidence, source: 'approved_learning_candidate' } });
  return candidate;
}

export async function rejectLearningCandidate(id, reviewerId, reason = null) { return prisma.aiLearningCandidate.update({ where: { id: Number(id) }, data: { status: 'REJECTED', reviewed_by: reviewerId, reviewed_at: new Date(), review_reason: reason || null } }); }

export async function retrieveRelevantKnowledge({ intent = '', message = '', branchId = null, workflow = null, limit = 8 } = {}) {
  const terms = `${intent} ${message}`.toLowerCase().split(/[^a-z0-9]+/).filter((term) => term.length > 3).slice(0, 16);
  const rules = await prisma.aiRule.findMany({ where: { active: true, OR: [{ branch_id: null }, { branch_id: Number(branchId) || -1 }], AND: [{ OR: [{ workflow: null }, { workflow: workflow || '' }] }] }, orderBy: [{ priority: 'asc' }, { updated_at: 'desc' }], take: 100 });
  return rules.filter((item) => terms.some((term) => item.rule.toLowerCase().includes(term) || String(item.category || '').toLowerCase().includes(term))).slice(0, limit);
}

export async function recordEvaluationMetric(data) { return prisma.aiEvaluationMetric.upsert({ where: { period_start: data.period_start }, update: data, create: data }); }

export async function getLearningDashboard(days = 7) {
  const since = new Date(Date.now() - days * 86400000);
  const [feedback, corrections, candidates, rules, examples, patterns, activity, actions, successfulActions, approved, resolved, history, activityHistory] = await Promise.all([
    prisma.aiFeedback.count({ where: { created_at: { gte: since } } }),
    prisma.aiFeedback.count({ where: { created_at: { gte: since }, correction: { not: null } } }),
    prisma.aiLearningCandidate.findMany({ where: { created_at: { gte: since } }, orderBy: { created_at: 'desc' }, take: 50 }),
    prisma.aiRule.count({ where: { active: true } }), prisma.aiExample.count({ where: { active: true } }),
    prisma.aiMistakePattern.findMany({ where: { resolved: false }, orderBy: { last_seen: 'desc' }, take: 50 }),
    prisma.aiActivity.findMany({ where: { created_at: { gte: since } }, orderBy: { created_at: 'desc' }, take: 100 }),
    prisma.aiAction.count({ where: { created_at: { gte: since } } }),
    prisma.aiAction.count({ where: { created_at: { gte: since }, success: true } }),
    prisma.aiLearningCandidate.count({ where: { status: 'APPROVED', reviewed_at: { gte: since } } }),
    prisma.resolved.count({ where: { resolved_at: { gte: since } } }),
    prisma.$queryRawUnsafe(`SELECT (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Africa/Lagos')::date AS day, count(*)::int AS total, count(*) FILTER (WHERE outcome = 'SUCCESS')::int AS successful FROM ai_activity WHERE created_at >= $1 GROUP BY day ORDER BY day`, since),
    prisma.$queryRawUnsafe(`SELECT (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Africa/Lagos')::date AS day, 'corrections' AS kind, count(*)::int AS count FROM ai_feedback WHERE created_at >= $1 AND correction IS NOT NULL GROUP BY day UNION ALL SELECT (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Africa/Lagos')::date, 'candidates', count(*)::int FROM ai_learning_candidates WHERE created_at >= $1 GROUP BY 1 UNION ALL SELECT (reviewed_at AT TIME ZONE 'UTC' AT TIME ZONE 'Africa/Lagos')::date, 'approved', count(*)::int FROM ai_learning_candidates WHERE reviewed_at >= $1 AND status = 'APPROVED' GROUP BY 1 UNION ALL SELECT (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Africa/Lagos')::date, 'successful', count(*)::int FROM ai_activity WHERE created_at >= $1 AND outcome = 'SUCCESS' GROUP BY 1 ORDER BY 1`, since)
  ]);
  const total = activity.length; const successful = activity.filter((item) => item.outcome === 'SUCCESS').length;
  const progress = history.map((row) => ({ date: row.day, total: row.total, accuracy: row.total ? row.successful / row.total : null }));
  const activityByDay = new Map();
  activityHistory.forEach((row) => { const key = String(row.day); const item = activityByDay.get(key) || { date: row.day, corrections: 0, candidates: 0, approved: 0, successful: 0 }; item[row.kind] = row.count; activityByDay.set(key, item); });
  return { metrics: { feedback, corrections, candidates: candidates.length, approved, rules, examples, patterns: patterns.length, total, accuracy: total ? successful / total : null, actionSuccessRate: actions ? successfulActions / actions : null, correctionRate: total ? corrections / total : null, resolutionRate: total ? resolved / total : null }, history: progress, activityHistory: [...activityByDay.values()], candidates, patterns, activity };
}
