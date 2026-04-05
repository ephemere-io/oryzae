import { Hono } from 'hono';
import { entries } from './contexts/entry/presentation/routes/entries.js';
import { entryQuestions } from './contexts/question/presentation/routes/entry-questions.js';
import { questions } from './contexts/question/presentation/routes/questions.js';
import { authMiddleware } from './contexts/shared/presentation/middleware/auth.js';
import { errorHandler } from './contexts/shared/presentation/middleware/error-handler.js';
import { authRoutes } from './contexts/shared/presentation/routes/auth.js';

const app = new Hono();

app.onError(errorHandler);

app.get('/health', (c) => c.json({ status: 'ok' }));

// Auth routes (no auth middleware)
app.route('/api/v1/auth', authRoutes);

// Protected routes
app.use('/api/v1/*', authMiddleware);
app.route('/api/v1/entries.js', entries);
app.route('/api/v1/questions.js', questions);
app.route('/api/v1/entries/:entryId/questions.js', entryQuestions);

export default app;
