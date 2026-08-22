import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useSidebar } from '../contexts/SidebarContext';
import { getSettings } from '../services/settingsService';

const menuItems = [
  { to: '/dashboard', label: 'Dashboard', icon: <path d="M4 13.5 12 5l8 8.5V20a1 1 0 0 1-1 1h-4v-5H9v5H5a1 1 0 0 1-1-1v-6.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /> },
  { to: '/tickets', label: 'Tickets', icon: <path d="M5 7h14M5 12h14M5 17h9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /> },
  { to: '/analytics', label: 'Analytics', icon: <path d="M5 19V10m7 9V5m7 14v-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /> },
  { to: '/knowledge', label: 'Knowledge Base', icon: <path d="M7 4.5h8a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-11a2 2 0 0 1 2-2Zm0 3h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /> },
  {
    to: '/orders',
    label: 'Orders',
    icon: <path d="M6 5h12l-1 7H7L6 5Zm1 7 1 7h8l1-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />,
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
    icon: <path d="M4 6h16v12H4zM4 6l8 6 8-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  },
  { to: '/vouchers', label: 'Vouchers', icon: <path d="M4 7h16v10H4zM7 10h10M7 14h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /> },
  { to: '/refunds', label: 'Refunds', icon: <path d="M4 7h16v10H4zM7 10h10M7 14h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /> },
  { to: '/settings', label: 'Settings', icon: <path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm8 3.5-.9-.4a7.9 7.9 0 0 0-.4-1l.5-.8-1.4-1.4-.8.4a7.4 7.4 0 0 0-1-.4L15 4h-2l-.4 1a7.4 7.4 0 0 0-1 .4l-.8-.5-1.4 1.4.5.8a7.9 7.9 0 0 0-.4 1L4 12v2l.9.4c.1.3.2.7.4 1l-.5.8 1.4 1.4.8-.5c.3.2.7.3 1 .4L13 20h2l.4-1c.3-.1.7-.2 1-.4l.8.5 1.4-1.4-.5-.8c.2-.3.3-.7.4-1l.9-.4v-2Z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /> }
];

function Sidebar() {
  const { sidebarToggle, closeSidebar } = useSidebar();
  const location = useLocation();
  const [isHovered, setIsHovered] = useState(false);
  
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
  const liveBadgeText = location.pathname.startsWith('/inbox') ? 'Inbox live' : 'Ops online';

  return (
    <>
      <aside
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`${sidebarToggle ? 'translate-x-0' : '-translate-x-full'} ${isCollapsed ? 'lg:w-[96px]' : widthClass.desktop} fixed ${positionClass} top-0 z-[60] flex h-dvh w-[85vw] ${widthClass.mobile} flex-col overflow-y-hidden border-r border-slate-200/80 bg-white/80 px-3 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur-2xl transition-[width,transform,box-shadow] duration-300 ease-out sm:px-4 dark:border-slate-800 dark:bg-slate-950/80 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 lg:flex-none lg:shadow-[0_0_0_1px_rgba(148,163,184,0.08),0_24px_70px_rgba(15,23,42,0.12)]`}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(99,102,241,0.18),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(14,165,233,0.14),_transparent_30%)]" />

        <div className="relative z-10 flex flex-1 flex-col overflow-hidden">
          <div className={`flex items-center pb-5 pt-6 sm:pb-6 sm:pt-8 ${showExpandedContent ? 'justify-start' : 'justify-center'}`}>
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
          </div>

          {showExpandedContent ? (
            <div className="relative z-10 mb-5 flex items-center justify-between rounded-2xl border border-slate-200/80 bg-slate-50/80 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/70">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_0_4px_rgba(16,185,129,0.12)]" />
                <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Workspace</span>
              </div>
              <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
                {liveBadgeText}
              </span>
            </div>
          ) : null}

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
                          className={() =>
                            `group relative flex items-center gap-3 rounded-2xl px-3 py-2.5 font-medium transition-all duration-200 ${
                              active
                                ? 'bg-gradient-to-r from-brand-50 via-indigo-50 to-cyan-50 text-brand-600 shadow-[0_12px_25px_rgba(79,70,229,0.12)] ring-1 ring-brand-100 dark:from-brand-500/15 dark:via-brand-500/10 dark:to-cyan-500/10 dark:text-brand-300 dark:ring-brand-400/20'
                                : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/80 dark:hover:text-white'
                            }`
                          }
                        >
                          <span className={`relative flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-200 ${active ? 'bg-white text-brand-600 shadow-sm ring-1 ring-brand-100 dark:bg-slate-900 dark:text-brand-300 dark:ring-brand-500/20' : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200 group-hover:text-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:group-hover:bg-slate-700 dark:group-hover:text-slate-200'}`}>
                            <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" xmlns="http://www.w3.org/2000/svg">
                              {item.icon}
                            </svg>
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

            <div className="mt-auto pt-5">
              <div className="rounded-2xl border border-brand-100 bg-gradient-to-br from-white via-brand-50 to-indigo-50 p-3.5 shadow-[0_16px_35px_rgba(79,70,229,0.08)] dark:border-brand-500/20 dark:from-slate-900 dark:via-brand-500/10 dark:to-sky-500/10">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-500 dark:text-brand-300">Live queue</div>
                    <div className="mt-2 text-[28px] font-semibold leading-none text-slate-900 dark:text-white">24</div>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/80 text-brand-600 shadow-sm dark:bg-slate-900/80 dark:text-brand-300">
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M5 12h2l2.5-5 3 10 2-5h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                  <span>Response SLA</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-300">2.4 min</span>
                </div>
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
