import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldTransitionReservedTable, buildOccupiedFromReservationPayload } from '../src/utils/tableReservation.js';

test('marks reserved tables as occupied once the reservation time is reached', () => {
  const now = new Date('2026-07-13T18:30:00.000Z');
  const table = {
    number: 3,
    status: 'reserved',
    customerName: 'Mina',
    reservedUntil: '2026-07-13T18:30:00.000Z'
  };

  assert.equal(shouldTransitionReservedTable(table, now), true);
  assert.deepEqual(buildOccupiedFromReservationPayload(table, now), {
    status: 'occupied',
    customerName: 'Mina',
    reservedUntil: null,
    isBooking: true,
    sessionStartedAt: now.toISOString()
  });
});

test('keeps future reservations in reserved state until their scheduled time arrives', () => {
  const now = new Date('2026-07-13T18:30:00.000Z');
  const table = {
    number: 5,
    status: 'reserved',
    reservedUntil: '2026-07-13T19:00:00.000Z'
  };

  assert.equal(shouldTransitionReservedTable(table, now), false);
});
