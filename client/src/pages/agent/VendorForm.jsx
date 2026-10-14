import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useT } from '../../i18n/index.jsx';
import { get, patch, post } from '../../lib/api.js';
import { phone } from '../../lib/format.js';
import { Alert, Button, Card, Checkbox, ErrorMessage, Input, PhoneInput, Select, Spinner, fieldErrors } from '../../components/ui.jsx';

const EMPTY = { name: '', phone: '', location_description: '', payout_method: 'telebirr', payout_account: '', is_active: true };

export default function VendorForm() {
  const { id } = useParams();
  const { t } = useT();
  const navigate = useNavigate();
  const [form, setForm] = useState(id ? null : EMPTY);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    get(`/agent/vendors/${id}`).then(({ vendor }) => setForm({
      ...vendor, phone: phone(vendor.phone).replace(/ /g, ''), payout_method: vendor.payout_method || '', payout_account: vendor.payout_account || '',
    })).catch(setError);
  }, [id]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    const body = {
      name: form.name, phone: form.phone, location_description: form.location_description,
      payout_method: form.payout_method || null, payout_account: form.payout_account || null, is_active: form.is_active,
    };
    try {
      if (id) { await patch(`/agent/vendors/${id}`, body); setSaved(true); }
      else { const { vendor } = await post('/agent/vendors', body); navigate(`/agent/products/new?vendor=${vendor.id}`); }
    } catch (err) { setError(err); }
    setBusy(false);
  }

  if (!form) return error ? <ErrorMessage error={error} /> : <Spinner />;
  const errors = fieldErrors(error);

  return (
    <div className="stack-lg" style={{ maxWidth: 560 }}>
      <Link to="/agent/vendors" className="small">← {t('agent.vendors.title')}</Link>
      <h1>{id ? t('agent.vendors.edit') : t('agent.vendors.add')}</h1>
      <Card>
        <form className="stack" onSubmit={submit}>
          <ErrorMessage error={error} />
          {saved && <Alert tone="success">{t('common.saved')}</Alert>}
          <Input label={t('agent.vendors.name')} value={form.name} onChange={set('name')} error={errors.name} required />
          <PhoneInput value={form.phone} onChange={set('phone')} error={errors.phone} hint={t('agent.vendors.phoneHint')} required />
          <Input label={t('agent.vendors.location')} value={form.location_description} onChange={set('location_description')} hint={t('agent.vendors.locationHint')} />
          <div className="form-grid form-grid-2">
            <Select label={t('agent.vendors.payoutMethod')} value={form.payout_method} onChange={set('payout_method')} placeholder="—"
              options={[{ value: 'telebirr', label: 'Telebirr' }, { value: 'cbe', label: 'CBE (bank)' }, { value: 'cbe_birr', label: 'CBE Birr' }, { value: 'other', label: t('common.other') }]} />
            <Input label={t('agent.vendors.payoutAccount')} value={form.payout_account} onChange={set('payout_account')} />
          </div>
          {id && <Checkbox label={t('agent.vendors.active')} checked={form.is_active} onChange={set('is_active')} />}
          <Button type="submit" loading={busy}>{id ? t('common.save') : t('agent.vendors.createAndAddProduct')}</Button>
        </form>
      </Card>
      {id && <Link className="btn btn-secondary" to={`/agent/products?vendor=${id}`}>{t('agent.vendors.viewProducts')}</Link>}
    </div>
  );
}
