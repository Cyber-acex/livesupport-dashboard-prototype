import test from 'node:test';
import assert from 'node:assert/strict';
import * as replies from '../replies.js';

const { buildPolicyGuidance, isMenuInquiry, isReservationInquiry, isModificationRequest, isMissingItemRequest, isRefundInquiry, isOrderStatusInquiry, isColdFoodComplaint, extractPartySize } = replies;

test('buildPolicyGuidance includes allergy escalation and refund guardrails', () => {
  const guidance = buildPolicyGuidance('I have a severe peanut allergy and also want a refund for the order.');

  assert.match(guidance, /peanut allergy/i);
  assert.match(guidance, /customer allergy confirmation/i);
  assert.match(guidance, /escalate/i);
  assert.match(guidance, /refund/i);
  assert.match(guidance, /evidence/i);
});

import * as replies from '../replies.js';

test('new support helper detections work for reservation, modification, refund, cold food, and missing item cases', () => {
  const { isMenuInquiry, isReservationInquiry, isModificationRequest, isMissingItemRequest, isRefundInquiry, isOrderStatusInquiry, isColdFoodComplaint, extractPartySize } = replies;

  assert.equal(isMenuInquiry('What is your menu and prices?'), true);
  assert.equal(isReservationInquiry('Can I book for 6?'), true);
  assert.equal(extractPartySize('Can I book a table for 6 people?'), 6);
  assert.equal(isModificationRequest('Remove onions from my burger'), true);
  assert.equal(isModificationRequest('Please add extra chicken'), true);
  assert.equal(isMissingItemRequest('You forgot my drink'), true);
  assert.equal(isRefundInquiry('I want my money back'), true);
  assert.equal(isOrderStatusInquiry('Where is my order?'), true);
  assert.equal(isColdFoodComplaint('Food arrived cold'), true);
});
