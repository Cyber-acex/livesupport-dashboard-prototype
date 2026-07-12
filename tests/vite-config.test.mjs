import test from 'node:test';
import assert from 'node:assert/strict';
import config from '../vite.config.js';

test('vite dev server proxies API and socket traffic to the backend', () => {
  const serverConfig = config.server || {};
  assert.equal(serverConfig.port, 3001);
  assert.equal(serverConfig.proxy?.['/api']?.target, 'http://localhost:3000');
  assert.equal(serverConfig.proxy?.['/socket.io']?.target, 'http://localhost:3000');
  assert.equal(serverConfig.proxy?.['/socket.io']?.ws, true);
});
