import { describe, expect, it } from 'vitest';
import { entries } from '@/contexts/entry/presentation/routes/entries.js';

describe('entries のルート登録順', () => {
  it('GET /monthly-counts が GET /:id より前に登録されている', () => {
    // Hono は登録順に照合する。逆だと /monthly-counts が id="monthly-counts" の
    // 1 件取得として食われ、必ず 404 になる（書斎の机が黙って空になる）。
    const getPaths = entries.routes
      .filter((route) => route.method === 'GET')
      .map((route) => route.path);

    const monthlyAt = getPaths.indexOf('/monthly-counts');
    const detailAt = getPaths.indexOf('/:id');

    expect(monthlyAt).toBeGreaterThanOrEqual(0);
    expect(detailAt).toBeGreaterThanOrEqual(0);
    expect(monthlyAt).toBeLessThan(detailAt);
  });
});
