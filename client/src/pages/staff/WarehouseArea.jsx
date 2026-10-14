// Warehouse screen: drop-offs to check, orders to pack, packed orders to send to the pickup point, returns.
import { useCallback, useState } from 'react';
import { Routes, Route } from 'react-router';
import { useT } from '../../i18n/index.jsx';
import { useApi } from '../../lib/useApi.js';
import { post } from '../../lib/api.js';
import { dateTime, phone, relative } from '../../lib/format.js';
import StaffLayout from '../../components/StaffLayout.jsx';
import { Alert, Badge, Button, Card, Empty, ErrorMessage, Loader, Modal, ProductImage, Tabs, Textarea } from '../../components/ui.jsx';

export default function WarehouseArea() {
  const { t } = useT();
  return (
    <Routes>
      <Route element={<StaffLayout links={[{ to: '/warehouse', label: t('roles.warehouse'), end: true }]} title={t('roles.warehouse')} />}>
        <Route index element={<Warehouse />} />
      </Route>
    </Routes>
  );
}

function Warehouse() {
  const { t } = useT();
  const [tab, setTab] = useState('dropoff');
  const summary = useApi('/warehouse/summary');
  const [message, setMessage] = useState('');
  const onDone = useCallback((msg) => { setMessage(msg); summary.reload(); }, [summary]);

  return (
    <div className="stack">
      <h1>{t('warehouse.title')}</h1>
      <Tabs value={tab} onChange={(v) => { setTab(v); setMessage(''); }} tabs={[
        { value: 'dropoff', label: t('warehouse.tabs.dropoff'), count: summary.data?.awaiting },
        { value: 'pack', label: t('warehouse.tabs.pack'), count: summary.data?.toPack },
        { value: 'packed', label: t('warehouse.tabs.packed'), count: summary.data?.packed },
        { value: 'returns', label: t('warehouse.tabs.returns'), count: summary.data?.returns },
      ]} />
      <Alert tone="success">{message}</Alert>
      {tab === 'dropoff' && <Dropoff onDone={onDone} />}
      {tab === 'pack' && <OrderStage path="/warehouse/ready-to-pack" action="pack" onDone={onDone} />}
      {tab === 'packed' && <OrderStage path="/warehouse/packed" action="send-to-pickup" onDone={onDone} />}
      {tab === 'returns' && <Returns onDone={onDone} />}
    </div>
  );
}

const REJECT_REASONS = ['damaged', 'wrongItem', 'poorQuality', 'notAsDescribed'];

