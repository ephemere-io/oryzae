import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SpendView } from '@/features/observability/components/spend-view';
import type { SpendData } from '@/features/observability/hooks/use-spend';

afterEach(cleanup);

const COST_CONSOLE_URL = 'https://platform.claude.com/cost';

function makeData(overrides: Partial<SpendData> = {}): SpendData {
  return {
    rangeDays: 30,
    actual: {
      status: 'ok',
      totalCostUsd: 1.23,
      daily: [{ date: '2026-08-30', costUsd: 1.23 }],
      truncated: false,
      message: null,
    },
    estimated: {
      status: 'ok',
      // 発酵 1.19 + OCR 0.30
      totalCostUsd: 1.49,
      truncated: false,
      fermentation: {
        pricing: { modelId: 'claude-sonnet-4-6', inputUsdPerMTok: 3, outputUsdPerMTok: 15 },
        totalCostUsd: 1.19,
        inputTokens: 300000,
        outputTokens: 40000,
        fermentationCount: 12,
        untrackedCount: 0,
        truncated: false,
        daily: [
          {
            date: '2026-08-30',
            estimatedCostUsd: 1.19,
            inputTokens: 300000,
            outputTokens: 40000,
            fermentationCount: 12,
          },
        ],
        byUser: [
          {
            userId: 'u1',
            email: 'user@test.com',
            estimatedCostUsd: 1.19,
            inputTokens: 300000,
            outputTokens: 40000,
            fermentationCount: 12,
          },
        ],
      },
      ocr: {
        status: 'ok',
        pricing: { modelId: 'claude-opus-5', inputUsdPerMTok: 5, outputUsdPerMTok: 25 },
        totalCostUsd: 0.3,
        inputTokens: 40000,
        outputTokens: 4000,
        requestCount: 4,
        untrackedCount: 0,
        truncated: false,
        daily: [
          {
            date: '2026-08-30',
            estimatedCostUsd: 0.3,
            inputTokens: 40000,
            outputTokens: 4000,
            requestCount: 4,
          },
        ],
        byModel: [
          {
            model: 'claude-opus-5',
            requestCount: 4,
            estimatedCostUsd: 0.3,
            inputTokens: 40000,
            outputTokens: 4000,
            unpriced: false,
          },
        ],
        byUser: [
          {
            userId: 'u1',
            email: 'user@test.com',
            estimatedCostUsd: 0.3,
            inputTokens: 40000,
            outputTokens: 4000,
            requestCount: 4,
          },
        ],
      },
    },
    ...overrides,
  };
}

/** estimated の一部だけ差し替える（ネストが深いので毎回全部書かない）。 */
function withEstimated(patch: Partial<SpendData['estimated']>): SpendData {
  const base = makeData();
  return { ...base, estimated: { ...base.estimated, ...patch } };
}

function renderView(data: SpendData | null) {
  render(<SpendView data={data} loading={false} error={null} onRefresh={() => {}} />);
}

/** Console の Cost ページへ飛べる <a> だけを拾う。 */
function consoleLinks(): HTMLAnchorElement[] {
  return screen
    .getAllByRole('link')
    .filter((el): el is HTMLAnchorElement => el.getAttribute('href') === COST_CONSOLE_URL);
}

describe('SpendView の Anthropic Console リンク', () => {
  // 画面の実請求額は「Anthropic がそう請求した」ことの根拠になっていないと意味がない。
  // Console の Cost ページへ飛べれば、その場で数字を突き合わせられる。
  it('実額が取れているとき、照合用のリンクを出す', () => {
    renderView(makeData());

    const links = consoleLinks();
    expect(links.length).toBeGreaterThan(0);
    expect(screen.getByText('Console で照合')).toBeTruthy();
  });

  it('未設定のときも Console で確認できることを示す', () => {
    renderView(
      makeData({
        actual: {
          status: 'not-configured',
          totalCostUsd: null,
          daily: [],
          truncated: false,
          message: null,
        },
      }),
    );

    expect(screen.getByText('未設定')).toBeTruthy();
    expect(consoleLinks().length).toBeGreaterThan(0);
  });

  it('取得失敗のときも Console で確認できることを示す', () => {
    renderView(
      makeData({
        actual: {
          status: 'error',
          totalCostUsd: null,
          daily: [],
          truncated: false,
          message: 'cost_report responded 401',
        },
      }),
    );

    expect(screen.getByText('取得失敗')).toBeTruthy();
    expect(screen.getByText('cost_report responded 401')).toBeTruthy();
    expect(consoleLinks().length).toBeGreaterThan(0);
  });

  it('外部リンクは新規タブで開き、rel で参照元を渡さない', () => {
    renderView(makeData());

    for (const link of consoleLinks()) {
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.getAttribute('rel')).toContain('noopener');
      expect(link.getAttribute('rel')).toContain('noreferrer');
    }
  });
});

