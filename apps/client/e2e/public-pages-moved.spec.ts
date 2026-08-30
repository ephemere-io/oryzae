import { expect, test } from '@playwright/test';

/**
 * 公開ページ（LP・/support・/privacy）は別リポジトリの公開サイト
 * （ephemere-io/oryzae-docs、docs.oryzae.ephemere.io）へ移設した。
 *
 * ここで守るのは「旧 URL を踏んだ人が行き止まりにならないこと」。
 * `/privacy` は App Store の審査情報から、`/support` はメール文面から参照されており、
 * **アプリの外から叩かれる URL** なので 404 にしてはならない。
 *
 * 外部ドメインへ実際に出て行かないよう、ページ遷移ではなく Location ヘッダを検証する。
 */
test.describe('移設した公開ページ', () => {
  for (const path of ['/privacy', '/support']) {
    test(`${path} は公開サイトへ恒久リダイレクトされる`, async ({ request }) => {
      const res = await request.get(path, { maxRedirects: 0 });

      // Next.js の `permanent: true` は 308（メソッドを保持する恒久リダイレクト）を返す。
      // 301 に変わっても意図は同じなので、どちらでも通す。
      expect([301, 308]).toContain(res.status());

      const location = res.headers().location;
      expect(location).toBeTruthy();
      expect(location).toMatch(/^https?:\/\//);
      expect(location.endsWith(path)).toBe(true);
    });
  }

  test('LP は残っていない（/ は描画物を持たない振り分けゲート）', async ({ request }) => {
    // `/` に LP 本文が残っていたら、公開サイトと二重に存在してしまう合図。
    const res = await request.get('/');
    const html = await res.text();
    expect(html).not.toContain('発酵の三段');
  });
});
