const ROLE_PERMISSIONS = Object.freeze({
  admin: ['config', 'policies', 'analytics', 'roles', 'integrations'],
  manager: ['approves_refunds', 'overrides', 'monitors_quality'],
  agent: [],
  staff: [],
  rider: [],
  viewer: []
});

export function normalizeRole(role) {
  return String(role || '').trim().toLowerCase();
}

export function getRolePermissions(role) {
  const normalizedRole = normalizeRole(role);
  return ROLE_PERMISSIONS[normalizedRole] || [];
}

export function hasRolePermission(role, permission) {
  return getRolePermissions(role).includes(permission);
}
