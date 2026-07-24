import test from 'node:test';
import assert from 'node:assert/strict';
import { extractCsatRating, isCsatReplyText } from '../src/utils/csat.js';

test('extracts a numeric 1-5 rating from customer replies', () => {
  assert.equal(extractCsatRating('5'), 5);
  assert.equal(extractCsatRating(' 3 '), 3);
  assert.equal(extractCsatRating('six'), null);
  assert.equal(extractCsatRating('It was great'), null);
});

test('recognizes only numeric 1-5 replies as CSAT responses', () => {
  assert.equal(isCsatReplyText('4'), true);
  assert.equal(isCsatReplyText('0'), false);
  assert.equal(isCsatReplyText('6'), false);
  assert.equal(isCsatReplyText('five'), false);
});
