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
  /** auth.admin.listUsers の応答（1 ページ目）。 */
  users: { id: string; email: string | null }[];
  /** profiles テーブルの応答。 */
  profiles: { id: string; nickname: string }[];
  listUsersShouldThrow: boolean;
  listUsersCalls: number;
} = {
  rows: [],
  error: null,
  shouldThrow: false,
  capturedRange: {},
  users: [],
  profiles: [],
  listUsersShouldThrow: false,
  listUsersCalls: 0,
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
    const profiles = {
      select: () => ({
        in: () => Promise.resolve({ data: supabaseState.profiles, error: null }),
      }),
    };
    return {
      from: (table: string) => (table === 'profiles' ? profiles : { select: () => builder }),
      auth: {
        admin: {
          listUsers: ({ page }: { page: number }) => {
            supabaseState.listUsersCalls++;
            if (supabaseState.listUsersShouldThrow) {
              return Promise.reject(new Error('listUsers down'));
            }
            return Promise.resolve({
              data: { users: page === 1 ? supabaseState.users : [] },
              error: null,
            });
          },
        },
      },
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
/** 請求額の欄。スコープ（org 全体の実額）は欄の名前に置いている。 */
const ACTUAL_FIELD = '請求額（Anthropic の org 全体の実額）';

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
    supabaseState.users = [];
    supabaseState.profiles = [];
    supabaseState.listUsersShouldThrow = false;
    supabaseState.listUsersCalls = 0;
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

  // 「ユーザー ID ではなく名前を出してほしい。メールでもいい」への対応。
  describe('ユーザー別（誰の発酵か）', () => {
    const threeRuns = () => [
      fermentation({ user_id: 'aaaaaaaa-1111', input_tokens: 100_000, output_tokens: 0 }),
      fermentation({ user_id: 'bbbbbbbb-2222', input_tokens: 300_000, output_tokens: 0 }),
      fermentation({ user_id: 'aaaaaaaa-1111', input_tokens: 100_000, output_tokens: 0 }),
    ];

    it('名前 (メール) で書き、ID は出さない', async () => {
      supabaseState.rows = threeRuns();
      supabaseState.users = [
        { id: 'aaaaaaaa-1111', email: 'akira@example.com' },
        { id: 'bbbbbbbb-2222', email: 'baba@example.com' },
      ];
      supabaseState.profiles = [
        { id: 'aaaaaaaa-1111', nickname: 'あきら' },
        { id: 'bbbbbbbb-2222', nickname: 'ばば' },
      ];

      const res = await createApp().request('/cron', { method: 'POST', headers: validHeaders });
      const body = await res.json();

      expect(body.userCount).toBe(2);
      const breakdown = fieldValue('ユーザー別（推定）') ?? '';
      // コスト降順。b が $0.90、a が 2件で $0.60。
      expect(breakdown).toContain('ばば (baba@example.com): $0.9000（1 件）');
      expect(breakdown).toContain('あきら (akira@example.com): $0.6000（2 件）');
      expect(breakdown.indexOf('ばば')).toBeLessThan(breakdown.indexOf('あきら'));
      expect(breakdown).not.toContain('aaaaaaaa');
      expect(breakdown).not.toContain('bbbbbbbb');
      // なぜここだけ推定なのかを内訳自身が説明する（実額と並ぶと区別がつかないため）
      expect(breakdown).toContain('実額はユーザー別に取れないため');
    });

    it('名前が無ければメールだけ、メールも無ければ ID の先頭 8 桁に縮退する', async () => {
      supabaseState.rows = threeRuns();
      // a はメールのみ（profiles 無し）、b はどちらも無い
      supabaseState.users = [{ id: 'aaaaaaaa-1111', email: 'akira@example.com' }];

      await createApp().request('/cron', { method: 'POST', headers: validHeaders });

      const breakdown = fieldValue('ユーザー別（推定）') ?? '';
      expect(breakdown).toContain('akira@example.com: $0.6000（2 件）');
      expect(breakdown).toContain('bbbbbbbb: $0.9000（1 件）');
    });

    it('11 人以上の日は上位 10 人に絞り、欄名にそう書く', async () => {
      supabaseState.rows = Array.from({ length: 11 }, (_, i) =>
        fermentation({
          user_id: `user-${String(i).padStart(2, '0')}`,
          input_tokens: (11 - i) * 10_000,
          output_tokens: 0,
        }),
      );

      await createApp().request('/cron', { method: 'POST', headers: validHeaders });

      // 全員載る日は「上位」と書かない（載っていない人がいるように読めるため）
      expect(fieldValue('ユーザー別（推定）')).toBeUndefined();
      const breakdown = fieldValue('ユーザー別（推定・上位10）') ?? '';
      expect(breakdown).toContain('user-00: $0.3300（1 件）');
      expect(breakdown).toContain('user-09: $0.0600（1 件）');
      expect(breakdown).not.toContain('user-10:');
      expect(breakdown).toContain('…他 1 名');
    });

    it('ユーザーの解決に失敗してもレポートは出す（ID 表記に縮退）', async () => {
      supabaseState.rows = threeRuns();
      supabaseState.listUsersShouldThrow = true;
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const res = await createApp().request('/cron', { method: 'POST', headers: validHeaders });

      expect(res.status).toBe(200);
      const breakdown = fieldValue('ユーザー別（推定）') ?? '';
      expect(breakdown).toContain('bbbbbbbb: $0.9000（1 件）');
      expect(errorSpy).toHaveBeenCalledWith(
        '[cron-cost-alert] user lookup failed',
        expect.objectContaining({ error: 'listUsers down' }),
      );

      errorSpy.mockRestore();
    });

    it('発酵 0 件の日はユーザー一覧を引かない（listUsers は最大 20 往復する）', async () => {
      await createApp().request('/cron', { method: 'POST', headers: validHeaders });

      expect(supabaseState.listUsersCalls).toBe(0);
    });
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
    expect(fieldValue(ACTUAL_FIELD)).toContain('$0.4650');
  });

  it('says the admin key is unset rather than reporting $0', async () => {
    supabaseState.rows = [fermentation()];

    const res = await createApp().request('/cron', { method: 'POST', headers: validHeaders });
    const body = await res.json();

    expect(body.actualCost).toEqual({ status: 'not-configured' });
    expect(fieldValue(ACTUAL_FIELD)).toContain('取得できません（ANTHROPIC_ADMIN_KEY 未設定）');
    expect(fieldValue(ACTUAL_FIELD)).not.toContain('$0');
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

      const value = fieldValue(ACTUAL_FIELD) ?? '';
      // 「合計: 金額」の配下に「用途: 金額」をぶら下げる。親子が字形で分かる
      expect(value).toContain(
        '合計: $0.3129\n├ OCR (claude-opus-5): $0.1881\n└ 発酵 (claude-sonnet-4-6): $0.1248',
      );

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

      const value = fieldValue(ACTUAL_FIELD) ?? '';
      expect(value).toContain('├ 写真の文字起こし (claude-sonnet-5): $0.6029');
      expect(value).toContain('└ claude-haiku-4-5-20251001: $0.0013 ← 用途不明');
    });

    it('知らないモデルは用途を決めつけず、その旨を添える', async () => {
      vi.stubEnv('ANTHROPIC_ADMIN_KEY', 'sk-ant-admin01-test');
      mockFetch.mockResolvedValueOnce(
        costReportResponse([{ amount: '500', model: 'some-other-model' }]),
      );

      const res = await createApp().request('/cron', { method: 'POST', headers: validHeaders });
      const body = await res.json();

      // $1 以上は 2 桁。$5.0000 の下 2 桁は読む人にとって意味を持たない
      expect(fieldValue(ACTUAL_FIELD)).toContain(
        '└ some-other-model: $5.00 ← 用途不明（アプリ外の利用か登録漏れ）',
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

      const value = fieldValue(ACTUAL_FIELD) ?? '';
      expect(value).toContain('└ (web_search): $0.0500');
      expect(value).not.toContain('(web_search): $0.0500 ←');
    });

    it('内訳が取れなかったときは、その旨を出す（合計は正しいと添える）', async () => {
      vi.stubEnv('ANTHROPIC_ADMIN_KEY', 'sk-ant-admin01-test');
      // group_by が効かない応答（model も cost_type も無い）
      mockFetch.mockResolvedValueOnce(costReportResponse([{ amount: '500' }]));

      await createApp().request('/cron', { method: 'POST', headers: validHeaders });

      const value = fieldValue(ACTUAL_FIELD) ?? '';
      expect(value).toContain('group_by が効いていない可能性');
      expect(value).toContain('合計は正しい値です');
    });

    it('確認先として管理画面と Anthropic Console のリンクを付ける', async () => {
      vi.stubEnv('ANTHROPIC_ADMIN_KEY', 'sk-ant-admin01-test');
      mockFetch.mockResolvedValueOnce(
        costReportResponse([{ amount: '500', model: 'claude-opus-5' }]),
      );

      await createApp().request('/cron', { method: 'POST', headers: validHeaders });

      // 通知だけで数字の裏取りに行けること（Console はモデル別 + API キー別に割れる）
      const value = fieldValue(ACTUAL_FIELD) ?? '';
      expect(value).toContain(
        '確認先: [管理画面](https://oryzae-admin.vercel.app/observability/spend)',
      );
      expect(value).toContain('[Anthropic Console](https://platform.claude.com/cost)');
    });

    it('実額が取れないときは内訳を出さず、推定が代用として前に出る', async () => {
      supabaseState.rows = [fermentation()];

      await createApp().request('/cron', { method: 'POST', headers: validHeaders });

      expect(fieldValue(ACTUAL_FIELD)).not.toContain('←');
      // 確認先は実額が取れない日にも要る（管理画面で状況を見に行ける）
      expect(fieldValue(ACTUAL_FIELD)).toContain('確認先: [管理画面]');
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
      // スコープ（org 全体の実額）は引き算や注記ではなく、欄の名前で伝える
      expect(lastEmbed().fields?.some((f) => f.name === ACTUAL_FIELD)).toBe(true);
      expect(fieldValue(ACTUAL_FIELD)).toContain('※ 同じモデルを CI などが使えば');
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

      expect(fieldValue(ACTUAL_FIELD)?.startsWith('合計: $0.2000（前日 $0.1000 +100%）\n')).toBe(
        true,
      );
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
      expect(fieldValue(ACTUAL_FIELD)?.startsWith('合計: $0.2000（前日 データなし）\n')).toBe(true);
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
      expect(fieldValue(ACTUAL_FIELD)?.startsWith('合計: $0.2000\n')).toBe(true);
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
      expect(fieldValue('ユーザー別（推定）')).toBeUndefined();
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
