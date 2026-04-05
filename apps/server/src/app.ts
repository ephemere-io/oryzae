import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { entries } from './contexts/entry/presentation/routes/entries.js';
import { entryQuestions } from './contexts/question/presentation/routes/entry-questions.js';
import { questions } from './contexts/question/presentation/routes/questions.js';
import { authMiddleware } from './contexts/shared/presentation/middleware/auth.js';
import { errorHandler } from './contexts/shared/presentation/middleware/error-handler.js';
import { authRoutes } from './contexts/shared/presentation/routes/auth.js';

const allowedOrigins = process.env.CLIENT_URL
  ? [process.env.CLIENT_URL, 'http://localhost:3001']
  : ['http://localhost:3001'];

const app = new Hono()
  .use('*', cors({ origin: allowedOrigins, credentials: true }))
  .onError(errorHandler)
  .get('/health', (c) => c.json({ status: 'ok' }))
  .route('/api/v1/auth', authRoutes)
  .use('/api/v1/*', authMiddleware)
  .route('/api/v1/entries', entries)
  .route('/api/v1/questions', questions)
  .route('/api/v1/entries/:entryId/questions', entryQuestions);

export type AppType = typeof app;
export default app;
