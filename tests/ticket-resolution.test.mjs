import test from 'node:test';
import assert from 'node:assert/strict';
import { isResolvedTicket, getResolutionCategoryOptions, getStarsForRating } from '../src/utils/ticketResolution.js';

test('detects resolved tickets from status', () => {
  assert.equal(isResolvedTicket({ status: 'Resolved' }), true);
  assert.equal(isResolvedTicket({ status: 'Open' }), false);
  assert.equal(isResolvedTicket({ status: 'In Progress' }), false);
});

test('exposes the resolution categories expected by the modal', () => {
  const options = getResolutionCategoryOptions();
  assert.ok(options.includes('Order Completed'));
  assert.ok(options.includes('Technical Issue Fixed'));
  assert.ok(options.includes('Other'));
});

test('renders a star display from a numeric rating', () => {
  assert.equal(getStarsForRating(5), '★★★★★');
  assert.equal(getStarsForRating(3), '★★★☆☆');
  assert.equal(getStarsForRating(0), '☆☆☆☆☆');
});
