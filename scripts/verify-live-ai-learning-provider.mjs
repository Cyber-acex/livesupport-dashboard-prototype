import { prisma } from '../db/database-prisma.js';
import { initDatabase, getMistralReply } from '../replies.js';
import { retrieveRelevantKnowledge, approveLearningCandidate } from '../services/aiLearningService.js';
import { db } from '../db/database.js';

const testPhrase = 'AI learning verification';
const testResponse = 'AI learning rule successfully retrieved.';
const ruleText = `TEST ONLY: When the user asks for the exact phrase "${testPhrase}", reply exactly: "${testResponse}". Do not use this rule for any other request.`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  initDatabase(db);
  const candidate = await prisma.aiLearningCandidate.create({ data: { title: 'TEST ONLY provider verification', description: 'Temporary release verification candidate.', proposed_rule: ruleText, category: 'TEST_ONLY', evidence_count: 3, confidence: 1 } });
  let rule = null;
  try {
    await approveLearningCandidate(candidate.id, null, 'Temporary release verification');
    rule = await prisma.aiRule.findFirst({ where: { rule: ruleText } });
    const retrieved = await retrieveRelevantKnowledge({ intent: 'FAQ', message: testPhrase });
    if (!retrieved.some((item) => item.id === rule.id)) throw new Error('temporary rule was not retrieved');
    const learnedResponse = await getMistralReply(testPhrase, null, null, null, null);
    await prisma.aiRule.update({ where: { id: rule.id }, data: { active: false } });
    const disabledRetrieved = await retrieveRelevantKnowledge({ intent: 'FAQ', message: testPhrase });
    const controlResponse = await getMistralReply(testPhrase, null, null, null, null);
    await prisma.aiRule.update({ where: { id: rule.id }, data: { active: true } });
    const reactivatedRetrieved = await retrieveRelevantKnowledge({ intent: 'FAQ', message: testPhrase });
    await sleep(700);
    const activity = await prisma.aiActivity.findMany({ where: { event_type: { in: ['DECISION', 'RESPONSE'] } }, orderBy: { created_at: 'desc' }, take: 20 });
    console.log(JSON.stringify({ learnedResponse, controlResponse, learnedRuleApplied: learnedResponse.toLowerCase().includes(testResponse.toLowerCase()), controlRuleAbsent: disabledRetrieved.every((item) => item.id !== rule.id), reactivatedRuleRetrieved: reactivatedRetrieved.some((item) => item.id === rule.id), activityRecords: activity.length }, null, 2));
  } finally {
    if (rule) await prisma.aiRule.delete({ where: { id: rule.id } }).catch(() => {});
    await prisma.aiLearningCandidate.delete({ where: { id: candidate.id } }).catch(() => {});
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
