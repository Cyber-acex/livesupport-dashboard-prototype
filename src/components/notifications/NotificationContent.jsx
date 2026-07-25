import React from 'react';
import NotificationShell from './NotificationShell';

const notificationStyles = {
  success: {
    accent: 'Live sync',
    panelClassName: 'border-emerald-400/20 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.16),_transparent_42%),linear-gradient(135deg,rgba(6,17,29,0.95),rgba(9,20,38,0.9),rgba(3,10,20,0.96))]',
    glowClassName: 'bg-emerald-500/25',
    iconClassName: 'border-emerald-400/25 bg-emerald-500/10',
    iconGlowClassName: 'bg-emerald-400/20',
  },
  error: {
    accent: 'Attention needed',
    panelClassName: 'border-rose-400/20 bg-[radial-gradient(circle_at_top_left,_rgba(248,113,113,0.16),_transparent_42%),linear-gradient(135deg,rgba(31,41,55,0.95),rgba(30,41,59,0.9),rgba(15,23,42,0.96))]',
    glowClassName: 'bg-rose-500/20',
    iconClassName: 'border-rose-400/25 bg-rose-500/10',
    iconGlowClassName: 'bg-rose-400/20',
  },
  warning: {
    accent: 'Heads up',
    panelClassName: 'border-amber-400/20 bg-[radial-gradient(circle_at_top_left,_rgba(245,158,11,0.16),_transparent_42%),linear-gradient(135deg,rgba(31,41,55,0.95),rgba(30,41,59,0.9),rgba(15,23,42,0.96))]',
    glowClassName: 'bg-amber-500/20',
    iconClassName: 'border-amber-400/25 bg-amber-500/10',
    iconGlowClassName: 'bg-amber-400/20',
  },
  info: {
    accent: 'New update',
    panelClassName: 'border-sky-400/20 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.16),_transparent_42%),linear-gradient(135deg,rgba(15,23,42,0.95),rgba(15,23,42,0.9),rgba(10,22,42,0.96))]',
    glowClassName: 'bg-sky-500/25',
    iconClassName: 'border-sky-400/25 bg-sky-500/10',
    iconGlowClassName: 'bg-sky-400/20',
  },
  ticket_created: {
    accent: 'Ticket event',
    panelClassName: 'border-violet-400/20 bg-[radial-gradient(circle_at_top_left,_rgba(168,85,247,0.16),_transparent_42%),linear-gradient(135deg,rgba(15,23,42,0.95),rgba(15,23,42,0.9),rgba(10,22,42,0.96))]',
    glowClassName: 'bg-violet-500/25',
    iconClassName: 'border-violet-400/25 bg-violet-500/10',
    iconGlowClassName: 'bg-violet-400/20',
  },
  order_created: {
    accent: 'New order',
    panelClassName: 'border-amber-400/20 bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.16),_transparent_42%),linear-gradient(135deg,rgba(15,23,42,0.95),rgba(15,23,42,0.9),rgba(10,22,42,0.96))]',
    glowClassName: 'bg-amber-500/25',
    iconClassName: 'border-amber-400/25 bg-amber-500/10',
    iconGlowClassName: 'bg-amber-400/20',
  },
};

function getStyle(type) {
  return notificationStyles[type] || notificationStyles.info;
}

function getIcon(type) {
  switch (type) {
    case 'success':
      return (
        <svg viewBox="0 0 24 24" className="relative h-7 w-7 text-emerald-300" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12.5l4.2 4.2L19 7" />
          <circle cx="12" cy="12" r="9" strokeOpacity="0.24" />
        </svg>
      );
    case 'error':
      return (
        <svg viewBox="0 0 24 24" className="relative h-7 w-7 text-rose-300" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 6l12 12" />
          <path d="M18 6L6 18" />
        </svg>
      );
    case 'warning':
      return (
        <svg viewBox="0 0 24 24" className="relative h-7 w-7 text-amber-300" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 7v5" />
          <path d="M12 15h.01" />
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
        </svg>
      );
    case 'ticket_created':
      return (
        <svg viewBox="0 0 24 24" className="relative h-7 w-7 text-violet-300" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 11h14" />
          <path d="m9 7 4 4-4 4" />
          <path d="M3 7.9v8.2c0 .44.36.9.8.9h.4c.44 0 .8-.45.8-.9v-.3" />
          <path d="M21 7.9v8.2c0 .44-.36.9-.8.9h-.4c-.44 0-.8-.45-.8-.9v-.3" />
        </svg>
      );
    case 'order_created':
      return (
        <svg viewBox="0 0 24 24" className="relative h-7 w-7 text-amber-300" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 7h16M7 7v10M17 7v10M11 7v10" />
          <path d="M4 17h16" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" className="relative h-7 w-7 text-sky-300" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 5v6" />
          <path d="M7 12h10" />
          <path d="M12 17h.01" />
          <circle cx="12" cy="12" r="9" strokeOpacity="0.24" />
        </svg>
      );
  }
}

export default function NotificationContent({
  title,
  description,
  timestamp,
  type,
  onClose,
  onAction,
}) {
  const style = getStyle(type);

  return (
    <NotificationShell
      accent={style.accent}
      title={title || 'Notification'}
      description={description || 'You have a new notification.'}
      timestamp={timestamp || 'Just now'}
      onClose={onClose}
      onAction={onAction}
      panelClassName={style.panelClassName}
      glowClassName={style.glowClassName}
      iconClassName={style.iconClassName}
      iconGlowClassName={style.iconGlowClassName}
      icon={getIcon(type)}
    />
  );
}
