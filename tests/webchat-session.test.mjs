import test from 'node:test';
import assert from 'node:assert/strict';
import { createGuestSessionStorage, getGuestDisplayName, loadGuestSession, saveGuestSession } from '../src/utils/webChatSession.js';

test('guest names default to sequential Guest #001 style labels when blank', () => {
  const storage = createGuestSessionStorage();

  assert.equal(getGuestDisplayName('', storage), 'Guest #001');
  assert.equal(getGuestDisplayName('', storage), 'Guest #002');
});

test('guest session storage round-trips a complete session payload', () => {
  const storage = createGuestSessionStorage();
  const session = {
    guestId: 'guest-123',
    conversationId: 42,
    branchId: 1,
    customerName: 'Jane Doe',
    phone: '+2348123456789',
    channel: 'web'
  };

  saveGuestSession(storage, session);
  assert.deepEqual(loadGuestSession(storage), session);
});
