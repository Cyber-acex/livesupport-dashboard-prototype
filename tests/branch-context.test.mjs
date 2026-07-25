import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeBranchId, resolveBranchId, injectBranchId } from '../utils/branchContext.js';

test('normalizeBranchId keeps only valid positive values', () => {
  assert.equal(normalizeBranchId('7'), 7);
  assert.equal(normalizeBranchId(0), null);
  assert.equal(normalizeBranchId('abc'), null);
});

test('resolveBranchId prefers request and session branch context over fallback', () => {
  const req = {
    branchId: 3,
    session: {
      branchId: 2,
      branch: { id: 1 },
      user: { branch_id: 4 }
    }
  };

  assert.equal(resolveBranchId(req, 9), 3);
  assert.equal(resolveBranchId({ session: { branch: { id: 1 } } }, 9), 1);
  assert.equal(resolveBranchId({ session: { user: { branch_id: 4 } } }, 9), 4);
});

test('injectBranchId adds a branch id only when present', () => {
  assert.deepEqual(injectBranchId({ name: 'order' }, 5), { name: 'order', branch_id: 5 });
  assert.deepEqual(injectBranchId({ name: 'order' }, null), { name: 'order' });
});
