import { useState, useEffect, useRef } from 'react';

function NotificationDropdown({ isOpen, onClose }) {
  const [notifications, setNotifications] = useState({
    messages: [],
    alerts: [],
    tickets: [],
    other: []
  });
  const [activeTab, setActiveTab] = useState('all');
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    // Use demo data instead of API calls
    setNotifications({
      messages: [
        {
          id: 1,
          type: 'message',
          title: 'Customer #2347',
          message: 'Thank you for your help!',
          timestamp: new Date(Date.now() - 5 * 60000),
          icon: '💬'
        },
        {
          id: 2,
          type: 'message',
          title: 'Customer #5678',
          message: 'When will my order arrive?',
          timestamp: new Date(Date.now() - 25 * 60000),
          icon: '💬'
        },
        {
          id: 3,
          type: 'message',
          title: 'Customer #9012',
          message: 'I have a question about pricing',
          timestamp: new Date(Date.now() - 1.5 * 3600000),
          icon: '💬'
        }
      ],
      alerts: [
        {
          id: 1,
          type: 'alert',
          title: 'High Response Time',
          message: 'Average response time exceeded 5 minutes',
          timestamp: new Date(Date.now() - 15 * 60000),
          icon: '⚠️'
        },
        {
          id: 2,
          type: 'alert',
          title: 'Low Staff Availability',
          message: 'Only 2 agents currently online',
          timestamp: new Date(Date.now() - 45 * 60000),
          icon: '👥'
        },
        {
          id: 3,
          type: 'alert',
          title: 'Queue Building Up',
          message: '12 customers waiting for support',
          timestamp: new Date(Date.now() - 2 * 3600000),
          icon: '📊'
        }
      ],
      tickets: [
        {
          id: 101,
          type: 'ticket',
          title: 'Billing Issue - Invoice Not Received',
          message: 'Customer reports missing invoice for recent order',
          timestamp: new Date(Date.now() - 30 * 60000),
          icon: '🎫',
          status: 'open'
        },
        {
          id: 102,
          type: 'ticket',
          title: 'Technical Support - Login Problems',
          message: 'User unable to log into account',
          timestamp: new Date(Date.now() - 1.5 * 3600000),
          icon: '🎫',
          status: 'in-progress'
        },
        {
          id: 103,
          type: 'ticket',
          title: 'Feature Request - Dark Mode',
          message: 'Customer requesting dark mode support',
          timestamp: new Date(Date.now() - 4 * 3600000),
          icon: '🎫',
          status: 'open'
        }
      ],
      other: [
        {
          id: 1,
          type: 'other',
          title: 'System Update Completed',
          message: 'Dashboard has been updated to v2.5.0',
          timestamp: new Date(Date.now() - 2 * 3600000),
          icon: '✅'
        },
        {
          id: 2,
          type: 'other',
          title: 'Database Backup',
          message: 'Automated backup completed successfully',
          timestamp: new Date(Date.now() - 6 * 3600000),
          icon: '💾'
        }
      ]
    });
  }, [isOpen]);

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

  const renderIcon = (type) => {
    const common = 'h-10 w-10 flex items-center justify-center rounded-2xl text-white';
    if (type === 'message') {
      return (
        <div className={`${common} bg-sky-500`}>
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 4h16v12H5.5L4 18.5V4z" />
            <path d="M22 4L12 14.01 2 4" />
          </svg>
        </div>
      );
    }
    if (type === 'alert') {
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
    return (
      <div className={`${common} bg-emerald-500`}>
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M5 13l4 4L19 7" />
        </svg>
      </div>
    );
  };

  const allNotifications = [
    ...notifications.messages,
    ...notifications.alerts,
    ...notifications.tickets,
    ...notifications.other
  ];

  const totalCount = allNotifications.length;

  const renderNotifications = () => {
    let items = allNotifications;
    
    if (activeTab === 'messages') items = notifications.messages;
    else if (activeTab === 'alerts') items = notifications.alerts;
    else if (activeTab === 'tickets') items = notifications.tickets;
    else if (activeTab === 'other') items = notifications.other;

    if (items.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
          <div className="mb-2 rounded-3xl bg-slate-100 p-4 text-slate-500 dark:bg-gray-800 dark:text-slate-400">
            <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 7h16v10H4z" />
              <path d="M4 7l8 6 8-6" />
            </svg>
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-sm">No notifications</p>
        </div>
      );
    }

    return (
      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        {items.map((notif) => (
          <div key={`${notif.type}-${notif.id}`} className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition cursor-pointer border-l-4 border-transparent hover:border-brand-500">
            <div className="flex gap-3">
              <div className="flex-shrink-0">{renderIcon(notif.type)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                    {notif.title}
                  </p>
                  {notif.status && (
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0 ${
                      notif.status === 'open' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-200' :
                      notif.status === 'in-progress' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200' :
                      'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200'
                    }`}>
                      {notif.status}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 line-clamp-2">
                  {notif.message}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                  {formatTime(notif.timestamp)}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div ref={dropdownRef} className="absolute right-0 top-full mt-2 w-96 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 z-50 max-h-[600px] flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 dark:text-white">Notifications</h3>
        {totalCount > 0 && (
          <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-gradient-to-br from-orange-400 to-orange-500 text-xs font-semibold text-white">
            {totalCount > 99 ? '99+' : totalCount}
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 overflow-x-auto">
        {[
          { id: 'all', label: 'All', count: totalCount },
          { id: 'messages', label: 'Messages', count: notifications.messages.length },
          { id: 'alerts', label: 'Alerts', count: notifications.alerts.length },
          { id: 'tickets', label: 'Tickets', count: notifications.tickets.length }
        ].map(tab => (
          <button
            key={tab.id}
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

      {/* Notifications List */}
      <div className="overflow-y-auto flex-1">
        {renderNotifications()}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
        <button className="w-full px-4 py-2 text-sm font-medium text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-950 rounded-lg transition">
          View All Notifications
        </button>
      </div>
    </div>
  );
}

export default NotificationDropdown;
