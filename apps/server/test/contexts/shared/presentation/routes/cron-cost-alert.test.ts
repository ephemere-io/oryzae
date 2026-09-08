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
    created_at: '2026-08-08T18:05:00.000Z', // JST 8/9 03:05 の定期発酵（UTC 8/8 の窓に入る）
    ...overrides,
  };
}

/** 直近の Discord embed。 */
function lastEmbed(): {
  title?: string;
  description?: string;
  fields?: { name: string; value: string; inline?: boolean }[];
} {
  return mockNotifyDiscord.mock.calls.at(-1)?.[0] ?? {};
}

/** Discord embed の fields から値を引く。 */
function fieldValue(name: string): string | undefined {
  return lastEmbed().fields?.find((f) => f.name === name)?.value;
}

/** 対象日 (UTC 8/8) 1 バケットぶんの cost_report 応答。 */
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

/**
 * 月ぶんの cost_report 応答。日次レポートは対象日と月初からの2回を投げるので、
 * 傾向（前日比・累計・見込み）を見るテストは2つ目の応答を積む。
 */
function monthlyCostReportResponse(buckets: { date: string; amountCents: string }[]) {
  return {
    ok: true,
    status: 200,
    json: () =>
      Promise.resolve({
        data: buckets.map((b) => ({
          starting_at: `${b.date}T00:00:00Z`,
          results: [{ amount: b.amountCents }],
        })),
        has_more: false,
      }),
    text: () => Promise.resolve(''),
  };
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
    // コスト cron は JST 10:00 (= UTC 01:00) 実行 → 対象は直前に閉じた UTC 日 (8/8)
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-09T01:00:00.000Z'));
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
    // 実額が取れない日だけ、推定が実額の代用として前に出る
    expect(fieldValue('推定コスト（発酵のみ・実額の代用）')).toContain('$0.4500');
  });

  // 「冒頭の文章の意味が全くわからない。何時から何時、のような時間表示がほしい」への対応。
  describe('対象の窓', () => {
    it('実額と同じ UTC 日 1 つで発酵を数える（窓を 2 つにしない）', async () => {
      await createApp().request('/cron', { method: 'POST', headers: validHeaders });

      // UTC 8/8 = JST 8/8 9:00 〜 8/9 9:00。定期発酵（JST 8/9 03:00）はこの中に入る
      expect(supabaseState.capturedRange.gte).toBe('2026-08-08T00:00:00.000Z');
      expect(supabaseState.capturedRange.lte).toBe('2026-08-08T23:59:59.999Z');
    });

    it('冒頭は「何時から何時の話か」だけを書く', async () => {
      const res = await createApp().request('/cron', { method: 'POST', headers: validHeaders });
      const body = await res.json();

      expect(lastEmbed().title).toBe('AI コスト日次レポート — 8/8 分');
      expect(lastEmbed().description).toBe(
        '8/8 9:00 〜 8/9 9:00 (JST) に発生したコストのレポートです。',
      );
      // UTC と JST の対応の説明を読む人に押し付けない
      expect(lastEmbed().description).not.toContain('UTC');
      expect(body.date).toBe('2026-08-08');
      expect(body.period).toBe('8/8 9:00 〜 8/9 9:00 (JST)');
    });

    it('フィールドはすべて縦に並べる（3 カラムにしない）', async () => {
      vi.stubEnv('ANTHROPIC_ADMIN_KEY', 'sk-ant-admin01-test');
      supabaseState.rows = [fermentation()];
      mockFetch
        .mockResolvedValueOnce(costReportResponse([{ amount: '20', model: 'claude-sonnet-4-6' }]))
        .mockResolvedValueOnce(
          monthlyCostReportResponse([{ date: '2026-08-08', amountCents: '20' }]),
        );

      await createApp().request('/cron', { method: 'POST', headers: validHeaders });

      const fields = lastEmbed().fields ?? [];
      expect(fields.length).toBeGreaterThan(0);
      expect(fields.every((f) => f.inline === false)).toBe(true);
    });
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
    const breakdown = fieldValue('ユーザー別（推定・上位5）') ?? '';
    // コスト降順。b が $0.90、a が 2件で $0.60。
    expect(breakdown.indexOf('bbbbbbbb')).toBeLessThan(breakdown.indexOf('aaaaaaaa'));
    expect(breakdown).toContain('$0.9000');
    expect(breakdown).toContain('2 件');
    // なぜここだけ推定なのかを内訳自身が説明する（実額と並ぶと区別がつかないため）
    expect(breakdown).toContain('実額はユーザー別に取れないため');
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
    expect(fieldValue('要確認')).toContain('トークン未記録 1 件');
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

    expect(body.actualCost).toEqual({
      status: 'ok',
      costUsd: 0.465,
      truncated: false,
      // group_by が無い応答なので内訳は受け皿に入る（総額と一致する）
      byModel: [{ model: '(内訳なし)', costUsd: 0.465, feature: null }],
    });
    expect(fieldValue('請求額')).toContain('$0.4650');
  });

  it('says the admin key is unset rather than reporting $0', async () => {
    supabaseState.rows = [fermentation()];

    const res = await createApp().request('/cron', { method: 'POST', headers: validHeaders });
    const body = await res.json();

    expect(body.actualCost).toEqual({ status: 'not-configured' });
    expect(fieldValue('請求額')).toContain('取得できません（ANTHROPIC_ADMIN_KEY 未設定）');
    expect(fieldValue('請求額')).not.toContain('$0');
    // 実額が無い日は月累計・見込みを出さない（推定を実額のように読ませない）
    expect(fieldValue('今月の累計と見込み')).toBeUndefined();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('sends an INFO report below the threshold', async () => {
    supabaseState.rows = [fermentation()];

    const res = await createApp().request('/cron', { method: 'POST', headers: validHeaders });

    expect((await res.json()).thresholdExceeded).toBe(false);
    expect(mockNotifyDiscord).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'AI コスト日次レポート — 8/8 分',
        color: COLORS.INFO,
      }),
    );
  });

  it('escalates to ERROR when the estimate exceeds the threshold', async () => {
    supabaseState.rows = [fermentation({ input_tokens: 1_000_000, output_tokens: 0 })];

    const res = await createApp().request('/cron', { method: 'POST', headers: validHeaders });

    expect((await res.json()).thresholdExceeded).toBe(true);
    expect(mockNotifyDiscord).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'AI コスト警告 — 8/8 分が閾値超過',
        color: COLORS.ERROR,
      }),
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
  describe('請求額の内訳', () => {
    it('「何に」を前に出し、金額の直下に並べる', async () => {
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

      const value = fieldValue('請求額') ?? '';
      expect(value).toContain('OCR (claude-opus-5)  $0.1881');
      expect(value).toContain('発酵 (claude-sonnet-4-6)  $0.1248');
      // 金額（1 行目）→ 内訳の順
      expect(value.indexOf('$0.3129')).toBeLessThan(value.indexOf('OCR'));

      expect(body.actualCost.byModel).toEqual([
        { model: 'claude-opus-5', costUsd: 0.1881, feature: 'OCR' },
        { model: 'claude-sonnet-4-6', costUsd: 0.124836, feature: '発酵' },
      ]);
    });

    it('写真の文字起こしも用途として読める（#591 の登録漏れの回帰防止）', async () => {
      vi.stubEnv('ANTHROPIC_ADMIN_KEY', 'sk-ant-admin01-test');
      // 9/7 のレポートそのもの: sonnet-5 $0.6029 が「何から発生したか」不明で届いた
      mockFetch.mockResolvedValueOnce(
        costReportResponse([
          { amount: '60.29', model: 'claude-sonnet-5', token_type: 'output_tokens' },
          { amount: '0.13', model: 'claude-haiku-4-5-20251001', token_type: 'output_tokens' },
        ]),
      );

      await createApp().request('/cron', { method: 'POST', headers: validHeaders });

      const value = fieldValue('請求額') ?? '';
      expect(value).toContain('写真の文字起こし (claude-sonnet-5)  $0.6029');
      expect(value).toContain('claude-haiku-4-5-20251001  $0.0013  ← 用途不明');
    });

    it('知らないモデルは用途を決めつけず、その旨を添える', async () => {
      vi.stubEnv('ANTHROPIC_ADMIN_KEY', 'sk-ant-admin01-test');
      mockFetch.mockResolvedValueOnce(
        costReportResponse([{ amount: '500', model: 'some-other-model' }]),
      );

      const res = await createApp().request('/cron', { method: 'POST', headers: validHeaders });
      const body = await res.json();

      // $1 以上は 2 桁。$5.0000 の下 2 桁は読む人にとって意味を持たない
      expect(fieldValue('請求額')).toContain(
        'some-other-model  $5.00  ← 用途不明（アプリ外の利用か登録漏れ）',
      );
      expect(body.actualCost.byModel[0].feature).toBeNull();
    });

    it('トークン以外のコスト (cost_type) は受け皿の名前のまま出す', async () => {
      vi.stubEnv('ANTHROPIC_ADMIN_KEY', 'sk-ant-admin01-test');
      mockFetch.mockResolvedValueOnce(
        costReportResponse([
          { amount: '10', model: 'claude-opus-5' },
          { amount: '5', cost_type: 'web_search' },
        ]),
      );

      await createApp().request('/cron', { method: 'POST', headers: validHeaders });

      const value = fieldValue('請求額') ?? '';
      expect(value).toContain('(web_search)  $0.0500');
      expect(value).not.toContain('(web_search)  $0.0500  ←');
    });

    it('内訳が取れなかったときは、その旨を出す（総額は正しいと添える）', async () => {
      vi.stubEnv('ANTHROPIC_ADMIN_KEY', 'sk-ant-admin01-test');
      // group_by が効かない応答（model も cost_type も無い）
      mockFetch.mockResolvedValueOnce(costReportResponse([{ amount: '500' }]));

      await createApp().request('/cron', { method: 'POST', headers: validHeaders });

      const value = fieldValue('請求額') ?? '';
      expect(value).toContain('group_by が効いていない可能性');
      expect(value).toContain('総額は正しい値です');
    });

    it('確認先として管理画面と Anthropic Console のリンクを付ける', async () => {
      vi.stubEnv('ANTHROPIC_ADMIN_KEY', 'sk-ant-admin01-test');
      mockFetch.mockResolvedValueOnce(
        costReportResponse([{ amount: '500', model: 'claude-opus-5' }]),
      );

      await createApp().request('/cron', { method: 'POST', headers: validHeaders });

      // 通知だけで数字の裏取りに行けること（Console はモデル別 + API キー別に割れる）
      const value = fieldValue('請求額') ?? '';
      expect(value).toContain(
        '[管理画面で確認](https://oryzae-admin.vercel.app/observability/spend)',
      );
      expect(value).toContain('[Anthropic Console](https://platform.claude.com/cost)');
    });

    it('実額が取れないときは内訳を出さず、推定が代用として前に出る', async () => {
      supabaseState.rows = [fermentation()];

      await createApp().request('/cron', { method: 'POST', headers: validHeaders });

      expect(fieldValue('請求額')).not.toContain('←');
      // 確認先は実額が取れない日にも要る（管理画面で状況を見に行ける）
      expect(fieldValue('請求額')).toContain('[管理画面で確認]');
      expect(fieldValue('推定コスト（発酵のみ・実額の代用）')).toContain('$0.4500');
    });
  });

  // 「推定と実請求の違いが分からない・エビデンスも分からない」への対応。
  describe('推定の根拠と、実請求との差の説明', () => {
    it('実額が取れないときは計算式をそのまま載せる（レポートの数字だけで検算できる）', async () => {
      supabaseState.rows = [fermentation({ input_tokens: 5_972, output_tokens: 7_128 })];

      await createApp().request('/cron', { method: 'POST', headers: validHeaders });

      const basis = fieldValue('推定の計算根拠') ?? '';
      expect(basis).toContain('発酵 (claude-sonnet-4-6)');
      expect(basis).toContain('in  5,972 × $3.00/MTok = $0.017916');
      expect(basis).toContain('out 7,128 × $15.00/MTok = $0.106920');
      expect(basis).toContain('$0.124836');
    });

    it('推定が実額と合っている日は、突き合わせも計算根拠も出さない', async () => {
      vi.stubEnv('ANTHROPIC_ADMIN_KEY', 'sk-ant-admin01-test');
      supabaseState.rows = [fermentation({ input_tokens: 5_972, output_tokens: 7_128 })];
      // 発酵モデル $0.1248 / OCR モデル $0.1881。推定 $0.124836 は前者と比べる。
      mockFetch.mockResolvedValueOnce(
        costReportResponse([
          { amount: '12.4836', model: 'claude-sonnet-4-6', token_type: 'output_tokens' },
          { amount: '18.81', model: 'claude-opus-5', token_type: 'output_tokens' },
        ]),
      );

      const res = await createApp().request('/cron', { method: 'POST', headers: validHeaders });

      expect((await res.json()).notices).toEqual([]);
      expect(fieldValue('要確認')).toBeUndefined();
      expect(fieldValue('推定の計算根拠')).toBeUndefined();
      // スコープの違いは引き算ではなく1行の注記で伝える
      expect(fieldValue('請求額')).toContain('org 全体の実額');
    });

    it('推定が実額とズレた日だけ、両方の数字と計算根拠を出す', async () => {
      vi.stubEnv('ANTHROPIC_ADMIN_KEY', 'sk-ant-admin01-test');
      supabaseState.rows = [fermentation({ input_tokens: 5_972, output_tokens: 7_128 })];
      // 実額 $0.0800 に対し推定 $0.124836 → +56%
      mockFetch.mockResolvedValueOnce(
        costReportResponse([{ amount: '8', model: 'claude-sonnet-4-6' }]),
      );

      await createApp().request('/cron', { method: 'POST', headers: validHeaders });

      expect(fieldValue('推定の計算根拠')).toContain('in  5,972 × $3.00/MTok');
      expect(fieldValue('要確認')).toContain(
        '発酵の推定 $0.1248 が同モデルの実額 $0.0800 と +56% ずれている',
      );
    });
  });

  // 「$0.1220」とだけ言われても多いのか少ないのか判断できない、への対応。
  describe('全体感（前日比・今月の累計・月末の見込み）', () => {
    it('対象日を前日・今月の累計・月末の見込みと並べて出す', async () => {
      vi.stubEnv('ANTHROPIC_ADMIN_KEY', 'sk-ant-admin01-test');
      supabaseState.rows = [fermentation()];
      mockFetch
        .mockResolvedValueOnce(costReportResponse([{ amount: '20', model: 'claude-sonnet-4-6' }]))
        .mockResolvedValueOnce(
          monthlyCostReportResponse([
            { date: '2026-08-01', amountCents: '10' },
            { date: '2026-08-06', amountCents: '10' },
            { date: '2026-08-07', amountCents: '10' },
            { date: '2026-08-08', amountCents: '20' },
          ]),
        );

      const res = await createApp().request('/cron', { method: 'POST', headers: validHeaders });
      const body = await res.json();

      expect(body.previousDayCost).toBeCloseTo(0.1, 6);
      expect(body.monthToDateCost).toBeCloseTo(0.5, 6);
      // 8 日で $0.50 → 1日 $0.0625 → 31 日で $1.9375
      expect(body.projectedMonthEndCost).toBeCloseTo(1.9375, 6);

      expect(fieldValue('請求額')?.startsWith('$0.2000（前日 $0.1000 +100%）\n')).toBe(true);
      expect(fieldValue('今月の累計と見込み')).toBe(
        '8 日分の累計 $0.5000\nこのペースだと月末に $1.94（1 日平均 $0.0625 × 31 日）',
      );
    });

    it('月ぶんは月初から取り、対象日の内訳とは別に投げる', async () => {
      vi.stubEnv('ANTHROPIC_ADMIN_KEY', 'sk-ant-admin01-test');
      mockFetch
        .mockResolvedValueOnce(costReportResponse([{ amount: '20', model: 'claude-sonnet-4-6' }]))
        .mockResolvedValueOnce(
          monthlyCostReportResponse([{ date: '2026-08-08', amountCents: '20' }]),
        );

      await createApp().request('/cron', { method: 'POST', headers: validHeaders });

      expect(mockFetch).toHaveBeenCalledTimes(2);
      const dayUrl = String(mockFetch.mock.calls[0]?.[0]);
      const monthUrl = String(mockFetch.mock.calls[1]?.[0]);
      expect(dayUrl).toContain(`starting_at=${encodeURIComponent('2026-08-08T00:00:00.000Z')}`);
      expect(dayUrl).toContain(`ending_at=${encodeURIComponent('2026-08-09T00:00:00.000Z')}`);
      expect(monthUrl).toContain(`starting_at=${encodeURIComponent('2026-08-01T00:00:00.000Z')}`);
      expect(monthUrl).toContain(`ending_at=${encodeURIComponent('2026-08-09T00:00:00.000Z')}`);
    });

    it('前日が不明なら「データなし」と書く（$0 と混同させない）', async () => {
      vi.stubEnv('ANTHROPIC_ADMIN_KEY', 'sk-ant-admin01-test');
      mockFetch
        .mockResolvedValueOnce(costReportResponse([{ amount: '20', model: 'claude-sonnet-4-6' }]))
        .mockResolvedValueOnce(
          monthlyCostReportResponse([{ date: '2026-08-08', amountCents: '20' }]),
        );

      const res = await createApp().request('/cron', { method: 'POST', headers: validHeaders });

      expect((await res.json()).previousDayCost).toBeNull();
      expect(fieldValue('請求額')?.startsWith('$0.2000（前日 データなし）\n')).toBe(true);
    });

    it('月ぶんの取得に失敗しても、その日のレポートは出す', async () => {
      vi.stubEnv('ANTHROPIC_ADMIN_KEY', 'sk-ant-admin01-test');
      supabaseState.rows = [fermentation()];
      mockFetch
        .mockResolvedValueOnce(costReportResponse([{ amount: '20', model: 'claude-sonnet-4-6' }]))
        .mockRejectedValueOnce(new Error('network down'));

      const res = await createApp().request('/cron', { method: 'POST', headers: validHeaders });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.actualCost.costUsd).toBeCloseTo(0.2, 6);
      expect(body.monthToDateCost).toBeNull();
      expect(fieldValue('請求額')?.startsWith('$0.2000\n')).toBe(true);
      expect(fieldValue('今月の累計と見込み')).toBeUndefined();
    });
  });

  // 「トークンが誰の何を言っているのか分からない」への対応。
  describe('発酵の中身', () => {
    it('件数・人数・1 発酵あたりを 1 つの欄に書く', async () => {
      supabaseState.rows = [
        fermentation({ user_id: 'aaaaaaaa-1111' }),
        fermentation({ user_id: 'bbbbbbbb-2222' }),
      ];

      await createApp().request('/cron', { method: 'POST', headers: validHeaders });

      expect(fieldValue('発酵')).toBe(
        '2 件（成功 2 / 失敗 0）・2 人\n1 件あたり 推定 $0.4500（入 100,000 / 出 10,000 tok）',
      );
      expect(fieldValue('利用者')).toBeUndefined();
      expect(fieldValue('1 発酵あたり (推定)')).toBeUndefined();
    });

    it('発酵が 0 件の日は 1 行に畳む（0 の再掲を並べない）', async () => {
      const res = await createApp().request('/cron', { method: 'POST', headers: validHeaders });

      expect(res.status).toBe(200);
      expect(fieldValue('発酵')).toBe('0 件');
      expect(fieldValue('ユーザー別（推定・上位5）')).toBeUndefined();
      // 0 件の日に計算根拠（すべて 0 の式）を出しても読むものが無い
      expect(fieldValue('推定の計算根拠')).toBeUndefined();
    });
  });

  it('何も無い日は「要確認」欄ごと出さない', async () => {
    supabaseState.rows = [fermentation()];

    const res = await createApp().request('/cron', { method: 'POST', headers: validHeaders });

    // 毎日「未計上 0 件」を出していると、本当に 1 件出た日に読み飛ばす。
    expect((await res.json()).notices).toEqual([]);
    expect(fieldValue('要確認')).toBeUndefined();
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
