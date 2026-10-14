import { useT } from '../../i18n/index.jsx';
import { useApi } from '../../lib/useApi.js';
import { Card, Loader } from '../../components/ui.jsx';

export default function PickupInfo() {
  const { t } = useT();
  const { data, error, loading, reload } = useApi('/settings/public');
  const loc = data?.pickup_location;
  return (
    <div className="stack-lg" style={{ maxWidth: 640, margin: '0 auto' }}>
      <h1>{t('pickupInfo.title')}</h1>
      <Loader loading={loading} error={error} reload={reload}>
        {loc && (
          <Card className="stack">
            <h2>{loc.name}</h2>
            <p>{loc.address}</p>
            <p className="muted">{loc.hours}</p>
            {loc.map_url && <a className="btn btn-secondary" href={loc.map_url} target="_blank" rel="noreferrer">{t('pickupInfo.openMap')}</a>}
          </Card>
        )}
      </Loader>
      <Card title={t('pickupInfo.howTitle')}>
        <ol className="stack small" style={{ paddingLeft: 'var(--space-5)', margin: 0 }}>
          <li>{t('pickupInfo.step1')}</li>
          <li>{t('pickupInfo.step2')}</li>
          <li>{t('pickupInfo.step3')}</li>
          <li>{t('pickupInfo.step4', { days: data?.pickup_window_days ?? 7 })}</li>
        </ol>
      </Card>
    </div>
  );
}
