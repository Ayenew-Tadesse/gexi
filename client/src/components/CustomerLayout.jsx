// Frame for shopping pages: top bar with search, bottom tab bar on phones.
import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router';
import { useT, LANGUAGES } from '../i18n/index.jsx';
import { useCart } from '../lib/cart.js';
import { useAuth, HOME_FOR_ROLE } from '../lib/auth.jsx';
import { HomeIcon, SearchIcon, CartIcon, UserIcon } from './icons.jsx';
import DemoBanner from './DemoBanner.jsx';

export function LanguageSwitch({ className = 'select', style }) {
  const { lang, setLang, t } = useT();
  return (
    <select className={className} style={style} value={lang} onChange={(e) => setLang(e.target.value)} aria-label={t('common.language')}>
      {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
    </select>
  );
}

export default function CustomerLayout() {
  const { t } = useT();
  const { count } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [q, setQ] = useState('');

  const onSearch = (e) => {
    e.preventDefault();
    navigate(`/products${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`);
  };

  return (
    <div className="page-with-bottom-nav">
      <DemoBanner />
      <header className="app-header">
        <div className="app-header-inner">
          <Link to="/" className="logo">Gexi</Link>
          <form className="header-search" onSubmit={onSearch} role="search">
            <label className="visually-hidden" htmlFor="site-search">{t('nav.search')}</label>
            <input id="site-search" className="input" type="search" placeholder={t('shop.searchPlaceholder')} value={q} onChange={(e) => setQ(e.target.value)} />
          </form>
          <nav className="header-actions">
            <LanguageSwitch className="select" style={{ minHeight: 38, width: 'auto' }} />
            {user && user.role !== 'customer' && <Link className="btn btn-ghost btn-sm" to={HOME_FOR_ROLE[user.role]}>{t('nav.workspace')}</Link>}
            <Link className="btn btn-ghost btn-sm" to="/orders">{t('nav.orders')}</Link>
            <Link className="btn btn-ghost btn-sm" to={user ? '/account' : '/login'}>{user ? t('nav.account') : t('nav.login')}</Link>
            <Link className="btn btn-secondary btn-sm" to="/cart">{t('nav.cart')}{count > 0 ? ` (${count})` : ''}</Link>
          </nav>
        </div>
      </header>
      <main className="container">
        <Outlet />
      </main>
      <nav className="bottom-nav" aria-label={t('nav.main')}>
        <NavLink to="/" end><HomeIcon />{t('nav.home')}</NavLink>
        <NavLink to="/products"><SearchIcon />{t('nav.shop')}</NavLink>
        <NavLink to="/cart"><CartIcon />{t('nav.cart')}{count > 0 && <span className="nav-count">{count}</span>}</NavLink>
        <NavLink to={user ? '/account' : '/login'}><UserIcon />{user ? t('nav.account') : t('nav.login')}</NavLink>
      </nav>
    </div>
  );
}
