import React, { useEffect } from 'react';
import { useNotification } from '../contexts/NotificationContext';

export default function NotificationBanner() {
  const { notifications, removeNotification } = useNotification();

  const getTypeStyles = (type) => {
    const styles = {
      success: {
        bg: 'bg-emerald-600',
        border: 'border-emerald-400',
        text: 'text-emerald-950',
        icon: '✓',
        iconBg: 'bg-emerald-500'
      },
      error: {
        bg: 'bg-red-600',
        border: 'border-red-400',
        text: 'text-red-950',
        icon: '✕',
        iconBg: 'bg-red-500'
      },
      warning: {
        bg: 'bg-amber-600',
        border: 'border-amber-400',
        text: 'text-amber-950',
        icon: '⚠',
        iconBg: 'bg-amber-500'
      },
      info: {
        bg: 'bg-blue-600',
        border: 'border-blue-400',
        text: 'text-blue-950',
        icon: 'ℹ',
        iconBg: 'bg-blue-500'
      }
    };
    return styles[type] || styles.info;
  };

  return (
    <div className="fixed inset-x-0 top-4 z-[9999] flex items-start justify-center px-4 pointer-events-none">
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
              shadow-[0_20px_60px_rgba(0,0,0,0.35)]
              backdrop-blur-none
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
