import { expect, test } from './fixtures/auth';

// issue #614: 一斉配信の画面。**送信そのものは E2E で踏まない**
// （本番の登録者に実際のメールが飛ぶ経路なので、テストから起動させない）。
// ここで見るのは「送信の前に確認が挟まること」まで。
test.describe('ニュースレター', () => {
  test('サイドバーから開けて、エディタが出る', async ({ page, authenticated }) => {
    void authenticated;

    await page.click('nav >> a:has-text("Newsletter")');
    await expect(page).toHaveURL(/\/newsletters/);

    await expect(page.getByLabel('件名')).toBeVisible();
    await expect(page.getByLabel(/本文/)).toBeVisible();
  });

  test('未保存の新規下書きからは送信できない（保存済みの本文が送られるため）', async ({
    page,
    authenticated,
  }) => {
    void authenticated;
    await page.goto('/newsletters');

    await expect(page.getByRole('button', { name: /送信する…/ })).toBeDisabled();
  });

  test('件名か本文が空なら保存できない', async ({ page, authenticated }) => {
    void authenticated;
    await page.goto('/newsletters');

    const save = page.getByRole('button', { name: '下書きを保存' });
    await expect(save).toBeDisabled();

    await page.getByLabel('件名').fill('E2E の下書き');
    // 件名だけではまだ保存できない。
    await expect(save).toBeDisabled();

    await page.getByLabel(/本文/).fill('本文です。');
    await expect(save).toBeEnabled();
  });
});
