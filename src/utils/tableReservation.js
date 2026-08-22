export function getTableStatus(table, now = new Date()) {
  if (!table) return 'vacant';

  const storedStatus = normalizeTableStatus(table.status);
  if (['cleaning', 'maintenance', 'out_of_service'].includes(storedStatus)) return storedStatus;

  const reservationStatus = normalizeTableStatus(table.reservationStatus);
  if (['cancelled', 'canceled', 'released', 'completed'].includes(reservationStatus)) return 'vacant';

  const reservationStart = parseReservationDate(table.reservationStartAt || table.reservationDateTime || table.reservedAt || table.reservedUntil);
  const reservationIsActive = storedStatus === 'reserved' || (storedStatus === 'occupied' && table.isBooking && reservationStart);
  if (!reservationIsActive) return storedStatus;
  if (!reservationStart) return storedStatus === 'reserved' ? 'reserved' : 'occupied';

  return reservationStart > now.getTime() ? 'reserved' : 'occupied';
}

export function shouldTransitionReservedTable(table, now = new Date()) {
  if (!table || getTableStatus(table, now) !== 'occupied') return false;
  return normalizeTableStatus(table.status) === 'reserved';
}

export function buildOccupiedFromReservationPayload(table, now = new Date()) {
  return {
    status: 'occupied',
    customerName: table?.customerName || null,
    reservedUntil: null,
    isBooking: true,
    sessionStartedAt: now.toISOString()
  };
}

export function canUseTableForOrder(table) {
  if (!table) return false;
  const status = normalizeTableStatus(table.status);
  return status === 'vacant' || status === 'reserved';
}

export function buildOrderTableTransitionPayload(table, now = new Date()) {
  return {
    status: 'occupied',
    customerName: table?.customerName || null,
    reservedUntil: null,
    isBooking: false,
    sessionStartedAt: now.toISOString()
  };
}

function normalizeTableStatus(status) {
  return String(status || 'vacant').toLowerCase().replace(/\s+/g, '_');
}

function parseReservationDate(value) {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}
