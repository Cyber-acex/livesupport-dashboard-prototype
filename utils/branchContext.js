function normalizeBranchId(value) {
  if (value === null || value === undefined || value === '') return null;
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) return null;
  return numericValue;
}

function resolveBranchId(req, fallback = null) {
  const candidates = [
    req?.branchId,
    req?.branch?.id,
    req?.session?.branchId,
    req?.session?.branch?.id,
    req?.session?.user?.branch_id,
    req?.session?.user?.branchId,
    fallback
  ];

  for (const candidate of candidates) {
    const normalized = normalizeBranchId(candidate);
    if (normalized != null) {
      return normalized;
    }
  }

  return null;
}

function injectBranchId(payload, branchId) {
  const nextPayload = { ...(payload || {}) };
  const normalizedBranchId = normalizeBranchId(branchId);
  if (normalizedBranchId == null) return nextPayload;
  nextPayload.branch_id = normalizedBranchId;
  return nextPayload;
}

export { normalizeBranchId, resolveBranchId, injectBranchId };
