import { Link } from 'react-router';
import { useT } from '../../i18n/index.jsx';
import { useApi } from '../../lib/useApi.js';
import { dateOnly } from '../../lib/format.js';
import { Card, Empty, Loader, Money, StatusBadge } from '../../components/ui.jsx';

export default function Orders() {
  const { t } = useT();
  const { data, error, loading, reload } = useApi('/orders');
  return (
    <div className="stack">
      <h1>{t('orders.title')}</h1>
      <Loader loading={loading} error={error} reload={reload}>
        {data && data.items.length === 0 && <Empty>{t('orders.none')} <Link to="/products">{t('cart.startShopping')}</Link></Empty>}
        {data?.items.map((o) => (
          <Link key={o.id} to={`/orders/${o.id}`} className="card card-link">
            <div className="row-between">
              <span className="bold">{o.order_number}</span>
              <StatusBadge status={o.status} />
            </div>
            <div className="row-between subtle">
              <span>{dateOnly(o.created_at)} · {t('cart.items', { count: o.item_count })}</span>
              <Money santim={o.total_santim} />
            </div>
          </Link>
        ))}
      </Loader>
    </div>
  );
}
