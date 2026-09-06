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
      byModel: [
        {
          model: 'claude-opus-5',
          costUsd: 0.8,
          byTokenType: [{ tokenType: 'output_tokens', costUsd: 0.8 }],
          feature: 'OCR',
        },
        {
          model: 'claude-sonnet-4-6',
          costUsd: 0.43,
          byTokenType: [{ tokenType: 'output_tokens', costUsd: 0.43 }],
          feature: '発酵',
        },
      ],
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
          byModel: [],
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
          byModel: [],
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
    expect(screen.getAllByText('claude-sonnet-4-6').length).toBeGreaterThan(0);
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

    expect(screen.getAllByText('claude-opus-5').length).toBeGreaterThan(0);
    expect(screen.getByText(/in 300,000 × \$5\.00\/MTok = \$1\.5000/)).toBeTruthy();
  });
});

// 用途別（= モデル別）の内訳は **実額** で出す。自前トークンの推定ではないので、
// キャッシュ・値引き・課金丸めも反映済み。「OCR がいくらか」はここで読む。
describe('SpendView の実請求額のモデル別内訳', () => {
  it('モデル別の実額と、そのモデルを使っている機能を出す', () => {
    renderView(makeData());

    expect(screen.getByText('実請求額の内訳（モデル別）')).toBeTruthy();
    expect(screen.getAllByText('claude-opus-5').length).toBeGreaterThan(0);
    expect(screen.getByText(/← OCR のモデル/)).toBeTruthy();
    // モデル合計と token_type 内訳の両方に出る（内訳が合計と一致している証拠）
    expect(screen.getAllByText('$0.8000').length).toBe(2);
    expect(screen.getByText(/← 発酵 のモデル/)).toBeTruthy();
  });

  it('token_type の内訳も出す（キャッシュが混ざれば見える）', () => {
    renderView(makeData());

    expect(screen.getAllByText('output_tokens').length).toBeGreaterThan(0);
  });

  // 「そのモデルのコスト」であって「その機能のコスト」ではない。
  // 同じモデルを CI 等が使えば混ざるので、そこを言い切らない。
  it('用途名が「そのモデルを使っている機能」だと明示する', () => {
    renderView(makeData());

    expect(screen.getByText(/そのモデルを使っている機能/)).toBeTruthy();
  });

  it('実額が取れないときは内訳を出さない（$0 の行を並べない）', () => {
    renderView(
      makeData({
        actual: {
          status: 'not-configured',
          totalCostUsd: null,
          daily: [],
          truncated: false,
          message: null,
          byModel: [],
        },
      }),
    );

    expect(screen.queryByText('実請求額の内訳（モデル別）')).toBeNull();
  });
});
