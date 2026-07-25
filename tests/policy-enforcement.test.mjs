import test from 'node:test';
import assert from 'node:assert/strict';
import * as replies from '../replies.js';

const { buildPolicyGuidance, isMenuInquiry, isReservationInquiry, isModificationRequest, isMissingItemRequest, isRefundInquiry, isOrderStatusInquiry, isColdFoodComplaint, extractPartySize, buildSupportReply } = replies;

test('buildPolicyGuidance includes allergy escalation and refund guardrails', () => {
  const guidance = buildPolicyGuidance('I have a severe peanut allergy and also want a refund for the order.');

  assert.match(guidance, /peanut allergy/i);
  assert.match(guidance, /customer allergy confirmation/i);
  assert.match(guidance, /escalate/i);
  assert.match(guidance, /refund/i);
  assert.match(guidance, /evidence/i);
});

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

test('buildSupportReply covers the key customer support use cases with branch-aware guidance', () => {
  const menuReply = buildSupportReply('What is your menu and prices?');
  assert.match(menuReply, /delivery fee/i);
  assert.match(menuReply, /free delivery/i);

  const statusReply = buildSupportReply('Where is my order?');
  assert.match(statusReply, /status/i);
  assert.match(statusReply, /eta/i);
  assert.match(statusReply, /order id/i);

  const coldReply = buildSupportReply('Food arrived cold');
  assert.match(coldReply, /apolog/i);
  assert.match(coldReply, /replacement|redelivery/i);
  assert.match(coldReply, /manager/i);

  const modificationReply = buildSupportReply('Remove onions and add extra chicken');
  assert.match(modificationReply, /allowed/i);
  assert.match(modificationReply, /order id/i);

  const refundReply = buildSupportReply('I want my money back');
  assert.match(refundReply, /manager/i);
  assert.match(refundReply, /eligibility/i);

  const reservationReply = buildSupportReply('Can I book for 6?');
  assert.match(reservationReply, /availability/i);
  assert.match(reservationReply, /party/i);

  const missingItemReply = buildSupportReply('You forgot my drink');
  assert.match(missingItemReply, /replacement/i);
  assert.match(missingItemReply, /voucher|credit/i);

  const branchReply = buildSupportReply('I need help with my order', { branchId: 2 });
  assert.match(branchReply, /lekki/i);
});
