// Frame for agent, warehouse, pickup and admin screens.
import { Link, NavLink, Outlet, useNavigate } from 'react-router';
import { useT } from '../i18n/index.jsx';
import { useAuth } from '../lib/auth.jsx';
import { LanguageSwitch } from './CustomerLayout.jsx';

export default function StaffLayout({ links, title }) {
  const { t } = useT();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <div>
      {import.meta.env.DEV && <div className="dev-bar">{t('dev.banner')}</div>}
      <header className="staff-header">
        <div className="app-header-inner">
          <Link to="/" className="logo">Gexi</Link>
          <span className="staff-role grow">{title} · {user?.name}</span>
          <LanguageSwitch className="select" style={{ minHeight: 32, width: 'auto', padding: '0 8px', fontSize: 14, color: 'var(--color-text)' }} />
          <button type="button" className="link-light" onClick={async () => { await logout(); navigate('/login'); }}>{t('nav.logout')}</button>
        </div>
      </header>
      {links.length > 1 && (
        <nav className="staff-nav">
          {links.map((l) => <NavLink key={l.to} to={l.to} end={l.end}>{l.label}</NavLink>)}
        </nav>
      )}
      <main className="container">
        <Outlet />
      </main>
    </div>
  );
}
