import { useState } from 'react';
import { useT } from '../../i18n/index.jsx';
import { useApi } from '../../lib/useApi.js';
import { qs } from '../../lib/api.js';
import { Empty, Input, Loader, Money, Select } from '../../components/ui.jsx';

const REPORTS = ['sales', 'by-agent', 'by-vendor', 'by-category'];
const MONEY = ['sales_santim', 'vendor_santim', 'agent_santim', 'platform_santim'];

function firstColumn(report, row) {
  if (report === 'sales') return row.period;
  if (report === 'by-agent') return row.agent_name;
  if (report === 'by-vendor') return row.vendor_name;
  return row.category;
}

export default function Reports() {
  const { t } = useT();
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const [report, setReport] = useState('sales');
  const [group, setGroup] = useState('day');
  const [from, setFrom] = useState(monthAgo);
  const [to, setTo] = useState(today);
  const query = qs({ from, to, group: report === 'sales' ? group : undefined });
  const { data, error, loading, reload } = useApi(`/admin/reports/${report}${query}`);
  const totals = (data?.items || []).reduce((acc, r) => {
    for (const k of [...MONEY, 'units']) acc[k] = (acc[k] || 0) + r[k];
    return acc;
  }, {});

  return (
    <div className="stack">
      <div className="row-between">
        <h1 style={{ margin: 0 }}>{t('admin.reports.title')}</h1>
        <a className="btn btn-secondary btn-sm" href={`/api/admin/reports/${report}${query}${query ? '&' : '?'}format=csv`}>{t('admin.reports.csv')}</a>
      </div>
      <p className="subtle">{t('admin.reports.explain')}</p>
      <div className="form-grid form-grid-2">
        <Select label={t('admin.reports.type')} value={report} onChange={(e) => setReport(e.target.value)} options={REPORTS.map((r) => ({ value: r, label: t(`admin.reports.types.${r}`) }))} />
        {report === 'sales' && <Select label={t('admin.reports.groupBy')} value={group} onChange={(e) => setGroup(e.target.value)} options={[{ value: 'day', label: t('admin.reports.day') }, { value: 'month', label: t('admin.reports.month') }]} />}
        <Input type="date" label={t('admin.reports.from')} value={from} onChange={(e) => setFrom(e.target.value)} />
        <Input type="date" label={t('admin.reports.to')} value={to} onChange={(e) => setTo(e.target.value)} />
      </div>
      <Loader loading={loading} error={error} reload={reload}>
        {data?.items.length === 0 && <Empty>{t('admin.reports.none')}</Empty>}
        {data?.items.length > 0 && (
          <div className="card card-flush table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t(`admin.reports.first.${report}`)}</th><th className="num">{t('admin.reports.orders')}</th><th className="num">{t('admin.reports.units')}</th>
                  <th className="num">{t('admin.reports.sales')}</th><th className="num">{t('admin.split.vendor')}</th><th className="num">{t('admin.split.agent')}</th><th className="num">{t('admin.split.platform')}</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((r, i) => (
                  <tr key={i}>
                    <td>{firstColumn(report, r)}</td>
                    <td className="num">{r.orders}</td><td className="num">{r.units}</td>
                    {MONEY.map((k) => <td key={k} className="num"><Money santim={r[k]} /></td>)}
                  </tr>
                ))}
                <tr>
                  <td className="bold">{t('cart.total')}</td><td /><td className="num bold">{totals.units}</td>
                  {MONEY.map((k) => <td key={k} className="num bold"><Money santim={totals[k]} /></td>)}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </Loader>
    </div>
  );
}
