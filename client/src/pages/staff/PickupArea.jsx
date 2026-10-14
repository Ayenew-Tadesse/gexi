// Pickup counter: find an order by code or phone, check the code, hand it over.
import { useState } from 'react';
import { Routes, Route } from 'react-router';
import { useT } from '../../i18n/index.jsx';
import { get, post, qs } from '../../lib/api.js';
import { dateTime, phone } from '../../lib/format.js';
import StaffLayout from '../../components/StaffLayout.jsx';
import { Alert, Button, Card, Empty, ErrorMessage, Input, Modal, StatusBadge, Tabs } from '../../components/ui.jsx';

export default function PickupArea() {
  const { t } = useT();
  return (
    <Routes>
      <Route element={<StaffLayout links={[{ to: '/pickup', label: t('roles.pickup'), end: true }]} title={t('roles.pickup')} />}>
        <Route index element={<Pickup />} />
      </Route>
    </Routes>
  );
}

function Pickup() {
  const { t } = useT();
  const [mode, setMode] = useState('code');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [handing, setHanding] = useState(null);
  const [code, setCode] = useState('');
  const [success, setSuccess] = useState('');

  async function search(e) {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    setSuccess('');
    try {
      const res = await get(`/pickup/lookup${qs(mode === 'code' ? { code: query.trim() } : { phone: query.trim() })}`);
      setResults(res.items);
    } catch (err) { setError(err); setResults(null); }
    setBusy(false);
  }

  async function handOver() {
    setBusy(true);
    setError(null);
    try {
      await post(`/pickup/orders/${handing.id}/handover`, { code });
      setSuccess(t('pickup.success', { order: handing.order_number, name: handing.customer_name }));
      setHanding(null);
      setResults(null);
      setQuery('');
    } catch (err) { setError(err); }
    setBusy(false);
  }

  return (
    <div className="stack-lg" style={{ maxWidth: 600, margin: '0 auto' }}>
      <h1>{t('pickup.title')}</h1>
      <Alert tone="success">{success}</Alert>
      <Card>
        <form className="stack" onSubmit={search}>
          <Tabs value={mode} onChange={(m) => { setMode(m); setQuery(''); setResults(null); }} tabs={[
            { value: 'code', label: t('pickup.byCode') },
            { value: 'phone', label: t('pickup.byPhone') },
          ]} />
          {mode === 'code'
            ? <Input label={t('pickup.code')} className="input-code" inputMode="numeric" maxLength={6} value={query} onChange={(e) => setQuery(e.target.value.replace(/\D/g, ''))} autoFocus />
            : <Input label={t('auth.phone')} type="tel" inputMode="tel" placeholder="09XX XXX XXX" value={query} onChange={(e) => setQuery(e.target.value)} autoFocus />}
          <Button type="submit" loading={busy} disabled={!query.trim()}>{t('pickup.find')}</Button>
        </form>
      </Card>
      <ErrorMessage error={!handing ? error : null} />
      {results && results.length === 0 && <Empty>{t('pickup.notFound')}</Empty>}
      {results?.map((o) => (
        <Card key={o.id} title={o.order_number} actions={<StatusBadge status={o.status} />}>
          <div className="stack small">
            <div><strong>{o.customer_name}</strong> · {phone(o.customer_phone)}</div>
            <ul style={{ margin: 0, paddingLeft: 'var(--space-5)' }}>
              {o.items.map((i, idx) => <li key={idx}>{i.quantity} × {i.title}</li>)}
            </ul>
            {o.status === 'ready_for_pickup' && <div className="subtle">{t('pickup.collectBy', { when: dateTime(o.pickup_deadline) })}</div>}
            {o.status === 'picked_up' || o.status === 'completed'
              ? <div className="subtle">{t('pickup.alreadyCollected', { when: dateTime(o.picked_up_at) })}</div>
              : o.status !== 'ready_for_pickup' && <Alert tone="warning">{t('pickup.notReady')}</Alert>}
            {o.status === 'ready_for_pickup' && (
              <Button block onClick={() => { setHanding(o); setCode(mode === 'code' ? query : ''); setError(null); }}>{t('pickup.handOver')}</Button>
            )}
          </div>
        </Card>
      ))}
      <Modal open={Boolean(handing)} onClose={() => setHanding(null)} title={t('pickup.confirmTitle', { order: handing?.order_number || '' })}>
        <p className="small">{t('pickup.confirmText', { name: handing?.customer_name || '' })}</p>
        <Input label={t('pickup.code')} className="input-code" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
        <ErrorMessage error={error} />
        <Button loading={busy} disabled={code.length !== 6} onClick={handOver}>{t('pickup.confirm')}</Button>
      </Modal>
    </div>
  );
}
