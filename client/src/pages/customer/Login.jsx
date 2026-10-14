import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useT } from '../../i18n/index.jsx';
import { post } from '../../lib/api.js';
import { useAuth, HOME_FOR_ROLE } from '../../lib/auth.jsx';
import { Alert, Button, Card, ErrorMessage, Input, PhoneInput, Tabs } from '../../components/ui.jsx';

export default function Login() {
  const { t } = useT();
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next');
  const [mode, setMode] = useState('password');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [devCode, setDevCode] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  function done(user) {
    setUser(user);
    const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : null;
    navigate(user.role === 'customer' ? safeNext || '/' : safeNext || HOME_FOR_ROLE[user.role], { replace: true });
  }

  async function run(fn) {
    setBusy(true);
    setError(null);
    try { await fn(); } catch (err) { setError(err); } finally { setBusy(false); }
  }

  const loginPassword = (e) => { e.preventDefault(); run(async () => done((await post('/auth/login', { phone, password })).user)); };
  const sendCode = (e) => {
    e.preventDefault();
    run(async () => {
      const res = await post('/auth/otp/request', { phone });
      setCodeSent(true);
      setDevCode(res.devCode || '');
    });
  };
  const verifyCode = (e) => { e.preventDefault(); run(async () => done((await post('/auth/otp/verify', { phone, code })).user)); };

  return (
    <div style={{ maxWidth: 420, margin: '0 auto' }} className="stack-lg">
      <h1>{t('auth.loginTitle')}</h1>
      <Card className="stack">
        <Tabs value={mode} onChange={(m) => { setMode(m); setError(null); }} tabs={[
          { value: 'password', label: t('auth.withPassword') },
          { value: 'code', label: t('auth.withCode') },
        ]} />
        <ErrorMessage error={error} />
        {mode === 'password' ? (
          <form className="stack" onSubmit={loginPassword}>
            <PhoneInput value={phone} onChange={(e) => setPhone(e.target.value)} required />
            <Input type="password" label={t('auth.password')} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <Button type="submit" block loading={busy}>{t('auth.login')}</Button>
          </form>
        ) : !codeSent ? (
          <form className="stack" onSubmit={sendCode}>
            <PhoneInput value={phone} onChange={(e) => setPhone(e.target.value)} required />
            <Button type="submit" block loading={busy}>{t('auth.sendCode')}</Button>
            <p className="subtle">{t('auth.codeExplain')}</p>
          </form>
        ) : (
          <form className="stack" onSubmit={verifyCode}>
            <p className="small">{t('auth.codeSentTo', { phone })}</p>
            {devCode && <Alert tone="info">{t('auth.devCode', { code: devCode })}</Alert>}
            <Input label={t('auth.code')} className="input-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} required />
            <Button type="submit" block loading={busy}>{t('auth.verify')}</Button>
            <Button variant="ghost" onClick={() => { setCodeSent(false); setCode(''); }}>{t('auth.changeNumber')}</Button>
          </form>
        )}
      </Card>
      <p className="small" style={{ textAlign: 'center' }}>
        {t('auth.noAccount')} <Link to={`/register${next ? `?next=${encodeURIComponent(next)}` : ''}`}>{t('auth.register')}</Link>
      </p>
    </div>
  );
}
