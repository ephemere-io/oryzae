import { Hono } from 'hono';
import { board } from './contexts/board/presentation/routes/board.js';
import { entries } from './contexts/entry/presentation/routes/entries.js';
import { adminFermentations } from './contexts/fermentation/presentation/routes/admin-fermentations.js';
import { fermentations } from './contexts/fermentation/presentation/routes/fermentations.js';
import { entryQuestions } from './contexts/question/presentation/routes/entry-questions.js';
import { questions } from './contexts/question/presentation/routes/questions.js';
import { adminAuthMiddleware } from './contexts/shared/presentation/middleware/admin-auth.js';
import { authMiddleware } from './contexts/shared/presentation/middleware/auth.js';
import { errorHandler } from './contexts/shared/presentation/middleware/error-handler.js';
import { adminDashboard } from './contexts/shared/presentation/routes/admin-dashboard.js';
import { adminUsers } from './contexts/shared/presentation/routes/admin-users.js';
import { authRoutes } from './contexts/shared/presentation/routes/auth.js';

const app = new Hono()
  .onError(errorHandler)
  .get('/health', (c) => c.json({ status: 'ok' }))
  .route('/api/v1/auth', authRoutes)
  .use('/api/v1/admin/*', adminAuthMiddleware)
  .route('/api/v1/admin/dashboard', adminDashboard)
  .route('/api/v1/admin/users', adminUsers)
  .route('/api/v1/admin/fermentations', adminFermentations)
  .use('/api/v1/*', authMiddleware)
  .route('/api/v1/board', board)
  .route('/api/v1/entries', entries)
  .route('/api/v1/questions', questions)
  .route('/api/v1/entries/:entryId/questions', entryQuestions)
  .route('/api/v1/fermentations', fermentations);

export type AppType = typeof app;
export default app;
