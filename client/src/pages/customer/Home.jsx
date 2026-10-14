import { Link } from 'react-router';
import { useT } from '../../i18n/index.jsx';
import { useApi } from '../../lib/useApi.js';
import { Loader, Card } from '../../components/ui.jsx';
import { ProductGrid } from '../../components/ProductCard.jsx';
import CategoryChips from '../../components/CategoryChips.jsx';

export default function Home() {
  const { t } = useT();
  const { data, error, loading, reload } = useApi('/products?pageSize=12');
  return (
    <div className="stack-lg">
      <Card className="hero">
        <h1>{t('home.title')}</h1>
        <p className="muted">{t('home.subtitle')}</p>
        <Link to="/pickup-info" className="small">{t('home.howPickupWorks')} →</Link>
      </Card>
      <CategoryChips buildHref={(slug) => (slug ? `/products?category=${slug}` : '/products')} />
      <section className="stack">
        <div className="row-between">
          <h2>{t('home.newArrivals')}</h2>
          <Link to="/products" className="small">{t('home.seeAll')}</Link>
        </div>
        <Loader loading={loading} error={error} reload={reload}>
          {data && <ProductGrid products={data.items} />}
        </Loader>
      </section>
    </div>
  );
}
