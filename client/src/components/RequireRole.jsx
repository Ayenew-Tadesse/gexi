import { Navigate, useLocation } from 'react-router';
import { useAuth } from '../lib/auth.jsx';
import { Spinner, Alert } from './ui.jsx';
import { useT } from '../i18n/index.jsx';

/** Only shows its content to logged-in users with one of the given roles (admins always allowed). */
export default function RequireRole({ roles, children }) {
  const { user, checking } = useAuth();
  const location = useLocation();
  const { t } = useT();
  if (checking) return <Spinner />;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  if (roles && user.role !== 'admin' && !roles.includes(user.role)) {
    return <div className="container"><Alert>{t('common.noAccess')}</Alert></div>;
  }
  return children;
}
