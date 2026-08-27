export function mergePresenceIntoDirectory(directory, presence) {
  const byId = new Map((Array.isArray(directory) ? directory : []).map((staff) => [String(staff.userId), staff]));
  (Array.isArray(presence) ? presence : []).forEach((staff) => {
    if (!staff?.userId) return;
    byId.set(String(staff.userId), { ...byId.get(String(staff.userId)), ...staff, status: staff.status || 'active' });
  });
  return Array.from(byId.values()).filter((staff) => staff.status !== 'offline');
}
