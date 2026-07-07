import { useEffect, useRef } from 'react';

function ProfileDropdown({ isOpen, onClose, onSelect }) {
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div ref={dropdownRef} className="absolute right-0 top-full mt-3 w-80 rounded-2xl border border-gray-200 bg-white shadow-theme-md ring-1 ring-black/5 dark:border-gray-700 dark:bg-gray-900 z-50">
      <div className="px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-500 to-sky-500 text-center text-base font-semibold text-white">
            A
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-900 dark:text-white">Admin</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">admin@livesupport.com</div>
          </div>
        </div>
      </div>

      <div className="border-t border-gray-100 dark:border-gray-800 px-3 py-3">
        <button
          type="button"
          onClick={() => onSelect('profile')}
          className="group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-gray-800"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4 text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-300" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 4.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9z" />
            <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
          </svg>
          <span>Edit profile</span>
        </button>

        <button
          type="button"
          onClick={() => onSelect('settings')}
          className="group mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-gray-800"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4 text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-300" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 4.5a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15z" />
            <path d="M12 8v4l2 2" />
          </svg>
          <span>Account settings</span>
        </button>

        <button
          type="button"
          onClick={() => onSelect('support')}
          className="group mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-gray-800"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4 text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-300" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7A8.38 8.38 0 014 12c0-4.7 3.8-8.5 8.5-8.5S21 7.3 21 12z" />
          </svg>
          <span>Support</span>
        </button>

        <button
          type="button"
          onClick={() => onSelect('logout')}
          className="group mt-3 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-rose-600 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-900/20"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4 text-rose-400 group-hover:text-rose-500" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
            <path d="M16 17l5-5-5-5" />
            <path d="M21 12H9" />
          </svg>
          <span>Sign out</span>
        </button>
      </div>
    </div>
  );
}

export default ProfileDropdown;
