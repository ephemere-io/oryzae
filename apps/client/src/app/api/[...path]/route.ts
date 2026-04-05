import app from '@oryzae/server';

const handler = (req: Request) => app.fetch(req);

export { handler as GET, handler as POST, handler as PUT, handler as DELETE, handler as PATCH };
