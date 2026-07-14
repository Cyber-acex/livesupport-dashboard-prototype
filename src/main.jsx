import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import { getSettings, applyTheme } from './services/settingsService';
import { SidebarProvider } from './contexts/SidebarContext';
import { NotificationProvider } from './contexts/NotificationContext';

// Apply theme early to avoid flash during React mount
try {
  const initial = getSettings();
  applyTheme(initial.theme);
} catch (e) {}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <NotificationProvider>
        <SidebarProvider>
          <App />
        </SidebarProvider>
      </NotificationProvider>
    </BrowserRouter>
  </React.StrictMode>
);
