import dotenv from 'dotenv';
dotenv.config();
import { prisma } from '../db/database-prisma.js';

async function seedStaff() {
  try {
    const staffList = [
      { fullName: 'Admin User', email: 'admin@livesupport.com', password: 'admin123', role: 'admin', branch_id: 1 },
      { fullName: 'John Agent', email: 'agent1@livesupport.com', password: 'password123', role: 'agent', branch_id: 1 },
      { fullName: 'Jane Agent', email: 'agent2@livesupport.com', password: 'password123', role: 'agent', branch_id: 1 }
    ];

    for (const s of staffList) {
      await prisma.staff.upsert({
        where: { email: s.email },
        update: { fullName: s.fullName, password: s.password, role: s.role, branch_id: s.branch_id },
        create: s
      });
      console.log('Upserted staff:', s.email);
    }

    console.log('Staff seed completed');
  } catch (err) {
    console.error('Staff seed error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

seedStaff();
