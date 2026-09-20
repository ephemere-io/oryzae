import { expect, test } from './fixtures/auth';

/**
 * SP のボードを**指で**触る（`playwright.config.ts` の mobile-chrome プロジェクト）。
 *
 * これまで SP の E2E は Desktop Chrome の viewport を狭めただけで、タップもピンチも
 * 再現できなかった。そのため「盤面がピンチをブラウザに奪われてタブ一覧が出る」
 * 「タップしても埋もれたまま」という壊れ方を CI が一度も拾えず、実機レビューで
 * 続けて指摘された。ここは touch を持つ端末で走らせ、指の経路そのものを通す。
 */

type Page = import('@playwright/test').Page;
type TouchPoint = { x: number; y: number; id: number };

/** world ノードの transform（倍率と位置）。盤面が動いたかはここで見る。 */
async function worldTransform(page: Page): Promise<string> {
  return page.evaluate(() => {
    const world = document.querySelector('[role="application"]')?.firstElementChild;
    return world instanceof HTMLElement ? world.style.transform : '';
  });
}

/**
 * 生のタッチを流す。
 *
 * Playwright の `tap()` は当たり判定（他の要素に遮られていないか）を見るので、
 * 「払う」「つまむ」には使えない。CDP で指の位置を直接動かす。
 */
async function touchStream(page: Page, frames: TouchPoint[][]): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  for (const [index, touchPoints] of frames.entries()) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: index === 0 ? 'touchStart' : 'touchMove',
      touchPoints,
    });
    await page.waitForTimeout(16);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(400);
}

/** カードにも操作 UI にも当たらない点（盤面を払える場所）。 */
async function emptySpot(page: Page): Promise<{ x: number; y: number } | null> {
  return page.evaluate(() => {
    const frame = document.querySelector('[role="application"]');
    if (!(frame instanceof HTMLElement)) return null;
    const rect = frame.getBoundingClientRect();
    for (let y = rect.bottom - 24; y > rect.top + 24; y -= 24) {
      for (let x = rect.left + 24; x < rect.right - 24; x += 24) {
        const element = document.elementFromPoint(x, y);
        if (!element || !frame.contains(element)) continue;
        if (element.closest('[data-canvas-no-pan]')) continue;
        return { x: Math.round(x), y: Math.round(y) };
      }
    }
    return null;
  });
}

/** 道具箱からスニペットを 1 枚作る。 */
async function createSnippet(page: Page, text: string): Promise<void> {
  await page.getByRole('button', { name: 'スニペットを作成' }).tap();
  await page.getByPlaceholder('書き留めておきたいことを').fill(text);
  await page.getByRole('button', { name: '保存' }).tap();
  await expect(page.getByText(text)).toBeVisible({ timeout: 15_000 });
}

/** カードの id と重なり順。 */
async function cards(page: Page): Promise<{ id: string; z: number; text: string }[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll('[data-card-id]')].map((el) => ({
      id: el.getAttribute('data-card-id') ?? '',
      z: Number(el instanceof HTMLElement ? el.style.zIndex : 0),
      text: el.textContent ?? '',
    })),
  );
}

