import { prisma } from './db/database-prisma.js';
const users = await prisma.user.findMany();
console.log('Users in database:', JSON.stringify(users, null, 2));
await prisma.$disconnect();
