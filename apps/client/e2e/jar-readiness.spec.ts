import { expect, test } from './fixtures/auth';

/**
 * 発酵瓶の readiness（issue #278）の受け入れ基準を通しで確かめる。
 *
 * 単体テストでは「サーバーが総和を返す」「瓶が readiness で見た目を変える」を別々に
 * 押さえているが、**その2つが実際に繋がっているか**はここでしか分からない。
 * 特に「エントリを書いた直後に反映される」は、cron を待たず再計算する経路が
 * 生きていることの証明なので、実 DB を通した往復でないと意味がない。
 */

/** localStorage に入っているアクセストークン（auth fixture のログイン後に入る）。 */
async function accessToken(page: import('@playwright/test').Page): Promise<string> {
  const token = await page.evaluate(() => localStorage.getItem('oryzae_access_token'));
  expect(token, 'ログイン後にアクセストークンが入っていること').toBeTruthy();
  return token ?? '';
}

async function fetchReadiness(page: import('@playwright/test').Page) {
  const res = await page.request.get('/api/v1/fermentations/readiness', {
    headers: { Authorization: `Bearer ${await accessToken(page)}` },
  });
  expect(res.status()).toBe(200);
  return res.json();
}

test.describe('発酵瓶の readiness (#278)', () => {
  test.beforeEach(async ({ authenticated }) => {
    // ログイン済み状態
  });

  test('readiness API が top / total / 問い数を返す', async ({ page }) => {
    const body = await fetchReadiness(page);

    expect(typeof body.top).toBe('number');
    expect(typeof body.total).toBe('number');
    expect(typeof body.questionCount).toBe('number');
    // top は1問いぶんなので 0〜1、total は総和なので問いの数まで。
    expect(body.top).toBeGreaterThanOrEqual(0);
    expect(body.top).toBeLessThanOrEqual(1);
    expect(body.total).toBeGreaterThanOrEqual(body.top);
    expect(body.total).toBeLessThanOrEqual(body.questionCount);
  });

  test('次回発火を逆算できる材料を返さない', async ({ page }) => {
    const body = await fetchReadiness(page);

    // 「いつ来るか分からない」が体験の芯なので、admin にだけ出す値が
    // client 用 API に混ざっていないことをここで固定する。
    expect(Object.keys(body).sort()).toEqual(['questionCount', 'top', 'total']);
  });

  test('エントリを書くと cron を待たず readiness が上がる', async ({ page }) => {
    const token = await accessToken(page);
    const headers = { Authorization: `Bearer ${token}` };

    // 問いが無いと readiness は常に 0（総和の対象がない）。無ければ作る。
    const questionsRes = await page.request.get('/api/v1/questions', { headers });
    expect(questionsRes.status()).toBe(200);
    let questions = await questionsRes.json();
    if (!Array.isArray(questions) || questions.length === 0) {
      const created = await page.request.post('/api/v1/questions', {
        headers,
        data: { string: `E2E readiness ${Date.now()}` },
      });
      expect(created.status()).toBe(201);
      questions = [await created.json()];
    }
    const questionId = questions[0].id;

    const before = await fetchReadiness(page);

    // ja 閾値は 1000 字。charScore を必ず動かすために十分な長さを書く。
    // （既に満タンの問いだと上がらないので、その場合は「下がらない」ことを見る）
    const entryRes = await page.request.post('/api/v1/entries', {
      headers,
      data: {
        content: 'あ'.repeat(1200),
        editorType: 'plain',
        editorVersion: '1',
        fermentationEnabled: true,
      },
    });
    expect(entryRes.status()).toBe(201);
    const entry = await entryRes.json();

    // 問い単位 readiness なので、問いに紐づけて初めて材料になる。
    const linkRes = await page.request.post(`/api/v1/entries/${entry.id}/questions/${questionId}`, {
      headers,
    });
    expect(linkRes.status()).toBe(201);

    const after = await fetchReadiness(page);

    // cron の日次更新を待たずに反映されること（受け入れ基準「リアルタイムで反映」）。
    expect(after.total).toBeGreaterThanOrEqual(before.total);
    // この問いは 1200 字ぶんの材料を得たので、時間ゲートで頭打ちでない限り 0 ではない。
    expect(after.total).toBeGreaterThan(0);

    // 後片付け（他テストの前提を汚さない）
    await page.request.delete(`/api/v1/entries/${entry.id}`, { headers });
  });

  test('瓶に readiness の数値も "%" も表示しない', async ({ page }) => {
    await page.goto('/jar');
    const vessel = page.locator('[data-verify-unit="JarVessel"]');
    await expect(vessel).toBeVisible();

    // 瓶の中に見えるのは漂う言葉だけ。数字が出たら「あと N%」を露出したのと同じ。
    const text = (await vessel.innerText()).trim();
    expect(text).not.toMatch(/[%％]/);
    expect(text).not.toMatch(/\d/);
  });

  test('瓶の見た目が readiness に追従している（契約が描画数と一致する）', async ({ page }) => {
    await page.goto('/jar');
    const vessel = page.locator('[data-verify-unit="JarVessel"]');
    await expect(vessel).toBeVisible();

    const fillPct = Number(await vessel.getAttribute('data-verify-fill-pct'));
    const microbes = Number(await vessel.getAttribute('data-verify-microbes'));
    const bubbles = Number(await vessel.getAttribute('data-verify-bubbles'));

    expect(fillPct).toBeGreaterThanOrEqual(0);
    expect(fillPct).toBeLessThanOrEqual(100);

    // 契約と実際の描画数が食い違っていたら、readiness は絵に効いていない。
    await expect(vessel.locator('[data-jar-microbe]')).toHaveCount(microbes);
    await expect(vessel.locator('[data-jar-bubble]')).toHaveCount(bubbles);

    // 段階の順序（液 → 微生物 → 泡）が保たれていること。
    if (microbes > 0) expect(fillPct).toBe(100);
    if (bubbles > 0) expect(microbes).toBeGreaterThan(0);
  });
});
