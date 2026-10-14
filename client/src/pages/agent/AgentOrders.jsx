import { useT } from '../../i18n/index.jsx';
import { useApi } from '../../lib/useApi.js';
import { dateTime } from '../../lib/format.js';
import { Empty, Loader, Money, StatusBadge } from '../../components/ui.jsx';

export default function AgentOrders() {
  const { t } = useT();
  const { data, error, loading, reload } = useApi('/agent/orders');
  return (
    <div className="stack">
      <h1>{t('agent.orders.title')}</h1>
      <p className="subtle">{t('agent.orders.explain')}</p>
      <Loader loading={loading} error={error} reload={reload}>
        {data?.items.length === 0 && <Empty>{t('agent.orders.none')}</Empty>}
        {data?.items.length > 0 && (
          <div className="card card-flush table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('common.order')}</th><th>{t('common.item')}</th><th>{t('agent.products.vendor')}</th>
                  <th>{t('common.status')}</th><th className="num">{t('common.amount')}</th><th className="num">{t('agent.orders.commission')}</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((i) => (
                  <tr key={i.id}>
                    <td className="nowrap">{i.order_number}<div className="subtle">{dateTime(i.paid_at)}</div></td>
                    <td>{i.quantity} × {i.title}</td>
                    <td>{i.vendor_name}</td>
                    <td><StatusBadge status={i.order_status} /><div><StatusBadge kind="item" status={i.item_status} /></div></td>
                    <td className="num"><Money santim={i.line_total_santim} /></td>
                    <td className="num"><Money santim={i.agent_commission_santim} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Loader>
    </div>
  );
}
