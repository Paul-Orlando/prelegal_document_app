import express from 'express';
import { AI_MODE, PUBLIC_DIR } from './config.js';
import { db } from './db.js';
import { router } from './routes.js';

/**
 * Build the Express app without starting a server, so tests and the
 * evaluation runner can use it in-process.
 */
export function createApp() {
  const app = express();

  // Trust one reverse-proxy hop (Railway) so req.ip is the real client address,
  // which the per-visitor demo limits key on.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  // Basic security headers on every response.
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
  });

  app.use(express.json({ limit: '1mb' }));

  // Revalidate HTML, CSS and JS on every load so visitors see a new deploy right away.
  app.use(
    express.static(PUBLIC_DIR, {
      setHeaders: (res, filePath) => {
        if (/\.(html|css|js)$/.test(filePath)) res.setHeader('Cache-Control', 'no-cache');
      },
    }),
  );

  // Health check for Railway: 503 when the database can't be read.
  app.get('/api/health', (_req, res) => {
    try {
      db.prepare('SELECT 1').get();
      res.json({ ok: true, aiMode: AI_MODE });
    } catch (err) {
      res.status(503).json({ ok: false, error: 'Database unavailable.' });
    }
  });

  app.use('/api', router);

  // Unknown API routes get JSON, not the HTML page.
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found.' }));

  // JSON error handler. Malformed JSON bodies are the client's fault (400);
  // anything else is logged and returned without internal details.
  app.use((err, _req, res, _next) => {
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Request body is not valid JSON.' });
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Request is too large.' });
    const status = err.status || 500;
    if (status >= 500) console.error('[error]', err);
    res.status(status).json({ error: status >= 500 ? 'Something went wrong on our side. Please try again.' : err.message });
  });

  return app;
}
