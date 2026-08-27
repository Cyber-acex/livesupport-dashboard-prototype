import 'dotenv/config';
import { getMistralReply } from '../replies.js';

const messages = ['I want to order', 'What is on the menu?', 'I need help'];
const fallbackMarker = "Sorry, I'm having trouble processing that right now";

for (const message of messages) {
  const reply = await getMistralReply(message, null, null, null, null, `wrapper-${Date.now()}`);
  console.log(JSON.stringify({ message, reply, isFallback: reply.includes(fallbackMarker) }));
}
