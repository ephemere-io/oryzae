import { Hono } from 'hono';
import { entries } from './contexts/entry/presentation/routes/entries';
import { entryQuestions } from './contexts/question/presentation/routes/entry-questions';
import { questions } from './contexts/question/presentation/routes/questions';
import { authMiddleware } from './contexts/shared/presentation/middleware/auth';
import { errorHandler } from './contexts/shared/presentation/middleware/error-handler';
import { authRoutes } from './contexts/shared/presentation/routes/auth';

const app = new Hono();

app.onError(errorHandler);

app.get('/health', (c) => c.json({ status: 'ok' }));

// Auth routes (no auth middleware)
app.route('/api/v1/auth', authRoutes);

// Protected routes
app.use('/api/v1/*', authMiddleware);
app.route('/api/v1/entries', entries);
app.route('/api/v1/questions', questions);
app.route('/api/v1/entries/:entryId/questions', entryQuestions);

export default app;
