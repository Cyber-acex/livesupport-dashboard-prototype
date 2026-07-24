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
  {
    to: '/inbox',
    label: 'Inbox',
    icon: <path d="M4 6h16v12H4zM4 6l8 6 8-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />,
    children: [
      { to: '/inbox', label: 'Whatsapp' },
      { to: '/inbox/messenger', label: 'Messenger' },
      { to: '/inbox/chat', label: 'Web chat' }
    ]
  },
  { to: '/vouchers', label: 'Vouchers', icon: <path d="M4 7h16v10H4zM7 10h10M7 14h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /> },
  { to: '/tracking', label: 'Tracking', icon: <path d="M12 4a7 7 0 0 1 7 7c0 4.5-4.5 8.5-7 9-2.5-.5-7-4.5-7-9a7 7 0 0 1 7-7Zm0 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /> },
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

  const isActivePath = (to) => {
    if (to === '/orders') {
      return location.pathname === '/orders' || location.pathname.startsWith('/orders/');
    }
    return location.pathname === to || location.pathname.startsWith(`${to}/`);
  };

  const isCollapsedLayout = layout.position === 'collapsed';
  const isCollapsed = isCollapsedLayout || (sidebarToggle && !isHovered);
  const showExpandedContent = !isCollapsedLayout && (!sidebarToggle || isHovered);

  const widthClassMap = {
    narrow: { desktop: 'lg:w-[160px]', mobile: 'max-w-[160px]' },
    standard: { desktop: 'lg:w-[220px]', mobile: 'max-w-[220px]' },
    wide: { desktop: 'lg:w-[280px]', mobile: 'max-w-[280px]' }
  };

  const widthClass = widthClassMap[layout.width] || widthClassMap.standard;
  const positionClass = layout.position === 'right' ? 'right-0 lg:right-0 lg:left-auto' : 'left-0 lg:left-0';

  return (
    <>
      <aside
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`${sidebarToggle ? 'translate-x-0' : '-translate-x-full'} ${isCollapsed ? 'lg:w-[90px]' : widthClass.desktop} fixed ${positionClass} top-0 z-[60] flex h-dvh w-[85vw] ${widthClass.mobile} flex-col overflow-y-hidden border-r border-gray-200 bg-white px-3 shadow-xl transition-[width,transform] duration-300 ease-linear dark:border-gray-800 dark:bg-black sm:px-4 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 lg:flex-none lg:shadow-none`}
      >
        <div className={`flex items-center pb-5 pt-6 sm:pb-7 sm:pt-8 ${showExpandedContent ? 'justify-start' : 'justify-center'}`}>
          <NavLink to="/dashboard" onClick={closeSidebar} className="flex w-full items-center gap-3">
            {showExpandedContent ? (
              <div className="min-w-0">
                <div className="text-base font-semibold text-gray-900 dark:text-white">Averon</div>
                <div className="text-[12px] uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">Support Console</div>
              </div>
            ) : (
              <div className="text-xs font-bold text-gray-700 dark:text-gray-300">AV</div>
            )}
          </NavLink>
        </div>

        <div className="flex flex-1 flex-col overflow-y-auto duration-300 ease-linear no-scrollbar custom-scrollbar">
          <nav className="flex-1">
            <div>
              <h3 className="mb-4 text-xs uppercase leading-[20px] text-gray-400">
                <span className={`${showExpandedContent ? '' : 'lg:hidden'}`}>MENU</span>
                <svg
                  className={`${showExpandedContent ? 'hidden' : 'lg:block hidden'} mx-auto h-6 w-6 fill-current text-gray-500`}
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

              <ul className="mb-6 flex flex-col gap-3">
                {menuItems.map((item) => {
                  const active = isActivePath(item.to);

                  return (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        onClick={closeSidebar}
                        className={() =>
                          `group relative flex items-center gap-3 rounded-lg px-3 py-2 font-medium transition ${
                            active
                              ? 'bg-brand-50 text-brand-500 dark:bg-brand-500/[0.12] dark:text-brand-400'
                              : 'text-gray-700 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-300 dark:hover:bg-white/5 dark:hover:text-gray-200'
                          }`
                        }
                      >
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 text-gray-500 transition group-hover:bg-gray-200 group-hover:text-gray-700 dark:bg-white/5 dark:text-gray-400 dark:group-hover:bg-white/10">
                          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" xmlns="http://www.w3.org/2000/svg">
                            {item.icon}
                          </svg>
                        </span>
                        <span className={`${showExpandedContent ? '' : 'lg:hidden'} truncate`}>{item.label}</span>
                      </NavLink>
                      {item.children && active && showExpandedContent ? (
                        <ul className="mt-2 ml-10 space-y-2">
                          {item.children.map((child) => {
                            const childActive = isActivePath(child.to);
                            return (
                              <li key={child.to}>
                                <NavLink
                                  to={child.to}
                                  onClick={closeSidebar}
                                  className={() =>
                                    `flex items-center rounded-md px-2 py-1.5 text-sm transition ${
                                      childActive
                                        ? 'font-semibold text-brand-500 dark:text-brand-400'
                                        : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
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
