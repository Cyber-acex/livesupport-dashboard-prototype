import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import { getSettings, applyTheme } from './services/settingsService';
import { SidebarProvider } from './contexts/SidebarContext';

// Apply theme early to avoid flash during React mount
try {
  const initial = getSettings();
  applyTheme(initial.theme);
} catch (e) {}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <SidebarProvider>
        <App />
      </SidebarProvider>
    </BrowserRouter>
  </React.StrictMode>
);
