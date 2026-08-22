function normalizeBranchSelectionReply(value) {
  if (typeof value !== 'string') return '';
  return value
    .trim()
    .replace(/^[^\d]+|[^\d]+$/g, '')
    .replace(/[^0-9]/g, '');
}

function normalizeBranchId(value) {
  if (value === null || value === undefined || value === '') return null;
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) return null;
  return numericValue;
}

function getBranchNameById(branchId, branches = []) {
  const normalizedBranchId = normalizeBranchId(branchId);
  if (normalizedBranchId == null) return null;

  const branchFromList = Array.isArray(branches)
    ? branches.find((branch) => normalizeBranchId(branch?.id ?? branch?.branch_id) === normalizedBranchId)
    : null;

  if (branchFromList && typeof branchFromList.name === 'string' && branchFromList.name.trim()) {
    return branchFromList.name.trim();
  }

  const fallbackMap = {
    1: 'Ikeja',
    2: 'Lekki',
    3: 'Victoria Island'
  };
  return fallbackMap[normalizedBranchId] || null;
}

function getActiveBranchContext({ branchId = null, conversationState = null, message = '', branches = [] } = {}) {
  const stateBranchId = normalizeBranchId(conversationState?.branchId ?? conversationState?.selectedBranchId ?? null);
  const selectedBranchId = normalizeBranchId(branchId ?? stateBranchId ?? null);
  const explicitChangeRequest = isExplicitBranchChangeRequest(message);

  if (selectedBranchId != null) {
    return {
      branchId: selectedBranchId,
      branchName: getBranchNameById(selectedBranchId, branches) || 'Selected branch',
      hasSelectedBranch: true,
      isExplicitChangeRequest: explicitChangeRequest
    };
  }

  return {
    branchId: null,
    branchName: null,
    hasSelectedBranch: false,
    isExplicitChangeRequest: explicitChangeRequest
  };
}

function shouldPromptForBranchSelection({ branchId = null, conversationState = null, message = '', branches = [] } = {}) {
  const activeBranch = getActiveBranchContext({ branchId, conversationState, message, branches });
  if (activeBranch.hasSelectedBranch) {
    return false;
  }

  return true;
}

function isExplicitBranchChangeRequest(message = '') {
  const text = String(message || '').toLowerCase();
  if (!text) return false;

  const branchChangePatterns = [
    /change branch/i,
    /switch branch/i,
    /switch to .*branch/i,
    /different branch/i,
    /want to change branches/i,
    /change to .*ikeja|change to .*lekki|change to .*victoria/i,
    /i want to switch to/i,
    /please use .*branch/i,
    /use .*branch instead/i,
    /branch change/i,
    /change my branch/i
  ];

  return branchChangePatterns.some((pattern) => pattern.test(text));
}

function normalizeSelectableBranches(branches = []) {
  if (!Array.isArray(branches)) return [];

  return branches
    .filter((branch) => branch && typeof branch === 'object')
    .map((branch) => {
      const normalizedName = typeof branch.name === 'string' ? branch.name.trim() : '';
      const normalizedId = branch.id ?? branch.branch_id ?? null;
      return {
        ...branch,
        id: normalizedId,
        name: normalizedName,
        is_active: branch.is_active !== false,
        is_archived: Boolean(branch.is_archived)
      };
    })
    .filter((branch) => branch.id != null && branch.name)
    .filter((branch) => branch.is_active !== false && !branch.is_archived);
}

function buildBranchSelectionMessage(branches = [], platform = 'whatsapp') {
  const normalizedPlatform = String(platform || 'whatsapp').toLowerCase();
  const isMessenger = normalizedPlatform === 'messenger';
  const isPlainText = isMessenger;
  const normalizedBranches = normalizeSelectableBranches(branches);

  if (!normalizedBranches.length) {
    const fallbackMessage = isPlainText
      ? '👋 Welcome to Our Restaurant!\n\nPlease choose the branch you would like to contact.\n\nReply with the number.\n\n1. Branch unavailable'
      : '👋 Welcome to Our Restaurant!\n\nPlease choose the branch you would like to contact.\n\nReply with the number.\n\n1️⃣ Branch unavailable';
    return fallbackMessage;
  }

  const lines = normalizedBranches.map((branch, index) => {
    const numberPrefix = isPlainText ? `${index + 1}.` : `${index + 1}️⃣`;
    return `${numberPrefix} ${branch.name}`;
  });

  const prompt = [
    '👋 Welcome to Our Restaurant!',
    '',
    "Please choose the branch you'd like to contact.",
    '',
    'Reply with the number.',
    '',
    ...lines
  ].join('\n');

  if (isMessenger) {
    console.log('[Messenger Branch Selection] Available branches:', JSON.stringify(normalizedBranches));
    console.log('[Messenger Branch Selection] Generated message:\n' + prompt);
  }

  return prompt;
}

function buildBranchSelectionPrompt(branches = [], platform = 'whatsapp') {
  return buildBranchSelectionMessage(branches, platform);
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

export {
  normalizeBranchSelectionReply,
  buildBranchSelectionPrompt,
  resolveBranchSelection,
  getBranchNameById,
  getActiveBranchContext,
  shouldPromptForBranchSelection,
  isExplicitBranchChangeRequest,
  normalizeBranchId
};
