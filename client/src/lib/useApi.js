import { useCallback, useEffect, useRef, useState } from 'react';
import { get } from './api.js';

/** Load data from the server: const { data, error, loading, reload } = useApi('/orders') */
export function useApi(path) {
  const [state, setState] = useState({ data: null, error: null, loading: Boolean(path) });
  const latest = useRef(path);

  const load = useCallback(async () => {
    if (!path) return;
    latest.current = path;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await get(path);
      if (latest.current === path) setState({ data, error: null, loading: false });
    } catch (error) {
      if (latest.current === path) setState((s) => ({ data: s.data, error, loading: false }));
    }
  }, [path]);

  useEffect(() => { load(); }, [load]);
  return { ...state, reload: load };
}
