import test from 'node:test';
import assert from 'node:assert/strict';
import { getTableStatus, shouldTransitionReservedTable, buildOccupiedFromReservationPayload } from '../src/utils/tableReservation.js';

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

test('derives reserved and occupied from the reservation start time', () => {
  const now = new Date('2026-08-22T15:24:00.000Z');
  const table = { status: 'reserved', reservedUntil: '2026-08-22T19:00:00.000Z' };

  assert.equal(getTableStatus(table, now), 'reserved');
  assert.equal(getTableStatus(table, new Date('2026-08-22T19:01:00.000Z')), 'occupied');
});

test('preserves explicit states and returns cancelled reservations to vacant', () => {
  const now = new Date('2026-08-22T15:24:00.000Z');

  assert.equal(getTableStatus({ status: 'occupied' }, now), 'occupied');
  assert.equal(getTableStatus({ status: 'maintenance', reservedUntil: '2026-08-22T19:00:00.000Z' }, now), 'maintenance');
  assert.equal(getTableStatus({ status: 'out of service' }, now), 'out_of_service');
  assert.equal(getTableStatus({ status: 'reserved', reservationStatus: 'cancelled', reservedUntil: '2026-08-22T19:00:00.000Z' }, now), 'vacant');
});