describe('SpendView の推定コストの計算根拠', () => {
  // 実額は Console のリンクで裏取りできるが、推定は式を出さないと確かめようがない。
  // 単価はサーバー (claude-pricing.ts) から来るので、画面が独自に持たないことも保証する。
  it('発酵のモデル名と単価、入出力それぞれの内訳を出す', () => {
    renderView(makeData());

    expect(screen.getByText('claude-sonnet-4-6')).toBeTruthy();
    // in 300,000 × $3/MTok = $0.9000
    expect(screen.getByText(/in 300,000 × \$3\.00\/MTok = \$0\.9000/)).toBeTruthy();
    // out 40,000 × $15/MTok = $0.6000
    expect(screen.getByText(/out 40,000 × \$15\.00\/MTok = \$0\.6000/)).toBeTruthy();
    expect(screen.getByText(/計 \$1\.5000/)).toBeTruthy();
  });

  it('サーバーが返した単価をそのまま使う（画面側で持たない）', () => {
    renderView(
      withEstimated({
        fermentation: {
          ...makeData().estimated.fermentation,
          pricing: { modelId: 'claude-opus-5', inputUsdPerMTok: 5, outputUsdPerMTok: 25 },
        },
      }),
    );

    expect(screen.getAllByText('claude-opus-5').length).toBeGreaterThan(0);
    expect(screen.getByText(/in 300,000 × \$5\.00\/MTok = \$1\.5000/)).toBeTruthy();
  });
});

// OCR は claude-opus-5 で動いているのに usage が捨てられており、推定に $0 しか
// 乗っていなかった。実請求との差が「原因不明の乖離」に見えていた原因のひとつ。
describe('SpendView の OCR コスト', () => {
  it('OCR 単体の金額・回数を独立したカードで出す', () => {
    renderView(makeData());

    expect(screen.getByText('OCR (推定)')).toBeTruthy();
    expect(screen.getByText('$0.3000')).toBeTruthy();
    expect(screen.getByText(/4 回 \/ in 40,000 · out 4,000/)).toBeTruthy();
  });

  it('OCR の計算根拠は OCR の単価 ($5/$25) で出す（発酵の単価を使わない）', () => {
    renderView(makeData());

    // in 40,000 × $5/MTok = $0.2000
    expect(screen.getByText(/in 40,000 × \$5\.00\/MTok = \$0\.2000/)).toBeTruthy();
    // out 4,000 × $25/MTok = $0.1000
    expect(screen.getByText(/out 4,000 × \$25\.00\/MTok = \$0\.1000/)).toBeTruthy();
  });

  it('推定合計は発酵 + OCR で、内訳も並記する', () => {
    renderView(makeData());

    // カードの合計とユーザー別の行、両方に出る（両者が一致していることの裏返し）。
    expect(screen.getAllByText('$1.4900').length).toBeGreaterThan(0);
    expect(screen.getByText(/発酵 \$1\.1900 \/ OCR/)).toBeTruthy();
  });

  it('実際に使われたモデルを出す（単価の根拠になる）', () => {
    renderView(makeData());

    expect(screen.getByText(/claude-opus-5 · 4 回 · \$0\.3000/)).toBeTruthy();
  });

  it('価格表に無いモデルは金額ではなく「単価不明」と出す', () => {
    renderView(
      withEstimated({
        ocr: {
          ...makeData().estimated.ocr,
          untrackedCount: 2,
          byModel: [
            {
              model: 'some-unpriced-model',
              requestCount: 2,
              estimatedCostUsd: 0,
              inputTokens: 100,
              outputTokens: 10,
              unpriced: true,
            },
          ],
        },
      }),
    );

    expect(screen.getByText(/some-unpriced-model · 2 回 · 単価不明（未計上）/)).toBeTruthy();
    expect(screen.getByText(/価格表に無いモデルで実行された OCR が/)).toBeTruthy();
  });

  // migration 00023 未適用の環境。$0 と表示すると「OCR は使っていない」と誤読される。
  it('OCR を取得できないときは $0 ではなく取得失敗と出す', () => {
    renderView(
      withEstimated({
        status: 'partial',
        totalCostUsd: 1.19,
        ocr: { ...makeData().estimated.ocr, status: 'error', totalCostUsd: 0, requestCount: 0 },
      }),
    );

    expect(screen.getByText('取得失敗')).toBeTruthy();
    expect(screen.getByText(/migration 00023/)).toBeTruthy();
    expect(screen.getByText(/OCR を集計できていないため、推定合計は過少です/)).toBeTruthy();
  });

  it('ユーザー別は発酵と OCR を合算する（カードの合計と一致させる）', () => {
    renderView(makeData());

    // 1.19 + 0.30 = 1.49 が同じ行に出る
    expect(screen.getAllByText('$1.4900').length).toBeGreaterThan(1);
    expect(screen.getByText('user@test.com')).toBeTruthy();
  });
});
