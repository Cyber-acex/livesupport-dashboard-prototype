import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import NotificationDropdown from './NotificationDropdown';
import ProfileDropdown from './ProfileDropdown';
import { getSettings, saveSettings, applyTheme } from '../services/settingsService';

function TopBar({ onToggleSidebar }) {
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [theme, setTheme] = useState(() => getSettings().theme || 'Light');
  const navigate = useNavigate();

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const toggleTheme = () => {
    const newTheme = theme === 'Dark' ? 'Light' : 'Dark';
    setTheme(newTheme);
    applyTheme(newTheme);
    saveSettings({ theme: newTheme });
  };

  const mobileNavItems = [
    { label: 'Dashboard', path: '/dashboard' },
    { label: 'Tickets', path: '/tickets' },
    { label: 'Analytics', path: '/analytics' },
    { label: 'Orders', path: '/orders' },
    { label: 'Inbox', path: '/inbox' },
    { label: 'Knowledge', path: '/knowledge' },
    { label: 'Tracking', path: '/tracking' },
    { label: 'Settings', path: '/settings' }
  ];

  return (
    <>
    <header className="fixed inset-x-0 top-0 z-50 border-b border-gray-200 bg-white/95 backdrop-blur dark:border-gray-800 dark:bg-gray-900/95 lg:left-[220px] lg:right-0">
      <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:px-6">
        <div className="flex w-full items-center justify-between gap-2 border-b border-gray-200 px-3 py-3 dark:border-gray-800 lg:border-b-0 lg:px-0 lg:py-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleSidebar}
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white lg:h-11 lg:w-11"
              aria-label="Toggle sidebar"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" xmlns="http://www.w3.org/2000/svg">
                <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>

            <div className="lg:hidden">
              <span className="text-lg font-semibold text-gray-900 dark:text-white">LiveSupport</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white lg:hidden"
            aria-label="Toggle menu"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" xmlns="http://www.w3.org/2000/svg">
              <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>

          <div className="hidden lg:block lg:w-full">
            <form>
              <div className="relative">
                <span className="absolute top-1/2 left-4 -translate-y-1/2 text-gray-500 dark:text-gray-400">
                  <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="9" cy="9" r="6" />
                    <path d="m14.5 14.5 3 3" />
                  </svg>
                </span>
                <input
                  placeholder="Search or type command..."
                  className="h-11 w-full rounded-xl border border-gray-200 bg-transparent py-2.5 pr-14 pl-12 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10 dark:border-gray-800 dark:bg-gray-900 dark:text-white dark:placeholder:text-gray-500"
                />
                <button
                  type="button"
                  className="absolute top-1/2 right-2.5 -translate-y-1/2 inline-flex items-center gap-0.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-[6px] text-xs text-gray-500 dark:border-gray-800 dark:bg-white/5 dark:text-gray-400"
                >
                  <span>⌘</span>
                  <span>K</span>
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className={`shadow-theme-md w-full items-center justify-between gap-4 px-5 py-4 lg:flex lg:justify-end lg:px-0 lg:shadow-none ${menuOpen ? 'flex' : 'hidden'}`}>
          <div className="flex w-full flex-col gap-2 lg:hidden">
            {mobileNavItems.map((item) => (
              <button
                key={item.path}
                type="button"
                onClick={() => {
                  navigate(item.path);
                  setMenuOpen(false);
                }}
                className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-left text-sm font-medium text-gray-700 transition hover:border-brand-300 hover:bg-gray-50 hover:text-gray-900 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-white/5 dark:hover:text-white"
              >
                {item.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={toggleTheme}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
            aria-label={theme === 'Dark' ? 'Switch to Light mode' : 'Switch to Dark mode'}
            title={theme === 'Dark' ? 'Switch to Light mode' : 'Switch to Dark mode'}
          >
            <svg className="hidden dark:block" width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path fillRule="evenodd" clipRule="evenodd" d="M9.99998 1.5415C10.4142 1.5415 10.75 1.87729 10.75 2.2915V3.5415C10.75 3.95572 10.4142 4.2915 9.99998 4.2915C9.58577 4.2915 9.24998 3.95572 9.24998 3.5415V2.2915C9.24998 1.87729 9.58577 1.5415 9.99998 1.5415ZM10.0009 6.79327C8.22978 6.79327 6.79402 8.22904 6.79402 10.0001C6.79402 11.7712 8.22978 13.207 10.0009 13.207C11.772 13.207 13.2078 11.7712 13.2078 10.0001C13.2078 8.22904 11.772 6.79327 10.0009 6.79327ZM5.29402 10.0001C5.29402 7.40061 7.40135 5.29327 10.0009 5.29327C12.6004 5.29327 14.7078 7.40061 14.7078 10.0001C14.7078 12.5997 12.6004 14.707 10.0009 14.707C7.40135 14.707 5.29402 12.5997 5.29402 10.0001ZM15.9813 5.08035C16.2742 4.78746 16.2742 4.31258 15.9813 4.01969C15.6884 3.7268 15.2135 3.7268 14.9207 4.01969L14.0368 4.90357C13.7439 5.19647 13.7439 5.67134 14.0368 5.96423C14.3297 6.25713 14.8045 6.25713 15.0974 5.96423L15.9813 5.08035ZM18.4577 10.0001C18.4577 10.4143 18.1219 10.7501 17.7077 10.7501H16.4577C16.0435 10.7501 15.7077 10.4143 15.7077 10.0001C15.7077 9.58592 16.0435 9.25013 16.4577 9.25013H17.7077C18.1219 9.25013 18.4577 9.58592 18.4577 10.0001ZM14.9207 15.9806C15.2135 16.2735 15.6884 16.2735 15.9813 15.9806C16.2742 15.6877 16.2742 15.2128 15.9813 14.9199L15.0974 14.036C14.8045 13.7431 14.3297 13.7431 14.0368 14.036C13.7439 14.3289 13.7439 14.8038 14.0368 15.0967L14.9207 15.9806ZM9.99998 15.7088C10.4142 15.7088 10.75 16.0445 10.75 16.4588V17.7088C10.75 18.123 10.4142 18.4588 9.99998 18.4588C9.58577 18.4588 9.24998 18.123 9.24998 17.7088V16.4588C9.24998 16.0445 9.58577 15.7088 9.99998 15.7088Zm5.96356-0.6116C15.2566 15.0972 15.2566 14.6225 14.9636 14.3296C14.6707 14.0367 14.1958 14.0367 13.9029 14.3296L13.019 15.2134C12.7261 15.5063 12.7261 15.9811 13.019 16.274C13.3119 16.5669 13.7868 16.5669 14.0797 16.274L14.9636 15.3922Z" fill="currentColor"/>
            </svg>
            <svg className="dark:hidden" width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M17.4547 11.97L18.1799 12.1611C18.265 11.8383 18.1265 11.4982 17.8401 11.3266C17.5538 11.1551 17.1885 11.1934 16.944 11.4207L17.4547 11.97ZM8.0306 2.5459L8.57989 3.05657C8.80718 2.81209 8.84554 2.44682 8.67398 2.16046C8.50243 1.8741 8.16227 1.73559 7.83948 1.82066L8.0306 2.5459Z" fill="currentColor"/>
            </svg>
          </button>

          <div className="relative">
            <button
              onClick={() => setNotificationOpen(!notificationOpen)}
              className={`relative flex h-11 w-11 items-center justify-center rounded-full border shadow-theme-xs transition ${
                notificationOpen
                  ? 'border-brand-300 bg-brand-50 text-brand-600 dark:border-brand-500 dark:bg-gray-700 dark:text-brand-400'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 dark:hover:border-brand-500 dark:hover:bg-gray-800 dark:hover:text-brand-400'
              }`}
              aria-label="Notifications"
            >
                <span className="absolute right-1.5 top-1.5 h-3 w-3 rounded-full bg-gradient-to-br from-orange-400 to-orange-500 shadow-md ring-2 ring-white dark:ring-gray-900" />
                <svg width="20" height="20" viewBox="0 0 20 20" className="h-5 w-5" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path fillRule="evenodd" clipRule="evenodd" d="M10.75 2.29248C10.75 1.87827 10.4143 1.54248 10 1.54248C9.58583 1.54248 9.25004 1.87827 9.25004 2.29248V2.83613C6.08266 3.20733 3.62504 5.9004 3.62504 9.16748V14.4591H3.33337C2.91916 14.4591 2.58337 14.7949 2.58337 15.2091C2.58337 15.6234 2.91916 15.9591 3.33337 15.9591H4.37504H15.625H16.6667C17.0809 15.9591 17.4167 15.6234 17.4167 15.2091C17.4167 14.7949 17.0809 14.4591 16.6667 14.4591H16.375V9.16748C16.375 5.9004 13.9174 3.20733 10.75 2.83613V2.29248ZM14.875 14.4591V9.16748C14.875 6.47509 12.6924 4.29248 10 4.29248C7.30765 4.29248 5.12504 6.47509 5.12504 9.16748V14.4591H14.875Z" fill="currentColor"/>
                </svg>
            </button>
            <NotificationDropdown
              isOpen={notificationOpen}
              onClose={() => setNotificationOpen(false)}
            />
          </div>

          <div className="relative flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-3 py-2 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
            <button
              type="button"
              onClick={() => {
                setProfileOpen(!profileOpen);
                setNotificationOpen(false);
              }}
              className="flex items-center gap-3 rounded-2xl bg-transparent text-left focus:outline-none"
            >
              <span className="h-11 w-11 overflow-hidden rounded-full bg-gradient-to-br from-indigo-500 to-sky-500 text-center text-sm font-semibold text-white leading-11">
                A
              </span>
              <div className="hidden min-w-0 flex-col truncate sm:flex">
                <span className="truncate text-sm font-semibold text-gray-900 dark:text-white">Musharof</span>
                <span className="truncate text-xs text-gray-500 dark:text-gray-400">Admin</span>
              </div>
              <svg
                className="h-4 w-4 text-gray-500 dark:text-gray-400"
                viewBox="0 0 18 20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M4.3125 8.65625L9 13.3437L13.6875 8.65625"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <ProfileDropdown
              isOpen={profileOpen}
              onClose={() => setProfileOpen(false)}
              onSelect={(action) => {
                setProfileOpen(false);
                if (action === 'profile') navigate('/settings');
                if (action === 'settings') navigate('/settings');
                if (action === 'support') navigate('/knowledge');
                if (action === 'logout') window.location.href = '/logout';
              }}
            />
          </div>
        </div>
      </div>
    </header>
    <div className="h-28 lg:h-24" />
    </>
  );
}

export default TopBar;
