// Admin views of agents, vendors and products.
import { useState } from 'react';
import { Link } from 'react-router';
import { useT } from '../../i18n/index.jsx';
import { useApi } from '../../lib/useApi.js';
import { patch, qs } from '../../lib/api.js';
import { phone } from '../../lib/format.js';
import { Badge, Button, Checkbox, Empty, ErrorMessage, Loader, Modal, Money, Pager, ProductImage, Select } from '../../components/ui.jsx';

export function Agents() {
  const { t } = useT();
  const { data, error, loading, reload } = useApi('/admin/agents');
  return (
    <div className="stack">
      <div className="row-between">
        <h1 style={{ margin: 0 }}>{t('admin.agents.title')}</h1>
        <Link className="btn btn-secondary btn-sm" to="/admin/users">{t('admin.agents.manage')}</Link>
      </div>
      <Loader loading={loading} error={error} reload={reload}>
        {data?.items.length === 0 && <Empty>{t('common.none')}</Empty>}
        {data?.items.length > 0 && (
          <div className="card card-flush table-wrap">
            <table className="table">
              <thead><tr><th>{t('auth.name')}</th><th className="num">{t('admin.agents.vendors')}</th><th className="num">{t('admin.agents.products')}</th><th className="num">{t('admin.agents.commission')}</th><th className="num">{t('agent.dashboard.due')}</th><th className="num">{t('agent.dashboard.paid')}</th></tr></thead>
              <tbody>
                {data.items.map((a) => (
                  <tr key={a.id}>
                    <td>{a.name} {!a.is_active && <Badge tone="danger">{t('common.inactive')}</Badge>}<div className="subtle">{phone(a.phone)}</div></td>
                    <td className="num"><Link to={`/admin/vendors?agent_id=${a.id}`}>{a.vendor_count}</Link></td>
                    <td className="num">{a.active_products}</td>
                    <td className="num">{a.commission_pct === null ? t('admin.agents.default') : `${Number(a.commission_pct)}%`}</td>
                    <td className="num"><Money santim={a.due_santim} /></td>
                    <td className="num"><Money santim={a.paid_santim} /></td>
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

export function Vendors() {
  const { t } = useT();
  const agentId = new URLSearchParams(window.location.search).get('agent_id') || '';
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useApi(`/admin/vendors${qs({ q: search, agent_id: agentId, page })}`);
  const { data: agents } = useApi('/admin/agents');
  const [editing, setEditing] = useState(null);
  const [saveError, setSaveError] = useState(null);

  async function save() {
    setSaveError(null);
    try {
      await patch(`/admin/vendors/${editing.id}`, { is_active: editing.is_active, agent_id: Number(editing.agent_id) });
      setEditing(null);
      reload();
    } catch (err) { setSaveError(err); }
  }

  return (
    <div className="stack">
      <h1>{t('admin.vendors.title')}</h1>
      <form className="row" onSubmit={(e) => { e.preventDefault(); setSearch(q); setPage(1); }}>
        <input className="input grow" type="search" placeholder={t('admin.vendors.search')} value={q} onChange={(e) => setQ(e.target.value)} />
      </form>
      <Loader loading={loading} error={error} reload={reload}>
        {data?.items.length === 0 && <Empty>{t('common.none')}</Empty>}
        {data?.items.length > 0 && (
          <div className="card card-flush table-wrap">
            <table className="table">
              <thead><tr><th>{t('agent.vendors.name')}</th><th>{t('roles.agent')}</th><th>{t('agent.vendors.payoutMethod')}</th><th className="num">{t('admin.agents.products')}</th><th /></tr></thead>
              <tbody>
                {data.items.map((v) => (
                  <tr key={v.id}>
                    <td>{v.name} {!v.is_active && <Badge tone="danger">{t('common.inactive')}</Badge>}<div className="subtle">{phone(v.phone)} · {v.location_description}</div></td>
                    <td>{v.agent_name}</td>
                    <td className="small">{v.payout_method || '—'}<div className="subtle">{v.payout_account}</div></td>
                    <td className="num">{v.product_count}</td>
                    <td><Button size="sm" variant="ghost" onClick={() => setEditing({ ...v, agent_id: String(v.agent_id) })}>{t('common.edit')}</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />}
      </Loader>
      {editing && (
        <Modal open onClose={() => setEditing(null)} title={editing.name}>
          <Select label={t('admin.vendors.agent')} value={editing.agent_id} onChange={(e) => setEditing({ ...editing, agent_id: e.target.value })}
            options={(agents?.items || []).map((a) => ({ value: String(a.id), label: a.name }))} hint={t('admin.vendors.agentHint')} />
          <Checkbox label={t('agent.vendors.active')} checked={editing.is_active} onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} />
          <ErrorMessage error={saveError} />
          <Button onClick={save}>{t('common.save')}</Button>
        </Modal>
      )}
    </div>
  );
}

export function AdminProducts() {
  const { t } = useT();
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useApi(`/admin/products${qs({ q: search, status, page })}`);
  const [actionError, setActionError] = useState(null);

  async function setProductStatus(id, value) {
    setActionError(null);
    try { await patch(`/admin/products/${id}`, { status: value }); reload(); } catch (err) { setActionError(err); }
  }

  return (
    <div className="stack">
      <h1>{t('admin.products.title')}</h1>
      <form className="row" onSubmit={(e) => { e.preventDefault(); setSearch(q); setPage(1); }}>
        <input className="input grow" type="search" placeholder={t('admin.products.search')} value={q} onChange={(e) => setQ(e.target.value)} style={{ minWidth: 200 }} />
        <select className="select" style={{ width: 'auto' }} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label={t('common.status')}>
          <option value="">{t('agent.products.allStatuses')}</option>
          {['active', 'draft', 'hidden'].map((s) => <option key={s} value={s}>{t(`productStatus.${s}`)}</option>)}
        </select>
      </form>
      <ErrorMessage error={actionError} />
      <Loader loading={loading} error={error} reload={reload}>
        {data?.items.length === 0 && <Empty>{t('common.none')}</Empty>}
        {data?.items.length > 0 && (
          <div className="card card-flush table-wrap">
            <table className="table">
              <thead><tr><th /><th>{t('common.item')}</th><th>{t('agent.products.vendor')}</th><th className="num">{t('agent.products.price')}</th><th className="num">{t('agent.products.stockQty')}</th><th>{t('common.status')}</th></tr></thead>
              <tbody>
                {data.items.map((p) => (
                  <tr key={p.id}>
                    <td><ProductImage src={p.image_small} alt="" className="thumb" /></td>
                    <td>{p.title_en}</td>
                    <td>{p.vendor_name}<div className="subtle">{p.agent_name}</div></td>
                    <td className="num"><Money santim={p.price_santim} /></td>
                    <td className="num">{p.stock_qty}</td>
                    <td>
                      <select className="select" style={{ minHeight: 34, width: 'auto' }} value={p.status} onChange={(e) => setProductStatus(p.id, e.target.value)} aria-label={t('common.status')}>
                        {['active', 'draft', 'hidden'].map((s) => <option key={s} value={s}>{t(`productStatus.${s}`)}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />}
      </Loader>
    </div>
  );
}
