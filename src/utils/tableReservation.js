import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

export const RESTAURANT_TIMEZONE = 'Africa/Lagos';

export function parseReservationDateTime(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const text = String(value);
  const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(text);
  const parsed = hasTimezone ? new Date(text) : fromZonedTime(text, RESTAURANT_TIMEZONE);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatReservationDateTime(value, format = 'MMM d, yyyy h:mm a') {
  const parsed = parseReservationDateTime(value);
  return parsed ? formatInTimeZone(parsed, RESTAURANT_TIMEZONE, format) : '';
}

export function toReservationInputValue(value) {
  return formatReservationDateTime(value, "yyyy-MM-dd'T'HH:mm");
}

function getRestaurantNow(now) {
  const localParts = formatInTimeZone(now, RESTAURANT_TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss.SSS");
  return fromZonedTime(localParts, RESTAURANT_TIMEZONE);
}

export function getTableStatus(table, now = new Date()) {
  if (!table) return 'vacant';

  const storedStatus = normalizeTableStatus(table.status);
  if (['cleaning', 'maintenance', 'out_of_service'].includes(storedStatus)) return storedStatus;

  const reservationStatus = normalizeTableStatus(table.reservationStatus);
  if (['cancelled', 'canceled', 'released', 'completed'].includes(reservationStatus)) return 'vacant';

  const reservationStart = parseReservationDateTime(table.reservationStartAt || table.reservationDateTime || table.reservedAt || table.reservedUntil)?.getTime();
  const reservationIsActive = storedStatus === 'reserved' || (storedStatus === 'occupied' && table.isBooking && reservationStart);
  if (!reservationIsActive) return storedStatus;
  if (!reservationStart) return storedStatus === 'reserved' ? 'vacant' : 'occupied';

  return reservationStart > getRestaurantNow(now).getTime() ? 'reserved' : 'occupied';
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

