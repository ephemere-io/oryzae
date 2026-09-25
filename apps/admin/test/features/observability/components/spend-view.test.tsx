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
          model: 'claude-sonnet-5',
          costUsd: 0.8,
          byTokenType: [{ tokenType: 'output_tokens', costUsd: 0.8 }],
        },
        {
          model: 'claude-sonnet-4-6',
          costUsd: 0.43,
          byTokenType: [{ tokenType: 'output_tokens', costUsd: 0.43 }],
        },
      ],
      // 用途別は Workspace 別。ボード OCR と写真の文字起こしは同じ sonnet-5 だが
      // Workspace が違うので、ここでは分かれて出る（モデル別では分けられない）。
      byWorkspace: [
        {
          workspaceId: 'wrkspc_ocr',
          workspaceName: 'oryzae-prod-ocr',
          costUsd: 0.8,
          byModel: [{ model: 'claude-sonnet-5', costUsd: 0.8 }],
        },
        {
          workspaceId: 'wrkspc_ferm',
          workspaceName: 'oryzae-prod-fermentation',
          costUsd: 0.43,
          byModel: [{ model: 'claude-sonnet-4-6', costUsd: 0.43 }],
        },
      ],
      groupingUnavailable: false,
      workspaceNamesUnavailable: false,
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
          byWorkspace: [],
          groupingUnavailable: false,
          workspaceNamesUnavailable: false,
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
          byWorkspace: [],
          groupingUnavailable: false,
          workspaceNamesUnavailable: false,
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
// キャッシュ・値引き・課金丸めも反映済み。「画像の文字起こしがいくらか」はここで読む。
describe('SpendView の実請求額の内訳', () => {
  // 用途別は Workspace 別。モデル ID からの読み替えは 2026-09 に撤去した
  // （ボード OCR と写真の文字起こしが同じモデルで、CI も同じモデルを使うため）。
  it('用途別（Workspace 別）の実額を出す', () => {
    renderView(makeData());

    expect(screen.getByText('実請求額の内訳（用途別 = Workspace 別）')).toBeTruthy();
    // Workspace 名は Anthropic 側のものをそのまま出す（用途名に読み替えない）
    expect(screen.getByText('oryzae-prod-ocr')).toBeTruthy();
    expect(screen.getByText('oryzae-prod-fermentation')).toBeTruthy();
  });

  it('モデル別の実額も出す（単価の検算用）', () => {
    renderView(makeData());

    expect(screen.getByText('実請求額の内訳（モデル別）')).toBeTruthy();
    expect(screen.getAllByText('claude-sonnet-5').length).toBeGreaterThan(0);
    // 同じ $0.8000 が 4 か所に出る: Workspace 合計・Workspace 内のモデル・
    // モデル別の合計・その token_type。どの階層でも金額が一致していることの証拠。
    expect(screen.getAllByText('$0.8000').length).toBe(4);
  });

  it('token_type の内訳も出す（キャッシュが混ざれば見える）', () => {
    renderView(makeData());

    expect(screen.getAllByText('output_tokens').length).toBeGreaterThan(0);
  });

  // モデル別を用途別と取り違えさせない。同じモデルを複数の機能と CI が使うので、
  // ここから機能別の額は読めない——その但し書きを画面に置く。
  it('モデル別は用途の軸ではないと明示する', () => {
    renderView(makeData());

    expect(screen.getByText(/用途の軸ではありません/)).toBeTruthy();
  });

  it('Workspace 名が引けなかったときは、ID 表示である旨を出す', () => {
    const base = makeData();
    renderView({
      ...base,
      actual: { ...base.actual, workspaceNamesUnavailable: true },
    });

    expect(screen.getByText(/一部は ID 表示です/)).toBeTruthy();
  });

  // group_by が効かないと総額は正しいまま内訳だけ消える。空配列を
  // 「内訳ゼロ」と見せると気づけないので、明示的に伝える。
  it('内訳の隣に Console への照合リンクを置く', () => {
    renderView(makeData());

    expect(screen.getByText('Console の Cost ページで照合')).toBeTruthy();
    expect(screen.getByText(/API キー別の内訳もそちらで見られます/)).toBeTruthy();
  });

  it('内訳が取れなかったときは、その旨を出して内訳を並べない', () => {
    const base = makeData();
    renderView({
      ...base,
      actual: { ...base.actual, groupingUnavailable: true },
    });

    expect(screen.getByText(/内訳を返しませんでした/)).toBeTruthy();
    expect(screen.queryByText('実請求額の内訳（モデル別）')).toBeNull();
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
          byWorkspace: [],
          groupingUnavailable: false,
          workspaceNamesUnavailable: false,
        },
      }),
    );

    expect(screen.queryByText('実請求額の内訳（モデル別）')).toBeNull();
  });
});
