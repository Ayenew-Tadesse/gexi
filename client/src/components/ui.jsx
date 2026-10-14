// The component kit: small building blocks used on every screen.
// They only apply CSS classes from styles/components.css, so restyling happens in CSS, not here.
import { useEffect, useId, useState } from 'react';
import { useT } from '../i18n/index.jsx';

export function Button({ variant = 'primary', size, block, loading, children, className = '', type = 'button', ...props }) {
  const classes = ['btn', `btn-${variant}`, size === 'sm' && 'btn-sm', block && 'btn-block', className].filter(Boolean).join(' ');
  return (
    <button type={type} className={classes} disabled={loading || props.disabled} {...props}>
      {loading ? '…' : children}
    </button>
  );
}

export function Field({ label, hint, error, children, id }) {
  return (
    <div className="field">
      {label && <label className="field-label" htmlFor={id}>{label}</label>}
      {children}
      {hint && !error && <span className="field-hint">{hint}</span>}
      {error && <span className="field-error" role="alert">{error}</span>}
    </div>
  );
}

export function Input({ label, hint, error, className = '', ...props }) {
  const id = useId();
  return (
    <Field label={label} hint={hint} error={error} id={id}>
      <input id={id} className={`input ${className}`} aria-invalid={error ? 'true' : undefined} {...props} />
    </Field>
  );
}

export function PhoneInput(props) {
  const { t } = useT();
  return <Input type="tel" inputMode="tel" autoComplete="tel" placeholder="09XX XXX XXX" label={t('auth.phone')} {...props} />;
}

export function Textarea({ label, hint, error, ...props }) {
  const id = useId();
  return (
    <Field label={label} hint={hint} error={error} id={id}>
      <textarea id={id} className="textarea" aria-invalid={error ? 'true' : undefined} {...props} />
    </Field>
  );
}

export function Select({ label, hint, error, options, placeholder, ...props }) {
  const id = useId();
  return (
    <Field label={label} hint={hint} error={error} id={id}>
      <select id={id} className="select" aria-invalid={error ? 'true' : undefined} {...props}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </Field>
  );
}

export function Checkbox({ label, ...props }) {
  return (
    <label className="checkbox">
      <input type="checkbox" {...props} />
      <span>{label}</span>
    </label>
  );
}

export function Card({ title, children, className = '', actions }) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <div className="row-between" style={{ marginBottom: 'var(--space-3)' }}>
          {title && <h2 className="card-title">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Badge({ tone = 'neutral', children }) {
  return <span className={`badge ${tone === 'neutral' ? '' : `badge-${tone}`}`}>{children}</span>;
}

const ORDER_TONES = {
  pending_payment: 'warning',
  paid: 'info',
  awaiting_dropoff: 'info',
  received_at_warehouse: 'info',
  packed: 'info',
  ready_for_pickup: 'primary',
  picked_up: 'success',
  completed: 'success',
  cancelled: 'danger',
  expired: 'danger',
};
const ITEM_TONES = {
  awaiting_dropoff: 'warning',
  received: 'success',
  rejected: 'danger',
  missed_dropoff: 'danger',
  cancelled: 'danger',
  return_pending: 'warning',
  returned_to_vendor: 'neutral',
  pending_payment: 'neutral',
};

export function StatusBadge({ status, kind = 'order' }) {
  const { t } = useT();
  const tone = (kind === 'item' ? ITEM_TONES : ORDER_TONES)[status] || 'neutral';
  return <Badge tone={tone}>{t(`${kind === 'item' ? 'itemStatus' : 'status'}.${status}`)}</Badge>;
}

export function Alert({ tone = 'error', children }) {
  if (!children) return null;
  return <div className={`alert alert-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>{children}</div>;
}

export function ErrorMessage({ error }) {
  if (!error) return null;
  return <Alert tone="error">{error.message || String(error)}</Alert>;
}

export function Spinner() {
  const { t } = useT();
  return <div className="spinner" role="status" aria-label={t('common.loading')} />;
}

export function Empty({ children }) {
  return <div className="empty">{children}</div>;
}

/** Shows a spinner, an error with a retry button, or the content. */
export function Loader({ loading, error, reload, children }) {
  const { t } = useT();
  if (error && !loading) {
    return (
      <div className="stack">
        <ErrorMessage error={error} />
        {reload && <Button variant="secondary" onClick={reload}>{t('common.retry')}</Button>}
      </div>
    );
  }
  if (loading && !children) return <Spinner />;
  return children;
}

export function Money({ santim, className = '' }) {
  const value = (santim || 0) / 100;
  const hasCents = Math.round(value * 100) % 100 !== 0;
  return <span className={`price ${className}`}>ETB {value.toLocaleString('en-US', { minimumFractionDigits: hasCents ? 2 : 0, maximumFractionDigits: 2 })}</span>;
}

export function Stat({ label, value }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
  );
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((tab) => (
        <button key={tab.value} type="button" role="tab" aria-selected={value === tab.value}
          className={`tab ${value === tab.value ? 'active' : ''}`} onClick={() => onChange(tab.value)}>
          {tab.label}{tab.count !== undefined ? ` (${tab.count})` : ''}
        </button>
      ))}
    </div>
  );
}

export function Modal({ open, onClose, title, children }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal stack" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        {title && <h2>{title}</h2>}
        {children}
      </div>
    </div>
  );
}

/** Product photo with lazy loading and fixed size (so the page does not jump while loading). */
export function ProductImage({ src, alt, className = 'product-card-img', sizes, srcSet, eager }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <div className={`img-placeholder ${className}`} aria-hidden="true" />;
  return (
    <img src={src} srcSet={srcSet} sizes={sizes} alt={alt} className={className} width="320" height="320"
      loading={eager ? 'eager' : 'lazy'} decoding="async" onError={() => setFailed(true)} />
  );
}

/** Pagination with "previous / next" buttons. */
export function Pager({ page, pageSize, total, onPage }) {
  const { t } = useT();
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <div className="row-between">
      <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>{t('common.previous')}</Button>
      <span className="subtle">{t('common.pageOf', { page, pages })}</span>
      <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>{t('common.next')}</Button>
    </div>
  );
}

/** Show field errors from the server next to the matching inputs. */
export function fieldErrors(error) {
  return error?.details && !Array.isArray(error.details) ? error.details : {};
}
