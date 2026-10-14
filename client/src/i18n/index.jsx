// Tiny translation system (English + Amharic).
// Text lives in locales/en.json and locales/am.json. Use it in components like:
//   const { t } = useT();   t('cart.title')   t('cart.items', { count: 3 })
// Missing Amharic text automatically falls back to English.
// The JSON format matches i18next, so a bigger library can replace this later if needed.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import en from './locales/en.json';

export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'am', label: 'አማርኛ' },
];
const STORAGE_KEY = 'gexi.lang';
const loaders = { am: () => import('./locales/am.json') }; // Amharic is only downloaded when chosen

function lookup(dict, key) {
  return key.split('.').reduce((node, part) => (node && typeof node === 'object' ? node[part] : undefined), dict);
}

function interpolate(text, vars) {
  if (!vars) return text;
  return text.replace(/\{\{(\w+)\}\}/g, (_, name) => (vars[name] ?? '').toString());
}

const I18nContext = createContext(null);

function initialLang() {
  try {
    return localStorage.getItem(STORAGE_KEY) || 'en';
  } catch {
    return 'en';
  }
}

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(initialLang);
  const [dict, setDict] = useState(null);

  useEffect(() => {
    document.documentElement.lang = lang;
    if (lang === 'en' || !loaders[lang]) { setDict(null); return; }
    let cancelled = false;
    loaders[lang]().then((m) => { if (!cancelled) setDict(m.default); }).catch(() => {});
    return () => { cancelled = true; };
  }, [lang]);

  const setLang = useCallback((code) => {
    setLangState(code);
    try { localStorage.setItem(STORAGE_KEY, code); } catch { /* private mode */ }
  }, []);

  const t = useCallback((key, vars) => {
    let text = (dict && lookup(dict, key)) || lookup(en, key);
    if (typeof text !== 'string') {
      if (import.meta.env.DEV) console.warn(`Missing translation: ${key}`);
      text = key;
    }
    // Simple plural support: "item_one" / "item_other"
    if (vars && typeof vars.count === 'number') {
      const plural = (dict && lookup(dict, `${key}_${vars.count === 1 ? 'one' : 'other'}`)) || lookup(en, `${key}_${vars.count === 1 ? 'one' : 'other'}`);
      if (typeof plural === 'string') text = plural;
    }
    return interpolate(text, vars);
  }, [dict]);

  /** Pick the right language field from data, e.g. tf(product, 'title') -> title_am or title_en */
  const tf = useCallback((obj, field) => (lang !== 'en' && obj?.[`${field}_${lang}`]) || obj?.[`${field}_en`] || '', [lang]);

  const value = useMemo(() => ({ lang, setLang, t, tf }), [lang, setLang, t, tf]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useT() {
  return useContext(I18nContext);
}
