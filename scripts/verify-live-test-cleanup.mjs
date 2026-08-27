import { prisma } from '../db/database-prisma.js';

const [rules, candidates] = await Promise.all([
  prisma.aiRule.findMany({ where: { rule: { contains: 'TEST ONLY' } }, select: { id: true, active: true } }),
  prisma.aiLearningCandidate.findMany({ where: { title: { contains: 'TEST ONLY' } }, select: { id: true, status: true } })
]);
console.log(JSON.stringify({ rules, candidates }));
await prisma.$disconnect();
