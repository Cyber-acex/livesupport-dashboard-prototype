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
    const common = 'h-10 w-10 flex items-center justify-center rounded-2xl text-white';
    if (type === 'conversation' || type === 'message') {
      return (
        <div className={`${common} bg-sky-500`}>
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 4h16v12H5.5L4 18.5V4z" />
            <path d="M22 4L12 14.01 2 4" />
          </svg>
        </div>
      );
    }
    if (type === 'ticket') {
      return (
        <div className={`${common} bg-violet-500`}>
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
        <div className={`${common} bg-orange-500`}>
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
            <path d="M10.29 3.86L1.82 18c-.6 1.04.06 2.34 1.24 2.34h18.88c1.18 0 1.84-1.3 1.24-2.34L13.71 3.86a1.75 1.75 0 00-3.42 0z" />
          </svg>
        </div>
      );
    }
    return (
      <div className={`${common} bg-emerald-500`}>
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
    <div ref={dropdownRef} className="absolute right-0 top-full mt-2 w-96 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 z-50 max-h-[600px] flex flex-col">
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white">Notifications</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">{unreadCount} unread</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleMarkAllRead}
            className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Mark all read
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-transparent bg-slate-100 px-2 py-1 text-xs text-slate-600 hover:bg-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Close
          </button>
        </div>
      </div>

      <div className="flex gap-1 px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 overflow-x-auto">
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
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
              activeTab === tab.id
                ? 'bg-brand-500 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
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
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {items.map((notif) => (
              <div
                key={notif.id}
                className={`group flex cursor-pointer flex-col gap-3 px-4 py-3 transition ${notif.isRead ? 'bg-white dark:bg-gray-800' : 'bg-slate-50 dark:bg-slate-900'} hover:bg-slate-100 dark:hover:bg-slate-700`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0">{iconForType(notif.type)}</div>
                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => handleItemClick(notif)}
                      className="text-left w-full"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-sm font-semibold ${notif.isRead ? 'text-slate-900 dark:text-white' : 'text-slate-900 dark:text-white'}`}>
                          {notif.title || 'Notification'}
                        </p>
                        <span className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${notif.isRead ? 'text-slate-400' : 'text-orange-600'}`}>
                          {notif.isRead ? 'Read' : 'New'}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 line-clamp-2">
                        {notif.message || 'Open to view details'}
                      </p>
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
                  <span>{formatTime(notif.createdAt || notif.created_at)}</span>
                  <button
                    type="button"
                    onClick={() => handleDismiss(notif.id)}
                    className="rounded-full px-2 py-1 text-[11px] font-semibold text-slate-500 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-700"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
        <button
          type="button"
          onClick={() => { fetchInboxNotifications(); }}
          className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Refresh notifications
        </button>
      </div>
    </div>
  );
}

export default NotificationDropdown;