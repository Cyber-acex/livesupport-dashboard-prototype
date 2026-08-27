import AILearningPage from './pages/AILearningPage';
import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import DashboardPage from './pages/DashboardPage';
import TicketsPage from './pages/TicketsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import OrdersPage from './pages/OrdersPage';
import KnowledgePage from './pages/KnowledgePage';
import PolicyPage from './pages/PolicyPage';
import SettingsPage from './pages/SettingsPage';
import InboxPage from './pages/InboxPage';
import AdminUsersPage from './pages/AdminUsersPage';
import VouchersPage from './pages/VouchersPage';
import RefundsPage from './pages/RefundsPage';
import LoginPage from './pages/Login';
import CustomerWebChatPage from './pages/CustomerWebChatPage';
import CustomerChatOnboardingPage from './pages/CustomerChatOnboardingPage';import FeedbackPage from './pages/FeedbackPage';
import NotificationBanner from './components/NotificationBanner';
import { useZoom } from './contexts/ZoomContext';
import StaffVoiceWidget from './components/StaffVoiceWidget';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('App error boundary caught an error', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return null;
    }
    return this.props.children;
  }
}

function App() {
  const location = useLocation();
  const { zoom } = useZoom();
  const pathname = location.pathname || '';
  const isLoginRoute = pathname === '/login';
  const isFeedbackRoute = pathname.startsWith('/rate/');
  const isAuthenticatedShell = !isLoginRoute && !isFeedbackRoute;
  return (
    <>
      {!isLoginRoute && !isFeedbackRoute && <NotificationBanner />}
      <div className="app-zoom-shell" style={{ '--app-zoom': isAuthenticatedShell ? zoom : 1, zoom: isAuthenticatedShell ? 'var(--app-zoom)' : 1 }}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/tickets" element={<TicketsPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/ai-learning" element={<AILearningPage />} />
        <Route path="/orders/*" element={<OrdersPage />} />
        <Route path="/knowledge" element={<KnowledgePage />} />
        <Route path="/knowledge/policies" element={<PolicyPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/inbox" element={<InboxPage />} />
        <Route path="/inbox/messenger" element={<Navigate to="/inbox" replace />} />
        <Route path="/inbox/chat" element={<Navigate to="/inbox" replace />} />
        <Route path="/inbox/chat/:conversationId" element={<Navigate to="/inbox" replace />} />
        <Route path="/customer-chat" element={<CustomerWebChatPage />} />
        <Route path="/customer-chat/onboarding" element={<CustomerChatOnboardingPage />} />
        <Route path="/rate/:token" element={<FeedbackPage />} />
        <Route path="/admin-users" element={<AdminUsersPage />} />
        <Route path="/vouchers" element={<VouchersPage />} />
        <Route path="/refunds" element={<RefundsPage />} />
        {/* Deliveries page removed for presentation build */}
      </Routes>
      </div>
      {isAuthenticatedShell && <StaffVoiceWidget />}
    </>
  );
}

export default App;
