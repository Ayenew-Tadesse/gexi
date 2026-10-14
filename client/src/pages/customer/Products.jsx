import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useT } from '../../i18n/index.jsx';
import { get, qs } from '../../lib/api.js';
import { Button, Loader, Empty } from '../../components/ui.jsx';
import { ProductGrid } from '../../components/ProductCard.jsx';
import CategoryChips from '../../components/CategoryChips.jsx';

export default function Products() {
  const { t } = useT();
  const [params, setParams] = useSearchParams();
  const q = params.get('q') || '';
  const category = params.get('category') || '';
  const sort = params.get('sort') || '';
  const [state, setState] = useState({ items: [], page: 0, total: 0, loading: true, error: null });

  async function load(page) {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const res = await get(`/products${qs({ q, category, sort, page, pageSize: 20 })}`);
      setState((s) => ({ items: page === 1 ? res.items : [...s.items, ...res.items], page, total: res.total, loading: false, error: null }));
    } catch (error) {
      setState((s) => ({ ...s, loading: false, error }));
    }
  }

  useEffect(() => { load(1); }, [q, category, sort]); // eslint-disable-line react-hooks/exhaustive-deps

  const href = (slug) => `/products${qs({ q, category: slug, sort })}`;
  const setSort = (value) => {
    const next = new URLSearchParams(params);
    if (value) next.set('sort', value); else next.delete('sort');
    setParams(next);
  };

  return (
    <div className="stack">
      <div className="row-between">
        <h1 style={{ margin: 0 }}>{q ? t('shop.resultsFor', { q }) : t('shop.title')}</h1>
        <select className="select" style={{ width: 'auto', minHeight: 36 }} value={sort} onChange={(e) => setSort(e.target.value)} aria-label={t('shop.sort')}>
          <option value="">{t('shop.sortNewest')}</option>
          <option value="price_asc">{t('shop.sortPriceLow')}</option>
          <option value="price_desc">{t('shop.sortPriceHigh')}</option>
        </select>
      </div>
      <CategoryChips active={category} buildHref={href} />
      {!state.loading && !state.error && state.items.length === 0 && <Empty>{t('shop.noResults')}</Empty>}
      {state.items.length > 0 && <ProductGrid products={state.items} />}
      <Loader loading={state.loading} error={state.error} reload={() => load(state.page || 1)}>
        {state.items.length < state.total && (
          <Button variant="secondary" block onClick={() => load(state.page + 1)}>{t('shop.loadMore')}</Button>
        )}
      </Loader>
    </div>
  );
}
