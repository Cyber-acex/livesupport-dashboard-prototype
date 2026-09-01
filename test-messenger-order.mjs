const senderId = 'messenger-order-test-2026';
const messages = [
  'I want to order two blueberry cheese cakes',
  'Delivery to 2 Oba Akinjobi Street, Ikeja',
  'I have no allergies',
  'Pay by card',
  'yes please place it now'
];
const base = 'http://127.0.0.1:3000';

for (let i = 0; i < messages.length; i++) {
  const payload = {
    entry: [{
      messaging: [{
        sender: { id: senderId },
        recipient: { id: 'PAGE_ID' },
        message: { mid: `mid.${Date.now()}.${i}`, text: messages[i] }
      }]
    }]
  };
  const res = await fetch(base + '/webhook/messenger', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  console.log('STEP', i + 1, messages[i], '->', res.status);
  await new Promise((r) => setTimeout(r, 1200));
}

const { prisma } = await import('./db/database-prisma.js');
const rows = await prisma.order.findMany({
  where: { phone: senderId },
  orderBy: { order_date: 'desc' },
  select: { id: true, order_id: true, product: true, status: true, total_amount: true, conversation_id: true, phone: true, order_date: true }
});
console.log('DB_ORDERS', JSON.stringify(rows, null, 2));
await prisma.$disconnect();
