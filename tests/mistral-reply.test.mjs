import test from 'node:test';
import assert from 'node:assert/strict';
import 'dotenv/config';
import { getMistralReply } from '../replies.js';

test('getMistralReply returns a conversational reply instead of the fallback', async () => {
  const result = await getMistralReply('hello', '+1234567890', 1, 1);

  assert.equal(typeof result, 'string');
  assert.ok(result.length > 0, 'reply should not be empty');
  assert.ok(!result.includes("Sorry, I'm having trouble processing that right now"), 'reply should not fall back to the hardcoded error');
});
