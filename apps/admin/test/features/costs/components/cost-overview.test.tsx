import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CostOverview } from '@/features/costs/components/cost-overview';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function mockResponse(body: unknown): Response {
  return {
    ok: true,
    json: () => Promise.resolve(body),
    status: 200,
  } as Response; // @type-assertion-allowed: テスト用の最小限 Response スタブ
}

const feature = (feature: string, model: string, count: number, est: number) => ({
  feature,
  model,
  rate: { inputUsdPerMTok: 3, outputUsdPerMTok: 15 },
  count,
  userCount: count > 0 ? 1 : 0,
  inputTokens: count * 3105,
  outputTokens: count * 3898,
  estimatedUsd: est,
});

const data = {
  period: { from: '2026-09-01', to: '2026-09-26', label: '9/1 9:00 〜 9/26 21:00 (JST)' },
  actual: {
    status: 'ok',
    totalUsd: 31.46,
    byWorkspace: [
      { name: 'oryzae-prod-fermentation', costUsd: 0.2762, outsideOryzae: false },
      { name: 'oryzae-prod-ocr', costUsd: 0.0102, outsideOryzae: false },
      { name: 'oryzae-ci', costUsd: 0, outsideOryzae: false },
      { name: 'Default Workspace', costUsd: 31.17, outsideOryzae: true },
    ],
    daily: [
      { date: '2026-09-24', costUsd: 6.74 },
      { date: '2026-09-25', costUsd: 0.2594 },
    ],
    projection: { projectedUsd: 37.75, daysElapsed: 25, daysInMonth: 30 },
    truncated: false,
  },
  usage: {
    status: 'ok',
    features: [
      feature('fermentation', 'claude-sonnet-4-6', 2, 0.1356),
      feature('ocr_board', 'claude-sonnet-5', 0, 0),
      feature('ocr_entry', 'claude-sonnet-5', 0, 0),
    ],
    users: [
      {
        userId: 'u1',
        label: 'kunimo (k@example.com)',
        counts: { fermentation: 2, ocr_board: 0, ocr_entry: 0 },
        inputTokens: 6210,
        outputTokens: 7796,
        estimatedUsd: 0.1356,
      },
    ],
    truncated: false,
  },
  consoleUrl: 'https://platform.claude.com/cost',
};

describe('CostOverview', () => {
  afterEach(cleanup);
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('oryzae_admin_access_token', 'test-token');
  });

  it('期間・払った額（Workspace 別・見込み）・使った量（機能別・ユーザー別）を出す', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(data));
    render(<CostOverview />);

    await waitFor(() => expect(screen.getByText('$31.46')).toBeTruthy());
    expect(screen.getByText('9/1 9:00 〜 9/26 21:00 (JST)')).toBeTruthy();
    expect(screen.getByText(/月末までの見込み \$37\.75/)).toBeTruthy();
    // $0 の Workspace も出す。Default Workspace は Oryzae 外と書く
    expect(screen.getByText('oryzae-ci')).toBeTruthy();
    expect(screen.getByText('Oryzae 外の利用')).toBeTruthy();
    // 機能は 3 つとも並ぶ（使われていなくても）
    expect(screen.getByText('ボード OCR')).toBeTruthy();
    expect(screen.getByText('写真の文字起こし')).toBeTruthy();
    const userRow = screen.getByText('kunimo (k@example.com)').closest('tr');
    expect(userRow && within(userRow).getByText('発酵 2')).toBeTruthy();
  });

  it('実額が取れないときは $0 と書かず、使った量は出す', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ ...data, actual: { status: 'not-configured' } }),
    );
    render(<CostOverview />);

    await waitFor(() =>
      expect(screen.getByText('取得できません（ANTHROPIC_ADMIN_KEY 未設定）')).toBeTruthy(),
    );
    expect(screen.queryByText('$31.46')).toBeNull();
    expect(screen.getByText('kunimo (k@example.com)')).toBeTruthy();
  });
});
