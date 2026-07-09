import React, { useState, useRef, useEffect } from 'react';

function TopBar({ onSidebarToggle }) {
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [currentUser, setCurrentUser] = useState({ name: 'Staff', role: 'agent' });
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
    async function loadCurrentUser() {
      if (typeof window !== 'undefined' && window.currentUser) {
        setCurrentUser(window.currentUser);
        return;
      }

      try {
        const res = await fetch('/api/user', { credentials: 'same-origin' });
        if (!res.ok) return;
        const data = await res.json();
        if (data && data.name) {
          setCurrentUser(data);
          window.currentUser = data;
        }
      } catch (error) {
        console.warn('Failed to load current user', error);
      }
    }

    loadCurrentUser();
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

  return (
    <header className="sticky top-0 z-50 flex w-full border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      <div className="flex grow flex-col items-center justify-between lg:flex-row lg:px-6">
        <div className="flex w-full items-center justify-between gap-2 border-b border-gray-200 px-3 py-3 sm:gap-4 lg:justify-normal lg:border-b-0 lg:px-0 lg:py-4 dark:border-gray-800">
          <button
            onClick={() => onSidebarToggle ? onSidebarToggle() : null}
            className="z-50 flex h-10 w-10 items-center justify-center rounded-lg border-gray-200 text-gray-500 lg:h-11 lg:w-11 lg:border dark:border-gray-800 dark:text-gray-400"
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

        <div className={`w-full items-center justify-between gap-4 px-5 py-4 lg:flex lg:justify-end lg:px-0`}>
          <div className="2xsm:gap-3 flex items-center gap-2">
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
              className="relative flex h-11 w-11 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 hover:bg-gray-100 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400"
              aria-label="Toggle dark mode"
            >
              {darkMode ? (
                <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"/></svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4.293 2.293a1 1 0 011.414 0l.707.707a1 1 0 11-1.414 1.414l-.707-.707a1 1 0 010-1.414zm2.828 2.828a1 1 0 011.414 0l.707.707a1 1 0 11-1.414 1.414l-.707-.707a1 1 0 010-1.414zM10 7a3 3 0 100 6 3 3 0 000-6zm-4.293-.707a1 1 0 00-1.414 1.414l.707.707a1 1 0 001.414-1.414l-.707-.707zm2.828 9.172a1 1 0 011.414 0l.707.707a1 1 0 11-1.414 1.414l-.707-.707a1 1 0 010-1.414zm10-10a1 1 0 010 1.414l-.707.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM10 18a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zm-4.293-2.293a1 1 0 00-1.414 1.414l.707.707a1 1 0 001.414-1.414l-.707-.707zm-2.828-2.828a1 1 0 00-1.414 1.414l.707.707a1 1 0 001.414-1.414l-.707-.707z" clipRule="evenodd"/></svg>
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

              {notificationsOpen && (
                <div className="absolute right-0 mt-3 w-[320px] rounded-2xl border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-800 dark:bg-gray-900">
                  <div className="mb-3 flex items-center justify-between border-b border-gray-100 pb-3 dark:border-gray-800">
                    <h5 className="text-lg font-semibold text-gray-800 dark:text-white/90">Notification</h5>
                    <button onClick={() => setNotificationsOpen(false)} className="text-gray-500">Close</button>
                  </div>
                  <ul className="max-h-72 overflow-y-auto">
                    <li className="flex gap-3 p-3"><img src="/images/user/user-02.jpg" className="h-10 w-10 rounded-full" alt="user" /><div><div className="font-medium">Terry Franci</div><div className="text-sm text-gray-500">5 min ago</div></div></li>
                    <li className="flex gap-3 p-3"><img src="/images/user/user-03.jpg" className="h-10 w-10 rounded-full" alt="user" /><div><div className="font-medium">Alena Franci</div><div className="text-sm text-gray-500">8 min ago</div></div></li>
                  </ul>
                  <a href="#" className="mt-3 block text-center rounded-lg border border-gray-300 bg-white p-3 text-gray-700">View All Notification</a>
                </div>
              )}
            </div>
          </div>

          <div className="relative ml-4" ref={userRef}>
            <button onClick={(e) => { e.stopPropagation(); setUserOpen(!userOpen); }} className="flex items-center text-gray-700 dark:text-gray-400">
              <span className="mr-3 flex h-11 w-11 items-center justify-center rounded-full bg-slate-200 text-sm font-semibold text-slate-800 dark:bg-slate-700 dark:text-white">
                {userInitials}
              </span>
              <span className="mr-1 block font-medium">{displayName}</span>
              <svg className={`${userOpen ? 'rotate-180' : ''} transition-transform`} width="18" height="20" viewBox="0 0 18 20"><path d="M4.3125 8.65625L9 13.3437L13.6875 8.65625" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>

            {userOpen && (
              <div className="absolute right-0 mt-3 w-[260px] rounded-2xl border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-800 dark:bg-gray-900">
                <div>
                  <span className="block font-medium text-gray-700 dark:text-gray-400">{displayName}</span>
                  <span className="block text-sm text-gray-500">{displayRole}</span>
                </div>
                <ul className="flex flex-col gap-1 border-b border-gray-200 pt-4 pb-3 dark:border-gray-800">
                  <li><a href="/profile" className="block px-3 py-2">Edit profile</a></li>
                  <li><a href="/messages" className="block px-3 py-2">Messages</a></li>
                  <li><a href="/settings" className="block px-3 py-2">Account settings</a></li>
                </ul>
                <button className="mt-3 block w-full text-left px-3 py-2">Sign out</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

export default TopBar;
