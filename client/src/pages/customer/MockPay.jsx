// FAKE payment screen used in development instead of Chapa (PAYMENT_PROVIDER=mock).
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { useT } from '../../i18n/index.jsx';
import { post } from '../../lib/api.js';
import { useApi } from '../../lib/useApi.js';
import { Alert, Button, Card, ErrorMessage, Loader, Money } from '../../components/ui.jsx';

export default function MockPay() {
  const { t } = useT();
  const [params] = useSearchParams();
  const txRef = params.get('tx_ref');
  const { data, error, loading } = useApi(`/payments/mock/${encodeURIComponent(txRef)}`);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  async function finish(outcome) {
    setBusy(true);
    try {
      await post('/payments/mock/complete', { tx_ref: txRef, outcome });
      window.location.assign(`/checkout/return?tx_ref=${encodeURIComponent(txRef)}`);
    } catch (e) {
      setErr(e);
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: '0 auto' }} className="stack-lg">
      <Alert tone="warning">{t('mockPay.notice')}</Alert>
      <Loader loading={loading} error={error}>
        {data && (
          <Card className="stack">
            <h1>{t('mockPay.title')}</h1>
            <div className="row-between"><span>{data.order_number}</span><Money santim={data.amount_santim} className="price-lg" /></div>
            <ErrorMessage error={err} />
            <Button block loading={busy} onClick={() => finish('success')}>{t('mockPay.pay')}</Button>
            <Button block variant="secondary" disabled={busy} onClick={() => finish('failed')}>{t('mockPay.fail')}</Button>
          </Card>
        )}
      </Loader>
    </div>
  );
}
