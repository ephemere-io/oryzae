import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockNotifyDiscord = vi.fn();

vi.mock('@/contexts/shared/infrastructure/discord-notify.js', () => ({
  COLORS: { SUCCESS: 1, WARNING: 2, ERROR: 3, INFO: 4 },
  notifyDiscord: (...args: unknown[]) => mockNotifyDiscord(...args),
}));

interface FermentationRow {
  user_id: string;
  status: string;
  input_tokens: number | null;
  output_tokens: number | null;
  created_at: string;
}

// Supabase クエリ結果をテストごとに差し替える。
const supabaseState: {
  rows: FermentationRow[];
  error: { message: string } | null;
  shouldThrow: boolean;
  capturedRange: { gte?: string; lte?: string };
} = {
  rows: [],
  error: null,
  shouldThrow: false,
  capturedRange: {},
};

vi.mock('@/contexts/shared/infrastructure/supabase-client.js', () => ({
  getSupabaseClient: () => {
    if (supabaseState.shouldThrow) {
      throw new Error('supabase init failed');
    }
    const builder = {
      eq: () => builder,
      gte: (_col: string, value: string) => {
        supabaseState.capturedRange.gte = value;
        return builder;
      },
      lte: (_col: string, value: string) => {
        supabaseState.capturedRange.lte = value;
        return builder;
      },
      order: () => builder,
      range: (from: number) => {
        if (supabaseState.error) {
          return Promise.resolve({ data: null, error: supabaseState.error });
        }
        // 1ページ目に全件返し、2ページ目以降は空（ページング終了）にする。
        return Promise.resolve({ data: from === 0 ? supabaseState.rows : [], error: null });
      },
    };
    return { from: () => ({ select: () => builder }) };
  },
}));

const mockFetch = vi.fn();

import { COLORS } from '@/contexts/shared/infrastructure/discord-notify.js';
import { cronCostAlert } from '@/contexts/shared/presentation/routes/cron-cost-alert.js';

function createApp() {
  return new Hono().route('/cron', cronCostAlert);
}

const SECRET = 'test-cron-secret';
const validHeaders = { Authorization: `Bearer ${SECRET}` };

function fermentation(overrides: Partial<FermentationRow> = {}): FermentationRow {
  return {
    user_id: 'user-1',
    status: 'completed',
    input_tokens: 100_000,
    output_tokens: 10_000,
    created_at: '2026-08-08T18:05:00.000Z', // JST 8/9 03:05 の定期発酵
    ...overrides,
  };
}

/** Discord embed の fields から値を引く。 */
function fieldValue(name: string): string | undefined {
  const embed = mockNotifyDiscord.mock.calls.at(-1)?.[0];
  return embed?.fields?.find((f: { name: string }) => f.name === name)?.value;
}

