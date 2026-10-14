import { useState } from 'react';
import { useT } from '../../i18n/index.jsx';
import { useApi } from '../../lib/useApi.js';
import { patch, post, qs } from '../../lib/api.js';
import { dateOnly, phone } from '../../lib/format.js';
import { Badge, Button, Checkbox, Empty, ErrorMessage, Input, Loader, Modal, Pager, PhoneInput, Select, fieldErrors } from '../../components/ui.jsx';

const ROLES = ['customer', 'agent', 'warehouse', 'pickup', 'admin'];

export default function Users() {
  const { t } = useT();
  const [role, setRole] = useState('');
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useApi(`/admin/users${qs({ role, q: search, page })}`);
  const [editing, setEditing] = useState(null);

  return (
    <div className="stack">
      <div className="row-between">
        <h1 style={{ margin: 0 }}>{t('admin.users.title')}</h1>
        <Button size="sm" onClick={() => setEditing({ isNew: true, role: 'agent', name: '', phone: '', password: '' })}>{t('admin.users.add')}</Button>
      </div>
      <form className="row" onSubmit={(e) => { e.preventDefault(); setSearch(q); setPage(1); }}>
        <input className="input grow" type="search" placeholder={t('admin.users.search')} value={q} onChange={(e) => setQ(e.target.value)} style={{ minWidth: 200 }} />
        <select className="select" style={{ width: 'auto' }} value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }} aria-label={t('admin.users.role')}>
          <option value="">{t('admin.users.allRoles')}</option>
          {ROLES.map((r) => <option key={r} value={r}>{t(`roles.${r}`)}</option>)}
        </select>
      </form>
      <Loader loading={loading} error={error} reload={reload}>
        {data?.items.length === 0 && <Empty>{t('common.none')}</Empty>}
        {data?.items.length > 0 && (
          <div className="card card-flush table-wrap">
            <table className="table">
              <thead><tr><th>{t('auth.name')}</th><th>{t('auth.phone')}</th><th>{t('admin.users.role')}</th><th>{t('admin.users.joined')}</th><th /></tr></thead>
              <tbody>
                {data.items.map((u) => (
                  <tr key={u.id}>
                    <td>{u.name || '—'} {!u.is_active && <Badge tone="danger">{t('common.inactive')}</Badge>}</td>
                    <td className="nowrap">{phone(u.phone)}</td>
                    <td>{t(`roles.${u.role}`)}{u.role === 'agent' && u.commission_pct !== null && <div className="subtle">{Number(u.commission_pct)}%</div>}</td>
                    <td className="nowrap">{dateOnly(u.created_at)}</td>
                    <td><Button size="sm" variant="ghost" onClick={() => setEditing({ ...u, password: '' })}>{t('common.edit')}</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />}
      </Loader>
      {editing && <UserModal user={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />}
    </div>
  );
}

function UserModal({ user, onClose, onSaved }) {
  const { t } = useT();
  const [form, setForm] = useState({
    ...user,
    phone: user.isNew ? '' : phone(user.phone),
    commission_pct: user.commission_pct === null || user.commission_pct === undefined ? '' : String(Number(user.commission_pct)),
    payout_method: user.payout_method || '',
    payout_account: user.payout_account || '',
  });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const errors = fieldErrors(error);

  async function save() {
    setBusy(true);
    setError(null);
    const agentFields = form.role === 'agent' ? {
      commission_pct: form.commission_pct === '' ? null : Number(form.commission_pct),
      payout_method: form.payout_method || null,
      payout_account: form.payout_account || null,
    } : {};
    try {
      if (user.isNew) {
        await post('/admin/users', { phone: form.phone, name: form.name, role: form.role, password: form.password, ...agentFields });
      } else {
        await patch(`/admin/users/${user.id}`, {
          name: form.name, role: form.role, is_active: form.is_active, ...(form.password ? { password: form.password } : {}), ...agentFields,
        });
      }
      onSaved();
    } catch (err) { setError(err); setBusy(false); }
  }

  return (
    <Modal open onClose={onClose} title={user.isNew ? t('admin.users.add') : t('admin.users.edit')}>
      <ErrorMessage error={error} />
      {user.isNew ? <PhoneInput value={form.phone} onChange={set('phone')} error={errors.phone} /> : <Input label={t('auth.phone')} value={form.phone} disabled />}
      <Input label={t('auth.name')} value={form.name} onChange={set('name')} error={errors.name} />
      <Select label={t('admin.users.role')} value={form.role} onChange={set('role')} options={ROLES.map((r) => ({ value: r, label: t(`roles.${r}`) }))} />
      <Input type="password" label={user.isNew ? t('auth.password') : t('admin.users.resetPassword')} value={form.password} onChange={set('password')} error={errors.password}
        hint={user.isNew ? t('admin.users.passwordHint') : t('admin.users.resetHint')} autoComplete="new-password" />
      {form.role === 'agent' && (
        <>
          <Input label={t('admin.users.commissionOverride')} inputMode="decimal" value={form.commission_pct} onChange={set('commission_pct')} error={errors.commission_pct} hint={t('admin.users.commissionHint')} />
          <div className="form-grid form-grid-2">
            <Input label={t('agent.vendors.payoutMethod')} value={form.payout_method} onChange={set('payout_method')} />
            <Input label={t('agent.vendors.payoutAccount')} value={form.payout_account} onChange={set('payout_account')} />
          </div>
        </>
      )}
      {!user.isNew && <Checkbox label={t('admin.users.active')} checked={form.is_active} onChange={set('is_active')} />}
      <Button loading={busy} onClick={save}>{t('common.save')}</Button>
    </Modal>
  );
}
