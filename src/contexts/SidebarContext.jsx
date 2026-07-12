import { createContext, useContext, useState } from 'react';

const SidebarContext = createContext(null);

export function SidebarProvider({ children }) {
  const [sidebarToggle, setSidebarToggle] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth >= 1024; // open by default on large screens
  });

  const toggleSidebar = () => {
    setSidebarToggle((prev) => !prev);
  };

  const closeSidebar = () => {
    if (typeof window === 'undefined') {
      return;
    }

    if (window.innerWidth < 1024) {
      setSidebarToggle(false);
    }
  };

  return (
    <SidebarContext.Provider value={{ sidebarToggle, toggleSidebar, closeSidebar }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within SidebarProvider');
  }
  return context;
}
