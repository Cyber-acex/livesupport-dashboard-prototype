import { prisma } from '../db/database-prisma.js';
const users = await prisma.user.findMany({ select: { id: true, email: true, role: true }, take: 20 });
console.log(users);
await prisma.$disconnect();
