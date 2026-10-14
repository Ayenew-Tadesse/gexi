import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { useT } from '../../i18n/index.jsx';
import { api, del, get, patch, post } from '../../lib/api.js';
import { useApi } from '../../lib/useApi.js';
import { toSantim } from '../../lib/format.js';
import { Alert, Button, Card, ErrorMessage, Input, Select, Spinner, Textarea, fieldErrors } from '../../components/ui.jsx';

export default function ProductForm() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const { t, tf } = useT();
  const navigate = useNavigate();
  const { data: vendors } = useApi('/agent/vendors');
  const { data: categories } = useApi('/categories');
  const [form, setForm] = useState(id ? null : {
    vendor_id: params.get('vendor') || '', category_id: '', title_en: '', title_am: '', description_en: '', description_am: '',
    price: '', stock_qty: '1', status: 'active', images: [],
  });
  const [newFiles, setNewFiles] = useState([]);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    get(`/agent/products/${id}`).then(({ product }) => setForm({
      ...product, vendor_id: String(product.vendor_id), category_id: product.category_id ? String(product.category_id) : '',
      price: String(product.price_santim / 100), stock_qty: String(product.stock_qty),
    })).catch(setError);
  }, [id]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function uploadFiles(productId, files) {
    const uploaded = [];
    for (const file of files) {
      const fd = new FormData();
      fd.append('image', file);
      const { image } = await api(`/agent/products/${productId}/images`, { method: 'POST', form: fd });
      uploaded.push(image);
    }
    return uploaded;
  }

  async function submit(e) {
    e.preventDefault();
    setError(null);
    setNotice('');
    const price = toSantim(form.price);
    if (!Number.isFinite(price) || price <= 0) { setError({ message: t('agent.products.priceInvalid'), details: { price_santim: t('agent.products.priceInvalid') } }); return; }
    const body = {
      vendor_id: Number(form.vendor_id), category_id: form.category_id ? Number(form.category_id) : null,
      title_en: form.title_en, title_am: form.title_am, description_en: form.description_en, description_am: form.description_am,
      price_santim: price, stock_qty: Number(form.stock_qty || 0), status: form.status,
    };
    setBusy(true);
    try {
      if (id) {
        const { product } = await patch(`/agent/products/${id}`, body);
        setForm((f) => ({ ...f, ...product, vendor_id: String(product.vendor_id), category_id: product.category_id ? String(product.category_id) : '' }));
        setNotice(t('common.saved'));
      } else {
        const { product } = await post('/agent/products', body);
        if (newFiles.length) await uploadFiles(product.id, newFiles);
        navigate(`/agent/products/${product.id}`, { replace: true });
      }
    } catch (err) {
      setError(err);
    }
    setBusy(false);
  }

  async function addPhotos(e) {
    const files = [...e.target.files];
    e.target.value = '';
    if (!id) { setNewFiles([...newFiles, ...files]); return; }
    setBusy(true);
    setError(null);
    try {
      const uploaded = await uploadFiles(id, files);
      setForm((f) => ({ ...f, images: [...f.images, ...uploaded] }));
    } catch (err) { setError(err); }
    setBusy(false);
  }

  async function removePhoto(image) {
    if (!window.confirm(t('agent.products.confirmRemovePhoto'))) return;
    await del(`/agent/products/${id}/images/${image.id}`).catch(setError);
    setForm((f) => ({ ...f, images: f.images.filter((i) => i.id !== image.id) }));
  }

  if (!form) return error ? <ErrorMessage error={error} /> : <Spinner />;
  const errors = fieldErrors(error);
  const vendorOptions = (vendors?.items || []).map((v) => ({ value: String(v.id), label: v.name }));

  return (
    <div className="stack-lg" style={{ maxWidth: 720 }}>
      <Link to="/agent/products" className="small">← {t('agent.products.title')}</Link>
      <h1>{id ? t('agent.products.edit') : t('agent.products.add')}</h1>
      {vendors && vendorOptions.length === 0 && (
        <Alert tone="warning">{t('agent.products.needVendor')} <Link to="/agent/vendors/new">{t('agent.vendors.add')}</Link></Alert>
      )}
      <form className="stack-lg" onSubmit={submit}>
        <ErrorMessage error={error} />
        <Alert tone="success">{notice}</Alert>
        <Card title={t('agent.products.basics')}>
          <div className="stack">
            <div className="form-grid form-grid-2">
              <Select label={t('agent.products.vendor')} value={form.vendor_id} onChange={set('vendor_id')} options={vendorOptions} placeholder={t('common.choose')} required error={errors.vendor_id} />
              <Select label={t('agent.products.category')} value={form.category_id} onChange={set('category_id')} placeholder="—"
                options={(categories?.items || []).map((c) => ({ value: String(c.id), label: tf(c, 'name') }))} />
            </div>
            <Input label={t('agent.products.titleEn')} value={form.title_en} onChange={set('title_en')} error={errors.title_en} required maxLength={160} />
            <Input label={t('agent.products.titleAm')} value={form.title_am} onChange={set('title_am')} hint={t('common.optional')} maxLength={160} />
            <div className="form-grid form-grid-2">
              <Input label={t('agent.products.price')} inputMode="decimal" value={form.price} onChange={set('price')} error={errors.price_santim} required />
              <Input label={t('agent.products.stockQty')} type="number" min="0" value={form.stock_qty} onChange={set('stock_qty')} error={errors.stock_qty} required />
            </div>
            <Select label={t('agent.products.status')} value={form.status} onChange={set('status')} hint={t('agent.products.statusHint')}
              options={['active', 'draft', 'hidden'].map((s) => ({ value: s, label: t(`productStatus.${s}`) }))} />
          </div>
        </Card>
        <Card title={t('agent.products.photos')}>
          <div className="stack">
            <div className="image-row">
              {form.images.map((img) => (
                <div key={img.id} className="image-tile">
                  <img src={img.small_url} alt="" />
                  <button type="button" onClick={() => removePhoto(img)} aria-label={t('common.remove')}>×</button>
                </div>
              ))}
              {newFiles.map((f, i) => (
                <div key={`new-${i}`} className="image-tile">
                  <img src={URL.createObjectURL(f)} alt="" />
                  <button type="button" onClick={() => setNewFiles(newFiles.filter((_, j) => j !== i))} aria-label={t('common.remove')}>×</button>
                </div>
              ))}
            </div>
            <label className="btn btn-secondary" style={{ alignSelf: 'flex-start' }}>
              {t('agent.products.addPhotos')}
              <input type="file" accept="image/*" multiple hidden onChange={addPhotos} />
            </label>
            <p className="subtle">{t('agent.products.photoHint')}</p>
          </div>
        </Card>
        <Card title={t('agent.products.descriptions')}>
          <div className="stack">
            <Textarea label={t('agent.products.descriptionEn')} value={form.description_en} onChange={set('description_en')} />
            <Textarea label={t('agent.products.descriptionAm')} value={form.description_am} onChange={set('description_am')} hint={t('common.optional')} />
          </div>
        </Card>
        <Button type="submit" loading={busy}>{id ? t('common.save') : t('agent.products.create')}</Button>
        {id && form.status === 'active' && <Link to={`/products/${id}`} className="small">{t('agent.products.viewInShop')} →</Link>}
      </form>
    </div>
  );
}
