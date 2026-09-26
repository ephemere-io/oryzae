/**
 * Anthropic Admin API の Cost Report から「実請求額」を取得する。
 *
 * issue #352 で Vercel AI Gateway → Anthropic 直叩きに切替えた結果、Gateway の
 * spend API (`gateway.getSpendReport`) には実績が一切入らなくなった。実額の正は
 * Anthropic の cost_report だけなので、コスト画面と日次レポートはここを参照する。
 *
 * ## 用途別の内訳は **Workspace 別の実額** で取る（モデルから推測しない）
 *
 * `group_by[]=workspace_id&group_by[]=description` の 2 軸で取る（cost_report の
 * ドキュメントに載っている組み合わせそのもの）。Oryzae は機能ごとに API キーを分け、
 * キーごとに Workspace を分けてあるので、**Workspace 別の実額＝用途別の実額**になる。
 *
 * **モデル別では用途を割れない。** 以前はモデル ID から用途を読み替えていたが、
 * (a) ボード OCR と写真の文字起こしは同じ claude-sonnet-5 で区別できず、
 * (b) CI の Claude がアプリと同じモデルを使えば同じ行に混ざる。実際 2026-09-15 に
 * 定期セキュリティ監査の消費が「OCR $6.46」として報告され、2026-09-23 には
 * 発酵 2 件（実際は $0.12）に $6.44 全額が積まれた。モデルは用途ではない。
 *
 * これはキャッシュ読み書き・値引き・課金丸めも反映済みの実額なので、自前推定より
 * 正確でもある（`token_type` に cache_read / cache_creation が現れる）。
 *
 * 自前トークンからの推定 (claude-pricing.ts) が残っているのは **ユーザー別内訳**
 * のためだけ。Anthropic は Oryzae のユーザーを知らないので、その軸だけは実額で出せない。
 *
 * 仕様上の制約（docs/observability-guide.md にも記載）:
 *   - バケットは UTC 日固定（bucket_width=1d のみ）。JST 日での実額は取得できない。
 *   - amount は「最小通貨単位（セント）の10進文字列」。100 で割って USD にする。
 *   - 反映ラグは通常5分程度。直近数分の利用は載らないことがある。
 *   - Priority Tier のコストは cost_report に含まれない（Oryzae は standard のみ）。
 *   - cost_report の group_by は `description` / `workspace_id` のみ。**api_key 別には
 *     割れない**（Console の Cost 画面はキー別に割れるので、API より細かい）。
 *     1 つの Workspace に複数のキーを置くと、その中では分けられない。
 *   - default workspace の利用は `workspace_id` が **null** で返る（ドキュメント明記）。
 *     推測ではないので DEFAULT_WORKSPACE_LABEL として明示的に扱う。
 */
const COST_REPORT_URL = 'https://api.anthropic.com/v1/organizations/cost_report';
/** Workspace の id → 名前を引く。cost_report は id しか返さない。 */
const WORKSPACES_URL = 'https://api.anthropic.com/v1/organizations/workspaces';
/** API キーの名前と所属 Workspace。Console 上の名前をレポートに出すため。 */
const API_KEYS_URL = 'https://api.anthropic.com/v1/organizations/api_keys';
/** キー別のトークン数。cost_report はキー別に割れないので、こちらで補う（金額ではない）。 */
const USAGE_REPORT_URL = 'https://api.anthropic.com/v1/organizations/usage_report/messages';
/**
 * 実額の出典（人が見る側）。画面・通知からここへ飛ばして数字を突き合わせられるようにする。
 * Console はモデル別に加えて **API キー別** にも割れるので、この API より細かく見られる。
 */
export const ANTHROPIC_COST_CONSOLE_URL = 'https://platform.claude.com/cost';
const ANTHROPIC_VERSION = '2023-06-01';
const REQUEST_TIMEOUT_MS = 10_000;
/**
 * 1ページあたりのバケット数。**明示しないと既定 7 になる**（docs: "limit … default: 7,
 * maximum: 31"）。30 日分を取るのに api.anthropic.com へ逐次 5 往復していて、これが
 * コスト画面の待ち時間の主因だった。上限の 31 を渡せば 30 日は 1 往復で済む。
 */
const BUCKETS_PER_PAGE = 31;
// 暴走防止の上限。31バケット × 10ページ ≒ 10か月分まで取り切れる。
const MAX_PAGES = 10;

