import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockNotifyDiscord = vi.fn();

vi.mock('@/contexts/shared/infrastructure/discord-notify.js', () => ({
  COLORS: { SUCCESS: 1, WARNING: 2, ERROR: 3, INFO: 4 },
  notifyDiscord: (...args: unknown[]) => mockNotifyDiscord(...args),
}));

/**
 * 発酵 1 件。トークン数は実際には ai_usage にあるが、テストでは発酵に添えて書き、
 * モックが ai_usage の行（ref_id = 発酵の id）に展開する。null は「記録なし」。
 */
interface FermentationRow {
  user_id: string;
  status: string;
  input_tokens: number | null;
  output_tokens: number | null;
  created_at: string;
}

/** ai_usage のうち OCR の行（発酵の行は FermentationRow から作る）。 */
interface OcrUsageRow {
  user_id: string;
  feature: 'ocr_board' | 'ocr_entry';
  input_tokens: number;
  output_tokens: number;
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
  /** ai_usage のうち OCR（ボード OCR / 写真の文字起こし）の行。 */
  ocrUsage: OcrUsageRow[];
  /** 期間で ai_usage を引く問い合わせ（日次の利用記録）を失敗させる。 */
  ocrUsageError: { message: string } | null;
} = {
  rows: [],
  error: null,
  shouldThrow: false,
  capturedRange: {},
  users: [],
  profiles: [],
  listUsersShouldThrow: false,
  listUsersCalls: 0,
  ocrUsage: [],
  ocrUsageError: null,
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
        return Promise.resolve({ data: from === 0 ? fermentationRows() : [], error: null });
      },
    };
    const fermentationRows = () =>
      supabaseState.rows.map((row, i) => ({ id: `ferm-${i}`, ...row }));
    // 発酵のトークン数を ai_usage の行として見せる（記録の無い発酵は行を作らない）。
    const fermentationUsage = () =>
      fermentationRows().flatMap((row) =>
        row.input_tokens === null
          ? []
          : [
              {
                user_id: row.user_id,
                feature: 'fermentation',
                ref_id: row.id,
                input_tokens: row.input_tokens,
                output_tokens: row.output_tokens ?? 0,
              },
            ],
      );
    const profiles = {
      select: () => ({
        in: () => Promise.resolve({ data: supabaseState.profiles, error: null }),
      }),
    };
    // 利用記録は発酵とは別の表。範囲の記録（capturedRange）は発酵のクエリだけが使う。
    //   - 期間で引く（日次の利用記録）: gte/lte/order/range
    //   - 発酵の id で引く（発酵ごとのトークン数）: eq/in
    const aiUsageBuilder = {
      eq: () => aiUsageBuilder,
      gte: () => aiUsageBuilder,
      lte: () => aiUsageBuilder,
      order: () => aiUsageBuilder,
      range: (from: number) =>
        Promise.resolve(
          supabaseState.ocrUsageError
            ? { data: null, error: supabaseState.ocrUsageError }
            : {
                data:
                  from === 0
                    ? [
                        ...fermentationUsage(),
                        ...supabaseState.ocrUsage.map((u) => ({ ...u, ref_id: null })),
                      ]
                    : [],
                error: null,
              },
        ),
      in: (_col: string, ids: string[]) =>
        Promise.resolve({
          data: fermentationUsage().filter((u) => ids.includes(u.ref_id)),
          error: null,
        }),
    };
    return {
      from: (table: string) => {
        if (table === 'profiles') return profiles;
        if (table === 'ai_usage') return { select: () => aiUsageBuilder };
        return { select: () => builder };
      },
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

/**
 * Anthropic の Admin API への応答を種類ごとに積む。
 *
 * 日次レポートは対象日の cost_report を取ったあと、月ぶんの cost_report・Workspace 一覧・
 * キー一覧・キー別トークン数を**並行に**取る。呼ばれる順番に頼ると並行化で壊れるので、
 * URL（と cost_report は starting_at）で振り分ける。
 *   - 対象日 / 月ぶんの cost_report: 1 回ずつ消費する
 *   - Workspace 一覧・キー一覧・トークン数: 同じ一覧を何度引いてもよいので、最後に積んだものを使い回す
 * 積んでいない種類は undefined を返す（= 取得失敗として縮退する。以前の既定と同じ）。
 */
type Queued = { kind: 'day' | 'month' | 'workspaces' | 'apiKeys' | 'usage'; value: unknown };
let anthropicQueue: Queued[] = [];
let sticky: Partial<Record<'workspaces' | 'apiKeys' | 'usage', unknown>> = {};

function kindOf(response: unknown): Queued['kind'] {
  if (typeof response === 'object' && response !== null && '__kind' in response) {
    const k = (response as { __kind: unknown }).__kind; // @type-assertion-allowed: テスト用のタグを読むだけ
    if (k === 'month' || k === 'workspaces' || k === 'apiKeys' || k === 'usage') return k;
  }
  return 'day';
}

/** 以前の fetchQueue.mockResolvedValueOnce(...) と同じ書き方で積めるようにする。 */
const fetchQueue = {
  mockResolvedValueOnce(response: unknown) {
    const kind = kindOf(response);
    if (kind === 'workspaces' || kind === 'apiKeys' || kind === 'usage') sticky[kind] = response;
    else anthropicQueue.push({ kind, value: Promise.resolve(response) });
    return fetchQueue;
  },
  /** 月ぶんの取得が失敗する場合（対象日の後に積まれる失敗は月ぶん）。 */
  mockRejectedValueOnce(error: unknown) {
    anthropicQueue.push({ kind: 'month', value: Promise.reject(error) });
    return fetchQueue;
  },
};

function routeAnthropic(url: string): unknown {
  const u = new URL(url);
  if (u.pathname.endsWith('/workspaces')) return Promise.resolve(sticky.workspaces);
  if (u.pathname.endsWith('/api_keys')) return Promise.resolve(sticky.apiKeys);
  if (u.pathname.endsWith('/usage_report/messages')) return Promise.resolve(sticky.usage);
  // 対象日は「実行時刻の前日」の UTC 0 時から。それ以外の cost_report は月ぶん。
  const now = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const dayStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  ).toISOString();
  const kind = u.searchParams.get('starting_at') === dayStart ? 'day' : 'month';
  const index = anthropicQueue.findIndex((q) => q.kind === kind);
  if (index === -1) return Promise.resolve(undefined);
  const [item] = anthropicQueue.splice(index, 1);
  return item?.value;
}

