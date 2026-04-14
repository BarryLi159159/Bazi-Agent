import express from 'express';
import { chatRouter } from './routes/chat.js';
import { healthRouter } from './routes/health.js';
import { predictionsRouter } from './routes/predictions.js';
import { sessionsRouter } from './routes/sessions.js';
import { usersRouter } from './routes/users.js';

export function createApp() {
  const app = express();

  // Allow local frontend dev servers (5173/5174/5175...) to call backend on 8787.
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    return next();
  });

  app.use(express.json({ limit: '2mb' }));

  app.use('/health', healthRouter);
  app.use('/api/chat', chatRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/sessions', sessionsRouter);
  app.use('/api/predictions', predictionsRouter);

  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('Unhandled error', error);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}
