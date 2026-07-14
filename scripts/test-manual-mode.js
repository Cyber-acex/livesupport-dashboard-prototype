import { io } from 'socket.io-client';

async function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }

(async ()=>{
  const socket = io('http://localhost:3002', { transports: ['websocket'] });
  socket.on('connect', async ()=>{
    console.log('socket connected', socket.id);
    socket.emit('agent:register', { userId: 'test-manual', name: 'Test Manual', role: 'agent', autopilotMode: 'manual' });
    // mark active on conversation 4
    socket.emit('agent:activeConversation', { conversationId: 4 });
    // wait a moment for server to process presence
    await sleep(600);
    try {
      const res = await fetch('http://localhost:3002/api/suggest-reply/4');
      const data = await res.json();
      console.log('suggest-reply response:', JSON.stringify(data));
    } catch (e) {
      console.error('fetch error', e);
    }
    socket.disconnect();
    process.exit(0);
  });
  socket.on('connect_error', (err)=>{ console.error('connect_error', err); process.exit(1); });
})();
