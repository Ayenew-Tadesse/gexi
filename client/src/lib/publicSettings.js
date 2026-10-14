// Public shop settings (pickup location, demo flag), fetched once and shared by every screen.
import { useEffect, useState } from 'react';
import { get } from './api.js';

let cached = null;
let pending = null;

export function usePublicSettings() {
  const [data, setData] = useState(cached);
  useEffect(() => {
    if (cached) return;
    pending = pending || get('/settings/public').then((d) => { cached = d; return d; }).finally(() => { pending = null; });
    pending.then(setData).catch(() => {});
  }, []);
  return data;
}
