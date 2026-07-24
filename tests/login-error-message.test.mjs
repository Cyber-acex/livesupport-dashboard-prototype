import test from 'node:test';
import assert from 'node:assert/strict';
import { getLoginErrorMessage, getLoginErrorMessageFromQuery } from '../src/utils/loginErrorMessages.js';

test('maps invalid credentials to a user-friendly message', () => {
  assert.equal(getLoginErrorMessage('invalid'), 'Invalid email or password. Please try again.');
  assert.equal(getLoginErrorMessage('invalid_credentials'), 'Invalid email or password. Please try again.');
});

test('maps branch selection issues to a clear message', () => {
  assert.equal(getLoginErrorMessage('branch_required'), 'Please select a branch before signing in.');
  assert.equal(getLoginErrorMessage('branch_mismatch'), 'You are not assigned to the selected branch.');
});

test('reads the error from a query string', () => {
  assert.equal(getLoginErrorMessageFromQuery('?error=invalid'), 'Invalid email or password. Please try again.');
});
