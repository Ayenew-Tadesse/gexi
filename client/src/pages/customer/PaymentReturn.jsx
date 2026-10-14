// The customer lands here after paying. We ask the server to confirm with the payment provider.
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useT } from '../../i18n/index.jsx';
import { get, post } from '../../lib/api.js';
import { cart } from '../../lib/cart.js';
import { Alert, Button, Card, Spinner } from '../../components/ui.jsx';

export default function PaymentReturn() {
  const { t } = useT();
  const [params] = useSearchParams();
  const txRef = params.get('tx_ref') || params.get('trx_ref');
  const [state, setState] = useState({ status: 'checking', orderId: null, error: null });

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    async function check() {
      attempts++;
      try {
        const res = await get(`/payments/verify/${encodeURIComponent(txRef)}`);
        if (cancelled) return;
        if (res.status === 'success') { cart.clear(); setState({ status: 'success', orderId: res.orderId }); return; }
        if (res.status === 'failed') { setState({ status: 'failed', orderId: res.orderId }); return; }
        if (attempts < 10) setTimeout(check, 3000);
        else setState({ status: 'pending', orderId: res.orderId });
      } catch (error) {
        if (!cancelled) setState({ status: 'error', error });
      }
    }
    if (txRef) check(); else setState({ status: 'error', error: new Error('Missing payment reference.') });
    return () => { cancelled = true; };
  }, [txRef]);

  async function retry() {
    const res = await post(`/orders/${state.orderId}/pay`);
    window.location.assign(res.checkoutUrl);
  }

  return (
    <Card className="stack" >
      {state.status === 'checking' && (<><h1>{t('payment.checking')}</h1><Spinner /></>)}
      {state.status === 'success' && (
        <>
          <h1>✅ {t('payment.success')}</h1>
          <p>{t('payment.successText')}</p>
          <Link className="btn btn-primary" to={`/orders/${state.orderId}`}>{t('payment.viewOrder')}</Link>
        </>
      )}
      {state.status === 'failed' && (
        <>
          <h1>{t('payment.failed')}</h1>
          <p className="muted">{t('payment.failedText')}</p>
          <Button onClick={retry}>{t('payment.tryAgain')}</Button>
        </>
      )}
      {state.status === 'pending' && (
        <>
          <h1>{t('payment.pending')}</h1>
          <p className="muted">{t('payment.pendingText')}</p>
          <Link className="btn btn-secondary" to={`/orders/${state.orderId}`}>{t('payment.viewOrder')}</Link>
        </>
      )}
      {state.status === 'error' && <Alert>{state.error?.message}</Alert>}
    </Card>
  );
}
