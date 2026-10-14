import { Link } from 'react-router';
import { useT } from '../i18n/index.jsx';
import { Money, ProductImage } from './ui.jsx';

export default function ProductCard({ product, eager }) {
  const { t, tf } = useT();
  const title = tf(product, 'title');
  return (
    <Link to={`/products/${product.id}`} className="product-card">
      <ProductImage src={product.image_small} srcSet={product.image_medium ? `${product.image_small} 320w, ${product.image_medium} 640w` : undefined}
        sizes="(min-width: 900px) 240px, 50vw" alt={title} eager={eager} />
      <div className="product-card-body">
        <span className="product-card-title">{title}</span>
        <Money santim={product.price_santim} />
        {product.stock_qty <= 0 && <span className="subtle">{t('shop.soldOut')}</span>}
      </div>
    </Link>
  );
}

export function ProductGrid({ products }) {
  return (
    <div className="product-grid">
      {products.map((p, i) => <ProductCard key={p.id} product={p} eager={i < 4} />)}
    </div>
  );
}
