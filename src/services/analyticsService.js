export async function fetchAnalytics(params = {}) {
  const query = new URLSearchParams(params).toString();
  const res = await fetch(`/api/analytics${query ? `?${query}` : ''}`, { credentials: 'same-origin' });
  if (!res.ok) throw new Error('Failed to load analytics');
  return res.json();
}

export async function fetchMyMetrics() {
  const res = await fetch('/api/my-metrics', { credentials: 'same-origin' });
  if (!res.ok) throw new Error('Failed to load my metrics');
  return res.json();
}

export async function fetchMessagesMonthly() {
  const res = await fetch('/api/messages-monthly', { credentials: 'same-origin' });
  if (!res.ok) throw new Error('Failed to load monthly messages');
  return res.json();
}

export async function fetchTicketStats() {
  const res = await fetch('/api/ticket-stats', { credentials: 'same-origin' });
  if (!res.ok) throw new Error('Failed to load ticket stats');
  return res.json();
}

export async function fetchTicketsByPeriod(params = {}) {
  const query = new URLSearchParams(params).toString();
  const res = await fetch(`/api/tickets-by-period${query ? `?${query}` : ''}`, { credentials: 'same-origin' });
  if (!res.ok) throw new Error('Failed to load tickets by period');
  return res.json();
}

export async function fetchStaffMetrics() {
  const res = await fetch('/api/staff-metrics', { credentials: 'same-origin' });
  if (!res.ok) throw new Error('Failed to load staff metrics');
  return res.json();
}

export async function fetchStaffPresence() {
  const res = await fetch('/api/staff-presence', { credentials: 'same-origin' });
  if (!res.ok) throw new Error('Failed to load staff presence');
  return res.json();
}
