import app from '@oryzae/server';

const handler = (req: Request) => app.fetch(req);

export { handler as GET };
