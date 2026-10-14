import { Link } from 'react-router';
import { useT } from '../../i18n/index.jsx';
import { useApi } from '../../lib/useApi.js';
import { phone } from '../../lib/format.js';
import { Badge, Empty, Loader } from '../../components/ui.jsx';

export default function Vendors() {
  const { t } = useT();
  const { data, error, loading, reload } = useApi('/agent/vendors');
  return (
    <div className="stack">
      <div className="row-between">
        <h1 style={{ margin: 0 }}>{t('agent.vendors.title')}</h1>
        <Link className="btn btn-primary btn-sm" to="/agent/vendors/new">{t('agent.vendors.add')}</Link>
      </div>
      <Loader loading={loading} error={error} reload={reload}>
        {data?.items.length === 0 && <Empty>{t('agent.vendors.none')}</Empty>}
        {data?.items.map((v) => (
          <Link key={v.id} to={`/agent/vendors/${v.id}`} className="card card-link">
            <div className="row-between">
              <span className="bold">{v.name}</span>
              {!v.is_active && <Badge tone="danger">{t('common.inactive')}</Badge>}
            </div>
            <div className="subtle">{phone(v.phone)} · {v.location_description}</div>
            <div className="subtle">{t('agent.vendors.productCount', { count: v.product_count })}</div>
          </Link>
        ))}
      </Loader>
    </div>
  );
}
