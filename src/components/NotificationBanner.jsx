import React, { useEffect } from 'react';
import { useNotification } from '../contexts/NotificationContext';

export default function NotificationBanner() {
  const { notifications, removeNotification } = useNotification();

  const getTypeStyles = (type) => {
    const styles = {
      success: {
        bg: 'bg-emerald-500/20',
        border: 'border-emerald-400/40',
        text: 'text-emerald-200',
        icon: '✓',
        iconBg: 'bg-emerald-500/30'
      },
      error: {
        bg: 'bg-red-500/20',
        border: 'border-red-400/40',
        text: 'text-red-200',
        icon: '✕',
        iconBg: 'bg-red-500/30'
      },
      warning: {
        bg: 'bg-amber-500/20',
        border: 'border-amber-400/40',
        text: 'text-amber-200',
        icon: '⚠',
        iconBg: 'bg-amber-500/30'
      },
      info: {
        bg: 'bg-blue-500/20',
        border: 'border-blue-400/40',
        text: 'text-blue-200',
        icon: 'ℹ',
        iconBg: 'bg-blue-500/30'
      }
    };
    return styles[type] || styles.info;
  };

  return (
    <div className="fixed inset-x-0 top-20 z-50 flex items-start justify-center px-4 pointer-events-none">
      {notifications.map((notification) => {
        const styles = getTypeStyles(notification.type);
        return (
          <div
            key={notification.id}
            className={`
              pointer-events-auto
              w-full max-w-xl
              flex items-center gap-3
              rounded-xl border
              ${styles.bg} ${styles.border}
              px-4 py-3
              shadow-lg shadow-black/20
              animate-in fade-in slide-in-from-top-2 duration-300
            `}
          >
            <div className={`flex-shrink-0 w-5 h-5 rounded-full ${styles.iconBg} flex items-center justify-center text-sm font-bold ${styles.text}`}>
              {styles.icon}
            </div>
            <p className={`text-sm font-medium ${styles.text} flex-1`}>
              {notification.message}
            </p>
            <button
              onClick={() => removeNotification(notification.id)}
              className={`flex-shrink-0 text-lg font-light ${styles.text} hover:opacity-70 transition-opacity`}
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}
