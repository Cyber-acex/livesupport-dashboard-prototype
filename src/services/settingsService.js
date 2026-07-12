// Settings Service - localStorage and appearance helpers

export function getSettings() {
  const savedTarget = Number(localStorage.getItem('monthlyTargetAmount'));
  const monthlyTargetAmount = Number.isFinite(savedTarget) && savedTarget > 0 ? savedTarget : 20000;

  return {
    displayName: localStorage.getItem('displayName') || '',
    email: localStorage.getItem('email') || '',
    theme: localStorage.getItem('theme') || 'Light',
    sidebarPosition: localStorage.getItem('sidebarPosition') || 'left',
    sidebarWidth: localStorage.getItem('sidebarWidth') || 'standard',
    fontSize: localStorage.getItem('fontSize') || '100',
    pageZoom: localStorage.getItem('pageZoom') || '100',
    msgAlert: localStorage.getItem('msgAlert') === 'true',
    ticketAlert: localStorage.getItem('ticketAlert') === 'true',
    soundAlert: localStorage.getItem('soundAlert') === 'true',
    autoReply: localStorage.getItem('autoReply') || '',
    chatEnabled: localStorage.getItem('chatEnabled') || 'on',
    autopilotMode: localStorage.getItem('autopilotMode') || 'assist',
    autoAssign: localStorage.getItem('autoAssign') || 'on',
    monthlyTargetAmount
  };
}

export function saveSettings(settings) {
  if (settings.displayName !== undefined) localStorage.setItem('displayName', settings.displayName);
  if (settings.email !== undefined) localStorage.setItem('email', settings.email);
  if (settings.theme !== undefined) localStorage.setItem('theme', settings.theme);
  if (settings.sidebarPosition !== undefined) localStorage.setItem('sidebarPosition', settings.sidebarPosition);
  if (settings.sidebarWidth !== undefined) localStorage.setItem('sidebarWidth', settings.sidebarWidth);
  if (settings.fontSize !== undefined) localStorage.setItem('fontSize', settings.fontSize);
  if (settings.pageZoom !== undefined) localStorage.setItem('pageZoom', settings.pageZoom);
  if (settings.msgAlert !== undefined) localStorage.setItem('msgAlert', String(settings.msgAlert));
  if (settings.ticketAlert !== undefined) localStorage.setItem('ticketAlert', String(settings.ticketAlert));
  if (settings.soundAlert !== undefined) localStorage.setItem('soundAlert', String(settings.soundAlert));
  if (settings.autoReply !== undefined) localStorage.setItem('autoReply', settings.autoReply);
  if (settings.chatEnabled !== undefined) localStorage.setItem('chatEnabled', settings.chatEnabled);
  if (settings.autopilotMode !== undefined) localStorage.setItem('autopilotMode', settings.autopilotMode);
  if (settings.autoAssign !== undefined) localStorage.setItem('autoAssign', settings.autoAssign);
  if (settings.monthlyTargetAmount !== undefined) {
    localStorage.setItem('monthlyTargetAmount', String(Number(settings.monthlyTargetAmount || 0)));
  }
}

export function applyTheme(theme) {
  try {
    if (theme === 'Dark') {
      document.documentElement.classList.add('dark');
      if (document.body) document.body.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
      if (document.body) document.body.classList.remove('dark');
    }
  } catch (e) {
    // ignore
  }
}

export function applyFontSize(size) {
  const numericSize = Number(size) || 100;
  document.documentElement.style.setProperty('--base-font-size', numericSize + '%');
}

export function applyZoom(zoomPercentage) {
  const clampedZoom = Math.max(25, Math.min(150, zoomPercentage));
  document.documentElement.style.zoom = clampedZoom + '%';
}

export const AUTOPILOT_MODES = {
  assist: {
    title: 'Assist Mode',
    summary: 'AI generates suggested replies, while a human agent reviews and sends them.',
    details: ['AI suggests reply drafts for staff review', 'Human sends the final message', 'Best for supervised, high-accuracy support']
  },
  auto: {
    title: 'Auto Mode',
    summary: 'AI automatically generates and sends replies to customers.',
    details: ['AI handles majority of support conversations', 'Escalates complex issues to human staff', 'Best for high-volume, routine support']
  },
  manual: {
    title: 'Manual Mode',
    summary: 'Human agents handle all communication with no AI assistance.',
    details: ['Full control for agents', 'No AI involvement', 'Best for sensitive or complex issues']
  }
};

export function getFontSizeLabel(size) {
  const numericSize = Number(size) || 100;
  return {
    90: 'Compact (90%)',
    100: 'Normal (100%)',
    110: 'Large (110%)',
    120: 'Extra Large (120%)'
  }[numericSize] || `${numericSize}%`;
}
