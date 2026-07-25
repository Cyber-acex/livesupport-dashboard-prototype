export function requireAuthenticatedDeliveryRequest(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: 'not_logged_in' });
  }
  return next();
}

export function requireRiderRole(req, res, next) {
  const role = String(req.session.user.role || '').toLowerCase();
  if (role !== 'rider') {
    return res.status(403).json({ error: 'rider_only' });
  }
  return next();
}

export function requireBranchAccess(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: 'not_logged_in' });
  }
  if (!req.branchId && !req.session.user.branch_id) {
    return res.status(403).json({ error: 'branch_required' });
  }
  return next();
}
