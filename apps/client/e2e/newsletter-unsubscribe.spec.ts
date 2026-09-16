import { expect, test } from '@playwright/test';

/**
 * お知らせメールの配信停止ページ (Issue #614)。
 *
 * ここで守りたいのは 2 点:
 *
 * 1. **ログインしていなくても開ける** — 止めたい人はログインしない。保護ルートに
 *    紛れ込ませて /login へ飛ばすようになったら、実質「止められない」に戻る。
 * 2. **署名の無いトークンでは止まらない** — ここが破れると、user_id を総当たり
 *    して他人を勝手に配信停止にできる。
 *
 * 正規トークンでの成功経路はサーバー側の単体テストが持つ（署名鍵を知らないと
 * ブラウザからは作れないため、E2E では踏めない）。
 */
test.describe('ニュースレターの配信停止', () => {
  test('ログインしていなくてもページが開く（/login へ飛ばさない）', async ({ page }) => {
    await page.goto('/unsubscribe?token=whatever');

    await expect(page).toHaveURL(/\/unsubscribe/);
    await expect(page.getByText('Oryzae')).toBeVisible();
  });

  test('署名の無いトークンは拒まれ、次の手を案内する', async ({ page }) => {
    await page.goto('/unsubscribe?token=forged-token');

    await expect(page.getByText('処理できませんでした')).toBeVisible();
    // ログインしていない相手なので、汎用エラーだけで放り出さない。
    await expect(page.getByText(/アカウント設定/)).toBeVisible();
  });

  test('token が無いリンクでもクラッシュしない', async ({ page }) => {
    await page.goto('/unsubscribe');

    await expect(page.getByText('処理できませんでした')).toBeVisible();
  });

  // リンク先読み（Outlook SafeLinks 等）で勝手に止まらないこと。
  // 先読みは JS を実行しないので、GET だけでは配信停止の要求が飛ばない。
  test('GET だけでは配信停止 API を叩かない', async ({ page }) => {
    const posted: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('/api/v1/newsletter/')) posted.push(`${req.method()} ${req.url()}`);
    });

    await page.goto('/unsubscribe?token=forged-token');
    await expect(page.getByText('処理できませんでした')).toBeVisible();

    // ページを開いた JS からの POST は 1 本だけ。GET は一切出さない。
    expect(posted.filter((r) => r.startsWith('GET '))).toEqual([]);
  });
});
