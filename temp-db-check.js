import { prisma, connectDatabase } from './db/database-prisma.js';

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d, days) {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}

function startOfWeek(d) {
  const date = startOfDay(d);
  const day = date.getDay();
  const diff = (day + 6) % 7; // make Monday start of week
  return addDays(date, -diff);
}

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

async function run() {
  try {
    await connectDatabase();
    const now = new Date();

    const dayStart = startOfDay(now);
    const dayEnd = addDays(dayStart, 1);

    const weekStart = startOfWeek(now);
    const weekEnd = addDays(weekStart, 7);

    const monthStart = startOfMonth(now);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const daily = await prisma.message.count({ where: { sender: { in: ['customer', 'received'] }, created_at: { gte: dayStart, lt: dayEnd } } });
    const weekly = await prisma.message.count({ where: { sender: { in: ['customer', 'received'] }, created_at: { gte: weekStart, lt: weekEnd } } });
    const monthly = await prisma.message.count({ where: { sender: { in: ['customer', 'received'] }, created_at: { gte: monthStart, lt: monthEnd } } });

    const sample = await prisma.message.findMany({ select: { id: true, sender: true, created_at: true, message: true }, orderBy: { id: 'desc' }, take: 5 });

    console.log('daily', JSON.stringify([{ count: daily }]));
    console.log('weekly', JSON.stringify([{ count: weekly }]));
    console.log('monthly', JSON.stringify([{ count: monthly }]));
    console.log('sample', JSON.stringify(sample));
  } catch (err) {
    console.error('ERROR', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

run();