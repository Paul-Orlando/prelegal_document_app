import { AI_MODE, DB_PATH, PORT } from './config.js';
import { createApp } from './app.js';

const server = createApp().listen(PORT, () => {
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
