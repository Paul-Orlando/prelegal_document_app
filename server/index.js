import express from 'express';
import { AI_MODE, DB_PATH, PORT, PUBLIC_DIR } from './config.js';
import { router } from './routes.js';

const app = express();

// Trust one reverse-proxy hop so req.ip reflects the real client when the
// server is reached through a tunnel (ngrok, etc.) — needed for the
// per-IP rate limit on new documents to key on the right address.
app.set('trust proxy', 1);

app.use(express.json({ limit: '1mb' }));
app.use(express.static(PUBLIC_DIR));
app.use('/api', router);

app.get('/api/health', (_req, res) => res.json({ ok: true, aiMode: AI_MODE }));

// JSON error handler — keeps the frontend from having to parse HTML error pages.
app.use((err, _req, res, _next) => {
  console.error('[error]', err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error.' });
});

const server = app.listen(PORT, () => {
  console.log(`Prelegal running at http://localhost:${PORT}`);
  console.log(`  AI mode:  ${AI_MODE}${AI_MODE === 'mock' ? '  (set OPENROUTER_API_KEY in .env for real AI chat)' : ''}`);
  console.log(`  Database: ${DB_PATH}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    console.log(`\nReceived ${signal}, shutting down.`);
    server.close(() => process.exit(0));
  });
}
