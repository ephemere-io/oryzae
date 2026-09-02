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
    ...overrides,
  };
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
  it('モデル名と単価、入出力それぞれの内訳を出す', () => {
    renderView(makeData());

    expect(screen.getByText('計算根拠')).toBeTruthy();
    expect(screen.getByText('claude-sonnet-4-6')).toBeTruthy();
    // in 300,000 × $3/MTok = $0.9000
    expect(screen.getByText(/in 300,000 × \$3\.00\/MTok = \$0\.9000/)).toBeTruthy();
    // out 40,000 × $15/MTok = $0.6000
    expect(screen.getByText(/out 40,000 × \$15\.00\/MTok = \$0\.6000/)).toBeTruthy();
    expect(screen.getByText(/計 \$1\.5000/)).toBeTruthy();
  });

  it('サーバーが返した単価をそのまま使う（画面側で持たない）', () => {
    renderView(
      makeData({
        estimated: {
          ...makeData().estimated,
          pricing: { modelId: 'claude-opus-5', inputUsdPerMTok: 5, outputUsdPerMTok: 25 },
        },
      }),
    );

    expect(screen.getByText('claude-opus-5')).toBeTruthy();
    expect(screen.getByText(/in 300,000 × \$5\.00\/MTok = \$1\.5000/)).toBeTruthy();
  });
});
