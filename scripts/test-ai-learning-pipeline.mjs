import { prisma } from '../db/database-prisma.js';
import { detectPatterns, retrieveRelevantKnowledge, approveLearningCandidate } from '../services/aiLearningService.js';

async function main() {
  const conversations = await prisma.conversation.findMany({ take: 2, select: { id: true } });
  const conversationIds = conversations.map((row) => row.id);
  const marker = `pipeline-${Date.now()}`;
  const activity = await prisma.aiActivity.create({ data: { conversation_id: conversationIds[0] || null, event_type: marker, intent: 'Order Tracking', confidence: 0.9, outcome: 'SUCCESS', metadata: { test: true } } });
  const decision = await prisma.aiDecision.create({ data: { conversation_id: conversationIds[0] || null, intent: 'Order Tracking', confidence: 0.9, metadata: { test: true } } });
  const action = await prisma.aiAction.create({ data: { conversation_id: conversationIds[0] || null, action_type: marker, success: true, result: { test: true } } });
  const feedback = await prisma.aiFeedback.create({ data: { conversation_id: conversationIds[0] || null, category: 'WRONG_CONTEXT', feedback_text: 'branch already selected, AI asked for branch again' } });
  const correction = await prisma.aiCorrection.create({ data: { conversation_id: conversationIds[0] || null, staff_id: null, expected_behavior: 'reuse existing branch', status: 'OPEN' } });
  const candidate = await prisma.aiLearningCandidate.create({ data: { title: marker, proposed_rule: `test rule ${marker}`, category: marker, evidence_count: 3, confidence: 0.9 } });
  const rule = await prisma.aiRule.create({ data: { rule: `test order tracking rule ${marker}`, category: 'ORDER TRACKING', source: marker, confidence: 0.9 } });
  const example = await prisma.aiExample.create({ data: { situation: marker, active: true } });
  const pattern = await prisma.aiMistakePattern.create({ data: { pattern: marker, occurrence_count: 3 } });
  const metric = await prisma.aiEvaluationMetric.create({ data: { period_start: new Date(`2099-01-01T00:00:00.000Z`), total_conversations: 1 } });
  const relevant = await retrieveRelevantKnowledge({ intent: 'Order Tracking', message: `test order tracking ${marker}` });
  if (!relevant.some((item) => item.id === rule.id)) throw new Error('Relevant rule was not retrieved');
  const approved = await approveLearningCandidate(candidate.id, null, 'pipeline test');
  if (approved.status !== 'APPROVED') throw new Error('Candidate was not approved');
  const createdRule = await prisma.aiRule.findFirst({ where: { rule: candidate.proposed_rule } });
  if (!createdRule) throw new Error('Approved candidate did not create a rule');
  await Promise.all([
    prisma.aiActivity.delete({ where: { id: activity.id } }), prisma.aiDecision.delete({ where: { id: decision.id } }), prisma.aiAction.delete({ where: { id: action.id } }),
    prisma.aiFeedback.delete({ where: { id: feedback.id } }), prisma.aiCorrection.delete({ where: { id: correction.id } }), prisma.aiLearningCandidate.delete({ where: { id: candidate.id } }),
    prisma.aiRule.delete({ where: { id: rule.id } }), prisma.aiRule.delete({ where: { id: createdRule.id } }), prisma.aiExample.delete({ where: { id: example.id } }), prisma.aiMistakePattern.delete({ where: { id: pattern.id } }), prisma.aiEvaluationMetric.delete({ where: { id: metric.id } })
  ]);
  console.log(JSON.stringify({ passed: true, conversationIds, verified: ['activity', 'decision', 'action', 'feedback', 'correction', 'candidate', 'approval', 'retrieval', 'metric'] }));
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
