const HIGH_RISK_RULES = [
  {
    id: 'refund-dispute',
    intent: 'Refund / Chargeback Dispute',
    reason: 'Refund / Chargeback Dispute',
    keywords: [
      'money back', 'refund', 'chargeback', 'contacting my bank', 'my bank', 'charged me twice',
      'never received my order', 'did not receive my order', 'i want my money back', 'filing a chargeback'
    ],
    reply: "I'm sorry you're experiencing this. I've forwarded your request to a member of our team who will assist you shortly.",
    escalate: true
  },
  {
    id: 'food-poisoning',
    intent: 'Food Poisoning / Health Claim',
    reason: 'Food Poisoning / Health Claim',
    keywords: ['food poisoning', 'made me sick', 'became ill', 'i got sick', 'in the hospital', 'poisoning', 'vomit', 'diarrhea', 'nausea'],
    reply: "I'm very sorry to hear this. I've escalated your message to our management team who will contact you as soon as possible.",
    escalate: true
  },
  {
    id: 'allergy-confirmation',
    intent: 'Allergy Confirmation',
    reason: 'Allergy Confirmation',
    keywords: ['nut-free', 'allergen-free', 'gluten', 'dairy free', 'peanut allergy', 'allergy', 'safe for someone with'],
    reply: "For your safety, I can't guarantee allergen-free preparation. I've forwarded your question to a staff member who can verify this for you.",
    escalate: true
  },
  {
    id: 'abuse-threat',
    intent: 'Threats, Harassment or Abuse',
    reason: 'Threats, Harassment or Abuse',
    keywords: ['abusive', 'threat', 'harassment', 'violent', 'fuck', 'shit', 'idiot', 'moron', 'you all'],
    reply: 'I understand your concern. I have escalated this conversation to a manager and will keep the discussion calm and professional.',
    escalate: true
  },
  {
    id: 'fraud-suspicion',
    intent: 'Fraud Suspicion',
    reason: 'Fraud Review',
    keywords: ['multiple refund requests', 'repeated chargeback', 'suspicious payment', 'account abuse', 'fraud'],
    reply: 'I have flagged this conversation for fraud review and escalated it to a manager.',
    escalate: true
  },
  {
    id: 'bank-details',
    intent: 'Payment Issue Involving Bank Details',
    reason: 'Payment Issue Involving Bank Details',
    keywords: ['bank account', 'bank details', 'routing number', 'account number', 'card problem', 'bank transfer', 'provide my bank'],
    reply: 'I can help with the issue, but I cannot request or store sensitive banking information. I have escalated this to a staff member.',
    escalate: true
  },
  {
    id: 'legal-threat',
    intent: 'Legal Threat',
    reason: 'Legal Threat',
    keywords: ['suing your restaurant', 'contact my lawyer', 'see you in court', 'attorney', 'lawyer', 'legal action'],
    reply: 'I understand your concern. I have escalated your message to our management team for review.',
    escalate: true
  }
];

function normalizeText(value) {
  return String(value || '').toLowerCase().trim();
}

export function detectHighRiskIntent(message) {
  const normalized = normalizeText(message);
  let matched = null;

  if (!normalized) {
    return {
      isHighRisk: false,
      shouldEscalate: false,
      confidence: 0.95,
      detectedIntent: null,
      escalationReason: null,
      reply: null,
      ruleId: null
    };
  }

  for (const rule of HIGH_RISK_RULES) {
    const matchedKeyword = rule.keywords.find((keyword) => normalized.includes(keyword));
    if (matchedKeyword) {
      matched = rule;
      break;
    }
  }

  const confidence = matched ? 0.93 : 0.95;
  const isHighRisk = Boolean(matched);
  const shouldEscalate = isHighRisk || confidence < 0.75;
  return {
    isHighRisk,
    shouldEscalate,
    confidence,
    detectedIntent: matched?.intent || null,
    escalationReason: matched?.reason || null,
    reply: matched?.reply || null,
    ruleId: matched?.id || null
  };
}

export function createHighRiskEscalationContext({ conversationId, branchId, customerId, message, confidence, detectedIntent, escalationReason }) {
  return {
    conversationId: conversationId || null,
    branchId: branchId || null,
    customerId: customerId || null,
    message: message || '',
    confidence: Number(confidence || 0),
    detectedIntent: detectedIntent || null,
    escalationReason: escalationReason || null,
    timestamp: new Date().toISOString(),
    status: 'Escalated'
  };
}

export function evaluateIntentPipeline(message, options = {}) {
  const detection = detectHighRiskIntent(message);
  const confidence = Number(options.confidence ?? detection.confidence);
  const shouldStopAutomation = detection.isHighRisk || confidence < 0.75;
  return {
    ...detection,
    confidence,
    shouldStopAutomation,
    shouldContinueAutomation: !shouldStopAutomation
  };
}
