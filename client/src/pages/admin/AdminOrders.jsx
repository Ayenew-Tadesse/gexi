import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useT } from '../../i18n/index.jsx';
import { useApi } from '../../lib/useApi.js';
import { qs } from '../../lib/api.js';
import { dateTime, phone } from '../../lib/format.js';
import { Empty, Loader, Money, Pager, StatusBadge } from '../../components/ui.jsx';

const STATUSES = ['pending_payment', 'awaiting_dropoff', 'received_at_warehouse', 'packed', 'ready_for_pickup', 'picked_up', 'completed', 'cancelled', 'expired'];

export default function AdminOrders() {
  const { t } = useT();
  const [params, setParams] = useSearchParams();
  const status = params.get('status') || '';
  const q = params.get('q') || '';
  const page = Number(params.get('page') || 1);
  const [search, setSearch] = useState(q);
  const { data, error, loading, reload } = useApi(`/admin/orders${qs({ status, q, page })}`);
  const update = (changes) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) { if (v) next.set(k, v); else next.delete(k); }
    setParams(next);
  };

  return (
    <div className="stack">
      <h1>{t('admin.orders.title')}</h1>
      <form className="row" onSubmit={(e) => { e.preventDefault(); update({ q: search, page: '' }); }}>
        <input className="input grow" type="search" placeholder={t('admin.orders.search')} value={search} onChange={(e) => setSearch(e.target.value)} style={{ minWidth: 200 }} />
        <select className="select" style={{ width: 'auto' }} value={status} onChange={(e) => update({ status: e.target.value, page: '' })} aria-label={t('common.status')}>
          <option value="">{t('admin.orders.allStatuses')}</option>
          {STATUSES.map((s) => <option key={s} value={s}>{t(`status.${s}`)}</option>)}
        </select>
      </form>
      <Loader loading={loading} error={error} reload={reload}>
        {data?.items.length === 0 && <Empty>{t('admin.orders.none')}</Empty>}
        {data?.items.length > 0 && (
          <div className="card card-flush table-wrap">
            <table className="table">
              <thead><tr><th>{t('common.order')}</th><th>{t('common.customer')}</th><th>{t('common.status')}</th><th>{t('admin.orders.deadline')}</th><th className="num">{t('cart.total')}</th></tr></thead>
              <tbody>
                {data.items.map((o) => (
                  <tr key={o.id}>
                    <td className="nowrap"><Link to={`/admin/orders/${o.id}`}>{o.order_number}</Link><div className="subtle">{dateTime(o.created_at)}</div></td>
                    <td>{o.customer_name}<div className="subtle">{phone(o.customer_phone)}</div></td>
                    <td><StatusBadge status={o.status} /></td>
                    <td className="small nowrap">
                      {o.status === 'awaiting_dropoff' && `${t('admin.orders.dropoff')}: ${dateTime(o.dropoff_deadline)}`}
                      {o.status === 'ready_for_pickup' && `${t('admin.orders.pickup')}: ${dateTime(o.pickup_deadline)}`}
                    </td>
                    <td className="num"><Money santim={o.total_santim} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={(p) => update({ page: String(p) })} />}
      </Loader>
    </div>
  );
}
