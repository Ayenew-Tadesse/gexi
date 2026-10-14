import { useT } from '../../i18n/index.jsx';
import { useApi } from '../../lib/useApi.js';
import { birr, dateOnly } from '../../lib/format.js';
import { Badge, Empty, Loader, Money, Stat } from '../../components/ui.jsx';

export default function Earnings() {
  const { t } = useT();
  const { data, error, loading, reload } = useApi('/agent/earnings');
  return (
    <div className="stack-lg">
      <h1>{t('agent.earnings.title')}</h1>
      <Loader loading={loading} error={error} reload={reload}>
        {data && (
          <>
            <div className="stats">
              <Stat label={t('agent.dashboard.due')} value={birr(data.totals.due)} />
              <Stat label={t('agent.dashboard.paid')} value={birr(data.totals.paid)} />
            </div>
            {data.items.length === 0 && <Empty>{t('agent.earnings.none')}</Empty>}
            {data.items.length > 0 && (
              <div className="card card-flush table-wrap">
                <table className="table">
                  <thead><tr><th>{t('common.order')}</th><th>{t('common.item')}</th><th>{t('common.status')}</th><th className="num">{t('agent.orders.commission')}</th></tr></thead>
                  <tbody>
                    {data.items.map((p) => (
                      <tr key={p.id}>
                        <td className="nowrap">{p.order_number}<div className="subtle">{dateOnly(p.created_at)}</div></td>
                        <td>{p.title}</td>
                        <td>
                          <Badge tone={p.status === 'paid' ? 'success' : 'warning'}>{t(`payoutStatus.${p.status}`)}</Badge>
                          {p.reference && <div className="subtle">{p.reference}</div>}
                        </td>
                        <td className="num"><Money santim={p.amount_santim} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </Loader>
    </div>
  );
}
