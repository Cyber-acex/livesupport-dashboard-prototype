import { prisma, connectDatabase } from './db/database-prisma.js';

async function run() {
  try {
    await connectDatabase();
    const result = await prisma.ticket.create({
      data: {
        ticket_type: 'Debug',
        subject: 'Debug',
        customer_name: 'Debug',
        customer_phone: '000',
        assignee: 'Debug',
        priority: 'Medium',
        status: 'Open',
        content: 'Debug content',
        tags: '[]',
        sla_due: new Date('2026-05-15T00:00:00Z')
      }
    });
    console.log('RESULT', result);
  } catch (err) {
    console.error('ERR', err);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

run();
