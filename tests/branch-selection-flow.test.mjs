import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeBranchSelectionReply, buildBranchSelectionPrompt, resolveBranchSelection, getActiveBranchContext, shouldPromptForBranchSelection, isExplicitBranchChangeRequest } from '../utils/branchSelection.js';

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

test('locks the branch once selected and only allows re-selection on explicit change requests', () => {
  const active = getActiveBranchContext({ branchId: 1, conversationState: { branchId: 1 }, message: 'I want to place an order' });

  assert.equal(active.branchId, 1);
  assert.equal(active.branchName, 'Ikeja');
  assert.equal(active.hasSelectedBranch, true);
  assert.equal(shouldPromptForBranchSelection({ branchId: 1, message: 'I want to place an order' }), false);
  assert.equal(shouldPromptForBranchSelection({ branchId: null, message: 'I want to place an order' }), true);
  assert.equal(isExplicitBranchChangeRequest('I want to switch to Lekki'), true);
  assert.equal(isExplicitBranchChangeRequest('I want to place an order'), false);
});
