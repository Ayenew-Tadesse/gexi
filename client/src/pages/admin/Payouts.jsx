// Payouts: what the platform owes vendors and agents after pickup. Pay them outside the app, then mark them paid here.
import { useMemo, useState } from 'react';
import { useT } from '../../i18n/index.jsx';
import { useApi } from '../../lib/useApi.js';
import { post, qs } from '../../lib/api.js';
import { birr, dateOnly, phone } from '../../lib/format.js';
import { Alert, Badge, Button, Card, Empty, ErrorMessage, Input, Loader, Modal, Money, Tabs } from '../../components/ui.jsx';

export default function Payouts() {
  const { t } = useT();
  const [status, setStatus] = useState('due');
  const [payeeType, setPayeeType] = useState('');
  const { data, error, loading, reload } = useApi(`/admin/payouts${qs({ status, payee_type: payeeType, pageSize: 100 })}`);
  const [selected, setSelected] = useState(new Set());
  const [confirming, setConfirming] = useState(false);
  const [reference, setReference] = useState('');
  const [msg, setMsg] = useState('');
  const [actionError, setActionError] = useState(null);

  // Group by payee so the admin sends one transfer per person.
  const groups = useMemo(() => {
    const map = new Map();
    for (const p of data?.items || []) {
      const key = `${p.payee_type}-${p.payee_id}`;
      if (!map.has(key)) map.set(key, { key, payee_type: p.payee_type, payee_name: p.payee_name, payee_phone: p.payee_phone, payout_method: p.payout_method, payout_account: p.payout_account, items: [], total: 0 });
      const g = map.get(key);
      g.items.push(p);
      g.total += p.amount_santim;
    }
    return [...map.values()];
  }, [data]);

  const toggle = (ids, on) => {
    const next = new Set(selected);
    ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
    setSelected(next);
  };
  const selectedTotal = (data?.items || []).filter((p) => selected.has(p.id)).reduce((s, p) => s + p.amount_santim, 0);

  async function markPaid() {
    setActionError(null);
    try {
      const res = await post('/admin/payouts/mark-paid', { ids: [...selected], reference });
      setMsg(t('admin.payouts.marked', { count: res.updated }));
      setSelected(new Set());
      setConfirming(false);
      setReference('');
      reload();
    } catch (err) { setActionError(err); }
  }

  return (
    <div className="stack">
      <h1>{t('admin.payouts.title')}</h1>
      <p className="subtle">{t('admin.payouts.explain')}</p>
      <div className="row-between">
        <Tabs value={status} onChange={(s) => { setStatus(s); setSelected(new Set()); }} tabs={[
          { value: 'due', label: t('payoutStatus.due') }, { value: 'paid', label: t('payoutStatus.paid') },
        ]} />
        <select className="select" style={{ width: 'auto' }} value={payeeType} onChange={(e) => setPayeeType(e.target.value)} aria-label={t('admin.payouts.payee')}>
          <option value="">{t('admin.payouts.allPayees')}</option>
          <option value="vendor">{t('payeeType.vendor')}</option>
          <option value="agent">{t('payeeType.agent')}</option>
        </select>
      </div>
      <Alert tone="success">{msg}</Alert>
      {status === 'due' && selected.size > 0 && (
        <Card>
          <div className="row-between">
            <span>{t('admin.payouts.selected', { count: selected.size, amount: birr(selectedTotal) })}</span>
            <Button size="sm" onClick={() => setConfirming(true)}>{t('admin.payouts.markPaid')}</Button>
          </div>
        </Card>
      )}
      <Loader loading={loading} error={error} reload={reload}>
        {data?.items.length === 0 && <Empty>{t('common.none')}</Empty>}
        {groups.map((g) => {
          const ids = g.items.map((p) => p.id);
          const all = ids.every((id) => selected.has(id));
          return (
            <Card key={g.key}>
              <div className="row-between">
                <div>
                  <div className="bold">{g.payee_name} <Badge>{t(`payeeType.${g.payee_type}`)}</Badge></div>
                  <div className="subtle">{phone(g.payee_phone)} · {g.payout_method || '—'} {g.payout_account}</div>
                </div>
                <div className="row">
                  <Money santim={g.total} className="price-lg" />
                  {status === 'due' && <input type="checkbox" checked={all} onChange={(e) => toggle(ids, e.target.checked)} aria-label={t('admin.payouts.selectAll')} style={{ width: 22, height: 22 }} />}
                </div>
              </div>
              <div className="list">
                {g.items.map((p) => (
                  <label key={p.id} className="list-item small" style={{ cursor: status === 'due' ? 'pointer' : 'default' }}>
                    {status === 'due' && <input type="checkbox" checked={selected.has(p.id)} onChange={(e) => toggle([p.id], e.target.checked)} />}
                    <span className="grow">{p.order_number} · {p.title}{p.reference && <span className="subtle"> · {p.reference} · {dateOnly(p.paid_at)}</span>}</span>
                    <Money santim={p.amount_santim} />
                  </label>
                ))}
              </div>
            </Card>
          );
        })}
      </Loader>
      <Modal open={confirming} onClose={() => setConfirming(false)} title={t('admin.payouts.confirmTitle')}>
        <p className="small">{t('admin.payouts.confirmText', { count: selected.size, amount: birr(selectedTotal) })}</p>
        <Input label={t('admin.payouts.reference')} hint={t('admin.payouts.referenceHint')} value={reference} onChange={(e) => setReference(e.target.value)} />
        <ErrorMessage error={actionError} />
        <Button onClick={markPaid}>{t('admin.payouts.markPaid')}</Button>
      </Modal>
    </div>
  );
}