/**
 * 内訳が取れなかった行の受け皿。
 *
 * group_by が効かない・トークン以外のコスト（web_search 等）で model が null の場合に使う。
 * 落とさずここに積むことで、**内訳の合計は必ず総額と一致する**（テストで固定）。
 * 黙って捨てると「内訳を全部出した」ように見えて実際は欠けている状態になる。
 */
const UNGROUPED_MODEL_LABEL = '(内訳なし)';
const UNKNOWN_TOKEN_TYPE_LABEL = '(その他)';
/**
 * `workspace_id: null` の行。ドキュメントに「default workspace の利用は null」と
 * 明記されているので、これは推測ではなく仕様どおりの読み替え。
 */
export const DEFAULT_WORKSPACE_LABEL = 'Default Workspace';
/**
 * Workspace・API キー一覧のページ上限。どちらも 1 ページ最大 1000 件
 * （ドキュメント）なので、実質 1 往復で足りる。
 */
const LIST_PAGES = 5;
const LIST_PAGE_SIZE = '1000';

interface DailyActualCost {
  /** UTC 日 (YYYY-MM-DD)。cost_report のバケットは UTC 固定。 */
  date: string;
  costUsd: number;
}

interface TokenTypeActualCost {
  /** cost_report の token_type（uncached_input_tokens / output_tokens / cache_read_input_tokens 等）。 */
  tokenType: string;
  costUsd: number;
}

interface ModelActualCost {
  /** cost_report の model。トークン以外のコストや内訳なしの場合は代替ラベル。 */
  model: string;
  costUsd: number;
  /** 単価の内訳。キャッシュ読み書きが混ざっていれば token_type に現れる。 */
  byTokenType: TokenTypeActualCost[];
}

/**
 * Workspace 別の実額。Oryzae ではこれが **用途別の実額** にあたる。
 *
 * 表示名は Anthropic から取った Workspace 名をそのまま出す。「fermentation だから発酵」
 * のような読み替え表は持たない——用途名を自前で持つと、Console で Workspace を
 * 増やしたり改名したときに、画面だけが古い名前を出し続ける。
 */
/**
 * Workspace の中のモデル別。**token_type の内訳は持たない。**
 *
 * ModelActualCost を使い回すと byTokenType が常に空配列で付いてきて、「キャッシュが
 * 混ざっていない」ことの表明に見えてしまう。単価の検算をしたいときはトップレベルの
 * byModel を見る。
 */
interface WorkspaceModelCost {
  model: string;
  costUsd: number;
}

export interface WorkspaceActualCost {
  /** cost_report の workspace_id。default workspace は null。 */
  workspaceId: string | null;
  /**
   * 表示名。解決順は (1) Workspace 一覧の名前 (2) null なら Default Workspace
   * (3) 一覧に無い id はその id をそのまま。**推測した用途名は入れない。**
   */
  workspaceName: string;
  costUsd: number;
  /** この Workspace の中のモデル別内訳。合計は costUsd と一致する。 */
  byModel: WorkspaceModelCost[];
}

/**
 * 実額の取得結果。「未設定」と「$0」を区別できるようにユニオンで返す。
 * これを number | null に潰すと、キー未設定を $0 と誤表示してしまう
 * （まさに issue の「いつも0円」を再生産することになる）。
 */
