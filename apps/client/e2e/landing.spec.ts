import { expect, test } from '@playwright/test';

test.describe('ランディングページ', () => {
  test('未認証で / にアクセスすると LP が表示される', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('発酵させる');
    await expect(page.locator('text=コンセプト').first()).toBeVisible();
    await expect(page.locator('text=発酵の三段').first()).toBeVisible();
  });

  test('「アプリを試す」CTAから /login に遷移できる', async ({ page }) => {
    await page.goto('/');
    await page.locator('header a:has-text("アプリを試す")').click();
    await expect(page).toHaveURL(/\/login/);
  });

  test('言語トグルで EN に切り替わる', async ({ page }) => {
    await page.goto('/');
    await page.locator('button:has-text("English")').click();
    await expect(page.locator('h1')).toContainText('ferment');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });

  test('FAQ をクリックすると展開する', async ({ page }) => {
    await page.goto('/');
    const firstFaqButton = page.locator('button[aria-expanded]').filter({ hasText: 'Pickles' });
    await expect(firstFaqButton).toHaveAttribute('aria-expanded', 'false');
    await firstFaqButton.click();
    await expect(firstFaqButton).toHaveAttribute('aria-expanded', 'true');
  });

  test('landing で切り替えた言語が /login にも反映される (cookie 共有)', async ({
    page,
    context,
  }) => {
    await context.addCookies([
      { name: 'NEXT_LOCALE', value: 'ja', domain: 'localhost', path: '/' },
    ]);
    await page.goto('/');
    await page.locator('button:has-text("English")').click();
    await expect(page.locator('h1')).toContainText('ferment');

    const cookies = await context.cookies();
    expect(cookies.find((c) => c.name === 'NEXT_LOCALE')?.value).toBe('en');

    await page.goto('/login');
    await expect(page.locator('text=Log in to continue')).toBeVisible();
  });
});
