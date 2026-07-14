import React, { createContext, useContext, useState, useCallback } from 'react';

const NotificationContext = createContext();

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);

  const addNotification = useCallback((message, type = 'success', duration = 4000) => {
    const id = Date.now();
    const notification = { id, message, type };
    
    setNotifications(prev => [...prev, notification]);

    if (duration > 0) {
      setTimeout(() => {
        removeNotification(id);
      }, duration);
    }

    return id;
  }, []);

  const removeNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const success = useCallback((message, duration) => 
    addNotification(message, 'success', duration), [addNotification]);

  const error = useCallback((message, duration) => 
    addNotification(message, 'error', duration), [addNotification]);

  const warning = useCallback((message, duration) => 
    addNotification(message, 'warning', duration), [addNotification]);

  const info = useCallback((message, duration) => 
    addNotification(message, 'info', duration), [addNotification]);

  return (
    <NotificationContext.Provider value={{ 
      addNotification, 
      removeNotification, 
      success, 
      error, 
      warning, 
      info,
      notifications 
    }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within NotificationProvider');
  }
  return context;
}