test.describe('SP のボード（指で触る）', () => {
  test.beforeEach(async ({ authenticated: _, page }) => {
    await page.goto('/board');
    await page.waitForSelector('[data-verify-unit="SpBoardSurface"]');
    // 初期の寄せ（いちばん新しいカードへ等倍）が済むまで待つ。
    await page.waitForTimeout(1200);
  });

  test('盤面がピンチを受け取り、ブラウザのページズームには渡さない', async ({ page }) => {
    // touch-action: none が外れると、iOS Safari はピンチをタブ一覧に使ってしまう。
    const frame = page.locator('[role="application"]').first();
    await expect(frame).toHaveCSS('touch-action', 'none');

    const before = await worldTransform(page);
    const frames: TouchPoint[][] = [];
    for (let i = 0; i <= 8; i += 1) {
      frames.push([
        { x: 140 - i * 8, y: 320, id: 1 },
        { x: 240 + i * 8, y: 320, id: 2 },
      ]);
    }
    await touchStream(page, frames);

    expect(await worldTransform(page)).not.toBe(before);
    // ブラウザ側のズームは動いていない（動くと道具箱が画面外へ出る）。
    expect(await page.evaluate(() => window.visualViewport?.scale ?? 1)).toBe(1);
  });

  test('空きを指で払うと盤面が動く（遠くのカードに会いに行ける）', async ({ page }) => {
    const spot = await emptySpot(page);
    test.skip(spot === null, '空いている場所が見つからない');
    if (!spot) return;

    const before = await worldTransform(page);
    const frames: TouchPoint[][] = [];
    for (let i = 0; i <= 8; i += 1) {
      frames.push([{ x: spot.x + i * 18, y: spot.y - i * 9, id: 1 }]);
    }
    await touchStream(page, frames);

    expect(await worldTransform(page)).not.toBe(before);
  });

  test('「全体を見る」で引いて、貼ってあるものが視界に入る', async ({ page }) => {
    const marker = `E2E全体-${Date.now()}`;
    await createSnippet(page, marker);

    const before = await worldTransform(page);
    await page.getByRole('button', { name: '全体を見る' }).tap();
    await page.waitForTimeout(600);

    expect(await worldTransform(page)).not.toBe(before);
    await expect(page.getByText(marker)).toBeVisible();
    // 俯瞰（全体マップ）も出ている
    await expect(page.locator('[data-verify-unit="CanvasMinimap"]')).toHaveCount(1);
  });

  test('重なったカードをタップすると前面に出る', async ({ page }) => {
    const lower = `E2E下-${Date.now()}`;
    const upper = `E2E上-${Date.now()}`;
    await createSnippet(page, lower);
    await createSnippet(page, upper);

    // 新しいカードは同じ場所（いま見えている真ん中）に生まれるので、上の 1 枚を
    // 指でずらして「一部だけ重なる」形にする。
    const upperCard = page.locator('[data-card-id]').filter({ hasText: upper });
    const box = await upperCard.boundingBox();
    test.skip(box === null, 'カードの位置が取れない');
    if (!box) return;
    await touchStream(page, [
      [{ x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2), id: 1 }],
      [
        {
          x: Math.round(box.x + box.width / 2 + 30),
          y: Math.round(box.y + box.height / 2 - 70),
          id: 1,
        },
      ],
      [
        {
          x: Math.round(box.x + box.width / 2 + 60),
          y: Math.round(box.y + box.height / 2 - 140),
          id: 1,
        },
      ],
    ]);

    // 下のカードの、覆われていない所を指で触る
    const point = await page.evaluate((text) => {
      const card = [...document.querySelectorAll('[data-card-id]')].find((el) =>
        (el.textContent ?? '').includes(text),
      );
      if (!card) return null;
      const rect = card.getBoundingClientRect();
      for (let y = rect.bottom - 8; y > rect.top + 4; y -= 8) {
        for (let x = rect.right - 8; x > rect.left + 4; x -= 8) {
          const hit = document.elementFromPoint(x, y)?.closest('[data-card-id]');
          if (hit === card) return { x: Math.round(x), y: Math.round(y) };
        }
      }
      return null;
    }, lower);
    test.skip(point === null, '下のカードの見えている所が見つからない');
    if (!point) return;

    await page.touchscreen.tap(point.x, point.y);
    await page.waitForTimeout(700);

    const after = await cards(page);
    const lowerCard = after.find((c) => c.text.includes(lower));
    const upperAfter = after.find((c) => c.text.includes(upper));
    expect(lowerCard, '下のカードが見つからない').toBeTruthy();
    expect(upperAfter, '上のカードが見つからない').toBeTruthy();
    expect(lowerCard?.z ?? 0).toBeGreaterThan(upperAfter?.z ?? 0);
  });
});
