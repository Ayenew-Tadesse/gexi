import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { useT } from '../../i18n/index.jsx';
import { useApi } from '../../lib/useApi.js';
import { cart, useCart } from '../../lib/cart.js';
import { Button, Loader, Money, Alert, Badge } from '../../components/ui.jsx';

export default function ProductDetail() {
  const { id } = useParams();
  const { t, tf } = useT();
  const { data, error, loading, reload } = useApi(`/products/${id}`);
  const { lines } = useCart();
  const [qty, setQty] = useState(1);
  const [imageIndex, setImageIndex] = useState(0);
  const [added, setAdded] = useState(false);

  const product = data?.product;
  const inCart = product && lines.find((l) => l.productId === product.id)?.quantity;
  const image = product?.images?.[imageIndex];
  const title = product ? tf(product, 'title') : '';
  const description = product ? tf(product, 'description') : '';

  return (
    <Loader loading={loading} error={error} reload={reload}>
      {product && (
        <div className="split">
          <div className="stack">
            {image ? (
              <img src={image.medium_url} srcSet={`${image.medium_url} 640w, ${image.large_url} 1200w`} sizes="(min-width: 800px) 500px, 100vw"
                alt={title} width="640" height="640" style={{ width: '100%', height: 'auto', aspectRatio: '1 / 1', objectFit: 'cover', borderRadius: 'var(--radius-lg)', background: 'var(--color-surface-muted)' }} />
            ) : <div className="img-placeholder" style={{ borderRadius: 'var(--radius-lg)' }} />}
            {product.images.length > 1 && (
              <div className="image-row">
                {product.images.map((img, i) => (
                  <button key={img.id} type="button" onClick={() => setImageIndex(i)} aria-label={`${t('shop.photo')} ${i + 1}`}
                    style={{ padding: 0, border: i === imageIndex ? '2px solid var(--color-primary)' : '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', background: 'none', cursor: 'pointer' }}>
                    <img src={img.small_url} alt="" className="thumb" loading="lazy" />
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="stack">
            {product.category_slug && <Link to={`/products?category=${product.category_slug}`} className="small">{tf(product, 'category_name')}</Link>}
            <h1>{title}</h1>
            <Money santim={product.price_santim} className="price-lg" />
            {product.stock_qty > 0
              ? <Badge tone="success">{product.stock_qty <= 5 ? t('shop.onlyLeft', { count: product.stock_qty }) : t('shop.inStock')}</Badge>
              : <Badge tone="danger">{t('shop.soldOut')}</Badge>}
            {product.stock_qty > 0 && (
              <div className="row">
                <div className="qty" aria-label={t('cart.quantity')}>
                  <button type="button" onClick={() => setQty(Math.max(1, qty - 1))} aria-label="−">−</button>
                  <span>{qty}</span>
                  <button type="button" onClick={() => setQty(Math.min(product.stock_qty, qty + 1))} aria-label="+">+</button>
                </div>
                <Button className="grow" onClick={() => { cart.add(product, qty); setAdded(true); }}>{t('shop.addToCart')}</Button>
              </div>
            )}
            {added && (
              <Alert tone="success">
                {t('shop.added')} · <Link to="/cart">{t('shop.goToCart')}{inCart ? ` (${inCart})` : ''}</Link>
              </Alert>
            )}
            <p className="small muted">📍 {t('shop.pickupOnlyNote')} <Link to="/pickup-info">{t('shop.where')}</Link></p>
            {description && <div><h2>{t('shop.description')}</h2><p style={{ whiteSpace: 'pre-line' }}>{description}</p></div>}
          </div>
        </div>
      )}
    </Loader>
  );
}
