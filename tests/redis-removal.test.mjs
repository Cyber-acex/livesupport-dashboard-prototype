import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

test('package.json no longer includes Redis packages', () => {
  const pkg = readJson(path.join(rootDir, 'package.json'));
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  assert.equal(deps.redis, undefined, 'redis should be removed from dependencies');
  assert.equal(deps.ioredis, undefined, 'ioredis should be removed from dependencies');
});

test('validateEnv no longer references REDIS_URL as a runtime concern', () => {
  const file = fs.readFileSync(path.join(rootDir, 'utils', 'validateEnv.js'), 'utf8');
  assert.equal(file.includes('REDIS_URL'), false, 'validateEnv should not reference REDIS_URL');
});
