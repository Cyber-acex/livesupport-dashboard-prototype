import React, { useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useNotification } from '../contexts/NotificationContext';
import NotificationContent from './notifications/NotificationContent';

function resolveNotificationComponent() {
  return NotificationContent;
}

export default function NotificationBanner() {
  const { notifications, removeNotification } = useNotification();

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        notifications.forEach((notification) => removeNotification(notification.id));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [notifications, removeNotification]);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[9999] flex justify-center px-3 sm:px-4">
      <div className="flex w-full max-w-[900px] flex-col gap-3">
        <AnimatePresence mode="popLayout">
          {notifications.map((notification) => {
            const Component = resolveNotificationComponent(notification.type);
            return (
              <div key={notification.id} className="pointer-events-auto w-full">
                <Component
                  title={notification.title || notification.message || 'Notification'}
                  description={notification.description || notification.message || 'You have a new update.'}
                  timestamp={notification.timestamp || 'Just now'}
                  onClose={() => removeNotification(notification.id)}
                  onAction={notification.onAction}
                />
              </div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

