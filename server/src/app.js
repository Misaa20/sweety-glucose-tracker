import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { todayInTimezone } from '@sweety/shared';
import { createAuth } from './auth.js';
import { errorHandler, HttpError } from './errors.js';
import { createReadingsRouter } from './readings.js';
import { createReportsRouter } from './reports.js';

export function createApp(pool, config, authOptions) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(express.json({ limit: '16kb' }));
  app.use(cookieParser());
  app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    // Same-origin cookies are used through Vite's /api proxy in development.
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.headers.origin && req.headers.origin !== config.clientOrigin) {
      throw new HttpError(403, 'This request origin is not allowed.');
    }
    next();
  });
  app.get('/api/health', async (req, res) => {
    await pool.query('SELECT 1');
    res.json({ status: 'ok' });
  });
  app.get('/api/meta', (req, res) => res.json({ today: todayInTimezone(config.timezone), timezone: config.timezone }));
  const auth = createAuth(pool, config, authOptions);
  app.use('/api/auth', auth.router);
  app.use('/api/readings', auth.requireUser, createReadingsRouter(pool, config));
  app.use('/api/reports', auth.requireUser, createReportsRouter(pool, config));
  app.use('/api', (req, res) => res.status(404).json({ message: 'Endpoint not found.' }));

  const clientDist = fileURLToPath(new URL('../../client/dist/', import.meta.url));
  if (existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get('/{*path}', (req, res) => res.sendFile(`${clientDist}/index.html`));
  }
  app.use(errorHandler);
  return app;
}
