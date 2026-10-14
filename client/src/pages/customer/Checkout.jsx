import { useState } from 'react';
import { Link } from 'react-router';
import { useT } from '../../i18n/index.jsx';
import { cart, useCart } from '../../lib/cart.js';
import { useAuth } from '../../lib/auth.jsx';
import { post } from '../../lib/api.js';
import { useApi } from '../../lib/useApi.js';
import { phone } from '../../lib/format.js';
import { Alert, Button, Card, Empty, ErrorMessage, Money } from '../../components/ui.jsx';

export default function Checkout() {
  const { t, tf } = useT();
  const { lines, total } = useCart();
  const { user } = useAuth();
  const { data: settings } = useApi('/settings/public');
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  async function pay() {
    setBusy(true);
    setError(null);
    setNotice('');
    try {
      const res = await post('/checkout', { items: lines.map((l) => ({ productId: l.productId, quantity: l.quantity })) });
      window.location.assign(res.checkoutUrl);
    } catch (err) {
      setBusy(false);
      if (err.code === 'cart_problem' && Array.isArray(err.details)) {
        // Fix the cart automatically and explain what changed.
        for (const p of err.details) {
          if (p.reason === 'not_enough_stock' && p.available > 0) cart.setQuantity(p.productId, p.available);
          else cart.remove(p.productId);
        }
        setNotice(t('checkout.cartUpdated'));
      } else {
        setError(err);
      }
    }
  }

  if (lines.length === 0) return <Empty><p>{t('cart.empty')}</p><Link to="/products">{t('cart.startShopping')}</Link></Empty>;
  const location = settings?.pickup_location;

  return (
    <div className="stack-lg" style={{ maxWidth: 560, margin: '0 auto' }}>
      <h1>{t('checkout.title')}</h1>
      <Alert tone="warning">{notice}</Alert>
      <Card title={t('checkout.items')}>
        <div className="list">
          {lines.map((l) => (
            <div key={l.productId} className="list-item">
              <span className="grow small">{l.quantity} × {tf(l, 'title')}</span>
              <Money santim={l.price_santim * l.quantity} />
            </div>
          ))}
        </div>
      </Card>
      <Card title={t('checkout.pickup')}>
        {location && (
          <div className="stack" style={{ gap: 'var(--space-1)' }}>
            <span className="bold">{location.name}</span>
            <span className="small">{location.address}</span>
            <span className="small muted">{location.hours}</span>
          </div>
        )}
        <p className="small muted" style={{ marginTop: 'var(--space-3)' }}>
          {t('checkout.smsNote', { phone: phone(user?.phone) })}
        </p>
      </Card>
      <ErrorMessage error={error} />
      <div className="row-between">
        <span className="bold">{t('cart.total')}</span>
        <Money santim={total} className="price-lg" />
      </div>
      <Button block onClick={pay} loading={busy}>{t('checkout.payNow')}</Button>
      <p className="subtle" style={{ textAlign: 'center' }}>{t('checkout.methods')}</p>
    </div>
  );
}
