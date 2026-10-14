import { useEffect, useState } from 'react';
import { useT } from '../../i18n/index.jsx';
import { get, patch, post, put } from '../../lib/api.js';
import { useApi } from '../../lib/useApi.js';
import { toSantim } from '../../lib/format.js';
import { Alert, Button, Card, ErrorMessage, Input, Spinner, fieldErrors } from '../../components/ui.jsx';

export default function Settings() {
  const { t } = useT();
  const [form, setForm] = useState(null);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    get('/admin/settings').then(({ settings: s }) => setForm({
      ...s,
      vendor_pct: String(s.vendor_pct), agent_pct: String(s.agent_pct), platform_pct: String(s.platform_pct),
      dropoff_window_hours: String(s.dropoff_window_hours), pickup_window_days: String(s.pickup_window_days),
      expiry_fee: String(s.expiry_fee_santim / 100), payment_timeout_minutes: String(s.payment_timeout_minutes),
      pickup_reminder_hours_before: String(s.pickup_reminder_hours_before),
      pickup_location: { map_url: '', ...s.pickup_location },
    })).catch(setError);
  }, []);

  if (!form) return error ? <ErrorMessage error={error} /> : <Spinner />;
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const setLoc = (k) => (e) => setForm({ ...form, pickup_location: { ...form.pickup_location, [k]: e.target.value } });
  const sum = Number(form.vendor_pct) + Number(form.agent_pct) + Number(form.platform_pct);
  const errors = fieldErrors(error);

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await put('/admin/settings', {
        vendor_pct: Number(form.vendor_pct), agent_pct: Number(form.agent_pct), platform_pct: Number(form.platform_pct),
        dropoff_window_hours: Number(form.dropoff_window_hours), pickup_window_days: Number(form.pickup_window_days),
        expiry_fee_santim: toSantim(form.expiry_fee || 0), payment_timeout_minutes: Number(form.payment_timeout_minutes),
        pickup_reminder_hours_before: Number(form.pickup_reminder_hours_before),
        pickup_location: form.pickup_location,
      });
      setSaved(true);
    } catch (err) { setError(err); }
    setBusy(false);
  }

  return (
    <div className="stack-lg" style={{ maxWidth: 720 }}>
      <h1>{t('admin.settings.title')}</h1>
      <form className="stack-lg" onSubmit={save}>
        <ErrorMessage error={error} />
        {saved && <Alert tone="success">{t('common.saved')}</Alert>}
        <Card title={t('admin.settings.split')}>
          <div className="stack">
            <p className="subtle">{t('admin.settings.splitExplain')}</p>
            <div className="form-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
              <Input label={`${t('admin.split.vendor')} %`} inputMode="decimal" value={form.vendor_pct} onChange={set('vendor_pct')} error={errors.vendor_pct} />
              <Input label={`${t('admin.split.agent')} %`} inputMode="decimal" value={form.agent_pct} onChange={set('agent_pct')} error={errors.agent_pct} />
              <Input label={`${t('admin.split.platform')} %`} inputMode="decimal" value={form.platform_pct} onChange={set('platform_pct')} error={errors.platform_pct} />
            </div>
            <Alert tone={Math.abs(sum - 100) < 0.001 ? 'success' : 'error'}>{t('admin.settings.sum', { sum: Math.round(sum * 100) / 100 })}</Alert>
          </div>
        </Card>
        <Card title={t('admin.settings.timing')}>
          <div className="form-grid form-grid-2">
            <Input type="number" min="1" label={t('admin.settings.dropoffHours')} value={form.dropoff_window_hours} onChange={set('dropoff_window_hours')} hint={t('admin.settings.dropoffHint')} />
            <Input type="number" min="1" label={t('admin.settings.pickupDays')} value={form.pickup_window_days} onChange={set('pickup_window_days')} hint={t('admin.settings.pickupHint')} />
            <Input inputMode="decimal" label={t('admin.settings.expiryFee')} value={form.expiry_fee} onChange={set('expiry_fee')} hint={t('admin.settings.expiryFeeHint')} />
            <Input type="number" min="5" label={t('admin.settings.paymentTimeout')} value={form.payment_timeout_minutes} onChange={set('payment_timeout_minutes')} />
            <Input type="number" min="1" label={t('admin.settings.reminderHours')} value={form.pickup_reminder_hours_before} onChange={set('pickup_reminder_hours_before')} />
          </div>
        </Card>
        <Card title={t('admin.settings.location')}>
          <div className="stack">
            <Input label={t('admin.settings.locationName')} value={form.pickup_location.name} onChange={setLoc('name')} />
            <Input label={t('admin.settings.address')} value={form.pickup_location.address} onChange={setLoc('address')} />
            <Input label={t('admin.settings.hours')} value={form.pickup_location.hours} onChange={setLoc('hours')} />
            <Input label={t('admin.settings.mapUrl')} value={form.pickup_location.map_url} onChange={setLoc('map_url')} hint={t('common.optional')} />
          </div>
        </Card>
        <Button type="submit" loading={busy}>{t('common.save')}</Button>
      </form>
      <Categories />
    </div>
  );
}

function Categories() {
  const { t } = useT();
  const { data, reload } = useApi('/categories');
  const [form, setForm] = useState({ name_en: '', name_am: '', slug: '' });
  const [error, setError] = useState(null);

  async function add(e) {
    e.preventDefault();
    setError(null);
    const slug = form.slug || form.name_en.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    try {
      await post('/admin/categories', { ...form, slug, sort_order: (data?.items.length || 0) });
      setForm({ name_en: '', name_am: '', slug: '' });
      reload();
    } catch (err) { setError(err); }
  }

  async function rename(c, field, value) {
    if (value === c[field]) return;
    await patch(`/admin/categories/${c.id}`, { [field]: value }).catch(setError);
    reload();
  }

  return (
    <Card title={t('admin.settings.categories')}>
      <div className="stack">
        <ErrorMessage error={error} />
        {data?.items.map((c) => (
          <div key={c.id} className="form-grid form-grid-2">
            <input className="input" defaultValue={c.name_en} onBlur={(e) => rename(c, 'name_en', e.target.value)} aria-label={t('admin.settings.nameEn')} />
            <input className="input" defaultValue={c.name_am} onBlur={(e) => rename(c, 'name_am', e.target.value)} aria-label={t('admin.settings.nameAm')} placeholder={t('admin.settings.nameAm')} />
          </div>
        ))}
        <form className="form-grid form-grid-2" onSubmit={add}>
          <Input label={t('admin.settings.nameEn')} value={form.name_en} onChange={(e) => setForm({ ...form, name_en: e.target.value })} required />
          <Input label={t('admin.settings.nameAm')} value={form.name_am} onChange={(e) => setForm({ ...form, name_am: e.target.value })} />
          <Button type="submit" variant="secondary">{t('admin.settings.addCategory')}</Button>
        </form>
      </div>
    </Card>
  );
}
