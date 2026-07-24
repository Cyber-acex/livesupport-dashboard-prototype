import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createGuestSessionStorage, getGuestDisplayName, loadGuestSession, saveGuestSession } from '../utils/webChatSession';

const branches = [
  { id: 1, name: 'Ikeja' },
  { id: 2, name: 'Lekki' }
];

export default function CustomerChatOnboardingPage() {
  const navigate = useNavigate();
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const storage = useMemo(() => createGuestSessionStorage(window.localStorage), []);

  useEffect(() => {
    const existing = loadGuestSession(storage);
    if (existing?.branchId) {
      setSelectedBranchId(String(existing.branchId));
    }
    if (existing?.customerName) {
      setCustomerName(existing.customerName);
    }
    if (existing?.phone) {
      setPhone(existing.phone);
    }
  }, [storage]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!selectedBranchId) {
      setError('Please select a branch to continue.');
      return;
    }

    if (!customerName.trim()) {
      setError('Please enter your name to continue.');
      return;
    }

    setSubmitting(true);
    try {
      const branch = branches.find((entry) => String(entry.id) === String(selectedBranchId));
      const trimmedName = customerName.trim();
      const guestName = getGuestDisplayName(trimmedName, storage);
      const existing = loadGuestSession(storage);
      const sessionPayload = {
        guestId: existing?.guestId || `guest-${Date.now()}`,
        conversationId: existing?.conversationId || null,
        branchId: Number(selectedBranchId),
        customerName: guestName,
        phone: phone.trim(),
        channel: 'web'
      };

      let conversationId = existing?.conversationId || null;
      if (!conversationId) {
        const response = await fetch('/api/customer-web-chat/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            guestId: sessionPayload.guestId,
            branchId: sessionPayload.branchId,
            customerName: trimmedName,
            phone: sessionPayload.phone,
            channel: 'web'
          })
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data?.error || 'Unable to start a conversation right now.');
        }
        conversationId = data?.conversationId || data?.conversation?.id || null;
        sessionPayload.conversationId = conversationId;
        
        // Show success message for new conversations
        if (data?.isExisting === false) {
          setError('✓ Welcome! A new conversation has been created for you.');
        } else if (data?.isExisting === true) {
          setError('✓ Welcome back! Returning to your existing conversation.');
        }
      }

      saveGuestSession(storage, sessionPayload);
      setTimeout(() => navigate('/customer-chat'), 800);
    } catch (submitError) {
      setError(submitError?.message || 'Unable to start a chat right now.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-4 py-10 sm:px-6 lg:px-8">
      {/* Animated gradient orbs background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-x-0 top-0 h-80 bg-[radial-gradient(circle_at_top_left,_rgba(249,115,22,0.3),_transparent_40%),radial-gradient(circle_at_top_right,_rgba(59,130,246,0.25),_transparent_40%)] blur-3xl animate-pulse" />
        <div className="absolute -left-40 top-40 h-96 w-96 rounded-full bg-orange-500/20 blur-3xl animate-[pulse_8s_ease-in-out_infinite]" />
        <div className="absolute -right-40 bottom-40 h-96 w-96 rounded-full bg-blue-500/15 blur-3xl animate-[pulse_6s_ease-in-out_infinite_2s]" />
      </div>

      <div className="relative overflow-hidden">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-orange-500/30 bg-orange-500/10 px-4 py-2 backdrop-blur-xl">
              <div className="h-2 w-2 rounded-full bg-orange-400 animate-pulse" />
              <span className="text-sm font-semibold text-orange-300">AI-Powered Support</span>
            </div>
          </div>

          <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
            <div className="group rounded-[2rem] border border-white/10 bg-gradient-to-br from-slate-900/80 via-slate-900/60 to-slate-950/80 p-8 text-white shadow-2xl ring-1 ring-white/5 backdrop-blur-xl transition-all duration-500 hover:border-white/20 hover:shadow-[0_40px_120px_-30px_rgba(249,115,22,0.25)]">
              <p className="inline-flex rounded-full bg-orange-500/10 px-3 py-1 text-sm font-semibold text-orange-400 ring-1 ring-orange-400/10">Premium support</p>
              <h1 className="mt-6 text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">Connect with your support team instantly.</h1>
              <p className="mt-4 max-w-xl bg-gradient-to-r from-slate-300 to-slate-400 bg-clip-text text-lg leading-7 text-transparent sm:text-base">
                Choose a branch, share the details, and let our staff handle the rest. Powered by smart routing and real-time notifications for a premium customer support experience.
              </p>
              <div className="mt-10 grid gap-4 sm:grid-cols-2">
                <div className="group rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm transition-all duration-300 hover:border-orange-400/50 hover:bg-orange-500/5 hover:shadow-lg hover:shadow-orange-500/10">
                  <div className="flex items-start gap-3">
                    <div className="mt-1 rounded-lg bg-orange-500/20 p-2 group-hover:bg-orange-500/30 transition-colors">
                      <svg className="h-4 w-4 text-orange-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">Fast routing</p>
                      <p className="mt-1 text-sm text-slate-400">Automatically connect you to the right branch and agent.</p>
                    </div>
                  </div>
                </div>
                <div className="group rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm transition-all duration-300 hover:border-blue-400/50 hover:bg-blue-500/5 hover:shadow-lg hover:shadow-blue-500/10">
                  <div className="flex items-start gap-3">
                    <div className="mt-1 rounded-lg bg-blue-500/20 p-2 group-hover:bg-blue-500/30 transition-colors">
                      <svg className="h-4 w-4 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">Context preserved</p>
                      <p className="mt-1 text-sm text-slate-400">Your details stay with the session so there is no repeat asking.</p>
                    </div>
                  </div>
                </div>
                <div className="group rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm transition-all duration-300 hover:border-violet-400/50 hover:bg-violet-500/5 hover:shadow-lg hover:shadow-violet-500/10">
                  <div className="flex items-start gap-3">
                    <div className="mt-1 rounded-lg bg-violet-500/20 p-2 group-hover:bg-violet-500/30 transition-colors">
                      <svg className="h-4 w-4 text-violet-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">Enterprise-grade</p>
                      <p className="mt-1 text-sm text-slate-400">Designed for reliable live support across every customer journey.</p>
                    </div>
                  </div>
                </div>
                <div className="group rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm transition-all duration-300 hover:border-emerald-400/50 hover:bg-emerald-500/5 hover:shadow-lg hover:shadow-emerald-500/10">
                  <div className="flex items-start gap-3">
                    <div className="mt-1 rounded-lg bg-emerald-500/20 p-2 group-hover:bg-emerald-500/30 transition-colors">
                      <svg className="h-4 w-4 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">Simple setup</p>
                      <p className="mt-1 text-sm text-slate-400">Start chatting in seconds with a guided onboarding flow.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/10 via-white/5 to-white/10 p-8 shadow-2xl ring-1 ring-white/5 backdrop-blur-xl transition-all duration-500 hover:shadow-[0_40px_120px_-30px_rgba(59,130,246,0.25)]">
              <div className="mb-8">
                <p className="text-xs font-bold uppercase tracking-widest text-orange-400/80">Get started</p>
                <h2 className="mt-4 text-3xl font-bold text-white">Your details</h2>
                <p className="mt-3 text-sm leading-6 text-slate-300">Select the branch and tell us who you are so your conversation starts with context.</p>
              </div>

              <form className="space-y-6" onSubmit={handleSubmit}>
                <div className="space-y-4">
                  <label className="text-sm font-semibold text-white">Choose branch</label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {branches.map((branch) => {
                      const isActive = String(branch.id) === String(selectedBranchId);
                      return (
                        <button
                          key={branch.id}
                          type="button"
                          onClick={() => setSelectedBranchId(String(branch.id))}
                          className={`group relative overflow-hidden rounded-2xl border p-4 text-left transition-all duration-300 ${
                            isActive
                              ? 'border-orange-400 bg-gradient-to-br from-orange-500/20 to-amber-500/10 shadow-lg shadow-orange-500/20 scale-105'
                              : 'border-white/20 bg-white/5 hover:border-white/40 hover:bg-white/10 hover:shadow-md hover:shadow-white/10'
                          }`}
                        >
                          <div className="relative z-10">
                            <span className="block text-xs font-medium uppercase tracking-wider text-slate-400">Branch</span>
                            <span className="mt-2 block text-lg font-semibold text-white leading-6">{branch.name}</span>
                          </div>
                          {isActive && (
                            <div className="absolute inset-0 -z-10 opacity-50 group-hover:opacity-75 transition-opacity duration-300" style={{ background: 'radial-gradient(circle at 50% 0%, rgba(249,115,22,0.15), transparent 70%)' }} />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-3">
                  <label htmlFor="name" className="text-sm font-semibold text-white">Your name <span className="text-orange-400">*</span></label>
                  <div className="relative group">
                    <input
                      id="name"
                      type="text"
                      value={customerName}
                      onChange={(event) => setCustomerName(event.target.value)}
                      placeholder="Enter your name"
                      required
                      className="w-full rounded-2xl border border-white/20 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-400 transition-all duration-300 focus:border-orange-400 focus:bg-white/10 focus:ring-4 focus:ring-orange-500/20 backdrop-blur-sm"
                    />
                    <div className="absolute inset-0 rounded-2xl opacity-0 group-focus-within:opacity-100 transition-opacity pointer-events-none" style={{ background: 'radial-gradient(circle at 50% 0%, rgba(249,115,22,0.1), transparent 70%)' }} />
                  </div>
                </div>

                <div className="space-y-3">
                  <label htmlFor="phone" className="text-sm font-semibold text-white">Phone number</label>
                  <div className="relative group">
                    <input
                      id="phone"
                      type="tel"
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      placeholder="Optional — enter a phone number for follow up"
                      className="w-full rounded-2xl border border-white/20 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-400 transition-all duration-300 focus:border-orange-400 focus:bg-white/10 focus:ring-4 focus:ring-orange-500/20 backdrop-blur-sm"
                    />
                    <div className="absolute inset-0 rounded-2xl opacity-0 group-focus-within:opacity-100 transition-opacity pointer-events-none" style={{ background: 'radial-gradient(circle at 50% 0%, rgba(249,115,22,0.1), transparent 70%)' }} />
                  </div>
                </div>

                {error ? (
                  <div className={`rounded-2xl border px-4 py-3 text-sm font-medium backdrop-blur-sm ring-1 ${
                    error.startsWith('✓')
                      ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200 ring-emerald-400/20'
                      : 'border-rose-400/30 bg-rose-500/10 text-rose-200 ring-rose-400/20'
                  }`}>
                    <div className="flex items-center gap-2">
                      {error.startsWith('✓') ? (
                        <>
                          <svg className="h-5 w-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>{error}</span>
                        </>
                      ) : (
                        <>
                          <svg className="h-5 w-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>{error}</span>
                        </>
                      )}
                    </div>
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={submitting}
                  className="group relative w-full overflow-hidden rounded-2xl bg-gradient-to-r from-orange-500 via-orange-400 to-amber-400 px-6 py-3 text-sm font-bold text-white shadow-xl shadow-orange-500/30 transition-all duration-300 hover:shadow-2xl hover:shadow-orange-500/50 hover:scale-105 disabled:cursor-not-allowed disabled:opacity-70 disabled:scale-100"
                >
                  <div className="absolute inset-0 -z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-xl" style={{ background: 'radial-gradient(circle, rgba(249,115,22,0.4), transparent)' }} />
                  {submitting ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/70 border-t-transparent" />
                      Starting chat…
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2">
                      Start chat
                      <svg className="h-4 w-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </span>
                  )}
                </button>
              </form>

              <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
                <p className="text-xs font-bold uppercase tracking-widest text-orange-400/80">Why this matters</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">Selecting your branch helps us connect you with the right staff and speeds up responses by getting the right queue from the first message.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
