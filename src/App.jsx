import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import DashboardPage from './pages/DashboardPage';
import TicketsPage from './pages/TicketsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import OrdersPage from './pages/OrdersPage';
import KnowledgePage from './pages/KnowledgePage';
import PolicyPage from './pages/PolicyPage';
import TrackingPage from './pages/TrackingPage';
import SettingsPage from './pages/SettingsPage';
import InboxPage from './pages/InboxPage';
import MessengerInboxPage from './pages/MessengerInboxPage';
import AdminUsersPage from './pages/AdminUsersPage';
import VouchersPage from './pages/VouchersPage';
import LoginPage from './pages/Login';
import CustomerWebChatPage from './pages/CustomerWebChatPage';
import CustomerChatOnboardingPage from './pages/CustomerChatOnboardingPage';import StaffWebChatPage from './pages/StaffWebChatPage';import FeedbackPage from './pages/FeedbackPage';
import VoicePanel from './components/VoicePanel';
import NotificationBanner from './components/NotificationBanner';

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
  const pathname = location.pathname || '';
  const isLoginRoute = pathname === '/login';
  const isCustomerChatRoute = pathname === '/customer-chat' || pathname.startsWith('/customer-chat/');
  const isFeedbackRoute = pathname.startsWith('/rate/');
  const shouldShowVoicePanel = !isLoginRoute && !isCustomerChatRoute && !isFeedbackRoute;

  return (
    <>
      {shouldShowVoicePanel && (
        <ErrorBoundary>
          <VoicePanel />
        </ErrorBoundary>
      )}
      {!isLoginRoute && !isFeedbackRoute && <NotificationBanner />}
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/tickets" element={<TicketsPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/orders/*" element={<OrdersPage />} />
        <Route path="/knowledge" element={<KnowledgePage />} />
        <Route path="/knowledge/policies" element={<PolicyPage />} />
        <Route path="/tracking" element={<TrackingPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/inbox" element={<InboxPage />} />
        <Route path="/inbox/messenger" element={<MessengerInboxPage />} />
        <Route path="/inbox/chat" element={<StaffWebChatPage />} />
        <Route path="/inbox/chat/:conversationId" element={<StaffWebChatPage />} />
        <Route path="/customer-chat" element={<CustomerWebChatPage />} />
        <Route path="/customer-chat/onboarding" element={<CustomerChatOnboardingPage />} />
        <Route path="/rate/:token" element={<FeedbackPage />} />
        <Route path="/admin-users" element={<AdminUsersPage />} />
        <Route path="/vouchers" element={<VouchersPage />} />
      </Routes>
    </>
  );
}

export default App;
