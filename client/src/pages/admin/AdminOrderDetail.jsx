import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { useT } from '../../i18n/index.jsx';
import { useApi } from '../../lib/useApi.js';
import { post } from '../../lib/api.js';
import { dateTime, phone } from '../../lib/format.js';
import { Badge, Button, Card, ErrorMessage, Loader, Modal, Money, StatusBadge, Textarea } from '../../components/ui.jsx';

const CANCELLABLE = ['pending_payment', 'paid', 'awaiting_dropoff', 'received_at_warehouse', 'packed'];

export default function AdminOrderDetail() {
  const { id } = useParams();
  const { t } = useT();
  const { data, error, loading, reload } = useApi(`/admin/orders/${id}`);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);
  const order = data?.order;

  async function cancel() {
    setBusy(true);
    setActionError(null);
    try {
      await post(`/admin/orders/${id}/cancel`, { note });
      setCancelOpen(false);
      reload();
    } catch (err) { setActionError(err); }
    setBusy(false);
  }

  return (
    <Loader loading={loading} error={error} reload={reload}>
      {order && (
        <div className="stack-lg">
          <Link to="/admin/orders" className="small">← {t('admin.orders.title')}</Link>
          <div className="row-between">
            <h1 style={{ margin: 0 }}>{order.order_number}</h1>
            <StatusBadge status={order.status} />
          </div>
          <div className="split">
            <Card title={t('common.customer')}>
              <div className="stack small">
                <div>{order.customer.name} · {phone(order.customer.phone)}</div>
                <div>{t('admin.orderDetail.pickupCode')}: <span className="mono bold">{order.pickup_code || '—'}</span></div>
                {order.dropoff_deadline && <div>{t('admin.orders.dropoff')}: {dateTime(order.dropoff_deadline)}</div>}
                {order.pickup_deadline && <div>{t('admin.orders.pickup')}: {dateTime(order.pickup_deadline)}</div>}
                {CANCELLABLE.includes(order.status) && (
                  <Button variant="danger" size="sm" onClick={() => setCancelOpen(true)} style={{ alignSelf: 'flex-start' }}>{t('admin.orderDetail.cancel')}</Button>
                )}
              </div>
            </Card>
            <Card title={t('admin.orderDetail.payments')}>
              {order.payments.length === 0 && <p className="subtle">—</p>}
              {order.payments.map((p) => (
                <div key={p.id} className="small row-between">
                  <span className="mono">{p.tx_ref}</span>
                  <span><Badge tone={p.status === 'success' ? 'success' : p.status === 'failed' ? 'danger' : 'warning'}>{p.status}</Badge> <Money santim={p.amount_santim} /></span>
                </div>
              ))}
            </Card>
          </div>
          <Card title={t('orderDetail.items')} className="card-flush">
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>{t('common.item')}</th><th>{t('agent.products.vendor')}</th><th>{t('common.status')}</th><th className="num">{t('common.amount')}</th><th className="num">{t('admin.split.vendor')}</th><th className="num">{t('admin.split.agent')}</th><th className="num">{t('admin.split.platform')}</th></tr></thead>
                <tbody>
                  {order.items.map((i) => (
                    <tr key={i.id}>
                      <td>{i.quantity} × {i.title}{i.rejection_reason && <div className="subtle">“{i.rejection_reason}”</div>}</td>
                      <td>{i.vendor_name}<div className="subtle">{t('roles.agent')}: {i.agent_name}</div></td>
                      <td><StatusBadge kind="item" status={i.item_status} /></td>
                      <td className="num"><Money santim={i.line_total_santim} /></td>
                      <td className="num"><Money santim={i.vendor_amount_santim} /></td>
                      <td className="num"><Money santim={i.agent_commission_santim} /><div className="subtle">{Number(i.agent_pct)}%</div></td>
                      <td className="num"><Money santim={i.platform_fee_santim} /><div className="subtle">{Number(i.platform_pct)}%</div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          {(order.refunds.length > 0 || order.payouts.length > 0) && (
            <div className="split">
              <Card title={t('admin.nav.refunds')}>
                {order.refunds.length === 0 && <p className="subtle">—</p>}
                {order.refunds.map((r) => (
                  <div key={r.id} className="small row-between">
                    <span>{t(`refundReason.${r.reason}`)}{r.fee_santim > 0 && <> ({t('admin.refunds.fee')} <Money santim={r.fee_santim} />)</>}</span>
                    <span><Badge tone={r.status === 'processed' ? 'success' : 'warning'}>{t(`refundStatus.${r.status}`)}</Badge> <Money santim={r.amount_santim} /></span>
                  </div>
                ))}
              </Card>
              <Card title={t('admin.nav.payouts')}>
                {order.payouts.length === 0 && <p className="subtle">—</p>}
                {order.payouts.map((p) => (
                  <div key={p.id} className="small row-between">
                    <span>{t(`payeeType.${p.payee_type}`)}</span>
                    <span><Badge tone={p.status === 'paid' ? 'success' : 'warning'}>{t(`payoutStatus.${p.status}`)}</Badge> <Money santim={p.amount_santim} /></span>
                  </div>
                ))}
              </Card>
            </div>
          )}
          <Card title={t('admin.orderDetail.history')}>
            <ol className="timeline">
              {order.history.map((h) => (
                <li key={h.id}>
                  <div className="small">
                    <span className="bold">{h.order_item_id ? `${t('common.item')}: ` : ''}{h.order_item_id ? t(`itemStatus.${h.to_status}`) : t(`status.${h.to_status}`)}</span>
                    {h.note && <span className="muted"> — {h.note}</span>}
                  </div>
                  <div className="subtle">{dateTime(h.created_at)} · {h.changed_by_name ? `${h.changed_by_name} (${t(`roles.${h.changed_by_role}`)})` : t('admin.orderDetail.system')}</div>
                </li>
              ))}
            </ol>
          </Card>
          <Modal open={cancelOpen} onClose={() => setCancelOpen(false)} title={t('admin.orderDetail.cancelTitle')}>
            <p className="small">{t('admin.orderDetail.cancelExplain')}</p>
            <Textarea label={t('warehouse.reason')} value={note} onChange={(e) => setNote(e.target.value)} />
            <ErrorMessage error={actionError} />
            <Button variant="danger" loading={busy} disabled={note.trim().length < 3} onClick={cancel}>{t('admin.orderDetail.confirmCancel')}</Button>
          </Modal>
        </div>
      )}
    </Loader>
  );
}
