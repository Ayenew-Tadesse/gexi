// Who is logged in. Wrap the app in <AuthProvider>, then use useAuth() anywhere.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { get, post } from './api.js';
import { useT } from '../i18n/index.jsx';

const AuthContext = createContext(null);

export const HOME_FOR_ROLE = { customer: '/', agent: '/agent', warehouse: '/warehouse', pickup: '/pickup', admin: '/admin' };

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = still checking
  const { lang, setLang } = useT();

  useEffect(() => {
    get('/auth/me').then((r) => setUser(r.user)).catch(() => setUser(null));
  }, []);

  const signedIn = useCallback((u) => {
    setUser(u);
    if (u?.preferred_language && u.preferred_language !== lang) setLang(u.preferred_language);
  }, [lang, setLang]);

  const logout = useCallback(async () => {
    await post('/auth/logout').catch(() => {});
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, setUser: signedIn, logout, checking: user === undefined }), [user, signedIn, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
