import { Link, useSearchParams } from 'react-router';
import { useT } from '../../i18n/index.jsx';
import { useApi } from '../../lib/useApi.js';
import { qs } from '../../lib/api.js';
import { Badge, Empty, Loader, Money, ProductImage } from '../../components/ui.jsx';

const STATUS_TONE = { active: 'success', draft: 'warning', hidden: 'neutral' };

export default function Products() {
  const { t } = useT();
  const [params, setParams] = useSearchParams();
  const vendor = params.get('vendor') || '';
  const status = params.get('status') || '';
  const { data: vendors } = useApi('/agent/vendors');
  const { data, error, loading, reload } = useApi(`/agent/products${qs({ vendor_id: vendor, status })}`);
  const setFilter = (k, v) => { const next = new URLSearchParams(params); if (v) next.set(k, v); else next.delete(k); setParams(next); };

  return (
    <div className="stack">
      <div className="row-between">
        <h1 style={{ margin: 0 }}>{t('agent.products.title')}</h1>
        <Link className="btn btn-primary btn-sm" to={`/agent/products/new${vendor ? `?vendor=${vendor}` : ''}`}>{t('agent.products.add')}</Link>
      </div>
      <div className="row">
        <select className="select" style={{ width: 'auto' }} value={vendor} onChange={(e) => setFilter('vendor', e.target.value)} aria-label={t('agent.products.vendor')}>
          <option value="">{t('agent.products.allVendors')}</option>
          {vendors?.items.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
        <select className="select" style={{ width: 'auto' }} value={status} onChange={(e) => setFilter('status', e.target.value)} aria-label={t('agent.products.status')}>
          <option value="">{t('agent.products.allStatuses')}</option>
          {['active', 'draft', 'hidden'].map((s) => <option key={s} value={s}>{t(`productStatus.${s}`)}</option>)}
        </select>
      </div>
      <Loader loading={loading} error={error} reload={reload}>
        {data?.items.length === 0 && <Empty>{t('agent.products.none')}</Empty>}
        <div className="card card-flush">
          <div className="list" style={{ padding: '0 var(--space-4)' }}>
            {data?.items.map((p) => (
              <Link key={p.id} to={`/agent/products/${p.id}`} className="list-item" style={{ color: 'inherit' }}>
                <ProductImage src={p.image_small} alt="" className="thumb" />
                <div className="grow">
                  <div className="small bold">{p.title_en}</div>
                  <div className="subtle">{p.vendor_name} · {t('agent.products.stock', { count: p.stock_qty })}</div>
                </div>
                <div className="stack right" style={{ gap: 4, alignItems: 'flex-end' }}>
                  <Money santim={p.price_santim} />
                  <Badge tone={STATUS_TONE[p.status]}>{t(`productStatus.${p.status}`)}</Badge>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </Loader>
    </div>
  );
}
