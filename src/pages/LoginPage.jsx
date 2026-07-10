import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import SupportAgentScene from '../components/SupportAgentScene';

function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get('error');

    if (error === 'invalid') {
      setErrorMessage('Invalid email or password. Please try again.');
    } else if (error && error.startsWith('google_')) {
      const googleErrors = {
        google_access_denied: 'Google login was cancelled.',
        google_no_code: 'Failed to get authorization code from Google.',
        google_token_failed: 'Failed to exchange code for token.',
        google_userinfo_failed: 'Failed to fetch your Google profile information.',
        google_db_error: 'Database error during login.',
        google_create_failed: 'Failed to create your account.',
        google_exception: 'An error occurred during Google authentication.'
      };
      setErrorMessage(googleErrors[error] || 'Google authentication failed. Please try again.');
    }
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage('');

    const form = event.currentTarget;
    const data = new FormData(form);
    data.set('remember', remember ? 'on' : '');

    try {
      const response = await fetch('/login', {
        method: 'POST',
        body: data,
        redirect: 'manual'
      });

      if (response.type === 'opaqueredirect' || response.status >= 300 && response.status < 400) {
        window.location.assign('/dashboard?welcome=1');
        return;
      }

      if (response.ok) {
        window.location.assign('/dashboard?welcome=1');
        return;
      }

      setErrorMessage('Unable to sign in right now. Please try again.');
      setIsSubmitting(false);
    } catch (error) {
      setErrorMessage('Unable to sign in right now. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(191,219,254,0.7),_transparent_30%),linear-gradient(135deg,_#f8fbff_0%,_#f3f8ff_45%,_#eef8ff_100%)] px-4 py-6 text-slate-900 sm:px-6 lg:px-8 lg:py-8">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-7xl flex-col overflow-hidden rounded-[2rem] border border-white/70 bg-white/70 shadow-[0_40px_120px_-40px_rgba(59,130,246,0.35)] backdrop-blur-2xl lg:flex-row">
        <motion.section
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="relative flex flex-1 items-center justify-center overflow-hidden px-4 py-8 sm:px-8 lg:px-10 lg:py-10"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(59,130,246,0.14),_transparent_48%)]" />
          <div className="relative z-10 w-full max-w-2xl">
            <div className="mb-6 flex items-center gap-3 text-sm font-semibold text-slate-600">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-sky-200 bg-white/80 shadow-sm">
                <svg viewBox="0 0 24 24" className="h-5 w-5 text-sky-600" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M6 19h12" strokeLinecap="round" />
                  <path d="M8 16V8a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v8" strokeLinecap="round" />
                  <path d="M10 8h4" strokeLinecap="round" />
                </svg>
              </div>
              <div>
                <p className="text-base text-slate-800">LiveSupport AI Desk</p>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Customer success workspace</p>
              </div>
            </div>
            <SupportAgentScene />
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: 'easeOut', delay: 0.1 }}
          className="flex w-full items-center justify-center border-t border-slate-200/70 bg-slate-50/70 px-4 py-8 sm:px-8 lg:w-[440px] lg:border-l lg:border-t-0 lg:px-8 lg:py-10"
        >
          <div className="w-full max-w-md rounded-[1.75rem] border border-white/80 bg-white/80 p-6 shadow-[0_20px_80px_-30px_rgba(15,23,42,0.25)] backdrop-blur-xl sm:p-8">
            <div className="mb-8 space-y-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-cyan-400 shadow-lg shadow-sky-200">
                <svg viewBox="0 0 24 24" className="h-6 w-6 text-white" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M7 7h10" strokeLinecap="round" />
                  <path d="M8 11h8" strokeLinecap="round" />
                  <path d="M10 15h4" strokeLinecap="round" />
                  <rect x="4" y="4" width="16" height="16" rx="3" />
                </svg>
              </div>
              <div>
                <p className="text-3xl font-semibold tracking-tight text-slate-900">Welcome back</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">Sign in to manage live conversations, orders, and support tickets in one calm workspace.</p>
              </div>
            </div>

            <AnimatePresence mode="wait">
              {errorMessage ? (
                <motion.div
                  key={errorMessage}
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="mb-5 rounded-2xl border border-rose-200 bg-rose-50/90 p-3 text-sm text-rose-700"
                >
                  {errorMessage}
                </motion.div>
              ) : null}
            </AnimatePresence>

            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium text-slate-700">Email</label>
                <div className="flex items-center rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-3 shadow-sm transition focus-within:border-sky-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-sky-100">
                  <svg viewBox="0 0 24 24" className="mr-2 h-5 w-5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M4 7h16v10H4z" />
                    <path d="m4 7 8 6 8-6" strokeLinecap="round" />
                  </svg>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="name@company.com"
                    required
                    className="w-full border-none bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium text-slate-700">Password</label>
                <div className="flex items-center rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-3 shadow-sm transition focus-within:border-sky-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-sky-100">
                  <svg viewBox="0 0 24 24" className="mr-2 h-5 w-5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M7 10V8a5 5 0 0 1 10 0v2" />
                    <rect x="5" y="10" width="14" height="10" rx="2" />
                  </svg>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Enter your password"
                    required
                    className="w-full border-none bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="ml-2 rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2 text-slate-600">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(event) => setRemember(event.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-sky-500 focus:ring-sky-400"
                  />
                  Remember me
                </label>
                <a href="/reset-password.html" className="font-medium text-sky-600 transition hover:text-sky-700">Forgot password?</a>
              </div>

              <motion.button
                type="submit"
                whileHover={{ y: -2, scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                disabled={isSubmitting}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-sky-600 to-cyan-500 px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-sky-200 transition disabled:cursor-not-allowed disabled:opacity-80"
              >
                {isSubmitting ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/70 border-t-transparent" />
                    Signing in…
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M5 12h14" strokeLinecap="round" />
                      <path d="m13 6 6 6-6 6" strokeLinecap="round" />
                    </svg>
                    Sign in
                  </>
                )}
              </motion.button>
            </form>

            <div className="mt-6 flex items-center gap-3 text-sm text-slate-400">
              <div className="h-px flex-1 bg-slate-200" />
              <span>or continue with</span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>

            <button
              type="button"
              onClick={() => window.location.assign('/auth/google')}
              className="mt-4 flex w-full items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm font-medium text-slate-700 shadow-sm transition hover:border-sky-200 hover:bg-sky-50/60"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Continue with Google
            </button>

            <p className="mt-6 text-center text-sm text-slate-500">
              New here?{' '}
              <a href="/signup" className="font-semibold text-sky-600 transition hover:text-sky-700">
                Create an account
              </a>
            </p>
          </div>
        </motion.section>
      </div>
    </div>
  );
}

export default LoginPage;
