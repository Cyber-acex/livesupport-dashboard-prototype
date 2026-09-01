import test from 'node:test';
import assert from 'node:assert/strict';
import { pickStaffName, normalizeVoicePresenceEntry } from '../src/utils/staffIdentity.js';

test('pickStaffName prefers the human name and ignores random socket ids', () => {
  assert.equal(pickStaffName({ name: 'Ada Okafor', displayName: 'Ada', email: 'ada@branch.com' }), 'Ada Okafor');
  assert.equal(pickStaffName({ email: 'ada@branch.com' }), 'ada@branch.com');
  assert.equal(pickStaffName({}), 'Staff');
});

test('normalizeVoicePresenceEntry preserves the real staff name instead of peer ids', () => {
  const entry = normalizeVoicePresenceEntry({ userId: 7, name: 'Ada Okafor', role: 'agent', branchId: 3, status: 'active' });
  assert.equal(entry.name, 'Ada Okafor');
  assert.equal(entry.userId, 7);
  assert.equal(entry.status, 'active');
});
