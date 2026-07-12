export function calculateMonthlyTargetPercent({ targetAmount, revenueAmount, progressPercent }) {
  if (typeof progressPercent === 'number' && Number.isFinite(progressPercent)) {
    return Math.max(0, Math.min(100, progressPercent));
  }

  const safeTarget = Number(targetAmount) || 0;
  const safeRevenue = Number(revenueAmount) || 0;

  if (!safeTarget) return 0;
  const ratio = safeRevenue / safeTarget;
  return Math.max(0, Math.min(100, ratio * 100));
}
