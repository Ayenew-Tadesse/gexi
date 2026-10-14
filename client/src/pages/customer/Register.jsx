import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useT } from '../../i18n/index.jsx';
import { post } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { Button, Card, ErrorMessage, Input, PhoneInput, fieldErrors } from '../../components/ui.jsx';

export default function Register() {
  const { t, lang } = useT();
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [form, setForm] = useState({ name: '', phone: '', password: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const errors = fieldErrors(error);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { user } = await post('/auth/register', { ...form, preferred_language: lang });
      setUser(user);
      const next = params.get('next');
      navigate(next && next.startsWith('/') && !next.startsWith('//') ? next : '/', { replace: true });
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: '0 auto' }} className="stack-lg">
      <h1>{t('auth.registerTitle')}</h1>
      <Card>
        <form className="stack" onSubmit={submit}>
          <ErrorMessage error={error} />
          <Input label={t('auth.name')} autoComplete="name" value={form.name} onChange={set('name')} error={errors.name} required />
          <PhoneInput value={form.phone} onChange={set('phone')} error={errors.phone} required hint={t('auth.phoneHint')} />
          <Input type="password" label={t('auth.password')} autoComplete="new-password" value={form.password} onChange={set('password')} error={errors.password} hint={t('auth.passwordHint')} required minLength={6} />
          <Button type="submit" block loading={busy}>{t('auth.register')}</Button>
        </form>
      </Card>
      <p className="small" style={{ textAlign: 'center' }}>{t('auth.haveAccount')} <Link to="/login">{t('auth.login')}</Link></p>
    </div>
  );
}
