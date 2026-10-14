import { useState } from 'react';
import { useT } from '../../i18n/index.jsx';
import { useApi } from '../../lib/useApi.js';
import { qs } from '../../lib/api.js';
import { dateTime, phone } from '../../lib/format.js';
import { Badge, Empty, Loader, Pager } from '../../components/ui.jsx';

export default function SmsLog() {
  const { t } = useT();
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useApi(`/admin/sms-log${qs({ phone: search, page })}`);
  return (
    <div className="stack">
      <h1>{t('admin.sms.title')}</h1>
      <p className="subtle">{t('admin.sms.explain')}</p>
      <form className="row" onSubmit={(e) => { e.preventDefault(); setSearch(q); setPage(1); }}>
        <input className="input grow" type="search" placeholder={t('admin.sms.search')} value={q} onChange={(e) => setQ(e.target.value)} />
      </form>
      <Loader loading={loading} error={error} reload={reload}>
        {data?.items.length === 0 && <Empty>{t('common.none')}</Empty>}
        {data?.items.map((s) => (
          <div key={s.id} className="card">
            <div className="row-between small">
              <span className="bold">{phone(s.to_phone)}</span>
              <span className="row"><Badge>{s.template}</Badge><Badge tone={s.status === 'sent' ? 'success' : 'danger'}>{s.status}</Badge></span>
            </div>
            <p className="small" style={{ margin: 'var(--space-2) 0' }}>{s.message}</p>
            <div className="subtle">{dateTime(s.created_at)} · {s.provider}{s.error && ` · ${s.error}`}</div>
          </div>
        ))}
        {data && <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />}
      </Loader>
    </div>
  );
}
