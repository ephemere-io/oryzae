import { expect, test } from './fixtures/auth';
import { cookieDomain } from './fixtures/env';

// SP 体験（Issue #363）の E2E。device-pref=sp cookie で SP UI を強制し、モバイル
// viewport で検証する。ログインは端末非依存なので authenticated フィクスチャを使う。
test.use({ viewport: { width: 390, height: 844 } });

/**
 * SP エディタで自前のエントリを1件作り、保存完了まで待つ。
 *
 * 以前は一覧の先頭（＝利用者の実エントリ）を掴んで本文を書き換えていたため、
 * テストのたびに実データが汚染されていた。必ず自分で作ったものだけを触る。
 */
async function createSpEntry(
  page: import('@playwright/test').Page,
  title: string,
  body: string,
): Promise<void> {
  await page.goto('/entries/new');
  await page.locator('input').first().fill(title);
  await page.locator('textarea').fill(body);
  await expect(page.getByText('保存しました')).toBeVisible({ timeout: 15_000 });
}

/** 開いているエントリを SP の削除フローで消す（テストが自分の後始末をする）。 */
async function deleteOpenSpEntry(page: import('@playwright/test').Page): Promise<void> {
  await page.getByRole('button', { name: '削除' }).click();
  await page.getByRole('button', { name: '削除する' }).click();
  await page.waitForURL(/\/entries$/, { timeout: 15_000 });
}

/** SP を強制する device-pref cookie を仕込む（middleware が UA より優先して読む）。 */
async function forceSp(page: import('@playwright/test').Page) {
  await page
    .context()
    .addCookies([{ name: 'device-pref', value: 'sp', domain: cookieDomain(), path: '/' }]);
}

test.describe('SP 体験 (#363)', () => {
  test('一覧→詳細で SP エディタに pre-fill され、編集が自動保存される', async ({
    page,
    authenticated,
  }) => {
    void authenticated;
    await forceSp(page);

    // 実データを書き換えないよう、専用エントリを作ってから開き直す。
    const marker = `sp-autosave-${Date.now()}`;
    await createSpEntry(page, marker, '初期本文。ここに追記して自動保存を確認する。');

    await page.goto('/entries');
    // SP シェル（ボトムナビ）が出る＝SP として描画されている
    await expect(page.getByRole('navigation')).toBeVisible();

    const target = page.locator('main li button', { hasText: marker }).first();
    await expect(target).toBeVisible({ timeout: 30_000 });
    await target.click();

    await page.waitForURL(/\/entries\/.+/);

    // SP エディタの本文 textarea に既存 content が pre-fill される
    const body = page.locator('textarea');
    await expect(body).toBeVisible();
    await expect(body).not.toHaveValue('');

    // 編集（10文字以上の差分で autosave がトリガ）→「保存しました」になる
    const current = await body.inputValue();
    await body.fill(`${current} 【e2e-autosave-check】`);
    await expect(page.getByText('保存しました')).toBeVisible({ timeout: 10_000 });

    // 再読込しても編集が永続している（backend に保存された）
    await page.reload();
    await expect(page.locator('textarea')).toHaveValue(/e2e-autosave-check/, { timeout: 10_000 });

    await deleteOpenSpEntry(page);
  });

  // regression(SP): title/body の分割保存（先頭行=タイトル）が改行を保って往復する
  test('改行を含むエントリを SP で書いて保存→開き直しても改行が保たれる', async ({
    page,
    authenticated,
  }) => {
    void authenticated;
    await forceSp(page);

    await page.goto('/entries/new');
    const nlMarker = `sp-nl-roundtrip-${Date.now()}`;
    await page.locator('input').first().fill(nlMarker);

    const body = page.locator('textarea');
    await body.click();
    await page.keyboard.type('1行目');
    await page.keyboard.press('Enter');
    await page.keyboard.type('2行目');
    await page.keyboard.press('Enter');
    await page.keyboard.type('3行目');

    await expect(page.getByText('保存しました')).toBeVisible({ timeout: 10_000 });

    // 一覧から開き直す（先頭行=タイトルが一覧の見出しになる）
    await page.goto('/entries');
    await page.locator('main li button', { hasText: nlMarker }).first().click();
    await page.waitForURL(/\/entries\/.+/);

    await expect(page.locator('input').first()).toHaveValue(nlMarker);
    const reopened = page.locator('textarea');
    const text = await reopened.inputValue();
    expect(text).toContain('1行目');
    expect(text).toContain('2行目');
    expect(text).toContain('3行目');
    // 改行が保たれていれば 3 行以上
    expect(text.split('\n').filter((l) => l.trim().length > 0).length).toBeGreaterThanOrEqual(3);

    await deleteOpenSpEntry(page);
  });

  test('アカウントでニックネームを編集して保存できる（PATCH 成功）', async ({
    page,
    authenticated,
  }) => {
    void authenticated;
    await forceSp(page);

    await page.goto('/account');
    await expect(page.getByText('プロフィール')).toBeVisible();

    await page.getByRole('button', { name: '編集' }).click();
    const input = page.getByRole('textbox');
    const original = await input.inputValue();

    // nickname スキーマは /^[a-zA-Z0-9_-]+$/。有効な値で変更 → 表示が新値に更新＝
    // res.ok（保存成功）。失敗なら編集モードのまま。
    const edited = `${original}2`;
    await input.fill(edited);
    await page.getByRole('button', { name: '保存' }).click();
    await expect(page.getByText(edited)).toBeVisible({ timeout: 10_000 });

    // 元に戻す（テストアカウントを汚さない）
    await page.getByRole('button', { name: '編集' }).click();
    await page.getByRole('textbox').fill(original);
    await page.getByRole('button', { name: '保存' }).click();
    await expect(page.getByRole('textbox')).toBeHidden({ timeout: 10_000 });
  });

  test('アカウント画面からログアウトできる', async ({ page, authenticated }) => {
    void authenticated;
    await forceSp(page);

    await page.goto('/account');
    // SP アカウント画面（プロフィール見出し＋ログアウト）
    await expect(page.getByText('プロフィール')).toBeVisible();
    const logout = page.getByRole('button', { name: 'ログアウトする' });
    await expect(logout).toBeVisible();

    await logout.click();
    await page.waitForURL(/\/login/);
  });
});
