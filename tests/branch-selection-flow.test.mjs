import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeBranchSelectionReply, buildBranchSelectionPrompt, resolveBranchSelection } from '../utils/branchSelection.js';

test('normalizes punctuation around numeric replies', () => {
  assert.equal(normalizeBranchSelectionReply('  2!  '), '2');
  assert.equal(normalizeBranchSelectionReply('(1)'), '1');
  assert.equal(normalizeBranchSelectionReply('  '), '');
});

test('builds a dynamic branch selection prompt from active branches', () => {
  const prompt = buildBranchSelectionPrompt([
    { id: 10, name: 'Ikeja' },
    { id: 20, name: 'Lekki' }
  ]);
  assert.match(prompt, /Ikeja/);
  assert.match(prompt, /Lekki/);
  assert.match(prompt, /1️⃣/);
  assert.match(prompt, /2️⃣/);
});

test('uses plain numbering for Messenger branch prompts', () => {
  const prompt = buildBranchSelectionPrompt([
    { id: 10, name: 'Ikeja' },
    { id: 20, name: 'Lekki' }
  ], 'messenger');

  assert.match(prompt, /1\. Ikeja/);
  assert.match(prompt, /2\. Lekki/);
  assert.doesNotMatch(prompt, /1️⃣/);
});

test('resolves a valid selection to a real active branch', () => {
  const branches = [
    { id: 10, name: 'Ikeja', is_active: true, is_archived: false },
    { id: 20, name: 'Lekki', is_active: true, is_archived: false },
    { id: 30, name: 'Closed', is_active: false, is_archived: false }
  ];

  assert.deepEqual(resolveBranchSelection('2', branches), { id: 20, name: 'Lekki', is_active: true, is_archived: false });
  assert.equal(resolveBranchSelection('3', branches), null);
  assert.equal(resolveBranchSelection('closed', branches), null);
});
