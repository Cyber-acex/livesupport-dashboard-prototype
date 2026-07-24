import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useSidebar } from '../contexts/SidebarContext';
import NotificationDropdown from './NotificationDropdown';

function TopBar({ onSidebarToggle }) {
  const { toggleSidebar } = useSidebar();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [currentUser, setCurrentUser] = useState({ name: 'Staff', role: 'agent', avatar_url: null });
  const [sessionStartedAt, setSessionStartedAt] = useState(() => {
    if (typeof window === 'undefined') return Date.now();
    const stored = window.localStorage.getItem('sessionStartedAt');
    const parsed = Number(stored);
    if (stored && !Number.isNaN(parsed) && parsed > 0) {
      return parsed;
    }
    const now = Date.now();
    window.localStorage.setItem('sessionStartedAt', String(now));
    return now;
  });
  const [sessionTick, setSessionTick] = useState(0);
  const signOutAudio = useMemo(() => {
    const audio = new Audio(encodeURI('/uploads/Notification sounds/sign out.wav'));
    audio.preload = 'auto';
    return audio;
  }, []);
  const notifRef = useRef();
  const userRef = useRef();

  // Initialize dark mode from localStorage and apply on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    const isDark = savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches);
    setDarkMode(isDark);
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  useEffect(() => {
    function syncAvatarFromStorage() {
      const storedAvatar = typeof window !== 'undefined' ? window.localStorage.getItem('userAvatar') : null;
      if (storedAvatar) {
        setCurrentUser((prev) => ({ ...prev, avatar_url: storedAvatar }));
      }
    }

    async function loadCurrentUser() {
      if (typeof window !== 'undefined' && window.currentUser) {
        setCurrentUser({
          ...window.currentUser,
          name: window.currentUser.name || 'Staff',
          role: window.currentUser.role || 'agent',
          avatar_url: window.currentUser.avatar_url || window.currentUser.avatarUrl || null
        });
        syncAvatarFromStorage();
        return;
      }

      try {
        const res = await fetch('/api/user', { credentials: 'same-origin' });
        if (!res.ok) return;
        const data = await res.json();
        if (data && data.name) {
          const resolvedAvatar = data.avatar_url || data.avatarUrl || (typeof window !== 'undefined' ? window.localStorage.getItem('userAvatar') : null);
          const mergedUser = {
            ...data,
            name: data.name || 'Staff',
            role: data.role || 'agent',
            avatar_url: resolvedAvatar
          };
          setCurrentUser(mergedUser);
          if (typeof window !== 'undefined') {
            window.currentUser = mergedUser;
          }
        }
      } catch (error) {
        console.warn('Failed to load current user', error);
      }
    }

    loadCurrentUser();
    if (typeof window !== 'undefined') {
      window.addEventListener('avatar:updated', syncAvatarFromStorage);
      window.addEventListener('profile:updated', loadCurrentUser);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('avatar:updated', syncAvatarFromStorage);
        window.removeEventListener('profile:updated', loadCurrentUser);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem('sessionStartedAt');
    const parsed = Number(stored);
    if (stored && !Number.isNaN(parsed) && parsed > 0) {
      setSessionStartedAt(parsed);
    } else {
      const now = Date.now();
      window.localStorage.setItem('sessionStartedAt', String(now));
      setSessionStartedAt(now);
    }
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => setSessionTick((value) => value + 1), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClick(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotificationsOpen(false);
      }
      if (userRef.current && !userRef.current.contains(e.target)) {
        setUserOpen(false);
      }
    }
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  function getInitials(name) {
    if (!name) return 'ST';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  const userInitials = getInitials(currentUser.name);
  const displayName = currentUser.name || 'Staff';
  const displayRole = currentUser.role ? currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1) : 'Agent';
  const activeBranchName = currentUser.branchName || currentUser.branch_name || currentUser.branch?.name || 'No branch';
  const avatarUrl = currentUser.avatar_url || currentUser.avatarUrl || (typeof window !== 'undefined' ? window.localStorage.getItem('userAvatar') : null);

  const handleSignOut = async () => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('userAvatar');
        window.localStorage.removeItem('sessionStartedAt');
        window.sessionStorage.removeItem('auth');
        window.currentUser = null;
      }

      if (signOutAudio) {
        signOutAudio.currentTime = 0;
        signOutAudio.play().catch(() => {
          // Ignore autoplay restrictions.
        });
      }

      await fetch('/logout', { method: 'GET', credentials: 'same-origin' });
    } catch (error) {
      console.warn('Sign out request failed', error);
    } finally {
      if (typeof window !== 'undefined') {
        window.location.assign('/login.html');
      }
    }
  };

  const formatSessionTimestamp = (startTime) => {
    if (!startTime) return 'Unknown';
    return new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      minute: '2-digit',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }).format(new Date(startTime));
  };

  const formatSessionDuration = (startTime) => {
    if (!startTime) return '0s';
    const diffMs = Math.max(0, Date.now() - startTime);
    const hours = Math.floor(diffMs / 3600000);
    const minutes = Math.floor((diffMs % 3600000) / 60000);
    const seconds = Math.floor((diffMs % 60000) / 1000);
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  };

  return (
    <header className="sticky top-0 z-50 flex w-full border-b border-gray-200 bg-white/95 backdrop-blur dark:border-gray-800 dark:bg-gray-900/95">
      <div className="flex grow flex-col items-center justify-between gap-3 px-3 py-3 sm:px-4 lg:flex-row lg:px-6 lg:py-4">
        <div className="flex w-full items-center justify-between gap-2 sm:gap-4 lg:justify-normal lg:px-0">
          <button
            onClick={() => (onSidebarToggle ? onSidebarToggle() : toggleSidebar())}
            className="z-50 flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 shadow-sm lg:h-11 lg:w-11 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400"
            aria-label="Toggle sidebar"
          >
            <svg className="hidden fill-current lg:block" width="16" height="12" viewBox="0 0 16 12" xmlns="http://www.w3.org/2000/svg"><path d="M0.583 1C0.583 0.586 0.919 0.25 1.333 0.25H14.667C15.081 0.25 15.417 0.586 15.417 1C15.417 1.414 15.081 1.75 14.667 1.75L1.333 1.75C0.919 1.75 0.583 1.414 0.583 1ZM0.583 11C0.583 10.586 0.919 10.25 1.333 10.25L14.667 10.25C15.081 10.25 15.417 10.586 15.417 11C15.417 11.414 15.081 11.75 14.667 11.75L1.333 11.75C0.919 11.75 0.583 11.414 0.583 11ZM1.333 5.25C0.919 5.25 0.583 5.586 0.583 6C0.583 6.414 0.919 6.75 1.333 6.75L7.999 6.75C8.414 6.75 8.75 6.414 8.75 6C8.75 5.586 8.414 5.25 7.999 5.25L1.333 5.25Z"/></svg>
            <svg className="fill-current lg:hidden" width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M3.25 6C3.25 5.586 3.586 5.25 4 5.25L20 5.25C20.414 5.25 20.75 5.586 20.75 6C20.75 6.414 20.414 6.75 20 6.75L4 6.75C3.586 6.75 3.25 6.414 3.25 6ZM3.25 18C3.25 17.586 3.586 17.25 4 17.25L20 17.25C20.414 17.25 20.75 17.586 20.75 18C20.75 18.414 20.414 18.75 20 18.75L4 18.75C3.586 18.75 3.25 18.414 3.25 18ZM4 11.25C3.586 11.25 3.25 11.586 3.25 12C3.25 12.414 3.586 12.75 4 12.75L12 12.75C12.414 12.75 12.75 12.414 12.75 12C12.75 11.586 12.414 11.25 12 11.25L4 11.25Z"/></svg>
          </button>

          <a href="/" className="lg:hidden">
            <img className="dark:hidden" src="/images/logo/logo.svg" alt="Logo" />
            <img className="hidden dark:block" src="/images/logo/logo-dark.svg" alt="Logo" />
          </a>

          <div className="hidden lg:block">
            <form>
              <div className="relative">
                <span className="absolute top-1/2 left-4 -translate-y-1/2 text-gray-500">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3.042 9.374C3.042 5.877 5.877 3.042 9.375 3.042C12.873 3.042 15.708 5.877 15.708 9.374C15.708 12.87 12.873 15.705 9.375 15.705C5.877 15.705 3.042 12.87 3.042 9.374Z" fill="currentColor"/></svg>
                </span>
                <input type="text" placeholder="Search or type command..." id="search-input" className="dark:bg-dark-900 h-11 w-full rounded-lg border border-gray-200 bg-transparent py-2.5 pr-14 pl-12 text-sm text-gray-800 placeholder:text-gray-400 xl:w-[430px] dark:border-gray-800 dark:bg-gray-900 dark:text-white/90" />
                <button id="search-button" className="absolute top-1/2 right-2.5 inline-flex -translate-y-1/2 items-center gap-0.5 rounded-lg border border-gray-200 bg-gray-50 px-[7px] py-[4.5px] text-xs text-gray-500 dark:border-gray-800 dark:bg-white/[0.03]">
                  <span> ⌘ </span>
                  <span> K </span>
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="flex w-full items-center justify-between gap-2 sm:gap-3 lg:justify-end lg:px-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const newDarkMode = !darkMode;
                setDarkMode(newDarkMode);
                if (newDarkMode) {
                  document.documentElement.classList.add('dark');
                  localStorage.setItem('theme', 'dark');
                } else {
                  document.documentElement.classList.remove('dark');
                  localStorage.setItem('theme', 'light');
                }
              }}
              className="relative flex h-11 w-11 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-[0_10px_24px_rgba(15,23,42,0.06)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-gray-50 hover:text-gray-900 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 dark:shadow-[0_10px_24px_rgba(2,6,23,0.35)] dark:hover:bg-gray-800 dark:hover:text-white"
              aria-label="Toggle dark mode"
            >
              {darkMode ? (
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M15.25 4.6A8.25 8.25 0 1 0 19.4 15.25a8.25 8.25 0 0 1-4.15-10.65Z" />
                  <path d="M15.5 2.75v1.5" />
                  <path d="M15.5 19.75v1.5" />
                  <path d="M21.25 15.5h-1.5" />
                  <path d="M4.25 15.5h-1.5" />
                </svg>
              ) : (
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="3.6" />
                  <path d="M12 2.5v2.2" />
                  <path d="M12 19.3v2.2" />
                  <path d="M4.7 4.7l1.55 1.55" />
                  <path d="M17.75 17.75l1.55 1.55" />
                  <path d="M2.5 12h2.2" />
                  <path d="M19.3 12h2.2" />
                  <path d="M4.7 19.3l1.55-1.55" />
                  <path d="M17.75 6.25l1.55-1.55" />
                </svg>
              )}
            </button>

            <div className="relative" ref={notifRef}>
              <button
                onClick={(e) => { e.stopPropagation(); setNotificationsOpen(!notificationsOpen); }}
                className="relative flex h-11 w-11 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 hover:bg-gray-100 dark:border-gray-800 dark:bg-gray-900"
                aria-label="Notifications"
              >
                <span className={`absolute top-0.5 right-0 h-2 w-2 rounded-full bg-orange-400 ${notificationsOpen ? 'hidden' : 'inline-block'}`} />
                <svg width="20" height="20" viewBox="0 0 20 20"><path d="M10 2C6.13 2 3.25 4.9 3.25 8.77V14.46H2.58C2.26 14.46 2 14.72 2 15.04C2 15.36 2.26 15.62 2.58 15.62H17.42C17.74 15.62 18 15.36 18 15.04C18 14.72 17.74 14.46 17.42 14.46H16.75V8.77C16.75 4.9 13.87 2 10 2Z"/></svg>
              </button>

              <NotificationDropdown isOpen={notificationsOpen} onClose={() => setNotificationsOpen(false)} />
            </div>
          </div>

          <div className="relative ml-4" ref={userRef}>
            <button onClick={(e) => { e.stopPropagation(); setUserOpen(!userOpen); }} className="flex items-center rounded-full px-1 py-1 text-gray-700 transition hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 sm:px-2">
              <span className="mr-2 flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-slate-200 text-sm font-semibold text-slate-800 sm:mr-3 sm:h-11 sm:w-11 dark:bg-slate-700 dark:text-white">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={displayName} className="h-full w-full object-cover" />
                ) : (
                  userInitials
                )}
              </span>
              <span className="mr-1 hidden font-medium sm:block">{displayName}</span>
              <svg className={`${userOpen ? 'rotate-180' : ''} transition-transform`} width="18" height="20" viewBox="0 0 18 20"><path d="M4.3125 8.65625L9 13.3437L13.6875 8.65625" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>

            {userOpen && (
              <div className="absolute right-0 mt-3 w-[260px] rounded-2xl border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-800 dark:bg-gray-900">
                <div>
                  <span className="block font-medium text-gray-700 dark:text-gray-400">{displayName}</span>
                  <span className="block text-sm text-gray-500">{displayRole}</span>
                  <span className="mt-1 inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-700 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-300">
                    {activeBranchName}
                  </span>
                </div>
                <div className="mt-3 rounded-xl border border-gray-100 bg-gray-50/80 px-3 py-3 text-sm text-gray-600 dark:border-gray-800 dark:bg-gray-800/50 dark:text-gray-300">
                  <div className="mb-2 flex items-center gap-2">
                    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M10 3.5a4.5 4.5 0 0 0-4.5 4.5v1.3c0 .4-.1.8-.4 1.1L4 11.2a1 1 0 0 0-.2.6v1.2a1 1 0 0 0 1 1h10.4a1 1 0 0 0 1-1v-1.2a1 1 0 0 0-.2-.6l-1.1-1.3c-.3-.3-.4-.7-.4-1.1V8a4.5 4.5 0 0 0-4.5-4.5Z" />
                      <path d="M8 15.5a2 2 0 0 0 4 0" />
                    </svg>
                    <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">Session</span>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-gray-500 dark:text-gray-400">Login time</span>
                      <span className="font-medium text-gray-700 dark:text-gray-200">{formatSessionTimestamp(sessionStartedAt)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-gray-500 dark:text-gray-400">Active for</span>
                      <span className="font-medium text-gray-700 dark:text-gray-200">{formatSessionDuration(sessionStartedAt)}</span>
                    </div>
                  </div>
                </div>
                <ul className="flex flex-col gap-1 border-b border-gray-200 pt-4 pb-3 dark:border-gray-800">
                  <li>
                    <a
                      href="/settings?section=notifications"
                      onClick={() => setUserOpen(false)}
                      className="flex items-center gap-3 rounded-lg px-3 py-2 text-gray-700 transition hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                    >
                      <svg className="h-4 w-4 flex-shrink-0" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M10 3.5a3 3 0 0 0-3 3v.8c0 .4-.1.8-.3 1.2L5.7 9.7a1 1 0 0 0-.2.6v1.2a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1v-1.2a1 1 0 0 0-.2-.6l-.9-1.2c-.2-.4-.3-.8-.3-1.2v-.8a3 3 0 0 0-3-3Z" />
                        <path d="M8 14.5a2 2 0 0 0 4 0" />
                      </svg>
                      <span>Notification settings</span>
                    </a>
                  </li>
                  <li>
                    <a href="/messages" className="flex items-center gap-3 rounded-lg px-3 py-2 text-gray-700 transition hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800">
                      <svg className="h-4 w-4 flex-shrink-0" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M4 5.5h12a1.5 1.5 0 0 1 1.5 1.5v6A1.5 1.5 0 0 1 16 14.5H7l-3 2V7A1.5 1.5 0 0 1 4 5.5Z" />
                      </svg>
                      <span>Messages</span>
                    </a>
                  </li>
                  <li>
                    <a href="/settings" className="flex items-center gap-3 rounded-lg px-3 py-2 text-gray-700 transition hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800">
                      <svg className="h-4 w-4 flex-shrink-0" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <circle cx="10" cy="10" r="3" />
                        <path d="M10 2.5v2.2M10 15.3v2.2M2.5 10h2.2M15.3 10h2.2M4.2 4.2l1.5 1.5M14.3 14.3l1.5 1.5M4.2 15.8l1.5-1.5M14.3 5.7l1.5-1.5" />
                      </svg>
                      <span>Account settings</span>
                    </a>
                  </li>
                </ul>
                <button
                  onClick={handleSignOut}
                  className="mt-3 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-gray-700 transition hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  <svg className="h-4 w-4 flex-shrink-0" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M7.5 5.5H5.25A1.75 1.75 0 0 0 3.5 7.25v7.5A1.75 1.75 0 0 0 5.25 16.5h2.25" />
                    <path d="M8 10h8" />
                    <path d="m13.5 7 3 3-3 3" />
                  </svg>
                  <span>Sign out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

export default TopBar;
