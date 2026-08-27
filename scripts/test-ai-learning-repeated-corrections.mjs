import { prisma } from '../db/database-prisma.js';
import { detectPatterns, retrieveRelevantKnowledge, approveLearningCandidate } from '../services/aiLearningService.js';

async function main() {
  const conversations = await prisma.conversation.findMany({ take: 2, select: { id: true } });
  if (conversations.length < 2) throw new Error('Need two conversations for independent evidence test');
  const marker = `test-${Date.now()}`;
  const patternKey = 'branch_context:repeated_context_request';
  const existingPattern = await prisma.aiMistakePattern.findFirst({ where: { pattern: patternKey } });
  const feedback = await prisma.$transaction([
    prisma.aiFeedback.create({ data: { conversation_id: conversations[0].id, category: 'TEST_BRANCH_CONTEXT', feedback_text: `${marker}: customer already selected branch, AI asked again` } }),
    prisma.aiFeedback.create({ data: { conversation_id: conversations[1].id, category: 'TEST_BRANCH_CONTEXT', feedback_text: `${marker}: branch was already known, AI requested branch` } }),
    prisma.aiFeedback.create({ data: { conversation_id: conversations[1].id, category: 'TEST_BRANCH_CONTEXT', feedback_text: `${marker}: selected branch was ignored and asked again` } })
  ]);
  const result = await detectPatterns({ category: 'TEST_BRANCH_CONTEXT', text: `${marker}: selected branch was ignored and asked again`, conversationId: conversations[1].id, userId: null });
  if (!result.proposed_rule) throw new Error('Repeated corrections did not generate a candidate');
  const approved = await approveLearningCandidate(result.id, null, 'automated pipeline test');
  const rules = await retrieveRelevantKnowledge({ intent: 'General Conversation', message: 'the customer already selected a branch', limit: 20 });
  if (!rules.some((rule) => rule.id && rule.rule === approved.proposed_rule)) throw new Error('Approved candidate was not retrieved');
  await prisma.aiRule.deleteMany({ where: { source: 'approved_learning_candidate', rule: approved.proposed_rule } });
  await prisma.aiLearningCandidate.delete({ where: { id: approved.id } });
  if (existingPattern) await prisma.aiMistakePattern.update({ where: { id: existingPattern.id }, data: { occurrence_count: existingPattern.occurrence_count, last_seen: existingPattern.last_seen } });
  else await prisma.aiMistakePattern.deleteMany({ where: { pattern: patternKey } });
  await prisma.aiFeedback.deleteMany({ where: { id: { in: feedback.map((item) => item.id) } } });
  console.log(JSON.stringify({ passed: true, evidenceConversations: 2, candidate: 'created', approval: 'stored', retrieval: 'relevant' }));
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
