import test from 'node:test';
import assert from 'node:assert/strict';
import { extractInsertId } from '../utils/dbInsert.js';

test('extractInsertId handles Postgres RETURNING results', () => {
  assert.equal(extractInsertId({ rows: [{ id: 42 }] }), 42);
  assert.equal(extractInsertId([{ id: 7 }]), 7);
  assert.equal(extractInsertId({ insertId: 9 }), 9);
  assert.equal(extractInsertId({ id: 11 }), 11);
  assert.equal(extractInsertId(null), null);
});
