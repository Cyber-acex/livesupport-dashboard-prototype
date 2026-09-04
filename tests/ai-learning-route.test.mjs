import test from 'node:test';
import assert from 'node:assert/strict';

process.env.SKIP_AUTH = '1';

const { app } = await import('../server.js');

test('GET /api/ai-learning returns dashboard metrics payload', async () => {
  const server = app.listen(0);

  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/api/ai-learning?days=7`);
    const body = await response.text();

    assert.equal(response.status, 200, body);

    const payload = JSON.parse(body);
    assert.ok(payload && typeof payload === 'object');
    assert.ok(Array.isArray(payload.history));
    assert.ok(Array.isArray(payload.activityHistory));
    assert.ok(payload.metrics && typeof payload.metrics === 'object');
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});
