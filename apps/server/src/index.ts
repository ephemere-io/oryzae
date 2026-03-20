import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { authMiddleware } from './contexts/shared/presentation/middleware/auth';
import { errorHandler } from './contexts/shared/presentation/middleware/error-handler';
import { entries } from './contexts/entry/presentation/routes/entries';

const app = new Hono();

app.onError(errorHandler);

app.get('/health', (c) => c.json({ status: 'ok' }));

app.use('/api/v1/*', authMiddleware);
app.route('/api/v1/entries', entries);

const port = Number(process.env.PORT ?? 3000);

serve({ fetch: app.fetch, port }, () => {
  console.log(`Server running on http://localhost:${port}`);
});
