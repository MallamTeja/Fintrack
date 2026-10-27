import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import Icon from './Icon.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { startRealtime } from '../lib/realtime.js';
import './AppShell.css';

const NAV = [
  { to: '/', label: 'Dashboard', short: 'Home', icon: 'dashboard', end: true, also: '/dashboard' },
  { to: '/transactions', label: 'Transactions', short: 'Ledger', icon: 'ledger' },
  { to: '/import', label: 'Import', short: 'Import', icon: 'import' },
  { to: '/people', label: 'People', short: 'People', icon: 'people', tab: false },
  { to: '/budgets', label: 'Budgets', short: 'Budgets', icon: 'budget' },
  { to: '/savings', label: 'Savings', short: 'Savings', icon: 'savings' },
  { to: '/settings', label: 'Settings', short: 'Settings', icon: 'settings' },
];

export function Wordmark({ as: Tag = 'span' }) {
  return <Tag className="wordmark">FinTrack</Tag>;
}

function UserMenu({ placement }) {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const name = user?.name || user?.email || 'Your account';
  const initial = (name.trim()[0] || 'F').toUpperCase();

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className={`usermenu usermenu--${placement}`} ref={ref}>
      <button
        type="button"
        className="usermenu__trigger"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="usermenu__avatar" aria-hidden="true">
          {initial}
        </span>
        <span className="usermenu__name">{name}</span>
        <span className="visually-hidden">Account menu</span>
      </button>
      {open && (
        <div className="usermenu__pop">
          <div className="usermenu__who">
            <strong>{user?.name || 'Signed in'}</strong>
            {user?.email && <span className="muted">{user.email}</span>}
          </div>
          <button
            type="button"
            className="usermenu__item"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
            {theme === 'dark' ? 'Light theme' : 'Dark theme'}
          </button>
          <button type="button" className="usermenu__item" onClick={logout}>
            <Icon name="logout" size={18} />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

function LiveDot({ status }) {
  if (status !== 'live') return null;
  return (
    <span className="live" title="Changes from other tabs and devices appear here automatically">
      <span className="live__dot" aria-hidden="true" />
      Live
    </span>
  );
}

export default function AppShell() {
  const { token } = useAuth();
  const [live, setLive] = useState('off');
  const { pathname } = useLocation();
  const mainRef = useRef(null);

  useEffect(() => {
    if (!token) return undefined;
    return startRealtime(token, setLive);
  }, [token]);

  // /dashboard is an alias of /, so the Dashboard link stays current on either address.
  const linkTo = (n) => (n.also && pathname === n.also ? n.also : n.to);

  useEffect(() => {
    window.scrollTo?.(0, 0);
  }, [pathname]);

  return (
    <div className="shell">
      <a href="#main" className="skip-link">
        Skip to content
      </a>

      <aside className="rail" aria-label="Primary">
        <Wordmark />
        <nav className="rail__nav" aria-label="Sections">
          {NAV.map((n) => (
            <NavLink key={n.to} to={linkTo(n)} end={n.end} className="rail__link">
              <Icon name={n.icon} />
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="rail__foot">
          <LiveDot status={live} />
          <UserMenu placement="rail" />
        </div>
      </aside>

      <header className="topbar">
        <Wordmark />
        <div className="topbar__end">
          <LiveDot status={live} />
          <UserMenu placement="top" />
        </div>
      </header>

      <main id="main" className="shell__main" ref={mainRef} tabIndex={-1}>
        <Outlet />
      </main>

      <nav className="tabbar" aria-label="Sections">
        {NAV.filter((n) => n.tab !== false).map((n) => (
          <NavLink key={n.to} to={linkTo(n)} end={n.end} className="tabbar__link">
            <Icon name={n.icon} size={22} />
            <span>{n.short}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
