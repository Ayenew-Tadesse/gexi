import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useT } from '../../i18n/index.jsx';
import { useApi } from '../../lib/useApi.js';
import { get, post } from '../../lib/api.js';
import { birr, dateTime } from '../../lib/format.js';
import { Alert, Button, Card, Loader, Stat } from '../../components/ui.jsx';

const STATUS_ORDER = ['pending_payment', 'awaiting_dropoff', 'received_at_warehouse', 'packed', 'ready_for_pickup', 'picked_up', 'completed', 'cancelled', 'expired'];

export default function Overview() {
  const { t } = useT();
  const { data, error, loading, reload } = useApi('/admin/overview');
  return (
    <div className="stack-lg">
      <h1>{t('admin.overview.title')}</h1>
      <Loader loading={loading} error={error} reload={reload}>
        {data && (
          <>
            <div className="stats">
              <Stat label={t('admin.overview.paidToday')} value={`${data.paidToday.orders} · ${birr(data.paidToday.amount_santim)}`} />
              <Stat label={t('admin.overview.deliveredSales')} value={birr(data.delivered.sales_santim)} />
              <Stat label={t('admin.overview.platformEarnings')} value={birr(data.delivered.platform_santim)} />
              <Stat label={t('admin.overview.payoutsDue')} value={birr(data.payoutsDue.amount_santim)} />
            </div>
            {data.pendingRefunds.count > 0 && (
              <Alert tone="warning">{t('admin.overview.refundsWaiting', { count: data.pendingRefunds.count, amount: birr(data.pendingRefunds.amount_santim) })} <Link to="/admin/refunds?status=pending">{t('common.view')}</Link></Alert>
            )}
            <Card title={t('admin.overview.ordersByStatus')}>
              <div className="stats">
                {STATUS_ORDER.map((s) => (
                  <Link key={s} to={`/admin/orders?status=${s}`} className="stat" style={{ color: 'inherit' }}>
                    <div className="stat-label">{t(`status.${s}`)}</div>
                    <div className="stat-value">{data.ordersByStatus[s] || 0}</div>
                  </Link>
                ))}
              </div>
            </Card>
          </>
        )}
      </Loader>
      <DevTools onChange={reload} />
    </div>
  );
}

/** Developer tool: move time forward to test deadlines (only shown when the server allows it). */
function DevTools({ onChange }) {
  const { t } = useT();
  const [clock, setClock] = useState(null);
  const [result, setResult] = useState(null);
  useEffect(() => { get('/dev/clock').then(setClock).catch(() => setClock(null)); }, []);
  if (!clock) return null;

  async function forward(hours) {
    const res = await post('/dev/fast-forward', { hours });
    setClock(res);
    setResult(res.counts);
    onChange();
  }
  async function reset() {
    setClock(await post('/dev/reset-clock'));
    setResult(null);
  }

  return (
    <Card title={`🛠 ${t('dev.title')}`}>
      <div className="stack small">
        <p className="muted">{t('dev.explain')}</p>
        <div>{t('dev.now', { now: dateTime(clock.now), offset: clock.offsetHours })}</div>
        <div className="row">
          {[1, 24, 49, 24 * 6 + 1, 24 * 8].map((h) => (
            <Button key={h} size="sm" variant="secondary" onClick={() => forward(h)}>+{h >= 24 ? `${Math.round(h / 24 * 10) / 10}d` : `${h}h`}</Button>
          ))}
          <Button size="sm" variant="ghost" onClick={reset}>{t('dev.reset')}</Button>
        </div>
        {result && <Alert tone="info">{t('dev.result', result)}</Alert>}
      </div>
    </Card>
  );
}
