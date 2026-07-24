import { useEffect, useState } from 'react';
import LoginForm from '../components/LoginForm';
import HeroSection from '../components/HeroSection';
import { getLoginErrorMessage, getLoginErrorMessageFromQuery } from '../utils/loginErrorMessages';

const features = [
  {
    title: 'Live Chat Support',
    subtitle: 'Real-time customer conversations',
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  },
  {
    title: 'Order Management',
    subtitle: 'Track and manage orders live',
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M9 11l3 3L22 4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  },
  {
    title: 'Ticket System',
    subtitle: 'Resolve issues faster',
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M9 11l3 3L22 4M12 2H5a3 3 0 0 0-3 3v14a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3V12" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="8" y="7" width="8" height="2" fill="currentColor" />
        <rect x="8" y="13" width="4" height="2" fill="currentColor" />
      </svg>
    )
  },
  {
    title: 'Analytics & Reports',
    subtitle: 'Monitor performance and satisfaction',
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <line x1="12" y1="2" x2="12" y2="22" strokeLinecap="round" />
        <polyline points="19 9 12 2 5 9" strokeLinecap="round" />
      </svg>
    )
  }
];

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [branchId, setBranchId] = useState('');
  const [branches, setBranches] = useState([]);
  const [branchSelectionLocked, setBranchSelectionLocked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const refreshBranchSelection = async (emailValue = '') => {
    const trimmedEmail = String(emailValue || '').trim();
    try {
      const query = trimmedEmail ? `?email=${encodeURIComponent(trimmedEmail)}` : '';
      const response = await fetch(`/api/branches${query}`, { credentials: 'same-origin' });
      if (!response.ok) {
        setBranches([]);
        setBranchSelectionLocked(false);
        setBranchId('');
        return;
      }

      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        const branchCandidates = data.filter((branch) => String(branch.name).trim().toLowerCase() !== 'main branch');
        const branchesToUse = branchCandidates.length > 0 ? branchCandidates : data;

        setBranches(branchesToUse);
        setBranchSelectionLocked(Boolean(trimmedEmail && branchesToUse.length === 1));
        setBranchId((currentBranchId) => {
          if (currentBranchId && branchesToUse.some((branch) => String(branch.id) === String(currentBranchId))) {
            return currentBranchId;
          }
          return String(branchesToUse[0].id);
        });
        return;
      }

      setBranches([]);
      setBranchSelectionLocked(false);
      setBranchId('');
    } catch (error) {
      console.warn('Unable to load branches', error);
    }
  };

  useEffect(() => {
    const error = new URLSearchParams(window.location.search).get('error');
    const message = getLoginErrorMessage(error);
    setErrorMessage(message);

    if (error) {
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.delete('error');
      window.history.replaceState({}, document.title, `${nextUrl.pathname}${nextUrl.search}`);
    }
  }, []);

  useEffect(() => {
    refreshBranchSelection('');
  }, []);

  useEffect(() => {
    const trimmedEmail = email.trim();
    const timerId = window.setTimeout(() => {
      refreshBranchSelection(trimmedEmail);
    }, 220);

    return () => window.clearTimeout(timerId);
  }, [email]);

  const handleSubmit = (event) => {
    setIsSubmitting(true);
    setErrorMessage('');
  };

  const handleShowPasswordToggle = () => {
    setShowPassword((value) => !value);
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(251,146,60,0.18),_transparent_24%),linear-gradient(135deg,_#fff9f3_0%,_#fff4eb_45%,_#fef7f0_100%)] px-4 py-6 text-slate-900 sm:px-6 lg:px-8 lg:py-8">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-7xl flex-col overflow-hidden rounded-[2rem] border border-white/70 bg-white/60 shadow-[0_40px_140px_-40px_rgba(249,115,22,0.35)] backdrop-blur-2xl lg:flex-row">
        <section className="flex flex-1 items-center justify-center px-4 py-8 sm:px-8 lg:px-10 lg:py-10">
          <LoginForm
            email={email}
            password={password}
            branchId={branchId}
            branches={branches}
            branchSelectionLocked={branchSelectionLocked}
            remember={remember}
            showPassword={showPassword}
            isSubmitting={isSubmitting}
            errorMessage={errorMessage}
            onEmailChange={(event) => setEmail(event.target.value)}
            onPasswordChange={(event) => setPassword(event.target.value)}
            onBranchChange={(event) => {
              if (!branchSelectionLocked) {
                setBranchId(event.target.value);
              }
            }}
            onRememberChange={(event) => setRemember(event.target.checked)}
            onShowPasswordToggle={handleShowPasswordToggle}
            onSubmit={handleSubmit}
            onGoogleClick={() => window.location.assign('/auth/google')}
            onForgotPasswordClick={() => window.location.assign('/forgot-password.html')}
            onSignUpClick={() => window.location.assign('/signup')}
            onCustomerChatClick={() => window.location.assign('/customer-chat/onboarding')}
          />
        </section>

        <HeroSection
          imageSrc="/images/buffed-login.png"
          headline="Run your restaurant support with calm, intelligent automation."
          subheadline="Coordinate kitchen orders, service tickets, and customer conversations from one premium AI workspace."
          features={features}
        />
      </div>
    </div>
  );
}
