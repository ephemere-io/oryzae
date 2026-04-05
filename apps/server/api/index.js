// Vercel Serverless Function entry point
// Import from tsc output (dist/) to bypass Vercel ncc's TypeScript compilation
// which fails on Supabase v2 types. Type safety is enforced by tsc in CI.
import { handle } from 'hono/vercel';
import app from '../dist/app.js';

export default handle(app);
