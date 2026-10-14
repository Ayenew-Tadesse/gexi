// Developer tools (only when ENABLE_DEV_TOOLS=true and not in production).
// "Fast-forward" moves the app's clock forward so you can test deadlines without waiting days.
import { Router } from 'express';
import { z } from 'zod';
import { parse } from '../lib/validate.js';
import { clock, HOUR } from '../lib/clock.js';
import { processDeadlines } from '../services/orders.js';
import { requireRole } from '../middleware/auth.js';

const router = Router();

router.get('/clock', (_req, res) => {
  res.json({ now: clock.now(), offsetHours: clock.offsetMs() / HOUR });
});

router.post('/fast-forward', requireRole('admin'), async (req, res) => {
  const { hours } = parse(z.object({ hours: z.number().min(0).max(24 * 60) }), req.body);
  clock.advance(hours * HOUR);
  const counts = await processDeadlines();
  res.json({ now: clock.now(), offsetHours: clock.offsetMs() / HOUR, counts });
});

router.post('/reset-clock', requireRole('admin'), (_req, res) => {
  clock.reset();
  res.json({ now: clock.now(), offsetHours: 0 });
});

export default router;
