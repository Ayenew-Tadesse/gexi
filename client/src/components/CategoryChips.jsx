import { Link } from 'react-router';
import { useT } from '../i18n/index.jsx';
import { useApi } from '../lib/useApi.js';

export default function CategoryChips({ active, buildHref }) {
  const { t, tf } = useT();
  const { data } = useApi('/categories');
  return (
    <div className="chips" role="list">
      <Link role="listitem" className={`chip ${!active ? 'active' : ''}`} to={buildHref('')}>{t('shop.all')}</Link>
      {(data?.items || []).map((c) => (
        <Link role="listitem" key={c.id} className={`chip ${active === c.slug ? 'active' : ''}`} to={buildHref(c.slug)}>{tf(c, 'name')}</Link>
      ))}
    </div>
  );
}
