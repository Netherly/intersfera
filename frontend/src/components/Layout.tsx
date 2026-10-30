import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '@/lib/auth';

interface NavItem {
  to: string;
  label: string;
  perm?: string;
  superAdmin?: boolean;
}

const navItems: NavItem[] = [
  { to: '/stats', label: 'Статистика', perm: 'appeals.view' },
  { to: '/appeals', label: 'Реестр', perm: 'appeals.view' },
  { to: '/mail', label: 'Почта', perm: 'appeals.create' },
  { to: '/materials', label: 'Базы', perm: 'materials.view' },
  { to: '/categories', label: 'Категории', superAdmin: true },
  { to: '/users', label: 'Пользователи', superAdmin: true },
  { to: '/access', label: 'Доступы', superAdmin: true },
];

function LogoutIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

export function Layout() {
  const { user, logout, hasPermission } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const items = navItems.filter((item) => {
    if (item.superAdmin) return user?.role === 'super_admin';
    if (!item.perm) return true;
    return hasPermission(item.perm);
  });

  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="layout">
      <div className="mobile-topbar">
        <button
          className="burger"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Меню"
          aria-expanded={menuOpen}
        >
          <span />
          <span />
          <span />
        </button>
        <div className="mobile-topbar__brand">
          <img className="brand-mark" src="/logo.png" alt="" />
          Интерсфера
        </div>
      </div>

      <aside className={menuOpen ? 'sidebar sidebar--open' : 'sidebar'}>
        <div className="sidebar__brand">
          <img className="brand-mark" src="/logo.png" alt="" />
          Интерсфера
        </div>
        <nav className="sidebar__nav">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={closeMenu}
              className={({ isActive }) => (isActive ? 'nav-link nav-link--active' : 'nav-link')}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar__user">
          <span className="sidebar__username" title={user?.full_name}>
            {user?.full_name}
          </span>
          <button className="sidebar__logout" onClick={logout} title="Выйти" aria-label="Выйти">
            <LogoutIcon />
          </button>
        </div>
      </aside>

      {menuOpen && <div className="sidebar-backdrop" onClick={closeMenu} />}

      <div className="content">
        <main className="main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
