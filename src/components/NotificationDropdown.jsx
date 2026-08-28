import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotification } from '../contexts/NotificationContext';

function NotificationDropdown({ isOpen, onClose }) {
  const {
    inboxNotifications,
    unreadCount,
    notificationsLoading,
    fetchInboxNotifications,
    markNotificationRead,
    dismissNotification,
    markAllNotificationsRead
  } = useNotification();
  const [activeTab, setActiveTab] = useState('all');
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!isOpen) return;
    fetchInboxNotifications();
  }, [isOpen, fetchInboxNotifications]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onClose]);

  const formatTime = (timestamp) => {
    if (!timestamp) return 'Just now';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const iconForType = (type) => {
    const common = 'flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border shadow-sm';
    if (type === 'conversation' || type === 'message') {
      return (
        <div className={`${common} border-sky-200 bg-sky-50 text-sky-600 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-300`}>
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 4h16v12H5.5L4 18.5V4z" />
            <path d="M22 4L12 14.01 2 4" />
          </svg>
        </div>
      );
    }
    if (type === 'ticket') {
      return (
        <div className={`${common} border-violet-200 bg-violet-50 text-violet-600 dark:border-violet-900/60 dark:bg-violet-950/40 dark:text-violet-300`}>
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 7h16" />
            <path d="M4 17h16" />
            <path d="M8 7v10" />
            <path d="M16 7v10" />
          </svg>
        </div>
      );
    }
    if (type === 'alert' || type === 'escalation') {
      return (
        <div className={`${common} border-orange-200 bg-orange-50 text-orange-600 dark:border-orange-900/60 dark:bg-orange-950/40 dark:text-orange-300`}>
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
            <path d="M10.29 3.86L1.82 18c-.6 1.04.06 2.34 1.24 2.34h18.88c1.18 0 1.84-1.3 1.24-2.34L13.71 3.86a1.75 1.75 0 00-3.42 0z" />
          </svg>
        </div>
      );
    }
    return (
      <div className={`${common} border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300`}>
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M5 13l4 4L19 7" />
        </svg>
      </div>
    );
  };

  const items = useMemo(() => {
    if (!Array.isArray(inboxNotifications)) return [];
    switch (activeTab) {
      case 'messages':
        return inboxNotifications.filter((item) => item.type === 'conversation' || item.type === 'message');
      case 'alerts':
        return inboxNotifications.filter((item) => item.type === 'alert' || item.type === 'escalation');
      case 'tickets':
        return inboxNotifications.filter((item) => item.type === 'ticket');
      default:
        return inboxNotifications;
    }
  }, [activeTab, inboxNotifications]);

  const tabCounts = useMemo(() => ({
    all: inboxNotifications.length,
    messages: inboxNotifications.filter((item) => item.type === 'conversation' || item.type === 'message').length,
    alerts: inboxNotifications.filter((item) => item.type === 'alert' || item.type === 'escalation').length,
    tickets: inboxNotifications.filter((item) => item.type === 'ticket').length
  }), [inboxNotifications]);

  const handleItemClick = (notification) => {
    if (notification.route) {
      navigate(notification.route);
    }
    if (!notification.isRead) {
      markNotificationRead(notification.id).catch(() => {});
    }
    onClose();
  };

  const handleDismiss = async (notificationId) => {
    await dismissNotification(notificationId);
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead();
  };

  if (!isOpen) return null;

  return (
    <div ref={dropdownRef} role="dialog" aria-label="Notifications" className="animate-[fadeIn_180ms_ease-out] absolute right-0 top-full z-50 mt-3 flex max-h-[min(650px,calc(100vh-92px))] w-[min(430px,calc(100vw-24px))] flex-col overflow-hidden rounded-[22px] border border-slate-200/80 bg-white/95 shadow-[0_24px_70px_rgba(15,23,42,0.18)] backdrop-blur-xl dark:border-slate-700/80 dark:bg-slate-900/95 dark:shadow-[0_24px_70px_rgba(0,0,0,0.38)]">
      <div className="relative overflow-hidden border-b border-slate-200/80 px-5 pb-4 pt-5 dark:border-slate-800">
        <div className="pointer-events-none absolute -right-10 -top-16 h-36 w-36 rounded-full bg-sky-400/10 blur-3xl" />
        <div className="relative flex items-start justify-between gap-3">
          <div>
            <div className="mb-1.5 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.12)]" />
              <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">Live activity</span>
            </div>
            <h3 className="text-xl font-semibold tracking-tight text-slate-950 dark:text-white">Notifications</h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{unreadCount ? `${unreadCount} need your attention` : 'You are all caught up'}</p>
          </div>
          <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleMarkAllRead}
            disabled={!unreadCount}
            className="rounded-lg px-2.5 py-2 text-[11px] font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            Mark all read
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close notifications"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-1 border-b border-slate-200/80 bg-slate-50/80 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-950/50">
        {[
          { id: 'all', label: 'All', count: tabCounts.all },
          { id: 'messages', label: 'Messages', count: tabCounts.messages },
          { id: 'alerts', label: 'Alerts', count: tabCounts.alerts },
          { id: 'tickets', label: 'Tickets', count: tabCounts.tickets }
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`min-w-0 rounded-lg px-1.5 py-2 text-[11px] font-semibold leading-4 transition ${
              activeTab === tab.id
                ? 'bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-900'
                : 'text-slate-500 hover:bg-white hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white'
            }`}
          >
            {tab.label} {tab.count > 0 && <span className="ml-1 text-xs">({tab.count})</span>}
          </button>
        ))}
      </div>

      <div className="overflow-y-auto flex-1">
        {notificationsLoading ? (
          <div className="p-6 text-center text-sm text-slate-500 dark:text-slate-400">Loading notifications…</div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
            <div className="mb-3 rounded-3xl bg-slate-100 p-4 text-slate-500 dark:bg-gray-800 dark:text-slate-400">
              <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 7h16v10H4z" />
                <path d="M4 7l8 6 8-6" />
              </svg>
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-sm">No notifications yet</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {items.map((notif) => (
              <div
                key={notif.id}
                className={`group relative flex cursor-pointer flex-col gap-3 px-5 py-4 transition ${notif.isRead ? 'bg-white dark:bg-slate-900' : 'bg-sky-50/60 dark:bg-sky-950/20'} hover:bg-slate-50 dark:hover:bg-slate-800/80`}
              >
                {!notif.isRead ? <span className="absolute bottom-4 left-0 top-4 w-0.5 rounded-r-full bg-sky-500" /> : null}
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0">{iconForType(notif.type)}</div>
                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => handleItemClick(notif)}
                      className="text-left w-full"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">
                          {notif.title || 'Notification'}
                        </p>
                        {!notif.isRead ? <span className="rounded-full bg-sky-100 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.16em] text-sky-700 dark:bg-sky-900/50 dark:text-sky-300">New</span> : null}
                      </div>
                      <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 line-clamp-2">
                        {notif.message || 'Open to view details'}
                      </p>
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3 pl-[52px] text-[11px] text-slate-400 dark:text-slate-500">
                  <span>{formatTime(notif.createdAt || notif.created_at)}</span>
                  <button
                    type="button"
                    onClick={() => handleDismiss(notif.id)}
                    aria-label={`Dismiss ${notif.title || 'notification'}`}
                    className="rounded-lg px-2 py-1 font-semibold text-slate-400 opacity-0 transition hover:bg-slate-200 hover:text-slate-700 group-hover:opacity-100 focus:opacity-100 dark:hover:bg-slate-700 dark:hover:text-white"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-slate-200/80 bg-slate-50/80 px-5 py-3 dark:border-slate-800 dark:bg-slate-950/50">
        <button
          type="button"
          onClick={() => { fetchInboxNotifications(); }}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-100 hover:text-slate-950 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 11a8 8 0 0 0-14.8-4L4 9" /><path d="M4 4v5h5" /><path d="M4 13a8 8 0 0 0 14.8 4L20 15" /><path d="M20 20v-5h-5" /></svg>
          Refresh activity
        </button>
      </div>
    </div>
  );
}

export default NotificationDropdown;