import { COLORS } from '@/contexts/shared/infrastructure/discord-notify.js';
import { cronCostAlert } from '@/contexts/shared/presentation/routes/cron-cost-alert.js';

function createApp() {
  return new Hono().route('/cron', cronCostAlert);
}

const SECRET = 'test-cron-secret';
const validHeaders = { Authorization: `Bearer ${SECRET}` };
/** 請求額の欄。名前は「請求額（期間・Workspace 別の実額）」。 */
const ACTUAL_FIELD = '請求額';

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

/**
 * Discord embed の fields から値を引く。欄の名前には期間が付く
 * （'発酵（8/8 9:00 〜 8/9 9:00 (JST)）'）ので、「名前」か「名前（…）」で引く。
 */
function fieldValue(name: string): string | undefined {
  return lastEmbed().fields?.find((f) => f.name === name || f.name.startsWith(`${name}（`))?.value;
}

/** 欄の名前そのもの（期間の書き方を確かめる用）。 */
function fieldName(prefix: string): string | undefined {
  return lastEmbed().fields?.find((f) => f.name.startsWith(`${prefix}（`))?.name;
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
 * Workspace 一覧の応答。cost_report は workspace_id しか返さないので、
 * 名前を出すテストはこれを積む。積まなければ ID 表示に縮退する（それも仕様）。
 */
function workspacesResponse(workspaces: { id: string; name: string }[]) {
  return {
    __kind: 'workspaces',
    ok: true,
    status: 200,
    json: () => Promise.resolve({ data: workspaces, has_more: false }),
    text: () => Promise.resolve(''),
  };
}

/**
 * 月ぶんの cost_report 応答。日次レポートは対象日と月初からの2回を投げるので、
 * 傾向（前日比・累計・見込み）を見るテストは2つ目の応答を積む。
 */
function monthlyCostReportResponse(buckets: { date: string; amountCents: string }[]) {
  return {
    __kind: 'month',
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

/** API キー一覧の応答。 */
function apiKeysResponse(
  keys: { id: string; name: string; status?: string; workspace_id: string | null }[],
) {
  return {
    __kind: 'apiKeys',
    ok: true,
    status: 200,
    json: () =>
      Promise.resolve({ data: keys.map((k) => ({ status: 'active', ...k })), has_more: false }),
    text: () => Promise.resolve(''),
  };
}

/** キー別トークン数（usage_report）の応答。対象日 1 バケットぶん。 */
function usageResponse(
  results: {
    api_key_id: string | null;
    workspace_id: string | null;
    uncached_input_tokens: number;
    output_tokens: number;
  }[],
) {
  return {
    __kind: 'usage',
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

describe('cronCostAlert', () => {
  beforeEach(() => {
    mockNotifyDiscord.mockClear();
    mockFetch.mockReset();
    anthropicQueue = [];
    sticky = {};
    mockFetch.mockImplementation((url: string) => routeAnthropic(String(url)));
    vi.stubGlobal('fetch', mockFetch);
    supabaseState.rows = [];
    supabaseState.ocrUsage = [];
    supabaseState.ocrUsageError = null;
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
      fetchQueue
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
  // ユーザー別は「発酵」の欄の中に罫線でぶら下げる（ボード OCR・写真の文字起こしと同じ形）。
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
      const breakdown = fieldValue('発酵') ?? '';
      // コスト降順。b が $0.90、a が 2件で $0.60。
      expect(breakdown).toContain('├ ばば (baba@example.com): 1 件・推定 $0.9000');
      expect(breakdown).toContain('└ あきら (akira@example.com): 2 件・推定 $0.6000');
      expect(breakdown.indexOf('ばば')).toBeLessThan(breakdown.indexOf('あきら'));
      expect(breakdown).not.toContain('aaaaaaaa');
      expect(breakdown).not.toContain('bbbbbbbb');
      // なぜここだけ推定なのかを内訳自身が説明する（実額と並ぶと区別がつかないため）
      expect(breakdown).toContain('実額はユーザー別に取れない');
    });

    it('名前が無ければメールだけ、メールも無ければ ID の先頭 8 桁に縮退する', async () => {
      supabaseState.rows = threeRuns();
      // a はメールのみ（profiles 無し）、b はどちらも無い
      supabaseState.users = [{ id: 'aaaaaaaa-1111', email: 'akira@example.com' }];

      await createApp().request('/cron', { method: 'POST', headers: validHeaders });

      const breakdown = fieldValue('発酵') ?? '';
      expect(breakdown).toContain('akira@example.com: 2 件・推定 $0.6000');
      expect(breakdown).toContain('bbbbbbbb: 1 件・推定 $0.9000');
    });

    it('11 人以上の日は上位 10 人に絞り、残りの人数を書く', async () => {
      supabaseState.rows = Array.from({ length: 11 }, (_, i) =>
        fermentation({
          user_id: `user-${String(i).padStart(2, '0')}`,
          input_tokens: (11 - i) * 10_000,
          output_tokens: 0,
        }),
      );

      await createApp().request('/cron', { method: 'POST', headers: validHeaders });

      const breakdown = fieldValue('発酵') ?? '';
      expect(breakdown).toContain('user-00: 1 件・推定 $0.3300');
      expect(breakdown).toContain('user-09: 1 件・推定 $0.0600');
      expect(breakdown).not.toContain('user-10:');
      // 切ったことは「…他 N 名」で書く（全員載る日には出ない）
      expect(breakdown).toContain('…他 1 名');
    });

    it('ユーザーの解決に失敗してもレポートは出す（ID 表記に縮退）', async () => {
      supabaseState.rows = threeRuns();
      supabaseState.listUsersShouldThrow = true;
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const res = await createApp().request('/cron', { method: 'POST', headers: validHeaders });

      expect(res.status).toBe(200);
      const breakdown = fieldValue('発酵') ?? '';
      expect(breakdown).toContain('bbbbbbbb: 1 件・推定 $0.9000');
      expect(errorSpy).toHaveBeenCalledWith(
        '[cron-cost-alert] user lookup failed',
        expect.objectContaining({ error: 'listUsers down' }),
      );

      errorSpy.mockRestore();
    });

    it('発酵も OCR も 0 件の日はユーザー一覧を引かない（listUsers は最大 20 往復する）', async () => {
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
    fetchQueue.mockResolvedValueOnce({
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
      byModel: [{ model: '(内訳なし)', costUsd: 0.465 }],
      // workspace_id も無いので default workspace に積まれる（Anthropic の仕様）
      byWorkspace: [{ workspaceId: null, workspaceName: 'Default Workspace', costUsd: 0.465 }],
      workspaceNamesUnavailable: false,
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
    fetchQueue.mockResolvedValueOnce({
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
    it('用途別（Workspace 別）に、金額の直下へ並べる', async () => {
      vi.stubEnv('ANTHROPIC_ADMIN_KEY', 'sk-ant-admin01-test');
      supabaseState.rows = [fermentation()];
      fetchQueue
        .mockResolvedValueOnce(
          costReportResponse([
            {
              amount: '12.4836',
              model: 'claude-sonnet-4-6',
              token_type: 'output_tokens',
              workspace_id: 'wrkspc_ferm',
            },
            {
              amount: '18.81',
              model: 'claude-sonnet-5',
              token_type: 'output_tokens',
              workspace_id: 'wrkspc_ocr',
            },
          ]),
        )
        .mockResolvedValueOnce(
          workspacesResponse([
            { id: 'wrkspc_ferm', name: 'oryzae-prod-fermentation' },
            { id: 'wrkspc_ocr', name: 'oryzae-prod-ocr' },
          ]),
        );

      const res = await createApp().request('/cron', { method: 'POST', headers: validHeaders });
      const body = await res.json();

      const value = fieldValue(ACTUAL_FIELD) ?? '';
      // 「合計: 金額」の配下に「Workspace 名: 金額」をぶら下げる。親子が字形で分かる。
      // Default Workspace は額が無くても常に最後に出る（Oryzae 外の利用が混ざる場所）。
      expect(value).toContain(
        '合計: $0.3129\n├ oryzae-prod-ocr: $0.1881\n├ oryzae-prod-fermentation: $0.1248\n└ Default Workspace: $0',
      );

      expect(body.actualCost.byWorkspace).toEqual([
        { workspaceId: 'wrkspc_ocr', workspaceName: 'oryzae-prod-ocr', costUsd: 0.1881 },
        {
          workspaceId: 'wrkspc_ferm',
          workspaceName: 'oryzae-prod-fermentation',
          costUsd: 0.124836,
        },
      ]);
    });

    // 2026-09-23 のレポートの再現。発酵は 2 件 $0.12 しか使っていないのに、同じ
    // claude-sonnet-4-6 を使う別の何かが $6.32 使ったため、モデル軸では「発酵 $6.44」と
    // 報告されていた。Workspace 軸ならこれが起きない。
    it('同じモデルでも Workspace が違えば分けて出す（発酵に他人の額を積まない）', async () => {
      vi.stubEnv('ANTHROPIC_ADMIN_KEY', 'sk-ant-admin01-test');
      supabaseState.rows = [fermentation({ input_tokens: 2_921, output_tokens: 3_530 })];
      fetchQueue
        .mockResolvedValueOnce(
          costReportResponse([
            { amount: '12.34', model: 'claude-sonnet-4-6', workspace_id: 'wrkspc_ferm' },
            { amount: '632', model: 'claude-sonnet-4-6', workspace_id: 'wrkspc_ci' },
          ]),
        )
        .mockResolvedValueOnce(
          workspacesResponse([
            { id: 'wrkspc_ferm', name: 'oryzae-prod-fermentation' },
            { id: 'wrkspc_ci', name: 'oryzae-ci' },
          ]),
        );

      const res = await createApp().request('/cron', { method: 'POST', headers: validHeaders });
      const body = await res.json();

      const value = fieldValue(ACTUAL_FIELD) ?? '';
      expect(value).toContain('├ oryzae-ci: $6.32');
      expect(value).toContain('├ oryzae-prod-fermentation: $0.1234');
      // 合計は org 全体のまま（隠さない）。分かれたのは内訳。
      expect(body.actualCost.costUsd).toBeCloseTo(6.4434, 6);
      // 突き合わせの相手は発酵 Workspace の $0.1234。旧実装は同じモデルを合算した
      // $6.44 と比べ、9/23 に「-98% ずれている」と報告していた。
      const notices = fieldValue('要確認') ?? '';
      expect(notices).toContain('oryzae-prod-fermentation の実額 $0.1234');
      expect(notices).not.toContain('$6.44');
      expect(notices).not.toContain('-98%');
    });

    it('Workspace 名が引けない日は ID のまま出し、その旨を添える', async () => {
      vi.stubEnv('ANTHROPIC_ADMIN_KEY', 'sk-ant-admin01-test');
      // Workspace 一覧の応答を積まない = 取得失敗。金額は出し、名前だけ縮退させる。
      fetchQueue.mockResolvedValueOnce(
        costReportResponse([
          { amount: '500', model: 'claude-opus-5', workspace_id: 'wrkspc_01ABC' },
        ]),
      );

      const res = await createApp().request('/cron', { method: 'POST', headers: validHeaders });
      const body = await res.json();

      const value = fieldValue(ACTUAL_FIELD) ?? '';
      expect(value).toContain('├ wrkspc_01ABC: $5.00');
      expect(value).toContain('※ Workspace 名を取得できず、一部は ID 表示（金額は正しい）');
      expect(body.actualCost.workspaceNamesUnavailable).toBe(true);
    });

    it('default workspace は仕様どおり null で来るので、その名前で出す', async () => {
      vi.stubEnv('ANTHROPIC_ADMIN_KEY', 'sk-ant-admin01-test');
      // workspace_id を持たない result = default workspace（ドキュメント明記）
      fetchQueue.mockResolvedValueOnce(
        costReportResponse([{ amount: '500', model: 'claude-opus-5' }]),
      );

      const res = await createApp().request('/cron', { method: 'POST', headers: validHeaders });
      const body = await res.json();

      expect(fieldValue(ACTUAL_FIELD)).toContain('└ Default Workspace: $5.00');
      // id が無いだけで「名前が引けなかった」わけではない。一覧も叩かない。
      expect(body.actualCost.workspaceNamesUnavailable).toBe(false);
      // 対象日の cost_report は名前を引く必要が無いので Workspace 一覧を叩かない。
      // 一覧を叩くのは「$0 の Workspace も出す」ための 1 回だけ。
      const paths = mockFetch.mock.calls.map(([url]) => new URL(String(url)).pathname);
      expect(paths.filter((p) => p.endsWith('/cost_report'))).toHaveLength(2); // 対象日 + 月ぶん
      expect(paths.filter((p) => p.endsWith('/workspaces'))).toHaveLength(1);
    });

    it('内訳が取れなかったときは、その旨を出す（合計は正しいと添える）', async () => {
      vi.stubEnv('ANTHROPIC_ADMIN_KEY', 'sk-ant-admin01-test');
      // group_by が効かない応答（model も cost_type も無い）
      fetchQueue.mockResolvedValueOnce(costReportResponse([{ amount: '500' }]));

      await createApp().request('/cron', { method: 'POST', headers: validHeaders });

      const value = fieldValue(ACTUAL_FIELD) ?? '';
      expect(value).toContain('group_by が効いていない可能性');
      expect(value).toContain('合計は正しい値です');
    });

    it('確認先として管理画面と Anthropic Console のリンクを付ける', async () => {
      vi.stubEnv('ANTHROPIC_ADMIN_KEY', 'sk-ant-admin01-test');
      fetchQueue.mockResolvedValueOnce(
        costReportResponse([{ amount: '500', model: 'claude-opus-5' }]),
      );

      await createApp().request('/cron', { method: 'POST', headers: validHeaders });

      // 通知だけで数字の裏取りに行けること（Console はモデル別 + API キー別に割れる）
      const value = fieldValue(ACTUAL_FIELD) ?? '';
      expect(value).toContain('確認先: [管理画面](https://oryzae-admin.vercel.app/tools/spend)');
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
      // 発酵 Workspace $0.1248 / OCR Workspace $0.1881。推定 $0.124836 は前者と比べる。
      fetchQueue
        .mockResolvedValueOnce(
          costReportResponse([
            {
              amount: '12.4836',
              model: 'claude-sonnet-4-6',
              token_type: 'output_tokens',
              workspace_id: 'wrkspc_ferm',
            },
            {
              amount: '18.81',
              model: 'claude-sonnet-5',
              token_type: 'output_tokens',
              workspace_id: 'wrkspc_ocr',
            },
          ]),
        )
        .mockResolvedValueOnce(
          workspacesResponse([
            { id: 'wrkspc_ferm', name: 'oryzae-prod-fermentation' },
            { id: 'wrkspc_ocr', name: 'oryzae-prod-ocr' },
          ]),
        );

      const res = await createApp().request('/cron', { method: 'POST', headers: validHeaders });

      expect((await res.json()).notices).toEqual([]);
      expect(fieldValue('要確認')).toBeUndefined();
      expect(fieldValue('推定の計算根拠')).toBeUndefined();
      // スコープ（org 全体の実額・Workspace 別）は引き算や注記ではなく、欄の名前で伝える
      expect(fieldName('請求額')).toBe('請求額（8/8 9:00 〜 8/9 9:00 (JST)・Workspace 別の実額）');
    });

    it('推定が実額とズレた日だけ、両方の数字と計算根拠を出す', async () => {
      vi.stubEnv('ANTHROPIC_ADMIN_KEY', 'sk-ant-admin01-test');
      supabaseState.rows = [fermentation({ input_tokens: 5_972, output_tokens: 7_128 })];
      // 発酵 Workspace の実額 $0.0800 に対し推定 $0.124836 → +56%
      fetchQueue
        .mockResolvedValueOnce(
          costReportResponse([
            { amount: '8', model: 'claude-sonnet-4-6', workspace_id: 'wrkspc_ferm' },
          ]),
        )
        .mockResolvedValueOnce(
          workspacesResponse([{ id: 'wrkspc_ferm', name: 'oryzae-prod-fermentation' }]),
        );

      await createApp().request('/cron', { method: 'POST', headers: validHeaders });

      expect(fieldValue('推定の計算根拠')).toContain('in  5,972 × $3.00/MTok');
      expect(fieldValue('要確認')).toContain(
        '発酵の推定 $0.1248 が oryzae-prod-fermentation の実額 $0.0800 と +56% ずれている',
      );
    });

    // 突き合わせができなかったことを黙るのが一番まずい。「今日はズレなかった」と
    // 読めてしまい、実際には比べていない。
    it('発酵 Workspace が実額に無い日は、突き合わせていないことを明示する', async () => {
      vi.stubEnv('ANTHROPIC_ADMIN_KEY', 'sk-ant-admin01-test');
      supabaseState.rows = [fermentation({ input_tokens: 5_972, output_tokens: 7_128 })];
      fetchQueue
        .mockResolvedValueOnce(
          costReportResponse([
            { amount: '8', model: 'claude-sonnet-4-6', workspace_id: 'wrkspc_other' },
          ]),
        )
        .mockResolvedValueOnce(workspacesResponse([{ id: 'wrkspc_other', name: 'oryzae-dev' }]));

      await createApp().request('/cron', { method: 'POST', headers: validHeaders });

      const notices = fieldValue('要確認') ?? '';
      expect(notices).toContain(
        'Workspace「oryzae-prod-fermentation」が実額に無く、推定との突き合わせができていない',
      );
      // 0 と比べた結果の「-100% ずれている」は出さない。
      expect(notices).not.toContain('ずれている');
    });
  });

  // 「$0.1220」とだけ言われても多いのか少ないのか判断できない、への対応。
  describe('全体感（前日比・今月の累計・月末の見込み）', () => {
    it('対象日を前日・今月の累計・月末の見込みと並べて出す', async () => {
      vi.stubEnv('ANTHROPIC_ADMIN_KEY', 'sk-ant-admin01-test');
      supabaseState.rows = [fermentation()];
      fetchQueue
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
      // 9/26 のレポートへの指摘:「何日の何時から何日の何時まで」を欄ごとに区切る。
      expect(fieldName('今月の累計')).toBe('今月の累計（8/1 9:00 〜 8/9 9:00 (JST)）');
      expect(fieldValue('今月の累計')).toBe(
        [
          '合計: $0.5000（8 日分）',
          '└ Default Workspace: $0.5000',
          '月末（9/1 9:00 (JST)）までの見込み: $1.94（1 日平均 $0.0625 × 31 日）',
        ].join('\n'),
      );
    });

    it('月ぶんは月初から取り、対象日の内訳とは別に投げる', async () => {
      vi.stubEnv('ANTHROPIC_ADMIN_KEY', 'sk-ant-admin01-test');
      fetchQueue
        .mockResolvedValueOnce(costReportResponse([{ amount: '20', model: 'claude-sonnet-4-6' }]))
        .mockResolvedValueOnce(
          monthlyCostReportResponse([{ date: '2026-08-08', amountCents: '20' }]),
        );

      await createApp().request('/cron', { method: 'POST', headers: validHeaders });

      const costUrls = mockFetch.mock.calls
        .map(([url]) => String(url))
        .filter((url) => new URL(url).pathname.endsWith('/cost_report'));
      expect(costUrls).toHaveLength(2);
      const [dayUrl, monthUrl] = costUrls;
      expect(dayUrl).toContain(`starting_at=${encodeURIComponent('2026-08-08T00:00:00.000Z')}`);
      expect(dayUrl).toContain(`ending_at=${encodeURIComponent('2026-08-09T00:00:00.000Z')}`);
      expect(monthUrl).toContain(`starting_at=${encodeURIComponent('2026-08-01T00:00:00.000Z')}`);
      expect(monthUrl).toContain(`ending_at=${encodeURIComponent('2026-08-09T00:00:00.000Z')}`);
    });

    it('前日が不明なら「データなし」と書く（$0 と混同させない）', async () => {
      vi.stubEnv('ANTHROPIC_ADMIN_KEY', 'sk-ant-admin01-test');
      fetchQueue
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
      fetchQueue
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

      expect(fieldName('発酵')).toBe('発酵（8/8 9:00 〜 8/9 9:00 (JST)）');
      const value = fieldValue('発酵') ?? '';
      expect(
        value.startsWith(
          '2 件（成功 2 / 失敗 0）・2 人\n1 件あたり 推定 $0.4500（入 100,000 / 出 10,000 tok）\n',
        ),
      ).toBe(true);
      // 誰の発酵かも同じ欄に罫線でぶら下げる
      expect(value).toContain('aaaaaaaa: 1 件・推定 $0.4500');
      expect(value).toContain('bbbbbbbb: 1 件・推定 $0.4500');
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
  // 9/26 のレポートへの指摘:「どういう人が実行したのか、人の情報も加えてほしい」。
  // 発酵だけでなく、ボード OCR と写真の文字起こしも誰が使ったかを出す。
  describe('ボード OCR / 写真の文字起こし（誰が何回使ったか）', () => {
    it('機能ごとに回数・人数・トークンと、使った人を名前 (メール) で出す', async () => {
      supabaseState.ocrUsage = [
        { user_id: 'aaaaaaaa-1111', feature: 'ocr_board', input_tokens: 1200, output_tokens: 20 },
        { user_id: 'aaaaaaaa-1111', feature: 'ocr_board', input_tokens: 1000, output_tokens: 10 },
        { user_id: 'bbbbbbbb-2222', feature: 'ocr_board', input_tokens: 900, output_tokens: 5 },
        { user_id: 'bbbbbbbb-2222', feature: 'ocr_entry', input_tokens: 1800, output_tokens: 40 },
      ];
      supabaseState.users = [
        { id: 'aaaaaaaa-1111', email: 'akira@example.com' },
        { id: 'bbbbbbbb-2222', email: 'baba@example.com' },
      ];
      supabaseState.profiles = [{ id: 'aaaaaaaa-1111', nickname: 'あきら' }];

      const res = await createApp().request('/cron', { method: 'POST', headers: validHeaders });
      const body = await res.json();

      expect(fieldName('ボード OCR')).toBe('ボード OCR（8/8 9:00 〜 8/9 9:00 (JST)）');
      expect(fieldValue('ボード OCR')).toBe(
        [
          '3 回・2 人・入 3,100 / 出 35 tok',
          '├ あきら (akira@example.com): 2 回・入 2,200 / 出 30 tok',
          '└ baba@example.com: 1 回・入 900 / 出 5 tok',
        ].join('\n'),
      );
      expect(fieldValue('写真の文字起こし')).toBe(
        ['1 回・1 人・入 1,800 / 出 40 tok', '└ baba@example.com: 1 回・入 1,800 / 出 40 tok'].join(
          '\n',
        ),
      );
      expect(body.ocrUsage).toEqual({
        ocr_board: { count: 3, userCount: 2 },
        ocr_entry: { count: 1, userCount: 1 },
      });
    });

    it('使われなかった日は「0 回」と 1 行で書く', async () => {
      await createApp().request('/cron', { method: 'POST', headers: validHeaders });

      expect(fieldValue('ボード OCR')).toBe('0 回');
      expect(fieldValue('写真の文字起こし')).toBe('0 回');
    });

    // migration 未適用だと記録の表が無い。それを「0 回」と書くと使われていないように読める。
    it('記録を読めなかった日は 0 回と書かず、読めなかったと書く', async () => {
      supabaseState.ocrUsageError = {
        message: 'relation "public.ai_usage" does not exist',
      };

      await createApp().request('/cron', { method: 'POST', headers: validHeaders });

      expect(fieldValue('ボード OCR')).toContain('記録を取得できません');
      expect(fieldValue('ボード OCR')).not.toContain('0 回');
    });

    it('発酵と OCR の利用者は 1 回でまとめて名前を引く（listUsers は最大 20 往復する）', async () => {
      supabaseState.rows = [fermentation({ user_id: 'aaaaaaaa-1111' })];
      supabaseState.ocrUsage = [
        { user_id: 'bbbbbbbb-2222', feature: 'ocr_entry', input_tokens: 10, output_tokens: 1 },
      ];

      await createApp().request('/cron', { method: 'POST', headers: validHeaders });

      expect(supabaseState.listUsersCalls).toBe(1);
    });
  });

  describe('Workspace ごとのキーと今月の累計', () => {
    it('すべての Workspace を並べ、配下にキーとトークン数をぶら下げる', async () => {
      vi.stubEnv('ANTHROPIC_ADMIN_KEY', 'sk-ant-admin01-test');
      fetchQueue
        .mockResolvedValueOnce(
          costReportResponse([
            { amount: '1.02', model: 'claude-sonnet-5', workspace_id: 'ws_ocr' },
            { amount: '11.36', model: 'claude-sonnet-4-6' },
          ]),
        )
        .mockResolvedValueOnce(
          workspacesResponse([
            { id: 'ws_ocr', name: 'oryzae-prod-ocr' },
            { id: 'ws_ci', name: 'oryzae-ci' },
          ]),
        )
        .mockResolvedValueOnce(
          apiKeysResponse([
            { id: 'k_board', name: 'oryzae-prod-ocr-board', workspace_id: 'ws_ocr' },
            { id: 'k_entry', name: 'oryzae-prod-ocr-entry', workspace_id: 'ws_ocr' },
            { id: 'k_student', name: 'waseda-class', workspace_id: null },
          ]),
        )
        .mockResolvedValueOnce(
          usageResponse([
            {
              api_key_id: 'k_board',
              workspace_id: 'ws_ocr',
              uncached_input_tokens: 2100,
              output_tokens: 150,
            },
            {
              api_key_id: 'k_student',
              workspace_id: null,
              uncached_input_tokens: 31000,
              output_tokens: 4200,
            },
          ]),
        );

      await createApp().request('/cron', { method: 'POST', headers: validHeaders });

      expect(fieldValue(ACTUAL_FIELD)).toContain(
        [
          '├ oryzae-prod-ocr: $0.0102',
          '│ ├ キー oryzae-prod-ocr-board: 入 2,100 / 出 150 tok',
          '│ └ キー oryzae-prod-ocr-entry: 0 tok',
          '├ oryzae-ci: $0',
          '└ Default Workspace: $0.1136',
          '\u2800\u2800└ キー waseda-class: 入 31,000 / 出 4,200 tok',
        ].join('\n'),
      );
    });

    it('今月の累計は Workspace ごとの額を出す（上限は出さない）', async () => {
      vi.stubEnv('ANTHROPIC_ADMIN_KEY', 'sk-ant-admin01-test');
      fetchQueue
        .mockResolvedValueOnce(costReportResponse([{ amount: '100', workspace_id: 'ws_ferm' }]))
        .mockResolvedValueOnce(
          workspacesResponse([{ id: 'ws_ferm', name: 'oryzae-prod-fermentation' }]),
        )
        .mockResolvedValueOnce({
          __kind: 'month',
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              data: [
                {
                  starting_at: '2026-08-07T00:00:00Z',
                  results: [{ amount: '200', workspace_id: 'ws_ferm' }],
                },
                {
                  starting_at: '2026-08-08T00:00:00Z',
                  results: [{ amount: '100', workspace_id: 'ws_ferm' }],
                },
              ],
              has_more: false,
            }),
          text: () => Promise.resolve(''),
        });

      await createApp().request('/cron', { method: 'POST', headers: validHeaders });

      expect(fieldValue('今月の累計')).toContain(
        '├ oryzae-prod-fermentation: $3.00\n└ Default Workspace: $0',
      );
    });
  });
});
