function normalizeBranchSelectionReply(value) {
  if (typeof value !== 'string') return '';
  return value
    .trim()
    .replace(/^[^\d]+|[^\d]+$/g, '')
    .replace(/[^0-9]/g, '');
}

function buildBranchSelectionPrompt(branches = []) {
  const normalizedBranches = Array.isArray(branches)
    ? branches.filter((branch) => branch && branch.id != null && branch.name)
    : [];

  if (!normalizedBranches.length) {
    return '👋 Welcome to Our Restaurant!\n\nPlease choose the branch you would like to contact.\n\nReply with the number.\n\n1️⃣ Branch unavailable';
  }

  const lines = normalizedBranches.map((branch, index) => `${index + 1}️⃣ ${branch.name}`);
  return [
    '👋 Welcome to Our Restaurant!',
    '',
    'Please choose the branch you would like to contact.',
    '',
    'Reply with the number.',
    '',
    ...lines
  ].join('\n');
}

function resolveBranchSelection(reply, branches = []) {
  const normalizedReply = normalizeBranchSelectionReply(reply);
  if (!normalizedReply) return null;

  const selectionIndex = Number.parseInt(normalizedReply, 10);
  if (!Number.isInteger(selectionIndex) || selectionIndex < 1) return null;

  const branch = branches[selectionIndex - 1];
  if (!branch) return null;
  const isActive = branch.is_active !== false;
  const isArchived = Boolean(branch.is_archived);
  if (!isActive || isArchived) return null;
  return branch;
}

export { normalizeBranchSelectionReply, buildBranchSelectionPrompt, resolveBranchSelection };
