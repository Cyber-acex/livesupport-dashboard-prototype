import test from 'node:test';
import assert from 'node:assert/strict';
import { SocketCallService } from '../src/services/socketCallService.js';

test('registerVoiceContext emits voice:register with the current user payload', () => {
  const service = new SocketCallService();
  const emitted = [];
  service.socket = {
    emit: (...args) => emitted.push(args)
  };

  service.registerVoiceContext({ userId: 7, name: 'Ada', role: 'agent' });

  assert.deepEqual(emitted, [
    ['voice:register', { userId: 7, name: 'Ada', role: 'agent' }]
  ]);
});
