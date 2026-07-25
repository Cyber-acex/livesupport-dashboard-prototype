export function shouldReuseCustomerConversation({ customer, selectedBranchId, latestConversation }) {
  if (!customer || !latestConversation) return false;

  const normalizedSelectedBranchId = Number(selectedBranchId || 0);
  if (!normalizedSelectedBranchId) return false;

  const customerBranchId = Number(customer?.branch_id || 0);
  const conversationBranchId = Number(latestConversation?.branch_id || 0);

  if (customerBranchId && normalizedSelectedBranchId && customerBranchId !== normalizedSelectedBranchId) {
    return false;
  }

  if (conversationBranchId && normalizedSelectedBranchId && conversationBranchId !== normalizedSelectedBranchId) {
    return false;
  }

  return true;
}
