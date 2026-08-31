import { expect, test } from './fixtures/auth';
import { deleteEntriesByMarker, waitForAutosave } from './fixtures/env';

test.describe('ボード画面', () => {
  test.beforeEach(async ({ authenticated: _, page }) => {
    await page.goto('/board');
    await page.waitForSelector('[role="application"]');
  });

  test('ボード画面が表示される（日付ナビ＋下部ツールバー）', async ({ page }) => {
    await expect(page.locator('button[data-verify-view-option="daily"]')).toBeVisible();
    await expect(page.locator('[role="toolbar"]')).toBeVisible();
    await expect(page.locator('button[data-verify-tool="snippet"]')).toBeVisible();
    await expect(page.locator('button[data-verify-tool="photo"]')).toBeVisible();
  });

  test('不要になった要素（フッター・カード数）が出ない', async ({ page }) => {
    await expect(page.locator('footer')).toHaveCount(0);
    await expect(page.getByText(/\d+ CARDS/)).toHaveCount(0);
  });

  test('日付ナビゲーションで前日/翌日に切り替えできる', async ({ page }) => {
    // 日付は BoardDateNav が公表する契約（data-verify-date-key）で見る。
    // 以前はクラス名（tracking-wider）で拾っていたが、見た目を変えるたびに
    // 壊れるうえ、何を見ているのかも読み取れなかった。
    const nav = page.locator('[data-verify-unit="BoardDateNav"]');
    const dateKey = () => nav.getAttribute('data-verify-date-key');
    const initial = await dateKey();

    await page.click('button[data-verify-nav="prev"]');
    await page.waitForTimeout(500);
    expect(await dateKey()).not.toBe(initial);

    await page.click('button[data-verify-nav="next"]');
    await page.waitForTimeout(500);
    expect(await dateKey()).toBe(initial);
  });

  test('ツールバーからスニペットを作成できる', async ({ page }) => {
    const snippet = `E2Eスニペット-${Date.now()}`;
    await page.click('button[data-verify-tool="snippet"]');
    // 入力は textarea(placeholder="テキストを入力...")、確定は「作成」。
    // 見出しは role で取る（同じ文言をツールバーのツールチップも持つため getByText は曖昧）。
    await expect(page.getByRole('heading', { name: 'スニペットを作成' })).toBeVisible();
    await page.fill('textarea[placeholder*="テキスト"]', snippet);
    await page.getByRole('button', { name: '作成', exact: true }).click();

    await page.waitForTimeout(1000);
    await expect(page.getByText(snippet)).toBeVisible();
  });

  test('スニペット作成ダイアログで「画像から読み取る」に切り替えられる', async ({ page }) => {
    await page.click('button[data-verify-tool="snippet"]');
    await expect(page.getByRole('heading', { name: 'スニペットを作成' })).toBeVisible();

    await page.click('button[data-verify-source-tab="image"]');
    // 画像タブではテキスト入力が消え、ドロップゾーン（画像用 file input）が出る。
    // 画像を選んだ時点で読み取りまで自動で進むので、未選択のうちはボタンを出さない。
    await expect(page.locator('textarea')).toHaveCount(0);
    await expect(page.locator('input[type="file"][accept*="image/"]')).toHaveCount(1);
    await expect(page.getByRole('button', { name: /読み取/ })).toHaveCount(0);

    await page.click('button[data-verify-source-tab="text"]');
    await expect(page.locator('textarea')).toBeVisible();
  });

  test('押せる要素にポインタカーソルが出る', async ({ page }) => {
    // Tailwind v4 の Preflight が button を cursor:default にする。押せる物が
    // 押せるように見えないと操作が伝わらないので、globals.css で戻している。
    for (const sel of [
      'button[data-verify-tool="snippet"]',
      'button[data-verify-view-option="daily"]',
      'button[data-verify-nav="next"]',
    ]) {
      const cursor = await page.locator(sel).evaluate((el) => getComputedStyle(el).cursor);
      expect(cursor, sel).toBe('pointer');
    }
  });

  test('入力中でも Escape でダイアログを閉じられ、入力は持ち越さない', async ({ page }) => {
    // textarea にフォーカスがある状態の Escape は、form の stopPropagation に阻まれて
    // 長らく効いていなかった（capture で拾うようにして解消）。ここで固定する。
    await page.click('button[data-verify-tool="snippet"]');
    const textarea = page.locator('textarea');
    await textarea.fill('破棄されるはずの下書き');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('heading', { name: 'スニペットを作成' })).toHaveCount(0);

    // 開き直したときに前回の入力が残らない
    await page.click('button[data-verify-tool="snippet"]');
    await expect(textarea).toHaveValue('');
    await page.keyboard.press('Escape');

    // 写真ダイアログも同じく Escape で閉じる
    await page.click('button[data-verify-tool="photo"]');
    await expect(page.getByRole('heading', { name: '写真を追加' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('heading', { name: '写真を追加' })).toHaveCount(0);
  });

  test('ツールバーのショートカット（S / I）が効き、入力中は誤発火しない', async ({ page }) => {
    await page.keyboard.press('s');
    await expect(page.getByRole('heading', { name: 'スニペットを作成' })).toBeVisible();

    // 本文に s / i を打っても写真ダイアログは開かない（そのまま文字として入る）
    await page.locator('textarea').pressSequentially('sisi');
    await expect(page.locator('textarea')).toHaveValue('sisi');
    await expect(page.getByRole('heading', { name: '写真を追加' })).toHaveCount(0);

    await page.keyboard.press('Escape');
    await page.keyboard.press('i');
    await expect(page.getByRole('heading', { name: '写真を追加' })).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('ツールチップのショートカットが kbd として描かれる', async ({ page }) => {
    // 「I」を薄い文字で置いていた頃、ただの縦棒に見えて誰もキーだと気づかなかった。
    // 原因は文字ではなく「キーとして描いていなかったこと」なので、枠付きの kbd で
    // 描くことを契約として固定する（文字は Image の I のまま）。
    const key = page.locator('[data-verify-tooltip="photo"] kbd');
    await expect(key).toHaveText('I');
  });

  test('ダイアログを開いている間の Backspace で背後のカードが消えない', async ({ page }) => {
    // キーハンドラの dialogOpen ガードが削除分岐より後ろにあり、ライトボックスや
    // ダイアログ表示中の Backspace が背後の選択カードをサーバーごと消していた。
    // 入力欄以外にフォーカスがある状態を作るのがポイント（textarea だと素通りする）。
    const snippet = `E2E消えない-${Date.now()}`;
    await page.click('button[data-verify-tool="snippet"]');
    await page.fill('textarea[placeholder*="テキスト"]', snippet);
    await page.getByRole('button', { name: '作成', exact: true }).click();
    await expect(page.getByText(snippet)).toBeVisible({ timeout: 10000 });

    // カードを選択してから写真ダイアログを開く（カードは選択されたまま背後に残る）
    const card = page.locator('[data-verify-unit="BoardCard"]').filter({ hasText: snippet });
    await card.click();
    await expect(card).toHaveAttribute('data-verify-selected', 'true');
    await page.click('button[data-verify-tool="photo"]');
    await expect(page.getByRole('heading', { name: '写真を追加' })).toBeVisible();

    // 入力欄ではなくダイアログの見出しにフォーカスが無い状態で Backspace
    await page.keyboard.press('Backspace');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('heading', { name: '写真を追加' })).toHaveCount(0);

    // 消えていないこと（リロードしてサーバー側でも生きているのを確かめる）
    await page.reload();
    await page.waitForSelector('[role="application"]');
    await expect(page.getByText(snippet)).toBeVisible({ timeout: 10000 });
  });

  test('日記は自動では出ず、選んで置いてから外せる', async ({ page }) => {
    // 以前は期間内の日記が勝手にカード化されていた。置いた覚えのないものが現れる
    // 一方で外し方も見えなかったので、「選んで置く／選んで外す」に変えた。
    const unique = `ボードE2E-${Date.now()}`;
    await page.goto('/entries/new');
    const editor = page.locator('[contenteditable="true"]').first();
    await editor.click();
    await editor.pressSequentially(unique);
    await waitForAutosave(page);

    await page.goto('/board');
    await page.waitForSelector('[role="application"]');
    await page.waitForTimeout(1500);

    // 1. 書いただけでは盤面に出ない
    await expect(page.getByText(unique)).toHaveCount(0);

    // 2. ツールバーから選んで置くと出る
    await page.click('button[data-verify-tool="entry"]');
    await expect(page.getByRole('heading', { name: 'エントリーを置く' })).toBeVisible();
    await page.locator('button[data-verify-entry-option]:not([disabled])').first().click();
    // 置けたらダイアログは自分で閉じる。開いたままだと置いたカードが裏に隠れ、
    // 一覧の表示も変わらないので「押しても何も起きない」ように見えていた。
    await expect(page.getByRole('heading', { name: 'エントリーを置く' })).toHaveCount(0, {
      timeout: 10000,
    });
    await expect(page.getByText(unique).first()).toBeVisible({ timeout: 10000 });

    // 3. カードを選ぶとツールバーが操作に入れ替わり、そこから外せる
    const card = page.locator('[data-verify-unit="BoardCard"]').filter({ hasText: unique });
    await card.locator('button').first().click({ force: true });
    await expect(page.locator('[data-verify-unit="BoardToolbar"]')).toHaveAttribute(
      'data-verify-mode',
      'card',
    );
    await page.click('button[data-verify-card-action="delete"]');
    await page.waitForTimeout(2000);

    // 4. 外しても日記そのものは残っている（盤面から消えるだけ）
    await page.reload();
    await page.waitForSelector('[role="application"]');
    await page.waitForTimeout(1500);
    await expect(page.getByText(unique)).toHaveCount(0);

    await page.goto('/entries');
    await expect(page.getByText(unique).first()).toBeVisible({ timeout: 10000 });

    await deleteEntriesByMarker(page, unique);
  });
});
