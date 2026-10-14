import { Link, useNavigate } from 'react-router';
import { useT } from '../../i18n/index.jsx';
import { cart, useCart } from '../../lib/cart.js';
import { useAuth } from '../../lib/auth.jsx';
import { Button, Card, Empty, Money, ProductImage } from '../../components/ui.jsx';

export default function Cart() {
  const { t, tf } = useT();
  const { lines, total, count } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  if (lines.length === 0) {
    return (
      <Empty>
        <p>{t('cart.empty')}</p>
        <Link className="btn btn-primary" to="/products">{t('cart.startShopping')}</Link>
      </Empty>
    );
  }

  return (
    <div className="split split-wide">
      <div className="stack">
        <h1>{t('cart.title')}</h1>
        <Card>
          <div className="list">
            {lines.map((l) => (
              <div key={l.productId} className="list-item">
                <ProductImage src={l.image} alt="" className="thumb" />
                <div className="grow stack" style={{ gap: 'var(--space-1)' }}>
                  <Link to={`/products/${l.productId}`} className="small">{tf(l, 'title')}</Link>
                  <Money santim={l.price_santim * l.quantity} />
                  <div className="row">
                    <div className="qty">
                      <button type="button" onClick={() => cart.setQuantity(l.productId, l.quantity - 1)} aria-label="−">−</button>
                      <span>{l.quantity}</span>
                      <button type="button" onClick={() => cart.setQuantity(l.productId, l.quantity + 1)} aria-label="+">+</button>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => cart.remove(l.productId)}>{t('cart.remove')}</Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
      <Card title={t('cart.summary')} className="stack">
        <div className="row-between"><span>{t('cart.items', { count })}</span><Money santim={total} /></div>
        <div className="row-between"><span>{t('cart.pickupFee')}</span><span className="bold">{t('cart.free')}</span></div>
        <hr style={{ border: 0, borderTop: '1px solid var(--color-border)', width: '100%' }} />
        <div className="row-between"><span className="bold">{t('cart.total')}</span><Money santim={total} className="price-lg" /></div>
        <Button block onClick={() => navigate(user ? '/checkout' : '/login?next=/checkout')}>{t('cart.checkout')}</Button>
        <p className="subtle">{t('cart.pickupOnly')}</p>
      </Card>
    </div>
  );
}
