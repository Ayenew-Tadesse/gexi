// The shopping cart is kept on the phone (localStorage), so it works even with a weak connection.
// Prices are shown from the last time the product was viewed; the server always re-checks at checkout.
import { useSyncExternalStore } from 'react';

const KEY = 'gexi.cart';
const listeners = new Set();
let cache = read();

function read() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(lines) {
  cache = lines;
  try { localStorage.setItem(KEY, JSON.stringify(lines)); } catch { /* storage full or private mode */ }
  listeners.forEach((l) => l());
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => { if (e.key === KEY) { cache = read(); listeners.forEach((l) => l()); } });
}

export const cart = {
  lines: () => cache,
  add(product, quantity = 1) {
    const existing = cache.find((l) => l.productId === product.id);
    const max = product.stock_qty ?? 99;
    if (existing) {
      write(cache.map((l) => (l.productId === product.id ? { ...l, quantity: Math.min(max, l.quantity + quantity) } : l)));
    } else {
      write([...cache, {
        productId: product.id,
        quantity: Math.min(max, quantity),
        title_en: product.title_en,
        title_am: product.title_am,
        price_santim: product.price_santim,
        image: product.image_small || product.images?.[0]?.small_url || null,
        max,
      }]);
    }
  },
  setQuantity(productId, quantity) {
    if (quantity <= 0) return cart.remove(productId);
    write(cache.map((l) => (l.productId === productId ? { ...l, quantity: Math.min(l.max ?? 99, quantity) } : l)));
  },
  remove(productId) { write(cache.filter((l) => l.productId !== productId)); },
  clear() { write([]); },
};

export function useCart() {
  const lines = useSyncExternalStore((cb) => { listeners.add(cb); return () => listeners.delete(cb); }, () => cache, () => cache);
  const count = lines.reduce((n, l) => n + l.quantity, 0);
  const total = lines.reduce((s, l) => s + l.quantity * l.price_santim, 0);
  return { lines, count, total };
}