function Dropoff({ onDone }) {
  const { t } = useT();
  const { data, error, loading, reload } = useApi('/warehouse/awaiting-dropoff');
  const [rejecting, setRejecting] = useState(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(null);
  const [actionError, setActionError] = useState(null);

  async function act(item, kind, body) {
    setBusy(item.id);
    setActionError(null);
    try {
      await post(`/warehouse/items/${item.id}/${kind}`, body);
      onDone(kind === 'receive' ? t('warehouse.received', { item: item.title }) : t('warehouse.rejected', { item: item.title }));
      setRejecting(null);
      setReason('');
      reload();
    } catch (err) { setActionError(err); }
    setBusy(null);
  }

  // Group items by vendor: the vendor brings everything at once.
  const groups = [];
  for (const item of data?.items || []) {
    let g = groups.find((x) => x.vendor_id === item.vendor_id);
    if (!g) groups.push(g = { vendor_id: item.vendor_id, vendor_name: item.vendor_name, vendor_phone: item.vendor_phone, vendor_location: item.vendor_location, items: [] });
    g.items.push(item);
  }

  return (
    <Loader loading={loading} error={error} reload={reload}>
      <ErrorMessage error={actionError} />
      {data && groups.length === 0 && <Empty>{t('warehouse.noDropoffs')}</Empty>}
      {groups.map((g) => (
        <Card key={g.vendor_id} title={g.vendor_name} actions={<a className="small" href={`tel:${g.vendor_phone}`}>{phone(g.vendor_phone)}</a>}>
          {g.vendor_location && <p className="subtle">{g.vendor_location}</p>}
          <div className="list">
            {g.items.map((item) => {
              const hoursLeft = (new Date(item.dropoff_deadline) - Date.now()) / 3_600_000;
              return (
                <div key={item.id} className="list-item" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                  <div className="row" style={{ flexWrap: 'nowrap' }}>
                    <ProductImage src={item.image_url} alt="" className="thumb" />
                    <div className="grow">
                      <div className="bold small">{item.quantity} × {item.title}</div>
                      <div className="subtle">{item.order_number}</div>
                      <Badge tone={hoursLeft < 6 ? 'danger' : 'warning'}>{t('warehouse.due', { when: relative(item.dropoff_deadline) })}</Badge>
                    </div>
                  </div>
                  <div className="row" style={{ flexWrap: 'nowrap' }}>
                    <Button className="grow" loading={busy === item.id} onClick={() => act(item, 'receive')}>{t('warehouse.markReceived')}</Button>
                    <Button className="grow" variant="secondary" disabled={busy === item.id} onClick={() => setRejecting(item)}>{t('warehouse.reject')}</Button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      ))}
      <Modal open={Boolean(rejecting)} onClose={() => setRejecting(null)} title={t('warehouse.rejectTitle', { item: rejecting?.title || '' })}>
        <p className="small muted">{t('warehouse.rejectExplain')}</p>
        <div className="chips" style={{ flexWrap: 'wrap' }}>
          {REJECT_REASONS.map((r) => (
            <button key={r} type="button" className={`chip ${reason === t(`warehouse.reasons.${r}`) ? 'active' : ''}`} onClick={() => setReason(t(`warehouse.reasons.${r}`))}>
              {t(`warehouse.reasons.${r}`)}
            </button>
          ))}
        </div>
        <Textarea label={t('warehouse.reason')} value={reason} onChange={(e) => setReason(e.target.value)} />
        <ErrorMessage error={actionError} />
        <Button variant="danger" loading={busy === rejecting?.id} disabled={reason.trim().length < 3} onClick={() => act(rejecting, 'reject', { reason })}>
          {t('warehouse.confirmReject')}
        </Button>
      </Modal>
    </Loader>
  );
}

function OrderStage({ path, action, onDone }) {
  const { t } = useT();
  const { data, error, loading, reload } = useApi(path);
  const [busy, setBusy] = useState(null);
  const [actionError, setActionError] = useState(null);

  async function act(order) {
    setBusy(order.id);
    setActionError(null);
    try {
      await post(`/warehouse/orders/${order.id}/${action}`);
      onDone(action === 'pack' ? t('warehouse.packedMsg', { order: order.order_number }) : t('warehouse.sentMsg', { order: order.order_number }));
      reload();
    } catch (err) { setActionError(err); }
    setBusy(null);
  }

  return (
    <Loader loading={loading} error={error} reload={reload}>
      <ErrorMessage error={actionError} />
      {data?.items.length === 0 && <Empty>{t('warehouse.nothingHere')}</Empty>}
      {data?.items.map((o) => (
        <Card key={o.id} title={o.order_number} actions={<span className="subtle">{dateTime(o.updated_at)}</span>}>
          <ul className="small" style={{ margin: '0 0 var(--space-3)', paddingLeft: 'var(--space-5)' }}>
            {o.items.map((i) => <li key={i.id}>{i.quantity} × {i.title} <span className="subtle">({i.vendor_name})</span></li>)}
          </ul>
          {action === 'pack' && <p className="subtle">{t('warehouse.labelHint', { order: o.order_number })}</p>}
          <Button block loading={busy === o.id} onClick={() => act(o)}>
            {action === 'pack' ? t('warehouse.markPacked') : t('warehouse.sendToPickup')}
          </Button>
        </Card>
      ))}
    </Loader>
  );
}

function Returns({ onDone }) {
  const { t } = useT();
  const { data, error, loading, reload } = useApi('/warehouse/returns');
  const [busy, setBusy] = useState(null);
  return (
    <Loader loading={loading} error={error} reload={reload}>
      <p className="subtle">{t('warehouse.returnsExplain')}</p>
      {data?.items.length === 0 && <Empty>{t('warehouse.nothingHere')}</Empty>}
      {data?.items.map((i) => (
        <Card key={i.id}>
          <div className="row-between">
            <div>
              <div className="bold small">{i.quantity} × {i.title}</div>
              <div className="subtle">{i.order_number} · {i.vendor_name} · {phone(i.vendor_phone)}</div>
            </div>
            <Button size="sm" loading={busy === i.id} onClick={async () => {
              setBusy(i.id);
              await post(`/warehouse/items/${i.id}/returned`).catch(() => {});
              setBusy(null);
              onDone(t('warehouse.returnedMsg', { item: i.title }));
              reload();
            }}>{t('warehouse.markReturned')}</Button>
          </div>
        </Card>
      ))}
    </Loader>
  );
}
