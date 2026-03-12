import { createApp } from './app.js';
import { config } from './config.js';
import { closePool } from './db/pool.js';

const app = createApp();

const server = app.listen(config.PORT, () => {
  console.log(`bazi-agent-backend listening on http://localhost:${config.PORT}`);
});

async function shutdown(signal: string): Promise<void> {
  console.log(`Received ${signal}, shutting down...`);
  server.close(async () => {
    await closePool();
    process.exit(0);
  });
}

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});