export type ActualCostResult =
  | {
      kind: 'ok';
      totalCostUsd: number;
      daily: DailyActualCost[];
      /** モデル別の実額（コスト降順）。合計は totalCostUsd と一致する。 */
      byModel: ModelActualCost[];
      /**
       * Workspace 別の実額（コスト降順）。**用途別に読むならこれを見る。**
       * 合計は totalCostUsd と一致する。
       */
      byWorkspace: WorkspaceActualCost[];
      /**
       * Workspace 名を一覧から引けなかった場合 true（= 表示名が id のまま）。
       *
       * 金額は正しいので失敗にはしない。ただし画面に `wrkspc_01ABC…` が並ぶ理由を
       * 呼び出し側が説明できるようにフラグで返す。黙って id を出すと「知らない
       * Workspace が課金されている」ように読めてしまう。
       */
      workspaceNamesUnavailable: boolean;
      /**
       * `group_by[]` を送ったのに内訳が1件も返らなかった場合 true。
       *
       * 書式や仕様が変わって grouping が無視されると、results が1件に丸められ
       * `model` が null になる。**これは失敗しない**——総額は正しいまま内訳だけが
       * 静かに消えるので、フラグにして呼び出し側から見えるようにする。
       * `(内訳なし)` の行だけを見せると、モデル名の一種のように読めてしまう。
       */
      groupingUnavailable: boolean;
      /**
       * MAX_PAGES に達してページングを打ち切った場合 true（= 実額は過少）。
       * 打ち切りを黙って隠すと「途中までの合計」を完全な実請求額として
       * 表示してしまう。fermentation-cost-query.ts の truncated と同じ方針。
       */
      truncated: boolean;
    }
  | { kind: 'not-configured' }
  | { kind: 'error'; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** cost_report の amount はセント単位の10進文字列。数値化できなければ 0 扱い。 */
function parseAmountToUsd(amount: unknown): number {
  if (typeof amount !== 'string') return 0;
  const cents = Number(amount);
  return Number.isFinite(cents) ? cents / 100 : 0;
}

/** result 1件をどのモデルに積むか決める。model が無ければ cost_type、それも無ければ受け皿へ。 */
function modelKeyOf(item: Record<string, unknown>): string {
  if (typeof item.model === 'string' && item.model !== '') return item.model;
  // web_search / code_execution / session_usage はトークンではないので model が null。
  if (typeof item.cost_type === 'string' && item.cost_type !== '') return `(${item.cost_type})`;
  return UNGROUPED_MODEL_LABEL;
}

/**
 * result 1 件をどの Workspace に積むか。null は default workspace（仕様どおり）。
 * 文字列でない値が来たら null 扱いにする——勝手なキーを作ると合計が割れる。
 */
function workspaceKeyOf(item: Record<string, unknown>): string | null {
  if (typeof item.workspace_id === 'string' && item.workspace_id !== '') return item.workspace_id;
  return null;
}

function tokenTypeKeyOf(item: Record<string, unknown>): string {
  if (typeof item.token_type === 'string' && item.token_type !== '') return item.token_type;
  return UNKNOWN_TOKEN_TYPE_LABEL;
}

interface ParsedBucket {
  daily: DailyActualCost;
  items: {
    modelKey: string;
    tokenTypeKey: string;
    workspaceKey: string | null;
    costUsd: number;
  }[];
}

function parseBucket(bucket: unknown): ParsedBucket | null {
  if (!isRecord(bucket)) return null;
  const startingAt = bucket.starting_at;
  if (typeof startingAt !== 'string') return null;
  const results = bucket.results;
  if (!Array.isArray(results)) return null;

  let costUsd = 0;
  const items: ParsedBucket['items'] = [];
  for (const item of results) {
    if (!isRecord(item)) continue;
    const itemCost = parseAmountToUsd(item.amount);
    costUsd += itemCost;
    items.push({
      modelKey: modelKeyOf(item),
      tokenTypeKey: tokenTypeKeyOf(item),
      workspaceKey: workspaceKeyOf(item),
      costUsd: itemCost,
    });
  }
  return { daily: { date: startingAt.slice(0, 10), costUsd }, items };
}

function adminHeaders(adminKey: string): Record<string, string> {
  return {
    'x-api-key': adminKey,
    'anthropic-version': ANTHROPIC_VERSION,
    'User-Agent': 'Oryzae/1.0 (https://github.com/ephemere-io/oryzae)',
  };
}

/**
 * `after_id` / `has_more` / `last_id` 方式の一覧を全件読む（Workspace・API キーの一覧）。
 *
 * **`page` / `next_page` ではない。** cost_report / usage_report とはページ送りの方式が
 * 違う。以前は Workspace 一覧を `page` で送っていたが、その引数は無視されるので、
 * 2 ページ目以降があれば同じページを読み続けて取りこぼしていた（件数が少なく表面化せず）。
 */
async function listAll(adminKey: string, url: string): Promise<Record<string, unknown>[] | null> {
  const items: Record<string, unknown>[] = [];
  let afterId: string | undefined;
  try {
    for (let i = 0; i < LIST_PAGES; i++) {
      const params = new URLSearchParams({ limit: LIST_PAGE_SIZE });
      if (afterId) params.set('after_id', afterId);
      const res = await fetch(`${url}?${params.toString()}`, {
        headers: adminHeaders(adminKey),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!res.ok) return null;
      const body: unknown = await res.json();
      if (!isRecord(body) || !Array.isArray(body.data)) return null;
      for (const item of body.data) if (isRecord(item)) items.push(item);
      if (body.has_more !== true || typeof body.last_id !== 'string') break;
      afterId = body.last_id;
    }
    return items;
  } catch {
    return null;
  }
}

/** アーカイブされていない Workspace。 */
export interface WorkspaceInfo {
  id: string;
  name: string;
}

/**
 * Workspace の一覧（アーカイブ済みを除く）。失敗しても **例外にしない**（null を返す）。
 *
 * 名前は表示のためだけのもので、金額の正しさには関わらない。ここで throw すると
 * 「Workspace 名の API が落ちた日はコストレポートも来ない」ことになり、本末転倒。
 */
async function fetchWorkspaces(adminKey: string): Promise<WorkspaceInfo[] | null> {
  const items = await listAll(adminKey, WORKSPACES_URL);
  if (!items) return null;
  const workspaces: WorkspaceInfo[] = [];
  for (const item of items) {
    if (typeof item.id !== 'string' || typeof item.name !== 'string' || item.name === '') continue;
    if (item.archived_at !== null && item.archived_at !== undefined) continue;
    workspaces.push({ id: item.id, name: item.name });
  }
  return workspaces;
}

export interface ApiKeyInfo {
  id: string;
  /** Console で付けた名前。 */
  name: string;
  status: string;
  /**
   * 所属 Workspace。**default workspace は null**（cost_report / usage_report と同じ表現）。
   * Workspace に属さない組織スコープのキーも null になるが、Oryzae には無い。
   */
  workspaceId: string | null;
}

/**
 * API キーの一覧。所属は非推奨の `workspace_id`（default は null）で読み、
 * 無ければ `scope.workspace_id` に落とす。`scope` は default workspace でも実 ID を
 * 返すので、そのままだと cost_report の null と突き合わせられない。
 */
async function fetchApiKeys(adminKey: string): Promise<ApiKeyInfo[] | null> {
  const items = await listAll(adminKey, API_KEYS_URL);
  if (!items) return null;
  const keys: ApiKeyInfo[] = [];
  for (const item of items) {
    if (typeof item.id !== 'string' || typeof item.name !== 'string') continue;
    let workspaceId: string | null = null;
    if (typeof item.workspace_id === 'string') {
      workspaceId = item.workspace_id;
    } else if (item.workspace_id === undefined && isRecord(item.scope)) {
      workspaceId = typeof item.scope.workspace_id === 'string' ? item.scope.workspace_id : null;
    }
    keys.push({
      id: item.id,
      name: item.name,
      status: typeof item.status === 'string' ? item.status : 'unknown',
      workspaceId,
    });
  }
  return keys;
}

/** キー 1 本ぶんのトークン数（期間合計）。金額ではない。 */
export interface KeyTokenUsage {
  /** null は Console の playground など、キーを使わない利用。 */
  apiKeyId: string | null;
  /** default workspace は null。 */
  workspaceId: string | null;
  uncachedInputTokens: number;
  cacheCreationInputTokens: number;
  cacheReadInputTokens: number;
  outputTokens: number;
}

function numberOr0(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/** usage_report をキー × Workspace で取って、期間で合算する。 */
async function fetchUsageByApiKey(
  adminKey: string,
  startingAt: Date,
  endingAt: Date,
): Promise<KeyTokenUsage[] | null> {
  const perKey = new Map<string, KeyTokenUsage>();
  let page: string | undefined;
  try {
    for (let i = 0; i < MAX_PAGES; i++) {
      const params = new URLSearchParams({
        starting_at: startingAt.toISOString(),
        ending_at: endingAt.toISOString(),
        bucket_width: '1d',
        limit: String(BUCKETS_PER_PAGE),
      });
      params.append('group_by[]', 'api_key_id');
      params.append('group_by[]', 'workspace_id');
      if (page) params.set('page', page);
      const res = await fetch(`${USAGE_REPORT_URL}?${params.toString()}`, {
        headers: adminHeaders(adminKey),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!res.ok) return null;
      const body: unknown = await res.json();
      if (!isRecord(body) || !Array.isArray(body.data)) return null;

      for (const bucket of body.data) {
        if (!isRecord(bucket) || !Array.isArray(bucket.results)) continue;
        for (const r of bucket.results) {
          if (!isRecord(r)) continue;
          const apiKeyId = typeof r.api_key_id === 'string' ? r.api_key_id : null;
          const workspaceId = typeof r.workspace_id === 'string' ? r.workspace_id : null;
          const mapKey = `${apiKeyId ?? '-'}|${workspaceId ?? '-'}`;
          const acc = perKey.get(mapKey) ?? {
            apiKeyId,
            workspaceId,
            uncachedInputTokens: 0,
            cacheCreationInputTokens: 0,
            cacheReadInputTokens: 0,
            outputTokens: 0,
          };
          acc.uncachedInputTokens += numberOr0(r.uncached_input_tokens);
          if (isRecord(r.cache_creation)) {
            acc.cacheCreationInputTokens +=
              numberOr0(r.cache_creation.ephemeral_1h_input_tokens) +
              numberOr0(r.cache_creation.ephemeral_5m_input_tokens);
          }
          acc.cacheReadInputTokens += numberOr0(r.cache_read_input_tokens);
          acc.outputTokens += numberOr0(r.output_tokens);
          perKey.set(mapKey, acc);
        }
      }
      if (body.has_more !== true || typeof body.next_page !== 'string') break;
      page = body.next_page;
    }
    return Array.from(perKey.values());
  } catch {
    return null;
  }
}

/**
 * 日次レポートの「Workspace ごとに何のキーが何トークン使ったか」の材料。
 *
 * 金額は含まない（cost_report はキー別に割れない）。1 つの Workspace に複数のキーが
 * いるとき（ボード OCR と写真の文字起こし）、どちらがどれだけ使ったかをトークン数で見せる。
 * 3 つの取得は独立なので並行に投げ、どれかが失敗したらその部分だけ null にする。
 */
export type UsageDetailResult =
  | {
      kind: 'ok';
      /** null は取得失敗（名前は ID 表示に縮退する）。 */
      workspaces: WorkspaceInfo[] | null;
      apiKeys: ApiKeyInfo[] | null;
      usageByKey: KeyTokenUsage[] | null;
    }
  | { kind: 'not-configured' };

export async function fetchUsageDetail(
  startingAt: Date,
  endingAt: Date,
): Promise<UsageDetailResult> {
  const adminKey = process.env.ANTHROPIC_ADMIN_KEY;
  if (!adminKey) return { kind: 'not-configured' };
  const [workspaces, apiKeys, usageByKey] = await Promise.all([
    fetchWorkspaces(adminKey),
    fetchApiKeys(adminKey),
    fetchUsageByApiKey(adminKey, startingAt, endingAt),
  ]);
  return { kind: 'ok', workspaces, apiKeys, usageByKey };
}

/**
 * Workspace の一覧。管理画面で $0 の Workspace も並べるため。
 * キー未設定なら 'not-configured'、取得失敗なら null。
 */
export async function listWorkspaces(): Promise<WorkspaceInfo[] | null | 'not-configured'> {
  const adminKey = process.env.ANTHROPIC_ADMIN_KEY;
  if (!adminKey) return 'not-configured';
  return fetchWorkspaces(adminKey);
}

/** Workspace の id → 名前。失敗したら null。 */
async function fetchWorkspaceNames(adminKey: string): Promise<Map<string, string> | null> {
  const workspaces = await fetchWorkspaces(adminKey);
  if (!workspaces) return null;
  return new Map(workspaces.map((w) => [w.id, w.name]));
}

/**
 * 指定期間の実請求額を取得する。
 *
 * @param startingAt 期間開始（この時刻以降に始まるバケットが対象。UTC 日境界に丸められる）
 * @param endingAt   期間終了（この時刻より前に終わるバケットが対象）
 */
export async function fetchActualCost(startingAt: Date, endingAt: Date): Promise<ActualCostResult> {
  const adminKey = process.env.ANTHROPIC_ADMIN_KEY;
  if (!adminKey) return { kind: 'not-configured' };

  const daily: DailyActualCost[] = [];
  const perModel = new Map<string, { costUsd: number; byTokenType: Map<string, number> }>();
  const perWorkspace = new Map<string | null, { costUsd: number; byModel: Map<string, number> }>();
  let page: string | undefined;
  let truncated = false;

  try {
    for (let i = 0; i < MAX_PAGES; i++) {
      const params = new URLSearchParams({
        starting_at: startingAt.toISOString(),
        ending_at: endingAt.toISOString(),
        bucket_width: '1d',
        limit: String(BUCKETS_PER_PAGE),
      });
      // 配列パラメータは `group_by[]`。これを付けないと results が1件に丸められ、
      // model / token_type / workspace_id が null になって内訳が出せない。
      //
      // 2 軸同時に指定する（cost_report のドキュメントに載っている組み合わせ）。
      // workspace_id が **用途別**、description が各 Workspace 内の **モデル別**。
      params.append('group_by[]', 'workspace_id');
      params.append('group_by[]', 'description');
      if (page) params.set('page', page);

      const res = await fetch(`${COST_REPORT_URL}?${params.toString()}`, {
        headers: adminHeaders(adminKey),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        return {
          kind: 'error',
          message: `cost_report responded ${res.status}: ${body.slice(0, 200)}`,
        };
      }

      const body: unknown = await res.json();
      if (!isRecord(body) || !Array.isArray(body.data)) {
        return { kind: 'error', message: 'cost_report returned an unexpected shape' };
      }

      for (const bucket of body.data) {
        const parsed = parseBucket(bucket);
        if (!parsed) continue;
        daily.push(parsed.daily);
        for (const item of parsed.items) {
          const model = perModel.get(item.modelKey) ?? { costUsd: 0, byTokenType: new Map() };
          model.costUsd += item.costUsd;
          model.byTokenType.set(
            item.tokenTypeKey,
            (model.byTokenType.get(item.tokenTypeKey) ?? 0) + item.costUsd,
          );
          perModel.set(item.modelKey, model);

          const ws = perWorkspace.get(item.workspaceKey) ?? { costUsd: 0, byModel: new Map() };
          ws.costUsd += item.costUsd;
          ws.byModel.set(item.modelKey, (ws.byModel.get(item.modelKey) ?? 0) + item.costUsd);
          perWorkspace.set(item.workspaceKey, ws);
        }
      }

      if (body.has_more !== true || typeof body.next_page !== 'string') break;
      page = body.next_page;
      // 次ページがあるのに今回が最終イテレーションなら、この後打ち切られる。
      if (i === MAX_PAGES - 1) truncated = true;
    }

    const totalCostUsd = daily.reduce((sum, d) => sum + d.costUsd, 0);
    // 課金があるのに内訳キーが受け皿しか無い = grouping が効いていない。
    // 0 円の日は内訳が無くて当然なので、総額が正のときだけ判定する。
    const groupingUnavailable =
      totalCostUsd > 0 &&
      perModel.size > 0 &&
      Array.from(perModel.keys()).every((key) => key === UNGROUPED_MODEL_LABEL);
    const byModel: ModelActualCost[] = Array.from(perModel.entries())
      .map(([model, v]) => ({
        model,
        costUsd: v.costUsd,
        byTokenType: Array.from(v.byTokenType.entries())
          .map(([tokenType, cost]) => ({ tokenType, costUsd: cost }))
          .sort((a, b) => b.costUsd - a.costUsd),
      }))
      .sort((a, b) => b.costUsd - a.costUsd);

    // 名前を引くのは **解決すべき id があるときだけ**。課金が無い日や default
    // workspace だけの日に Workspace 一覧を叩いても、返ってくる名前に使い道がない。
    const idsToName = Array.from(perWorkspace.keys()).filter((id) => id !== null);
    // 名前が取れなくても金額は返す。表示名は id にフォールバックし、その事実を返す。
    const workspaceNames = idsToName.length > 0 ? await fetchWorkspaceNames(adminKey) : new Map();
    const hasUnnamedWorkspace = idsToName.some((id) => !workspaceNames?.get(id));

    const byWorkspace: WorkspaceActualCost[] = Array.from(perWorkspace.entries())
      .map(([workspaceId, v]) => ({
        workspaceId,
        workspaceName:
          workspaceId === null
            ? DEFAULT_WORKSPACE_LABEL
            : (workspaceNames?.get(workspaceId) ?? workspaceId),
        costUsd: v.costUsd,
        byModel: Array.from(v.byModel.entries())
          .map(([model, costUsd]) => ({ model, costUsd }))
          .sort((a, b) => b.costUsd - a.costUsd),
      }))
      .sort((a, b) => b.costUsd - a.costUsd);

    return {
      kind: 'ok',
      totalCostUsd,
      daily,
      byModel,
      byWorkspace,
      groupingUnavailable,
      workspaceNamesUnavailable: hasUnnamedWorkspace,
      truncated,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { kind: 'error', message };
  }
}

/** 実額を Discord / API に出すときの共通表記。未設定・失敗を $0 と混同させない。 */
export function formatActualCost(result: ActualCostResult): string {
  if (result.kind === 'ok') {
    const amount = `$${result.totalCostUsd.toFixed(4)}`;
    return result.truncated ? `${amount} (集計打ち切り・過少)` : amount;
  }
  if (result.kind === 'not-configured') return '未設定 (ANTHROPIC_ADMIN_KEY)';
  return `取得失敗: ${result.message.slice(0, 80)}`;
}
