import { useT } from '../i18n/index.jsx';
import { usePublicSettings } from '../lib/publicSettings.js';

/** Yellow strip on the online demo (DEMO_MODE) and in development. */
export default function DemoBanner() {
  const { t } = useT();
  const settings = usePublicSettings();
  if (settings?.demo_mode) return <div className="dev-bar">{t('dev.demoBanner')}</div>;
  if (import.meta.env.DEV) return <div className="dev-bar">{t('dev.banner')}</div>;
  return null;
}
