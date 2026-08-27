import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Activity, BarChart3, BookOpen, BrainCircuit, ChevronDown, ChevronsLeft, ChevronsRight, CircleDollarSign, ClipboardList, Home, Inbox, LayoutGrid, MoreHorizontal, Settings, Ticket, WalletCards, X } from 'lucide-react';
import { useSidebar } from '../contexts/SidebarContext';
import { getSettings } from '../services/settingsService';
import { getStoredAvatarUrl } from '../utils/avatarUpload';

const menuItems = [
  { to: '/dashboard', label: 'Dashboard', icon: Home },
  { to: '/tickets', label: 'Tickets', icon: Ticket },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
    { to: '/ai-learning', label: 'AI Learning', icon: BrainCircuit },
  { to: '/knowledge', label: 'Knowledge Base', icon: BookOpen },
  {
    to: '/orders',
    label: 'Orders',
    icon: ClipboardList,
    children: [
      { to: '/orders', label: 'Overview' },
      { to: '/orders/menu', label: 'Menu' },
      { to: '/orders/tables', label: 'Tables' }
    ]
  },
  // Deliveries menu removed for presentation
  {
    to: '/inbox',
    label: 'Inbox',
    icon: Inbox
  },
  { to: '/vouchers', label: 'Vouchers', icon: <path d="M4 7h16v10H4zM7 10h10M7 14h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /> },
  { to: '/refunds', label: 'Refunds', icon: <path d="M4 7h16v10H4zM7 10h10M7 14h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /> },
  { to: '/settings', label: 'Settings', icon: <path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm8 3.5-.9-.4a7.9 7.9 0 0 0-.4-1l.5-.8-1.4-1.4-.8.4a7.4 7.4 0 0 0-1-.4L15 4h-2l-.4 1a7.4 7.4 0 0 0-1 .4l-.8-.5-1.4 1.4.5.8a7.9 7.9 0 0 0-.4 1L4 12v2l.9.4c.1.3.2.7.4 1l-.5.8 1.4 1.4.8-.5c.3.2.7.3 1 .4L13 20h2l.4-1c.3-.1.7-.2 1-.4l.8.5 1.4-1.4-.5-.8c.2-.3.3-.7.4-1l.9-.4v-2Z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /> }
];

function Sidebar() {
  const { sidebarToggle, toggleSidebar, closeSidebar } = useSidebar();
  const location = useLocation();
  const [isHovered, setIsHovered] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState({ name: 'Staff', email: 'support@averon.ai', avatar_url: null });
  
  const [layout, setLayout] = useState(() => {
    const currentSettings = getSettings();
    return {
      position: currentSettings.sidebarPosition || 'left',
      width: currentSettings.sidebarWidth || 'standard'
    };
  });

  useEffect(() => {
    const syncLayout = () => {
      const currentSettings = getSettings();
      setLayout({
        position: currentSettings.sidebarPosition || 'left',
        width: currentSettings.sidebarWidth || 'standard'
      });
    };

    syncLayout();
    window.addEventListener('storage', syncLayout);
    window.addEventListener('settings:updated', syncLayout);

    return () => {
      window.removeEventListener('storage', syncLayout);
      window.removeEventListener('settings:updated', syncLayout);
    };
  }, []);

  useEffect(() => {
    const loadCurrentUser = async () => {
      const storedName = window.localStorage.getItem('displayName');
      const storedEmail = window.localStorage.getItem('email');
      try {
        const response = await fetch('/api/user', { credentials: 'same-origin' });
        const data = response.ok ? await response.json() : {};
        setCurrentUser((previous) => ({ ...previous, ...data, name: data.name || storedName || previous.name, email: data.email || storedEmail || previous.email, avatar_url: data.avatar_url || data.avatarUrl || getStoredAvatarUrl() }));
      } catch {
        setCurrentUser((previous) => ({ ...previous, name: storedName || previous.name, email: storedEmail || previous.email, avatar_url: getStoredAvatarUrl() }));
      }
    };

    loadCurrentUser();
    window.addEventListener('profile:updated', loadCurrentUser);
    window.addEventListener('avatar:updated', loadCurrentUser);
    return () => {
      window.removeEventListener('profile:updated', loadCurrentUser);
      window.removeEventListener('avatar:updated', loadCurrentUser);
    };
  }, []);

  // Delivery metrics removed for presentation

  const isActivePath = (to) => {
    if (to === '/orders') {
      return location.pathname === '/orders' || location.pathname.startsWith('/orders/');
    }
    if (to === '/inbox') {
      return location.pathname === '/inbox' || location.pathname.startsWith('/inbox/');
    }
    return location.pathname === to || location.pathname.startsWith(`${to}/`);
  };

  const isCollapsedLayout = layout.position === 'collapsed';
  const isCollapsed = isCollapsedLayout || (sidebarToggle && !isHovered);
  const showExpandedContent = !isCollapsedLayout && (!sidebarToggle || isHovered);

  const widthClassMap = {
    narrow: { desktop: 'lg:w-[180px]', mobile: 'max-w-[180px]' },
    standard: { desktop: 'lg:w-[250px]', mobile: 'max-w-[250px]' },
    wide: { desktop: 'lg:w-[310px]', mobile: 'max-w-[310px]' }
  };

  const widthClass = widthClassMap[layout.width] || widthClassMap.standard;
  const positionClass = layout.position === 'right' ? 'right-0 lg:right-0 lg:left-auto' : 'left-0 lg:left-0';
  const displayName = currentUser.name || 'Staff';
  const initials = displayName.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase();

  return (
    <>
      <aside
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`${sidebarToggle ? 'translate-x-0' : '-translate-x-full'} ${isCollapsed ? 'lg:w-[96px]' : widthClass.desktop} fixed ${positionClass} top-0 z-[60] flex h-dvh w-[85vw] ${widthClass.mobile} flex-col overflow-y-hidden border-r border-slate-200/80 bg-white/80 px-3 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur-2xl transition-[width,transform,box-shadow] duration-300 ease-out sm:px-4 dark:border-slate-800 dark:bg-slate-950/80 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 lg:flex-none lg:shadow-[0_0_0_1px_rgba(148,163,184,0.08),0_24px_70px_rgba(15,23,42,0.12)]`}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(99,102,241,0.08),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(14,165,233,0.06),_transparent_28%)]" />

        <div className="relative z-10 flex flex-1 flex-col overflow-hidden">
          <div className={`flex items-center gap-3 pb-5 pt-6 sm:pb-7 sm:pt-7 ${showExpandedContent ? '' : 'justify-center'}`}>
            <NavLink to="/dashboard" onClick={closeSidebar} className="flex w-full items-center gap-3 rounded-2xl border border-slate-200/70 bg-white/70 p-2.5 shadow-[0_10px_30px_rgba(15,23,42,0.05)] transition hover:border-brand-200 hover:shadow-[0_16px_35px_rgba(89,99,255,0.12)] dark:border-slate-800 dark:bg-slate-900/70">
              {showExpandedContent ? (
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 via-indigo-500 to-cyan-500 text-sm font-bold text-white shadow-[0_14px_30px_rgba(79,70,229,0.38)]">
                    AV
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-base font-semibold text-slate-900 dark:text-white">Averon</div>
                    <div className="truncate text-[10px] uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">Support Console</div>
                  </div>
                </div>
              ) : (
                <div className="flex w-full items-center justify-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 via-indigo-500 to-cyan-500 text-xs font-bold text-white shadow-[0_14px_30px_rgba(79,70,229,0.38)]">
                    AV
                  </div>
                </div>
              )}
            </NavLink>
            <button type="button" onClick={() => { setIsHovered(false); toggleSidebar(); }} aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'} title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'} className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white hover:text-slate-700 lg:flex">
              {isCollapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
            </button>
            <button type="button" onClick={closeSidebar} aria-label="Close navigation" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white hover:text-slate-700 lg:hidden"><X size={17} /></button>
          </div>

          <button type="button" title="Workspace: Ops Online" className={`mb-6 flex w-full items-center gap-3 rounded-xl border border-slate-200/80 bg-white/75 px-3 py-2.5 text-left transition hover:border-blue-200 hover:bg-white ${showExpandedContent ? '' : 'justify-center px-2'}`}>
            <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500"><LayoutGrid size={15} /><span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-400" /></span>
            {showExpandedContent ? <span className="min-w-0 flex-1"><span className="block text-[9px] font-bold uppercase tracking-[0.18em] text-slate-400">Workspace</span><span className="mt-0.5 block truncate text-xs font-semibold text-slate-700">Ops Online</span></span> : null}
            {showExpandedContent ? <ChevronDown size={14} className="text-slate-400" /> : null}
          </button>

          <div className="relative z-10 flex flex-1 flex-col overflow-y-auto pb-4 pr-1 no-scrollbar custom-scrollbar">
            <nav className="flex-1">
              <div className="space-y-1">
                <h3 className="mb-3 px-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
                  <span className={`${showExpandedContent ? '' : 'lg:hidden'}`}>Navigation</span>
                  <svg
                    className={`${showExpandedContent ? 'hidden' : 'lg:block hidden'} mx-auto h-6 w-6 fill-current text-slate-500`}
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      fillRule="evenodd"
                      clipRule="evenodd"
                      d="M5.99915 10.2451C6.96564 10.2451 7.74915 11.0286 7.74915 11.9951V12.0051C7.74915 12.9716 6.96564 13.7551 5.99915 13.7551C5.03265 13.7551 4.24915 12.9716 4.24915 12.0051V11.9951C4.24915 11.0286 5.03265 10.2451 5.99915 10.2451ZM17.9991 10.2451C18.9656 10.2451 19.7491 11.0286 19.7491 11.9951V12.0051C19.7491 12.9716 18.9656 13.7551 17.9991 13.7551C17.0326 13.7551 16.2491 12.9716 16.2491 12.0051V11.9951C16.2491 11.0286 17.0326 10.2451 17.9991 10.2451ZM13.7491 11.9951C13.7491 11.0286 12.9656 10.2451 11.9991 10.2451C11.0326 10.2451 10.2491 11.0286 10.2491 11.9951V12.0051C10.2491 12.9716 11.0326 13.7551 11.9991 13.7551C12.9656 13.7551 13.7491 12.9716 13.7491 12.0051V11.9951Z"
                      fill="currentColor"
                    />
                  </svg>
                </h3>

                <ul className="space-y-2">
                  {menuItems.map((item) => {
                    const active = isActivePath(item.to);

                    return (
                      <li key={item.to}>
                        <NavLink
                          to={item.to}
                          onClick={closeSidebar}
                          title={isCollapsed ? item.label : undefined}
                          className={() =>
                            `group relative flex items-center gap-3 rounded-2xl px-3 py-2.5 font-medium transition-all duration-200 ${
                              active
                                ? 'bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 text-indigo-700 shadow-[0_8px_20px_rgba(79,70,229,0.08)] ring-1 ring-indigo-100 dark:from-brand-500/15 dark:via-brand-500/10 dark:to-cyan-500/10 dark:text-brand-300 dark:ring-brand-400/20'
                                : 'text-slate-600 hover:bg-white hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/80 dark:hover:text-white'
                            }`
                          }
                        >
                          <span className={`relative flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-200 ${active ? 'bg-white text-brand-600 shadow-sm ring-1 ring-brand-100 dark:bg-slate-900 dark:text-brand-300 dark:ring-brand-500/20' : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200 group-hover:text-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:group-hover:bg-slate-700 dark:group-hover:text-slate-200'}`}>
                            {item.icon?.render ? <item.icon size={17} strokeWidth={1.8} /> : <svg viewBox="0 0 24 24" className="h-[17px] w-[17px]" fill="none">{item.icon}</svg>}
                          </span>
                          <span className={`${showExpandedContent ? '' : 'lg:hidden'} truncate`}>{item.label}</span>
                          {active && showExpandedContent ? <span className="ml-auto h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_0_4px_rgba(16,185,129,0.15)]" /> : null}
                        </NavLink>
                        {item.children && active && showExpandedContent ? (
                          <ul className="mt-2 ml-11 space-y-1.5">
                            {item.children.map((child) => {
                              const childActive = isActivePath(child.to);
                              return (
                                <li key={child.to}>
                                  <NavLink
                                    to={child.to}
                                    onClick={closeSidebar}
                                    className={() =>
                                      `block rounded-xl px-2.5 py-1.5 text-sm transition ${
                                        childActive
                                          ? 'font-semibold text-brand-600 dark:text-brand-300'
                                          : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
                                      }`
                                    }
                                  >
                                    <span className="truncate">{child.label}</span>
                                  </NavLink>
                                </li>
                              );
                            })}
                          </ul>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </div>
            </nav>

            <div className="mt-5">
              {showExpandedContent ? <div className="mb-4 rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/90 via-white to-blue-50/80 p-3.5 shadow-[0_12px_30px_rgba(79,70,229,0.06)]">
                <div className="flex items-center justify-between"><span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-indigo-500"><Activity size={13} className="animate-pulse" /> Live Queue</span><button type="button" aria-label="Live queue options" className="text-slate-400 transition hover:text-indigo-600"><MoreHorizontal size={16} /></button></div>
                <div className="mt-3 flex items-end justify-between"><span className="text-3xl font-bold tracking-tight text-slate-900">24</span><span className="mb-1 rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-bold text-emerald-700">LIVE</span></div>
                <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500"><span>Response SLA</span><span className="font-semibold text-slate-700">2.4 min</span></div>
              </div> : <div className="mb-4 flex justify-center text-indigo-500"><Activity size={18} className="animate-pulse" /></div>}

              <div className="relative">
                {profileOpen && showExpandedContent ? <div className="absolute bottom-14 left-0 right-0 rounded-xl border border-slate-200 bg-white p-2 shadow-[0_16px_35px_rgba(15,23,42,0.12)]"><NavLink to="/settings" onClick={() => { setProfileOpen(false); closeSidebar(); }} className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"><Settings size={14} /> Account settings</NavLink></div> : null}
                <button type="button" onClick={() => setProfileOpen((open) => !open)} aria-expanded={profileOpen} title={displayName} className={`flex w-full items-center gap-3 rounded-xl border border-transparent p-2 text-left transition hover:border-slate-200 hover:bg-white ${showExpandedContent ? '' : 'justify-center'}`}>
                  <span className="relative shrink-0">{currentUser.avatar_url ? <img src={currentUser.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover ring-2 ring-white" /> : <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">{initials}</span>}<span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-[#fbfcff] bg-emerald-400" /></span>
                  {showExpandedContent ? <span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold text-slate-800">{displayName}</span><span className="block truncate text-[10px] text-slate-400">{currentUser.email}</span></span> : null}
                  {showExpandedContent ? <ChevronDown size={14} className={`text-slate-400 transition-transform ${profileOpen ? 'rotate-180' : ''}`} /> : null}
                </button>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <div
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-300 lg:hidden ${sidebarToggle ? 'opacity-100 visible' : 'opacity-0 invisible'}`}
        onClick={closeSidebar}
      />
    </>
  );
}

export default Sidebar;
