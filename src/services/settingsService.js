// Settings Service - localStorage and appearance helpers
import { normalizeAutopilotMode } from './autopilotMode.js';
import { DEFAULT_ZOOM, normalizeZoomValue, ZOOM_STORAGE_KEY } from '../utils/zoom.js';

export function canChangeAiTone(role) {
  const normalizedRole = String(role || '').trim().toLowerCase();
  return normalizedRole === 'admin' || normalizedRole === 'manager';
}

export function getSettings() {
  const savedTarget = Number(localStorage.getItem('monthlyTargetAmount'));
  const monthlyTargetAmount = Number.isFinite(savedTarget) && savedTarget > 0 ? savedTarget : 20000;
  const savedZoom = normalizeZoomValue(localStorage.getItem(ZOOM_STORAGE_KEY) || localStorage.getItem('appZoom') || localStorage.getItem('pageZoom') || DEFAULT_ZOOM);

  return {
    displayName: localStorage.getItem('displayName') || '',
    email: localStorage.getItem('email') || '',
    theme: localStorage.getItem('theme') || 'Light',
    sidebarPosition: localStorage.getItem('sidebarPosition') || 'left',
    sidebarWidth: localStorage.getItem('sidebarWidth') || 'standard',
    fontSize: localStorage.getItem('fontSize') || '100',
    pageZoom: String(Math.round(savedZoom * 100)),
    interfaceZoom: savedZoom,
    msgAlert: localStorage.getItem('msgAlert') === 'true',
    ticketAlert: localStorage.getItem('ticketAlert') === 'true',
    soundAlert: localStorage.getItem('soundAlert') === 'true',
    autoReply: localStorage.getItem('autoReply') || '',
    chatEnabled: localStorage.getItem('chatEnabled') || 'on',
    autopilotMode: normalizeAutopilotMode(localStorage.getItem('autopilotMode') || 'assist'),
    autoAssign: localStorage.getItem('autoAssign') || 'on',
    aiTone: localStorage.getItem('aiTone') || 'warm',
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
  if (settings.pageZoom !== undefined) {
    const normalizedZoom = normalizeZoomValue(settings.pageZoom);
    localStorage.setItem(ZOOM_STORAGE_KEY, String(normalizedZoom));
    localStorage.setItem('pageZoom', String(Math.round(normalizedZoom * 100)));
    localStorage.setItem('pageZoom', String(Math.round(normalizedZoom * 100)));
  }
  if (settings.msgAlert !== undefined) localStorage.setItem('msgAlert', String(settings.msgAlert));
  if (settings.ticketAlert !== undefined) localStorage.setItem('ticketAlert', String(settings.ticketAlert));
  if (settings.soundAlert !== undefined) localStorage.setItem('soundAlert', String(settings.soundAlert));
  if (settings.autoReply !== undefined) localStorage.setItem('autoReply', settings.autoReply);
  if (settings.chatEnabled !== undefined) localStorage.setItem('chatEnabled', settings.chatEnabled);
  if (settings.autopilotMode !== undefined) localStorage.setItem('autopilotMode', settings.autopilotMode);
  if (settings.autoAssign !== undefined) localStorage.setItem('autoAssign', settings.autoAssign);
  if (settings.aiTone !== undefined) localStorage.setItem('aiTone', settings.aiTone);
  if (settings.monthlyTargetAmount !== undefined) {
    localStorage.setItem('monthlyTargetAmount', String(Number(settings.monthlyTargetAmount || 0)));
  }
}

export const AI_TONE_OPTIONS = {
  warm: {
    label: 'Warm',
    description: 'Friendly, empathetic, and customer-first.',
    sample: 'I’m really sorry about that. I can help with this right away and I’ll make the next step as easy as possible for you.'
  },
  professional: {
    label: 'Professional',
    description: 'Clear, polished, and efficient.',
    sample: 'Thank you for flagging this. I can review the issue and provide the next step promptly so we can resolve it efficiently.'
  },
  friendly: {
    label: 'Friendly',
    description: 'Casual and conversational while staying helpful.',
    sample: 'No worries — I can help sort this out. Send me the order details and I’ll take it from there.'
  },
  concise: {
    label: 'Concise',
    description: 'Short, direct, and to the point.',
    sample: 'I can help with that. Please send your order ID or the issue details, and I’ll take the next step.'
  }
};

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
  const normalizedZoom = normalizeZoomValue(zoomPercentage);
  if (typeof window !== 'undefined') {
    window.localStorage.setItem('appZoom', String(normalizedZoom));
    window.localStorage.setItem('pageZoom', String(normalizedZoom));
    document.documentElement.style.setProperty('--app-zoom', `${normalizedZoom * 100}%`);
    window.dispatchEvent(new Event('zoom:updated'));
  }
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
