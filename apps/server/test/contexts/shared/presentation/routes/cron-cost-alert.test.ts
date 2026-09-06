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

interface OcrRow {
  user_id: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  created_at: string;
}

// Supabase クエリ結果をテストごとに差し替える。
// ocr_usage は別テーブルなので、from() のテーブル名で分岐する。同じ行を返すと
// 発酵の行を OCR として読んでしまい、テストが実態とズレる。
const supabaseState: {
  rows: FermentationRow[];
  ocrRows: OcrRow[];
  error: { message: string } | null;
  ocrError: { message: string } | null;
  shouldThrow: boolean;
  capturedRange: { gte?: string; lte?: string };
  capturedOcrRange: { gte?: string; lte?: string };
} = {
  rows: [],
  ocrRows: [],
  error: null,
  ocrError: null,
  shouldThrow: false,
  capturedRange: {},
  capturedOcrRange: {},
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
    const ocrBuilder = {
      eq: () => ocrBuilder,
      gte: (_col: string, value: string) => {
        supabaseState.capturedOcrRange.gte = value;
        return ocrBuilder;
      },
      lte: (_col: string, value: string) => {
        supabaseState.capturedOcrRange.lte = value;
        return ocrBuilder;
      },
      order: () => ocrBuilder,
      range: (from: number) => {
        if (supabaseState.ocrError) {
          return Promise.resolve({ data: null, error: supabaseState.ocrError });
        }
        return Promise.resolve({ data: from === 0 ? supabaseState.ocrRows : [], error: null });
      },
    };
    return {
      from: (table: string) => ({
        select: () => (table === 'ocr_usage' ? ocrBuilder : builder),
      }),
    };
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
    supabaseState.ocrRows = [];
    supabaseState.error = null;
    supabaseState.ocrError = null;
    supabaseState.shouldThrow = false;
    supabaseState.capturedRange = {};
    supabaseState.capturedOcrRange = {};
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
    expect(fieldValue('推定コスト (Oryzae 記録分)')).toBe('$0.4500');
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
    const breakdown = fieldValue('ユーザー別 推定コスト・発酵 (上位5)') ?? '';
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
    expect(fieldValue('コスト未計上')).toBe('発酵 1 件 / OCR 0 件');
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
    expect(body.actualCost).toEqual({ status: 'ok', costUsd: 0.465, truncated: false });
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

  // OCR は課金されているのに usage が捨てられており、推定に $0 しか乗らなかった。
  // 実請求額との差が「原因不明の乖離」に見えていた原因のひとつ。
  describe('OCR コストの計上', () => {
    function ocrUsage(overrides: Partial<OcrRow> = {}): OcrRow {
      return {
        user_id: 'user-1',
        model: 'claude-opus-5',
        input_tokens: 100_000,
        output_tokens: 10_000,
        created_at: '2026-08-08T18:10:00.000Z',
        ...overrides,
      };
    }

    it('OCR の単価 (opus-5 $5/$25) で計上し、推定合計に足す', async () => {
      supabaseState.rows = [fermentation()]; // $0.4500
      supabaseState.ocrRows = [ocrUsage()]; // 100,000×$5/1M + 10,000×$25/1M = 0.5 + 0.25 = 0.75

      const res = await createApp().request('/cron', { method: 'POST', headers: validHeaders });
      const body = await res.json();

      expect(body.ocr.estimatedCost).toBeCloseTo(0.75, 6);
      expect(body.fermentationEstimatedCost).toBeCloseTo(0.45, 6);
      expect(body.estimatedCost).toBeCloseTo(1.2, 6);
      expect(fieldValue('推定コスト (Oryzae 記録分)')).toBe('$1.2000');
      expect(fieldValue('推定の内訳')).toBe('発酵 $0.4500 / OCR $0.7500');
    });

    it('発酵の単価で OCR を計算しない', async () => {
      supabaseState.ocrRows = [ocrUsage({ input_tokens: 1_000_000, output_tokens: 0 })];

      const body = await (
        await createApp().request('/cron', { method: 'POST', headers: validHeaders })
      ).json();

      // opus-5 の $5。発酵の $3 で計算していたら 3 になる。
      expect(body.ocr.estimatedCost).toBeCloseTo(5, 6);
    });

    it('OCR も JST 日で絞る', async () => {
      await createApp().request('/cron', { method: 'POST', headers: validHeaders });

      expect(supabaseState.capturedOcrRange.gte).toBe('2026-08-08T15:00:00.000Z');
      expect(supabaseState.capturedOcrRange.lte).toBe('2026-08-09T14:59:59.999Z');
    });

    it('OCR 回数を出す', async () => {
      supabaseState.ocrRows = [ocrUsage(), ocrUsage()];

      const body = await (
        await createApp().request('/cron', { method: 'POST', headers: validHeaders })
      ).json();

      expect(body.ocr.requestCount).toBe(2);
      expect(fieldValue('OCR 回数')).toBe('2 回');
    });

    // migration 00023 未適用の環境。0 件（$0）と区別できないと、
    // 「OCR は使っていない」と誤読される。
    it('ocr_usage を読めなければ、$0 ではなく取得失敗として出す', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      supabaseState.rows = [fermentation()];
      supabaseState.ocrError = { message: 'relation "ocr_usage" does not exist' };

      const body = await (
        await createApp().request('/cron', { method: 'POST', headers: validHeaders })
      ).json();

      expect(body.ocr.status).toBe('error');
      expect(fieldValue('OCR 回数')).toBe('取得失敗');
      expect(fieldValue('推定の内訳')).toBe('発酵 $0.4500 / OCR 取得失敗');
      expect(fieldValue('⚠️ OCR 未集計')).toContain('migration 00023');
      // 発酵のレポート自体は出す（OCR が読めないだけで日次通知を止めない）
      expect(mockNotifyDiscord).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'AI コスト日次レポート' }),
      );
      errorSpy.mockRestore();
    });
  });

  // 「推定コストが全然推定できていないように見えるし、そのエビデンスもわからない」
  // への対応。金額だけでなく式を出し、実請求との差が何なのかもレポートに書く。
  describe('推定の根拠と、実請求との差の説明', () => {
    it('計算式をそのまま載せる（レポートの数字だけで検算できる）', async () => {
      supabaseState.rows = [fermentation({ input_tokens: 5_972, output_tokens: 7_128 })];

      await createApp().request('/cron', { method: 'POST', headers: validHeaders });

      const basis = fieldValue('計算根拠') ?? '';
      expect(basis).toContain('発酵 (claude-sonnet-4-6)');
      expect(basis).toContain('in  5,972 × $3.00/MTok = $0.017916');
      expect(basis).toContain('out 7,128 × $15.00/MTok = $0.106920');
      expect(basis).toContain('$0.124836');
      expect(basis).toContain('OCR (claude-opus-5)');
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

      const gap = fieldValue('差額 (実請求 − 推定)') ?? '';
      // 0.3129 - 0.124836 = 0.188064
      expect(gap).toContain('$0.1881');
      expect(gap).toContain('記録していない利用');
    });

    it('OCR を集計できていないときは、差額の説明にその旨を含める', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.stubEnv('ANTHROPIC_ADMIN_KEY', 'sk-ant-admin01-test');
      supabaseState.rows = [fermentation()];
      supabaseState.ocrError = { message: 'relation "ocr_usage" does not exist' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            data: [{ starting_at: '2026-08-08T00:00:00Z', results: [{ amount: '100' }] }],
            has_more: false,
          }),
        text: () => Promise.resolve(''),
      });

      await createApp().request('/cron', { method: 'POST', headers: validHeaders });

      // OCR が読めていない以上、差額を「記録していない利用」と断定してはいけない。
      const gap = fieldValue('差額 (実請求 − 推定)') ?? '';
      expect(gap).toContain('OCR');
      expect(gap).not.toContain('記録していない利用');
      errorSpy.mockRestore();
    });

    it('実請求が取れないときは差額を出さない（引き算できない）', async () => {
      supabaseState.rows = [fermentation()];

      await createApp().request('/cron', { method: 'POST', headers: validHeaders });

      expect(fieldValue('差額 (実請求 − 推定)')).toBeUndefined();
    });
  });
});
