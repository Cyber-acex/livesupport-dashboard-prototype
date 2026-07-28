import test from 'node:test';
import assert from 'node:assert/strict';
import { mergePresenceIntoDirectory } from '../src/utils/voicePresence.js';

test('merges presence updates into the directory even when it starts empty', () => {
  const previous = [];
  const next = mergePresenceIntoDirectory(previous, [
    { userId: 7, name: 'John Agent', role: 'agent', status: 'available' }
  ]);

  assert.equal(next.length, 1);
  assert.equal(next[0].id, 7);
  assert.equal(next[0].name, 'John Agent');
  assert.equal(next[0].online, true);
  assert.equal(next[0].status, 'available');
  assert.equal(next[0].availability, 'Available');
});

test('marks missing users offline while keeping existing directory entries', () => {
  const previous = [
    { id: 4, name: 'Admin User', role: 'admin', department: 'Operations', branch: 'Main Branch', online: true, status: 'available', availability: 'Available' },
    { id: 7, name: 'John Agent', role: 'agent', department: 'Operations', branch: 'Main Branch', online: false, status: 'offline', availability: 'Offline' }
  ];

  const next = mergePresenceIntoDirectory(previous, [
    { userId: 7, name: 'John Agent', role: 'agent', status: 'away' }
  ]);

  assert.equal(next.length, 2);
  assert.equal(next.find((entry) => entry.id === 7).online, true);
  assert.equal(next.find((entry) => entry.id === 7).status, 'away');
  assert.equal(next.find((entry) => entry.id === 4).online, false);
  assert.equal(next.find((entry) => entry.id === 4).status, 'offline');
  assert.equal(next.find((entry) => entry.id === 4).availability, 'Offline');
});
