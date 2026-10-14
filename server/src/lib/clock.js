// The app's clock. In development you can "fast-forward" time to test deadlines without waiting days.
let offsetMs = 0;

export const clock = {
  now: () => new Date(Date.now() + offsetMs),
  advance(ms) { offsetMs += ms; },
  reset() { offsetMs = 0; },
  offsetMs: () => offsetMs,
};

export const HOUR = 60 * 60 * 1000;
export const DAY = 24 * HOUR;
