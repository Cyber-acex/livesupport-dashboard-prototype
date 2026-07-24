import AnimatedButton from './AnimatedButton';

export default function LoginForm({
  email,
  password,
  branchId,
  branches,
  branchSelectionLocked,
  remember,
  showPassword,
  isSubmitting,
  errorMessage,
  onEmailChange,
  onPasswordChange,
  onBranchChange,
  onRememberChange,
  onShowPasswordToggle,
  onSubmit,
  onGoogleClick,
  onForgotPasswordClick,
  onSignUpClick,
  onCustomerChatClick
}) {
  return (
    <div className="w-full max-w-lg rounded-[2rem] border border-white/80 bg-white/80 p-6 shadow-[0_24px_90px_-30px_rgba(15,23,42,0.35)] backdrop-blur-xl sm:p-8">
      <div className="mb-8 space-y-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-amber-400 text-white shadow-lg shadow-orange-200">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M23 16.13c0-.68-.55-1.25-1.23-1.25h-.98c-.68 0-1.23.57-1.23 1.25 0 .69.55 1.25 1.23 1.25h.98c.68 0 1.23-.56 1.23-1.25z" fill="currentColor" />
            <path d="M20.16 10.5h-3.5c-.68 0-1.23.57-1.23 1.25s.55 1.25 1.23 1.25h3.5c.68 0 1.23-.57 1.23-1.25s-.55-1.25-1.23-1.25z" fill="currentColor" />
            <path d="M20.16 4.63h-3.5c-.68 0-1.23.57-1.23 1.25s.55 1.25 1.23 1.25h3.5c.68 0 1.23-.57 1.23-1.25s-.55-1.25-1.23-1.25z" fill="currentColor" />
            <path d="M12.28 23.1H8.08c-3.82 0-6.19-2.38-6.19-6.2V7.1c0-3.82 2.37-6.2 6.19-6.2h4.2c3.82 0 6.19 2.38 6.19 6.2v9.8c0 3.82-2.37 6.2-6.19 6.2zm-4.2-18.5c-2.45 0-3.69 1.25-3.69 3.7v9.8c0 2.45 1.24 3.7 3.69 3.7h4.2c2.45 0 3.69-1.25 3.69-3.7V7.1c0-2.45-1.24-3.7-3.69-3.7h-4.2z" fill="currentColor" />
          </svg>
        </div>
        <div>
          <p className="text-3xl font-semibold tracking-tight text-slate-900">Welcome back</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">Sign in to manage live conversations, orders, and support tickets in one calm workspace.</p>
        </div>
      </div>

      {errorMessage ? (
        <div className="mb-5 flex animate-[fadeIn_220ms_ease-out] items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50/95 p-3 text-sm text-rose-700 shadow-sm" role="alert">
          <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0 animate-pulse" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 8v6" strokeLinecap="round" />
            <circle cx="12" cy="16" r="1" fill="currentColor" />
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>{errorMessage}</span>
        </div>
      ) : null}

      <form className="space-y-4" onSubmit={onSubmit} method="POST" action="/login">
        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium text-slate-700">Email</label>
          <div className="flex items-center rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-3 shadow-sm transition focus-within:border-orange-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-orange-100">
            <svg viewBox="0 0 24 24" className="mr-2 h-5 w-5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M20 6l-8 5-8-5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <input
              id="email"
              name="email"
              type="email"
              value={email}
              onChange={onEmailChange}
              placeholder="name@company.com"
              required
              className="w-full border-none bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="password" className="text-sm font-medium text-slate-700">Password</label>
          <div className="flex items-center rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-3 shadow-sm transition focus-within:border-orange-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-orange-100">
            <svg viewBox="0 0 24 24" className="mr-2 h-5 w-5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M19 10.5H5c-1.1 0-2 .9-2 2v7c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-7c0-1.1-.9-2-2-2z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M7 10.5V7c0-2.76 2.24-5 5-5s5 2.24 5 5v3.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="12" cy="16.5" r="1" fill="currentColor" />
            </svg>
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={onPasswordChange}
              placeholder="Enter your password"
              required
              className="w-full border-none bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
            />
            <button type="button" onClick={onShowPasswordToggle} className="ml-2 rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600">
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="branchId" className="text-sm font-medium text-slate-700">Select branch</label>
          <div className="flex items-center rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-3 shadow-sm transition focus-within:border-orange-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-orange-100">
            <svg viewBox="0 0 24 24" className="mr-2 h-5 w-5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M4 6h16" strokeLinecap="round" />
              <path d="M8 6v12" strokeLinecap="round" />
              <path d="M16 6v12" strokeLinecap="round" />
              <path d="M4 12h16" strokeLinecap="round" />
            </svg>
            <select id="branchId" name="branchId" value={branchId} onChange={onBranchChange} disabled={branchSelectionLocked} className="w-full border-none bg-transparent text-sm text-slate-700 outline-none disabled:cursor-not-allowed disabled:text-slate-500">
              {branches.length === 0 ? <option value="">Loading branches…</option> : branches.map((branch) => (
                <option key={branch.id} value={branch.id}>{branch.name}</option>
              ))}
            </select>
          </div>
          {branchSelectionLocked ? (
            <p className="text-xs text-slate-500">Only your assigned branch is available for this account.</p>
          ) : null}
        </div>

        <div className="flex items-center justify-between text-sm">
          <label className="flex items-center gap-2 text-slate-600">
            <input type="checkbox" checked={remember} onChange={onRememberChange} className="h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-400" />
            Remember me
          </label>
          <button type="button" onClick={onForgotPasswordClick} className="font-medium text-orange-600 transition hover:text-orange-700">
            Forgot password?
          </button>
        </div>

        <AnimatedButton type="submit" disabled={isSubmitting} className="w-full">
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
        </AnimatedButton>
      </form>

      <div className="mt-6 flex items-center gap-3 text-sm text-slate-400">
        <div className="h-px flex-1 bg-slate-200" />
        <span>or continue with</span>
        <div className="h-px flex-1 bg-slate-200" />
      </div>

      <AnimatedButton type="button" variant="secondary" className="mt-4 w-full" onClick={onGoogleClick}>
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>
        Continue with Google
      </AnimatedButton>

      <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-center shadow-sm">
        <div className="text-[11px] font-semibold uppercase tracking-[0.32em] text-slate-400">Customer access</div>
        <div className="mt-2 text-sm font-medium text-slate-700">Are you a customer?</div>
        <button type="button" onClick={onCustomerChatClick} className="mt-3 inline-flex items-center justify-center rounded-full border border-orange-200 bg-white px-4 py-2 text-sm font-semibold text-orange-600 transition hover:border-orange-300 hover:bg-orange-50">
          Chat with a Staff Member
        </button>
      </div>

    </div>
  );
}
