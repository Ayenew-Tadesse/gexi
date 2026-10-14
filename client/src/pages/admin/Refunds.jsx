import { useState } from 'react';
import { Link } from 'react-router';
import { useT } from '../../i18n/index.jsx';
import { useApi } from '../../lib/useApi.js';
import { post, qs } from '../../lib/api.js';
import { dateTime, phone } from '../../lib/format.js';
import { Badge, Button, Empty, ErrorMessage, Input, Loader, Modal, Money, Tabs } from '../../components/ui.jsx';

export default function Refunds() {
  const { t } = useT();
  const [status, setStatus] = useState(new URLSearchParams(window.location.search).get('status') || '');
  const { data, error, loading, reload } = useApi(`/admin/refunds${qs({ status })}`);
  const [processing, setProcessing] = useState(null);
  const [reference, setReference] = useState('');
  const [actionError, setActionError] = useState(null);

  async function markProcessed() {
    setActionError(null);
    try {
      await post(`/admin/refunds/${processing.id}/mark-processed`, { reference });
      setProcessing(null);
      setReference('');
      reload();
    } catch (err) { setActionError(err); }
  }

  return (
    <div className="stack">
      <h1>{t('admin.refunds.title')}</h1>
      <p className="subtle">{t('admin.refunds.explain')}</p>
      <Tabs value={status} onChange={setStatus} tabs={[
        { value: '', label: t('common.all') }, { value: 'pending', label: t('refundStatus.pending') }, { value: 'processed', label: t('refundStatus.processed') },
      ]} />
      <Loader loading={loading} error={error} reload={reload}>
        {data?.items.length === 0 && <Empty>{t('common.none')}</Empty>}
        {data?.items.length > 0 && (
          <div className="card card-flush table-wrap">
            <table className="table">
              <thead><tr><th>{t('common.order')}</th><th>{t('common.customer')}</th><th>{t('admin.refunds.reason')}</th><th>{t('common.status')}</th><th className="num">{t('common.amount')}</th><th /></tr></thead>
              <tbody>
                {data.items.map((r) => (
                  <tr key={r.id}>
                    <td className="nowrap"><Link to={`/admin/orders/${r.order_id}`}>{r.order_number}</Link><div className="subtle">{dateTime(r.created_at)}</div></td>
                    <td>{r.customer_name}<div className="subtle">{phone(r.customer_phone)}</div></td>
                    <td>{t(`refundReason.${r.reason}`)}{r.item_title && <div className="subtle">{r.item_title}</div>}{r.note && <div className="subtle">{r.note}</div>}</td>
                    <td><Badge tone={r.status === 'processed' ? 'success' : 'warning'}>{t(`refundStatus.${r.status}`)}</Badge>{r.provider_reference && <div className="subtle mono">{r.provider_reference}</div>}</td>
                    <td className="num"><Money santim={r.amount_santim} />{r.fee_santim > 0 && <div className="subtle">{t('admin.refunds.fee')} <Money santim={r.fee_santim} /></div>}</td>
                    <td>{r.status === 'pending' && <Button size="sm" variant="secondary" onClick={() => setProcessing(r)}>{t('admin.refunds.markDone')}</Button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Loader>
      <Modal open={Boolean(processing)} onClose={() => setProcessing(null)} title={t('admin.refunds.markDone')}>
        <p className="small">{t('admin.refunds.manualText', { name: processing?.customer_name || '', phone: phone(processing?.customer_phone) })}</p>
        <Input label={t('admin.payouts.reference')} value={reference} onChange={(e) => setReference(e.target.value)} />
        <ErrorMessage error={actionError} />
        <Button onClick={markProcessed}>{t('admin.refunds.markDone')}</Button>
      </Modal>
    </div>
  );
}
