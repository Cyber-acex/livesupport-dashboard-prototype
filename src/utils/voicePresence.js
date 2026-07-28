export function mergePresenceIntoDirectory(previousDirectory = [], presenceEntries = []) {
  const onlineById = new Map((Array.isArray(presenceEntries) ? presenceEntries : []).map((entry) => [String(entry.userId), entry]));
  const previous = Array.isArray(previousDirectory) ? previousDirectory : [];
  const merged = previous.map((staff) => {
    const presence = onlineById.get(String(staff.id));
    if (!presence) {
      return {
        ...staff,
        online: false,
        status: 'offline',
        availability: 'Offline'
      };
    }

    const normalizedStatus = presence.status === 'busy'
      ? 'busy'
      : presence.status === 'away'
        ? 'away'
        : 'available';

    return {
      ...staff,
      online: true,
      status: normalizedStatus,
      availability: normalizedStatus === 'busy' ? 'Busy' : normalizedStatus === 'away' ? 'Away' : 'Available'
    };
  });

  for (const [userId, presence] of onlineById.entries()) {
    if (!merged.some((staff) => String(staff.id) === userId)) {
      const normalizedStatus = presence.status === 'busy'
        ? 'busy'
        : presence.status === 'away'
          ? 'away'
          : 'available';
      merged.push({
        id: Number(userId),
        name: presence.name || 'Staff',
        role: presence.role || 'staff',
        department: presence.department || 'Operations',
        branch: presence.branch || 'Current Branch',
        online: true,
        status: normalizedStatus,
        avatar: (presence.name || 'ST').split(' ').map((segment) => segment[0]).slice(0, 2).join('').toUpperCase(),
        availability: normalizedStatus === 'busy' ? 'Busy' : normalizedStatus === 'away' ? 'Away' : 'Available'
      });
    }
  }

  return merged;
}
