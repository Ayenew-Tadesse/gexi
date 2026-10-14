// Builds the Express app: security headers, compression, routes and error handling.
import path from 'node:path';
import fs from 'node:fs';
import express from 'express';
import compression from 'compression';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { config } from './config.js';
import { loadUser } from './middleware/auth.js';
import { AppError } from './lib/errors.js';
import authRoutes from './routes/auth.js';
import catalogRoutes from './routes/catalog.js';
import customerRoutes from './routes/customer.js';
import paymentRoutes from './routes/payments.js';
import agentRoutes from './routes/agent.js';
import warehouseRoutes from './routes/warehouse.js';
import pickupRoutes from './routes/pickup.js';
import adminRoutes from './routes/admin.js';
import devRoutes from './routes/dev.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'same-site' } }));
  app.use(compression());
  // Keep the raw body so payment webhooks can check their signature.
  app.use(express.json({ limit: '200kb', verify: (req, _res, buf) => { req.rawBody = buf; } }));
  app.use(cookieParser());
  app.use(loadUser);

  // Uploaded product photos: cache for a year (file names never change).
  app.use('/uploads', express.static(config.uploadDir, { maxAge: '365d', immutable: true }));

  const api = express.Router();
  api.get('/health', (_req, res) => res.json({ ok: true }));
  api.use('/auth', authRoutes);
  api.use('/', catalogRoutes);
  api.use('/', customerRoutes);
  api.use('/payments', paymentRoutes);
  api.use('/agent', agentRoutes);
  api.use('/warehouse', warehouseRoutes);
  api.use('/pickup', pickupRoutes);
  api.use('/admin', adminRoutes);
  if (config.devTools) api.use('/dev', devRoutes);
  api.use((_req, _res, next) => next(new AppError(404, 'not_found', 'Unknown API address.')));
  app.use('/api', api);

  // In production the server also serves the built React app.
  const dist = new URL('../../client/dist/', import.meta.url).pathname;
  if (config.isProduction && fs.existsSync(dist)) {
    app.use('/assets', express.static(path.join(dist, 'assets'), { maxAge: '365d', immutable: true }));
    app.use(express.static(dist, { maxAge: '1h' }));
    app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  }

  // Turn any error into a JSON answer the screens can show.
  app.use((err, _req, res, _next) => {
    if (err instanceof AppError) {
      return res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
    }
    if (err?.name === 'MulterError') {
      return res.status(400).json({ error: { code: 'upload_error', message: 'The photo is too large or invalid (max 8 MB).' } });
    }
    if (err?.type === 'entity.parse.failed') {
      return res.status(400).json({ error: { code: 'bad_json', message: 'Invalid request.' } });
    }
    console.error(err);
    res.status(500).json({ error: { code: 'server_error', message: 'Something went wrong on our side. Please try again.' } });
  });

  return app;
}
