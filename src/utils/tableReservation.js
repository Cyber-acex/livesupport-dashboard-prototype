export function shouldTransitionReservedTable(table, now = new Date()) {
  if (!table || normalizeTableStatus(table.status) !== 'reserved') return false;
  if (!table.reservedUntil) return false;

  const targetTime = new Date(table.reservedUntil).getTime();
  if (Number.isNaN(targetTime)) return false;
  return targetTime <= now.getTime();
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

function normalizeTableStatus(status) {
  return String(status || 'vacant').toLowerCase().replace(/\s+/g, '_');
}
