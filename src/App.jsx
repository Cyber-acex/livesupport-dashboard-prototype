import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import DashboardPage from './pages/DashboardPage';
import TicketsPage from './pages/TicketsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import OrdersPage from './pages/OrdersPage';
import KnowledgePage from './pages/KnowledgePage';
import TrackingPage from './pages/TrackingPage';
import SettingsPage from './pages/SettingsPage';
import InboxPage from './pages/InboxPage';
import AdminUsersPage from './pages/AdminUsersPage';
import VoicePanel from './components/VoicePanel';
import LoginPage from './pages/LoginPage';
import NotificationBanner from './components/NotificationBanner';

function App() {
  const location = useLocation();
  const isLoginPage = location.pathname === '/login';

  return (
    <>
      {!isLoginPage && <VoicePanel />}
      <NotificationBanner />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/tickets" element={<TicketsPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/orders/*" element={<OrdersPage />} />
        <Route path="/knowledge" element={<KnowledgePage />} />
        <Route path="/tracking" element={<TrackingPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/inbox" element={<InboxPage />} />
        <Route path="/admin-users" element={<AdminUsersPage />} />
      </Routes>
    </>
  );
}

export default App;
