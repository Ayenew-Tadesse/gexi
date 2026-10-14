import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useT, LANGUAGES } from '../../i18n/index.jsx';
import { patch } from '../../lib/api.js';
import { useAuth, HOME_FOR_ROLE } from '../../lib/auth.jsx';
import { phone as formatPhone } from '../../lib/format.js';
import { Alert, Button, Card, ErrorMessage, Input, Select, fieldErrors } from '../../components/ui.jsx';

export default function Account() {
  const { t, setLang } = useT();
  const { user, setUser, logout } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState({ name: user.name, preferred_language: user.preferred_language });
  const [pw, setPw] = useState({ current_password: '', new_password: '' });
  const [msg, setMsg] = useState('');
  const [error, setError] = useState(null);

  async function save(body, after) {
    setError(null);
    setMsg('');
    try {
      const res = await patch('/auth/me', body);
      setUser(res.user);
      if (body.preferred_language) setLang(body.preferred_language);
      setMsg(t('account.saved'));
      after?.();
    } catch (err) {
      setError(err);
    }
  }
  const errors = fieldErrors(error);

  return (
    <div className="stack-lg" style={{ maxWidth: 520, margin: '0 auto' }}>
      <h1>{t('account.title')}</h1>
      {user.role !== 'customer' && (
        <Link className="btn btn-primary" to={HOME_FOR_ROLE[user.role]}>{t('account.openWorkspace')}</Link>
      )}
      <div className="row">
        <Link className="btn btn-secondary grow" to="/orders">{t('nav.orders')}</Link>
        <Link className="btn btn-secondary grow" to="/pickup-info">{t('nav.pickupInfo')}</Link>
      </div>
      <Alert tone="success">{msg}</Alert>
      <ErrorMessage error={error} />
      <Card title={t('account.profile')}>
        <form className="stack" onSubmit={(e) => { e.preventDefault(); save(profile); }}>
          <Input label={t('auth.phone')} value={formatPhone(user.phone)} disabled />
          <Input label={t('auth.name')} value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} error={errors.name} />
          <Select label={t('common.language')} value={profile.preferred_language} onChange={(e) => setProfile({ ...profile, preferred_language: e.target.value })}
            options={LANGUAGES.map((l) => ({ value: l.code, label: l.label }))} />
          <Button type="submit">{t('common.save')}</Button>
        </form>
      </Card>
      <Card title={t('account.password')}>
        <form className="stack" onSubmit={(e) => { e.preventDefault(); save(pw, () => setPw({ current_password: '', new_password: '' })); }}>
          <Input type="password" label={t('account.currentPassword')} hint={t('account.currentPasswordHint')} autoComplete="current-password" value={pw.current_password} onChange={(e) => setPw({ ...pw, current_password: e.target.value })} />
          <Input type="password" label={t('account.newPassword')} autoComplete="new-password" minLength={6} required value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} error={errors.new_password} />
          <Button type="submit" variant="secondary">{t('account.changePassword')}</Button>
        </form>
      </Card>
      <Button variant="ghost" onClick={async () => { await logout(); navigate('/'); }}>{t('nav.logout')}</Button>
    </div>
  );
}
