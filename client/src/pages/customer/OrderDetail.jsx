import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { useT } from '../../i18n/index.jsx';
import { useApi } from '../../lib/useApi.js';
import { post } from '../../lib/api.js';
import { dateTime } from '../../lib/format.js';
import { Alert, Button, Card, ErrorMessage, Loader, Money, ProductImage, StatusBadge } from '../../components/ui.jsx';

const STEPS = ['paid', 'awaiting_dropoff', 'received_at_warehouse', 'packed', 'ready_for_pickup', 'picked_up'];

export default function OrderDetail() {
  const { id } = useParams();
  const { t } = useT();
  const { data, error, loading, reload } = useApi(`/orders/${id}`);
  const { data: settings } = useApi('/settings/public');
  const [payError, setPayError] = useState(null);
  const [paying, setPaying] = useState(false);
  const order = data?.order;

  async function payNow() {
    setPaying(true);
    try {
      const res = await post(`/orders/${order.id}/pay`);
      window.location.assign(res.checkoutUrl);
    } catch (err) {
      setPayError(err);
      setPaying(false);
    }
  }

  const reached = new Map((order?.history || []).map((h) => [h.to_status, h.created_at]));
  const refundTotal = (order?.refunds || []).reduce((s, r) => s + r.amount_santim, 0);

  return (
    <Loader loading={loading} error={error} reload={reload}>
      {order && (
        <div className="stack-lg" style={{ maxWidth: 640, margin: '0 auto' }}>
          <div className="row-between">
            <h1 style={{ margin: 0 }}>{order.order_number}</h1>
            <StatusBadge status={order.status} />
          </div>

          {order.status === 'pending_payment' && (
            <Card className="stack">
              <p>{t('orderDetail.notPaid')}</p>
              <ErrorMessage error={payError} />
              <Button onClick={payNow} loading={paying}>{t('checkout.payNow')}</Button>
            </Card>
          )}

          {order.pickup_code && (
            <Card className="stack">
              <h2>{t('orderDetail.pickupCode')}</h2>
              <div className="pickup-code" aria-label={t('orderDetail.pickupCode')}>{order.pickup_code}</div>
              {order.status === 'ready_for_pickup' ? (
                <Alert tone="success">
                  {t('orderDetail.readyText', { deadline: dateTime(order.pickup_deadline) })}
                  {settings?.pickup_location && <><br /><strong>{settings.pickup_location.name}</strong> · {settings.pickup_location.address} · {settings.pickup_location.hours}</>}
                </Alert>
              ) : (
                <p className="small muted">{t('orderDetail.codeNotYet')}</p>
              )}
            </Card>
          )}

          {order.status === 'expired' && <Alert tone="warning">{t('orderDetail.expiredText')}</Alert>}
          {order.status === 'cancelled' && <Alert tone="warning">{t('orderDetail.cancelledText')}</Alert>}
          {refundTotal > 0 && (
            <Alert tone="info">
              {t('orderDetail.refund', { amount: (refundTotal / 100).toLocaleString('en-US') })}
              {' '}{order.refunds.every((r) => r.status === 'processed') ? t('orderDetail.refundDone') : t('orderDetail.refundPending')}
            </Alert>
          )}

          {!['pending_payment', 'cancelled', 'expired'].includes(order.status) && (
            <Card title={t('orderDetail.progress')}>
              <ol className="timeline">
                {STEPS.map((s) => (
                  <li key={s} className={reached.has(s) ? '' : 'pending'}>
                    <div className={reached.has(s) ? 'bold small' : 'small muted'}>{t(`status.${s}`)}</div>
                    {reached.has(s) && <div className="subtle">{dateTime(reached.get(s))}</div>}
                  </li>
                ))}
              </ol>
            </Card>
          )}

          <Card title={t('orderDetail.items')}>
            <div className="list">
              {order.items.map((i) => (
                <div key={i.id} className="list-item">
                  <ProductImage src={i.image_url} alt="" className="thumb" />
                  <div className="grow">
                    <Link to={`/products/${i.product_id}`} className="small">{i.quantity} × {i.title}</Link>
                    {['rejected', 'missed_dropoff', 'cancelled'].includes(i.item_status) && (
                      <div><StatusBadge kind="item" status={i.item_status} /></div>
                    )}
                  </div>
                  <Money santim={i.line_total_santim} />
                </div>
              ))}
            </div>
            <div className="row-between" style={{ marginTop: 'var(--space-3)' }}>
              <span className="bold">{t('cart.total')}</span><Money santim={order.total_santim} />
            </div>
          </Card>
        </div>
      )}
    </Loader>
  );
}
