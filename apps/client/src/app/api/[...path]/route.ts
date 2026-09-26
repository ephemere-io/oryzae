import app from '@oryzae/server';

/**
 * 関数の上限（秒）。既定（Pro 15s）だと `POST /api/v1/fermentations/first-letter` が切れる —
 * 初回の手紙は LLM を同期で呼び、数十秒かかる（`docs/fermentation-backend-guide.md`）。
 * 他の API は数百 ms で返るので、伸ばしても害は無い。cron は別の route が 800s を持つ。
 */
export const maxDuration = 60;

const handler = (req: Request) => app.fetch(req);

export { handler as GET, handler as POST, handler as PUT, handler as DELETE, handler as PATCH };
