// Vercel Serverless Function entry point
// .js to bypass Vercel's TypeScript compiler (type safety is enforced by tsc in CI)
import { handle } from 'hono/vercel';
import app from '../src/app.js';

export default handle(app);
