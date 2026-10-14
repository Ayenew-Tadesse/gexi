import { Link } from 'react-router';
import { useT } from '../../i18n/index.jsx';
import { useApi } from '../../lib/useApi.js';
import { birr } from '../../lib/format.js';
import { Card, Loader, Stat } from '../../components/ui.jsx';

export default function Dashboard() {
  const { t } = useT();
  const { data, error, loading, reload } = useApi('/agent/dashboard');
  return (
    <div className="stack-lg">
      <h1>{t('agent.dashboard.title')}</h1>
      <Loader loading={loading} error={error} reload={reload}>
        {data && (
          <>
            <div className="stats">
              <Stat label={t('agent.dashboard.vendors')} value={data.vendors} />
              <Stat label={t('agent.dashboard.activeProducts')} value={data.activeProducts} />
              <Stat label={t('agent.dashboard.ordersThisMonth')} value={data.ordersThisMonth} />
              <Stat label={t('agent.dashboard.commissionDue')} value={birr(data.commission.due)} />
            </div>
            <Card title={t('agent.dashboard.commission')}>
              <div className="stack small">
                <div className="row-between"><span>{t('agent.dashboard.pending')}</span><span className="bold">{birr(data.commission.pending)}</span></div>
                <div className="row-between"><span>{t('agent.dashboard.due')}</span><span className="bold">{birr(data.commission.due)}</span></div>
                <div className="row-between"><span>{t('agent.dashboard.paid')}</span><span className="bold">{birr(data.commission.paid)}</span></div>
                <p className="subtle">{t('agent.dashboard.explain')}</p>
              </div>
            </Card>
            <div className="row">
              <Link className="btn btn-primary" to="/agent/products/new">{t('agent.products.add')}</Link>
              <Link className="btn btn-secondary" to="/agent/vendors/new">{t('agent.vendors.add')}</Link>
            </div>
          </>
        )}
      </Loader>
    </div>
  );
}
