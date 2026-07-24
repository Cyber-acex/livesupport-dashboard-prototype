export const RESOLUTION_CATEGORY_OPTIONS = [
  'Order Completed',
  'Complaint Resolved',
  'Refund Issued',
  'Information Provided',
  'Customer Cancelled',
  'Technical Issue Fixed',
  'Other'
];

export function isResolvedTicket(ticket) {
  const status = String(ticket?.status || '').toLowerCase();
  return status === 'resolved' || status === 'closed' || status === 'complete' || status === 'completed';
}

export function getResolutionCategoryOptions() {
  return RESOLUTION_CATEGORY_OPTIONS;
}

export function getStarsForRating(rating) {
  const safeRating = Number(rating) || 0;
  const clamped = Math.max(0, Math.min(5, safeRating));
  return '★'.repeat(clamped) + '☆'.repeat(5 - clamped);
}

export function formatRatingLabel(rating) {
  if (!rating || Number(rating) <= 0) return 'Not Rated';
  return `${getStarsForRating(rating)} (${Number(rating)}/5)`;
}

export function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
}
