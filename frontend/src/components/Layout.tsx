import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { DEPARTMENTS, DepartmentId, isDepartmentId } from '@/lib/departments';

interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  perm?: string;
  superAdmin?: boolean;
  end?: boolean;
}

type IconName = 'stats' | 'registry' | 'mail' | 'bases' | 'history' | 'categories' | 'users' | 'access';

const appealsNav: NavItem[] = [
  { to: '/stats', label: 'Статистика', icon: 'stats', perm: 'appeals.view', end: true },
  { to: '/appeals', label: 'Реестр', icon: 'registry', perm: 'appeals.view' },
  { to: '/mail', label: 'Почта', icon: 'mail', perm: 'appeals.create' },
  { to: '/materials', label: 'Базы', icon: 'bases', perm: 'materials.view' },
  { to: '/history', label: 'История', icon: 'history', perm: 'appeals.view' },
];

const adminNav: NavItem[] = [
  { to: '/categories', label: 'Категории', icon: 'categories', superAdmin: true },
  { to: '/users', label: 'Пользователи', icon: 'users', superAdmin: true },
  { to: '/access', label: 'Доступы', icon: 'access', superAdmin: true },
];

function NavIcon({ name }: { name: IconName }) {
  const props = {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true as const,
  };
  if (name === 'stats') {
    return (
      <svg {...props}>
        <path d="M4 19V5" />
        <path d="M4 19h16" />
        <path d="M8 16v-5" />
        <path d="M12 16V8" />
        <path d="M16 16v-3" />
      </svg>
    );
  }
  if (name === 'registry') {
    return (
      <svg {...props}>
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <path d="M8 9h8" />
        <path d="M8 13h8" />
        <path d="M8 17h5" />
      </svg>
    );
  }
  if (name === 'mail') {
    return (
      <svg {...props}>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m4 7 8 6 8-6" />
      </svg>
    );
  }
  if (name === 'bases') {
    return (
      <svg {...props}>
        <path d="M4 7c0-1.4 3.6-2.5 8-2.5S20 5.6 20 7s-3.6 2.5-8 2.5S4 8.4 4 7Z" />
        <path d="M4 7v5c0 1.4 3.6 2.5 8 2.5s8-1.1 8-2.5V7" />
        <path d="M4 12v5c0 1.4 3.6 2.5 8 2.5s8-1.1 8-2.5v-5" />
      </svg>
    );
  }
  if (name === 'history') {
    return (
      <svg {...props}>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 8v5l3 2" />
      </svg>
    );
  }
  if (name === 'categories') {
    return (
      <svg {...props}>
        <path d="M4 7h16" />
        <path d="M4 12h16" />
        <path d="M4 17h10" />
      </svg>
    );
  }
  if (name === 'users') {
    return (
      <svg {...props}>
        <circle cx="9" cy="8" r="3" />
        <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
        <circle cx="17" cy="9" r="2" />
        <path d="M16 19a4.5 4.5 0 0 1 4.5-3" />
      </svg>
    );
  }
  return (
    <svg {...props}>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function departmentFromPath(pathname: string): DepartmentId | null {
  if (
    pathname.startsWith('/appeals') ||
    pathname.startsWith('/outgoing') ||
    pathname.startsWith('/mail') ||
    pathname.startsWith('/materials') ||
    pathname.startsWith('/history')
  ) {
    return 'appeals';
  }
  const match = pathname.match(/^\/department\/([^/]+)/);
  if (match && isDepartmentId(match[1])) return match[1];
  return null;
}

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
  const { user, logout, hasPermission, hasDepartment } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [deptOpen, setDeptOpen] = useState(false);
  const [picked, setPicked] = useState<DepartmentId>('appeals');
  const deptRef = useRef<HTMLDivElement>(null);
  const visible = DEPARTMENTS.filter((item) => hasDepartment(item.id));
  const located = departmentFromPath(location.pathname);
  const current = visible.some((item) => item.id === (located ?? picked))
    ? (located ?? picked)
    : visible[0]?.id ?? 'appeals';
  const sectionNav: NavItem[] =
    current === 'appeals'
      ? appealsNav
      : [
          { to: '/stats', label: 'Статистика', icon: 'stats', end: true },
          { to: `/department/${current}`, label: 'Раздел', icon: 'registry' },
        ];
  const canSee = (item: NavItem) => {
    if (item.superAdmin) return user?.role === 'super_admin';
    if (!item.perm) return true;
    return hasPermission(item.perm);
  };
  const workItems = sectionNav.filter(canSee);
  const adminItems = adminNav.filter(canSee);
  const initial = (user?.full_name ?? '?').trim().charAt(0).toUpperCase() || '?';

  useEffect(() => {
    if (!deptOpen) return;
    function onPointer(event: MouseEvent) {
      if (!deptRef.current?.contains(event.target as Node)) setDeptOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setDeptOpen(false);
    }
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [deptOpen]);

  function openDepartment(id: DepartmentId) {
    setDeptOpen(false);
    setPicked(id);
    setMenuOpen(false);
    if (id === 'appeals') navigate('/stats');
    else navigate(`/department/${id}`);
  }

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
          ЖилИнтерСфера
        </div>
      </div>

      <aside className={menuOpen ? 'sidebar sidebar--open' : 'sidebar'}>
        <div className="sidebar__brand">
          <img className="brand-mark" src="/logo.png" alt="" />
          <div>
            <div className="sidebar__brand-name">ЖилИнтерСфера</div>
            <div className="sidebar__brand-sub">Обращения</div>
          </div>
        </div>
        {visible.length > 1 && (
          <div className="sidebar__dept" ref={deptRef}>
            <span className="sidebar__label">Отдел</span>
            <button
              type="button"
              className={deptOpen ? 'sidebar__select sidebar__select--open' : 'sidebar__select'}
              aria-haspopup="listbox"
              aria-expanded={deptOpen}
              aria-label={`Отдел: ${visible.find((item) => item.id === current)?.label ?? ''}`}
              onClick={() => setDeptOpen((open) => !open)}
            >
              <span>{visible.find((item) => item.id === current)?.label}</span>
              <svg className="sidebar__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
            {deptOpen && (
              <ul className="sidebar__menu" role="listbox" aria-label="Отдел">
                {visible.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={item.id === current}
                      className={item.id === current ? 'sidebar__option sidebar__option--active' : 'sidebar__option'}
                      onClick={() => openDepartment(item.id)}
                    >
                      {item.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        <nav className="sidebar__nav">
          <div className="nav-section">Работа</div>
          {workItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={closeMenu}
              className={({ isActive }) => (isActive ? 'nav-link nav-link--active' : 'nav-link')}
            >
              <NavIcon name={item.icon} />
              {item.label}
            </NavLink>
          ))}
          {adminItems.length > 0 && (
            <>
              <div className="nav-section">Управление</div>
              {adminItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={closeMenu}
                  className={({ isActive }) => (isActive ? 'nav-link nav-link--active' : 'nav-link')}
                >
                  <NavIcon name={item.icon} />
                  {item.label}
                </NavLink>
              ))}
            </>
          )}
        </nav>

        <div className="sidebar__user">
          <span className="sidebar__avatar" aria-hidden="true">
            {initial}
          </span>
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
