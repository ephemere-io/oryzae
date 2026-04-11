import { expect, test } from './fixtures/auth';

test.describe('ボード画面', () => {
  test.beforeEach(async ({ authenticated: _, page }) => {
    await page.goto('/board');
    await page.waitForSelector('[role="application"]');
  });

  test('ボード画面が表示される', async ({ page }) => {
    await expect(page.locator('text=Daily')).toBeVisible();
    await expect(page.locator('button:has-text("Snippet")')).toBeVisible();
  });

  test('日付ナビゲーションで前日/翌日に切り替えできる', async ({ page }) => {
    const dateText = page.locator('[class*="tracking"]').first();
    const initialDate = await dateText.textContent();

    await page.click('button:has-text("‹")');
    await page.waitForTimeout(500);
    const prevDate = await dateText.textContent();
    expect(prevDate).not.toBe(initialDate);

    await page.click('button:has-text("›")');
    await page.waitForTimeout(500);
    const nextDate = await dateText.textContent();
    expect(nextDate).toBe(initialDate);
  });

  test('スニペットを作成できる', async ({ page }) => {
    await page.click('button:has-text("Snippet")');
    await expect(page.locator('text=New Snippet')).toBeVisible();

    await page.fill('input[placeholder*="スニペット"]', 'E2Eテストスニペット');
    await page.click('button:has-text("Add")');

    await page.waitForTimeout(1000);
    await expect(page.locator('text=E2Eテストスニペット')).toBeVisible();
  });

  test('エントリカードが表示される（当日エントリがある場合）', async ({ page }) => {
    // まずエントリを作成
    await page.goto('/entries/new');
    const editor = page.locator('[contenteditable="true"]');
    await editor.click();
    await editor.pressSequentially('ボードE2Eテスト用エントリ');
    await page.click('button:has-text("保存")');
    await page.waitForTimeout(2000);

    // ボードに移動してカードを確認
    await page.goto('/board');
    await page.waitForTimeout(2000);
    await expect(page.locator('text=ボードE2Eテスト用エントリ')).toBeVisible();
  });
});
