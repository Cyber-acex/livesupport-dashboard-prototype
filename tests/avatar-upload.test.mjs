import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveAvatarUploadFile } from '../src/utils/avatarUpload.js';

test('resolveAvatarUploadFile uses the most recently selected file from the ref', () => {
  const latestFile = { name: 'avatar.png' };
  const latestFileRef = { current: latestFile };

  assert.equal(resolveAvatarUploadFile(null, latestFileRef), latestFile);
  assert.equal(resolveAvatarUploadFile({ name: 'older.png' }, latestFileRef), latestFile);
});

test('resolveAvatarUploadFile falls back to the current state value', () => {
  const selectedFile = { name: 'selected.png' };

  assert.equal(resolveAvatarUploadFile(selectedFile, { current: null }), selectedFile);
  assert.equal(resolveAvatarUploadFile(null, { current: null }), null);
});