describe('cronCostAlert', () => {
  beforeEach(() => {
    mockNotifyDiscord.mockClear();
    mockFetch.mockReset();
    vi.stubGlobal('fetch', mockFetch);
    supabaseState.rows = [];
    supabaseState.error = null;
    supabaseState.shouldThrow = false;
    supabaseState.capturedRange = {};
    vi.stubEnv('CRON_SECRET', SECRET);
    vi.stubEnv('ANTHROPIC_ADMIN_KEY', '');
    // コスト cron は JST 10:00 (= UTC 01:00) 実行 → 対象は JST 前日 (8/9)
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-10T01:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('returns 500 and notifies Discord when CRON_SECRET is missing', async () => {
    vi.stubEnv('CRON_SECRET', '');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await createApp().request('/cron', { method: 'POST' });

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'CRON_SECRET not configured' });
    expect(mockNotifyDiscord).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'コスト cron: CRON_SECRET 未設定',
        color: COLORS.ERROR,
      }),
    );

    errorSpy.mockRestore();
  });

  it('returns 401 and notifies Discord when Authorization mismatches', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await createApp().request('/cron', {
      method: 'POST',
      headers: { Authorization: 'Bearer wrong' },
    });

    expect(res.status).toBe(401);
    expect(mockNotifyDiscord).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'コスト cron: 認証失敗', color: COLORS.ERROR }),
    );

    errorSpy.mockRestore();
  });

  it('returns 500 and notifies Discord when the Supabase query fails', async () => {
    supabaseState.error = { message: 'permission denied' };
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await createApp().request('/cron', { method: 'POST', headers: validHeaders });

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'permission denied' });
    expect(mockNotifyDiscord).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'コスト cron: Supabase クエリ失敗',
        description: 'permission denied',
        color: COLORS.ERROR,
      }),
    );

    errorSpy.mockRestore();
  });

  // ── ここからが issue の本体 ────────────────────────────────
  it('reports a non-zero estimated cost from stored tokens (regression: always $0.0000)', async () => {
    // issue #352 以降 generation_id は常に NULL。旧実装は generation_id NOT NULL で
    // 絞っていたため、この行を1件も拾えず毎日 $0.0000 を報告していた。
    supabaseState.rows = [fermentation()];

    const res = await createApp().request('/cron', { method: 'POST', headers: validHeaders });

    expect(res.status).toBe(200);
    const body = await res.json();
    // 100,000 * $3/1M + 10,000 * $15/1M = 0.3 + 0.15 = 0.45
    expect(body.estimatedCost).toBeCloseTo(0.45, 6);
    expect(body.fermentationCount).toBe(1);
    expect(fieldValue('推定コスト (発酵・記録分)')).toBe('$0.4500');
  });

  it('aggregates over the JST day, not the UTC day', async () => {
    await createApp().request('/cron', { method: 'POST', headers: validHeaders });

    // JST 8/9 = UTC [8/8 15:00, 8/9 14:59:59.999]
    expect(supabaseState.capturedRange.gte).toBe('2026-08-08T15:00:00.000Z');
    expect(supabaseState.capturedRange.lte).toBe('2026-08-09T14:59:59.999Z');
  });

  it('includes a per-user cost breakdown', async () => {
    supabaseState.rows = [
      fermentation({ user_id: 'aaaaaaaa-1111', input_tokens: 100_000, output_tokens: 0 }),
      fermentation({ user_id: 'bbbbbbbb-2222', input_tokens: 300_000, output_tokens: 0 }),
      fermentation({ user_id: 'aaaaaaaa-1111', input_tokens: 100_000, output_tokens: 0 }),
    ];

    const res = await createApp().request('/cron', { method: 'POST', headers: validHeaders });
    const body = await res.json();

    expect(body.userCount).toBe(2);
    const breakdown = fieldValue('ユーザー別 推定コスト (上位5)') ?? '';
    // コスト降順。b が $0.90、a が 2件で $0.60。
    expect(breakdown.indexOf('bbbbbbbb')).toBeLessThan(breakdown.indexOf('aaaaaaaa'));
    expect(breakdown).toContain('$0.9000');
    expect(breakdown).toContain('(2件)');
    // メールアドレスは Discord に送らない（既存の cron 通知の慣習に合わせる）
    expect(breakdown).not.toContain('@');
  });

  it('surfaces fermentations whose tokens were never stored', async () => {
    supabaseState.rows = [
      fermentation(),
      fermentation({ status: 'failed', input_tokens: null, output_tokens: null }),
    ];

    const res = await createApp().request('/cron', { method: 'POST', headers: validHeaders });
    const body = await res.json();

    expect(body.untrackedCount).toBe(1);
    expect(body.failedCount).toBe(1);
    expect(fieldValue('コスト未計上')).toBe('1 件');
  });

  it('reports the actual billed cost when the admin key is configured', async () => {
    vi.stubEnv('ANTHROPIC_ADMIN_KEY', 'sk-ant-admin01-test');
    supabaseState.rows = [fermentation()];
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          data: [{ starting_at: '2026-08-08T00:00:00Z', results: [{ amount: '46.5' }] }],
          has_more: false,
        }),
      text: () => Promise.resolve(''),
    });

    const res = await createApp().request('/cron', { method: 'POST', headers: validHeaders });
    const body = await res.json();

    // JST 8/9 の定期発酵は UTC 8/8 に走る
    expect(body.actualCostUtcDate).toBe('2026-08-08');
    expect(body.actualCost).toEqual({
      status: 'ok',
      costUsd: 0.465,
      truncated: false,
      // group_by が無い応答なので内訳は受け皿に入る（総額と一致する）
      byModel: [{ model: '(内訳なし)', costUsd: 0.465, feature: null }],
    });
    expect(fieldValue('実請求額 (org 全体)')).toBe('$0.4650 (UTC 2026-08-08)');
  });

  it('says the admin key is unset rather than reporting $0', async () => {
    supabaseState.rows = [fermentation()];

    const res = await createApp().request('/cron', { method: 'POST', headers: validHeaders });
    const body = await res.json();

    expect(body.actualCost).toEqual({ status: 'not-configured' });
    expect(fieldValue('実請求額 (org 全体)')).toBe('未設定 (ANTHROPIC_ADMIN_KEY)');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('sends an INFO report below the threshold', async () => {
    supabaseState.rows = [fermentation()];

    const res = await createApp().request('/cron', { method: 'POST', headers: validHeaders });

    expect((await res.json()).thresholdExceeded).toBe(false);
    expect(mockNotifyDiscord).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'AI コスト日次レポート', color: COLORS.INFO }),
    );
  });

  it('escalates to ERROR when the estimate exceeds the threshold', async () => {
    supabaseState.rows = [fermentation({ input_tokens: 1_000_000, output_tokens: 0 })];

    const res = await createApp().request('/cron', { method: 'POST', headers: validHeaders });

    expect((await res.json()).thresholdExceeded).toBe(true);
    expect(mockNotifyDiscord).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'AI コスト警告 — 閾値超過', color: COLORS.ERROR }),
    );
  });

  it('prefers the actual cost over the estimate for the threshold decision', async () => {
    vi.stubEnv('ANTHROPIC_ADMIN_KEY', 'sk-ant-admin01-test');
    // 推定は閾値未満だが、実請求額は $2.00 で超過している
    supabaseState.rows = [fermentation()];
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          data: [{ starting_at: '2026-08-08T00:00:00Z', results: [{ amount: '200' }] }],
          has_more: false,
        }),
      text: () => Promise.resolve(''),
    });

    const res = await createApp().request('/cron', { method: 'POST', headers: validHeaders });

    expect((await res.json()).thresholdExceeded).toBe(true);
  });

  // 用途別（= モデル別）の内訳は **実額** から取る。自前トークンを記録して
  // 単価を掛ける方式はやめた（cost_report が group_by[]=description で
  // モデル別に割れるため。そちらはキャッシュ・値引きも反映済みで正確）。
  describe('実請求額のモデル別内訳', () => {
    function costReportResponse(results: Record<string, unknown>[]) {
      return {
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            data: [{ starting_at: '2026-08-08T00:00:00Z', results }],
            has_more: false,
          }),
        text: () => Promise.resolve(''),
      };
    }

    it('モデル別の実額を出し、Oryzae での用途を添える', async () => {
      vi.stubEnv('ANTHROPIC_ADMIN_KEY', 'sk-ant-admin01-test');
      supabaseState.rows = [fermentation()];
      mockFetch.mockResolvedValueOnce(
        costReportResponse([
          { amount: '12.4836', model: 'claude-sonnet-4-6', token_type: 'output_tokens' },
          { amount: '18.81', model: 'claude-opus-5', token_type: 'output_tokens' },
        ]),
      );

      const res = await createApp().request('/cron', { method: 'POST', headers: validHeaders });
      const body = await res.json();

      const breakdown = fieldValue('実請求額の内訳（モデル別・実額）') ?? '';
      expect(breakdown).toContain('claude-opus-5  $0.1881  ← OCR のモデル');
      expect(breakdown).toContain('claude-sonnet-4-6  $0.1248  ← 発酵 のモデル');

      expect(body.actualCost.byModel).toEqual([
        { model: 'claude-opus-5', costUsd: 0.1881, feature: 'OCR' },
        { model: 'claude-sonnet-4-6', costUsd: 0.124836, feature: '発酵' },
      ]);
    });

    it('知らないモデルは用途を付けずにそのまま出す（勝手に決めつけない）', async () => {
      vi.stubEnv('ANTHROPIC_ADMIN_KEY', 'sk-ant-admin01-test');
      mockFetch.mockResolvedValueOnce(
        costReportResponse([{ amount: '500', model: 'some-other-model' }]),
      );

      const res = await createApp().request('/cron', { method: 'POST', headers: validHeaders });
      const body = await res.json();

      expect(fieldValue('実請求額の内訳（モデル別・実額）')).toContain('some-other-model  $5.0000');
      expect(body.actualCost.byModel[0].feature).toBeNull();
    });

    it('内訳が取れなかったときは、その旨を出す（総額は正しいと添える）', async () => {
      vi.stubEnv('ANTHROPIC_ADMIN_KEY', 'sk-ant-admin01-test');
      // group_by が効かない応答（model も cost_type も無い）
      mockFetch.mockResolvedValueOnce(costReportResponse([{ amount: '500' }]));

      await createApp().request('/cron', { method: 'POST', headers: validHeaders });

      const breakdown = fieldValue('実請求額の内訳（モデル別・実額）') ?? '';
      expect(breakdown).toContain('group_by が効いていない可能性');
      expect(breakdown).toContain('総額は正しい値です');
    });

    it('内訳に Anthropic Console への照合リンクを付ける', async () => {
      vi.stubEnv('ANTHROPIC_ADMIN_KEY', 'sk-ant-admin01-test');
      mockFetch.mockResolvedValueOnce(
        costReportResponse([{ amount: '500', model: 'claude-opus-5' }]),
      );

      await createApp().request('/cron', { method: 'POST', headers: validHeaders });

      // 通知だけで数字の裏取りに行けること（Console はモデル別 + API キー別に割れる）
      expect(fieldValue('実請求額の内訳（モデル別・実額）')).toContain(
        '[Anthropic Console で照合](https://platform.claude.com/cost)',
      );
    });

    it('実額が取れないときは内訳フィールドを出さない', async () => {
      supabaseState.rows = [fermentation()];

      await createApp().request('/cron', { method: 'POST', headers: validHeaders });

      expect(fieldValue('実請求額の内訳（モデル別・実額）')).toBeUndefined();
      expect(fieldValue('差額 (実請求 − 推定)')).toBeUndefined();
    });
  });

  // 「推定と実請求の違いが分からない・エビデンスも分からない」への対応。
  describe('推定の根拠と、実請求との差の説明', () => {
    it('計算式をそのまま載せる（レポートの数字だけで検算できる）', async () => {
      supabaseState.rows = [fermentation({ input_tokens: 5_972, output_tokens: 7_128 })];

      await createApp().request('/cron', { method: 'POST', headers: validHeaders });

      const basis = fieldValue('推定の計算根拠') ?? '';
      expect(basis).toContain('発酵 (claude-sonnet-4-6)');
      expect(basis).toContain('in  5,972 × $3.00/MTok = $0.017916');
      expect(basis).toContain('out 7,128 × $15.00/MTok = $0.106920');
      expect(basis).toContain('$0.124836');
    });

    it('実請求と推定の差額と、その正体を書く', async () => {
      vi.stubEnv('ANTHROPIC_ADMIN_KEY', 'sk-ant-admin01-test');
      supabaseState.rows = [fermentation({ input_tokens: 5_972, output_tokens: 7_128 })];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            data: [{ starting_at: '2026-08-08T00:00:00Z', results: [{ amount: '31.29' }] }],
            has_more: false,
          }),
        text: () => Promise.resolve(''),
      });

      await createApp().request('/cron', { method: 'POST', headers: validHeaders });

      // 0.3129 - 0.124836 = 0.188064
      const gap = fieldValue('差額 (実請求 − 推定)') ?? '';
      expect(gap).toContain('$0.1881');
      expect(gap).toContain('推定は発酵のみ');
    });
  });

  it('returns 500 and notifies Discord ERROR when an unexpected error is thrown', async () => {
    supabaseState.shouldThrow = true;
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await createApp().request('/cron', { method: 'POST', headers: validHeaders });

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      error: 'Internal Server Error',
      message: 'supabase init failed',
    });
    expect(mockNotifyDiscord).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'コスト cron: 実行中にエラー',
        description: 'supabase init failed',
        color: COLORS.ERROR,
      }),
    );

    errorSpy.mockRestore();
  });
});
