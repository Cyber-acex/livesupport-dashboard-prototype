import { NavLink } from 'react-router-dom';

const menuItems = [
  { to: '/dashboard', label: 'Dashboard', icon: <path d="M19 3H5c-1.1 0-2 .9-2 2v14l4-4h12c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z" /> },
  { to: '/tickets', label: 'Tickets', icon: <path d="M20 7V4H4v3H2v10h18V7h-0zM6 6h12v2H6V6zm12 10H6v-6h12v6z" /> },
  { to: '/analytics', label: 'Analytics', icon: <path d="M3 17h2V9H3v8zm4 0h2V3H7v14zm4 0h2v-6h-2v6zm4 0h2v-9h-2v9z" /> },
  { to: '/knowledge', label: 'Knowledge Base', icon: <path d="M12 2L2 7v6c0 5 4 9 10 9s10-4 10-9V7l-10-5zM12 4.4L18.6 8 12 11.6 5.4 8 12 4.4z" /> },
  { to: '/orders', label: 'Orders', icon: <path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zm10 0c-1.1 0-1.99.9-1.99 2S15.9 22 17 22s2-.9 2-2-.9-2-2-2zM7.16 14l.84-2h7.45l1.24 3H7.16zM7.6 6h10.8l-1.2 3H8.8L7.6 6z" /> },
  { to: '/inbox', label: 'Inbox', icon: <path d="M21 6.5V17c0 1.1-.9 2-2 2H5c-1.1 0-2-.9-2-2V6.5L12 12l9-5.5zM12 13.2L4 8V17h16V8l-8 5.2z" /> },
  { to: '/tracking', label: 'Tracking', icon: <path d="M12 8a4 4 0 100 8 4 4 0 000-8zm0-6c-6.6 0-12 5.4-12 12 0 3.6 1.6 6.8 4.2 9l.8-2.6C4.1 19.1 3 16.6 3 14 3 8.5 7.6 4 13 4s10 4.5 10 10c0 2.6-1.1 5.1-2.9 6.4L21 23c2.6-2.2 4-5.4 4-9 0-6.6-5.4-12-12-12z" /> },
  { to: '/settings', label: 'Settings', icon: <path d="M19.14 12.94a7.89 7.89 0 000-1.88l2.03-1.58-2-3.46-2.39.96a8.1 8.1 0 00-1.6-.93l-.36-2.5h-4l-.36 2.5c-.57.24-1.1.55-1.6.93L6.8 6.02l-2 3.46L6.83 11a7.89 7.89 0 000 1.88l-2.03 1.58 2 3.46 2.39-.96c.5.38 1.03.69 1.6.93l.36 2.5h4l.36-2.5c.57-.24 1.1-.55 1.6-.93l2.39.96 2-3.46-2.03-1.58zM12 15.5A3.5 3.5 0 1112 8.5a3.5 3.5 0 010 7z" /> }
];

function Sidebar() {
  return (
    <aside className="hidden lg:flex w-[220px] flex-col gap-[18px] rounded-none border-r border-white/10 bg-[#0f1724]/95 p-[18px] text-white">
      <div className="flex items-center gap-3">
        <svg viewBox="0 0 24 24" className="h-10 w-10 stroke-[#6ee7b7]" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
        </svg>
        <div>
          <div className="text-base font-semibold">LiveSupport</div>
          <div className="text-[12px] text-white/65">Support Console</div>
        </div>
      </div>


      <nav className="mt-2 flex flex-col gap-2">
        {menuItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                isActive ? 'bg-white/10 text-white' : 'text-white/65 hover:bg-white/5 hover:text-white'
              }`
            }
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
              {item.icon}
            </svg>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}

export default Sidebar;
