import { clearTokens, getRefreshToken, setTokens } from '@/lib/auth';
import { isObject, readJson, readStringField } from '@/lib/json';

export interface ApiClient {
  baseUrl: string;
  headers: Record<string, string>;
  fetch(path: string, init?: RequestInit): Promise<Response>;
}

// Issue #362: 楽観的データ取得では、失効した access token で複数のリクエストが
// 同時に 401 になり得る（N 個のデータフック × 複数の useAuth インスタンス）。
// Supabase は refresh token をローテートするため、並発リフレッシュは二重実行＝
// 後発がトークン再利用エラーで失敗する。in-flight な refresh を1本に集約し、
// 同時呼び出しは同じ Promise を共有する（解決後にクリアし次回は再実行可能）。
let inFlightRefresh: Promise<string | null> | null = null;

/** refresh レスポンスから session を取り出す。形が違えば null（＝失効扱い）。 */
function readSession(input: unknown): { accessToken: string; refreshToken: string } | null {
  if (!isObject(input)) return null;
  const session = input.session;
  const accessToken = readStringField(session, 'accessToken');
  const refreshToken = readStringField(session, 'refreshToken');
  if (accessToken === null || refreshToken === null) return null;
  return { accessToken, refreshToken };
}

export async function tryRefreshToken(): Promise<string | null> {
  if (inFlightRefresh) return inFlightRefresh;

  inFlightRefresh = (async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return null;

    const res = await fetch('/api/v1/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) {
      clearTokens();
      return null;
    }

    // 200 なのに body が壊れているのはサーバー側の問題で、refresh token が
    // 無効になったわけではない。ここで clearTokens すると一時的な不具合で
    // 全セッションが強制ログアウトになるため、今回の refresh を失敗扱いにするだけ。
    const session = readSession(await readJson(res));
    if (!session) return null;
    setTokens(session.accessToken, session.refreshToken);
    return session.accessToken;
  })();

  try {
    return await inFlightRefresh;
  } finally {
    inFlightRefresh = null;
  }
}

/**
 * 同じ GET を憶えておく時間（ms）。
 *
 * 画面を行き来する往復（書斎 → 瓶 → 書斎 → 瓶）を跨ぐ長さがあればよい。長くすると、
 * サーバー側だけで進む変化（発酵が仕上がる等）に気づくのが遅れる。利用者自身の
 * 操作で起きる変化は、その書き込み（POST/PATCH/DELETE）が憶えを全部捨てるので
 * ここには関係しない。
 */
const GET_CACHE_MS = 30_000;

interface CachedGet {
  at: number;
  status: number;
  statusText: string;
  contentType: string;
  body: string;
}

/**
 * 認証は憶えない。トークンの状態そのものを問う口なので、前の答えを返すと
 * 失効に気づけなくなる。
 */
function isCacheableGet(path: string, init?: RequestInit): boolean {
  const method = (init?.method ?? 'GET').toUpperCase();
  if (method !== 'GET') return false;
  return path.startsWith('/api/v1/') && !path.startsWith('/api/v1/auth/');
}

/**
 * 憶えてよい返事か。**JSON だけ**を憶える。
 *
 * 本文を一度 text にしてから貯めるので、画像や添付をそのまま通すと壊れる。
 * 内容の種類で判じることで、ここがドメインを知らずに済む（lib の規約）。
 */
function isCacheableResponse(res: Response): boolean {
  if (!res.ok) return false;
  return (res.headers.get('content-type') ?? '').includes('application/json');
}

export function createApiClient(accessToken?: string): ApiClient {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  /**
   * 直近の GET の返事。**この client（＝このログインセッション）だけのもの**で、
   * 保存もしない。別の利用者に渡ることはなく、再読み込みで空になる。
   *
   * 瓶や書斎は開くたびに同じ口を叩いていて（`/api/v1/fermentations` は受信箱と履歴の
   * 2 か所、`/api/v1/questions` は瓶と書斎）、行き来のたびに待ち時間が生まれていた
   * （「瓶の画面も開くたびにロードされていて、表示までに結構タイムラグがある」）。
   */
  const getCache = new Map<string, CachedGet>();
  /** 進行中の GET。同じ口へ同時に 2 本出さないための一本化。 */
  const inFlightGets = new Map<string, Promise<Response>>();

  function replay(entry: CachedGet): Response {
    return new Response(entry.body, {
      status: entry.status,
      statusText: entry.statusText,
      headers: { 'Content-Type': entry.contentType },
    });
  }

  async function doFetch(path: string, init?: RequestInit): Promise<Response> {
    if (isCacheableGet(path, init)) return cachedFetch(path, init);
    // 書き込みは憶えを全部捨てる。どの口の答えが変わったかは lib からは分からない
    // （分かろうとするとドメインを知ることになる）ので、まとめて捨てる。
    getCache.clear();
    return rawFetch(path, init);
  }

  async function cachedFetch(path: string, init?: RequestInit): Promise<Response> {
    const hit = getCache.get(path);
    if (hit && Date.now() - hit.at < GET_CACHE_MS) return replay(hit);

    const pending = inFlightGets.get(path);
    if (pending) return (await pending).clone();

    const request = rawFetch(path, init).then(async (res) => {
      if (!isCacheableResponse(res)) return res;
      // 本文は 1 度だけ読み、以後は同じ文字列から作り直して配る。`clone()` を配ると
      // 読まれないままの流れが残る。
      const entry: CachedGet = {
        at: Date.now(),
        status: res.status,
        statusText: res.statusText,
        contentType: res.headers.get('content-type') ?? 'application/json',
        body: await res.text(),
      };
      getCache.set(path, entry);
      return replay(entry);
    });

    inFlightGets.set(path, request);
    try {
      // 待っていた側にも自分ぶんの本文を渡す（同じ Response を 2 人で読めない）。
      return (await request).clone();
    } finally {
      inFlightGets.delete(path);
    }
  }

  async function rawFetch(path: string, init?: RequestInit): Promise<Response> {
    const isFormData = init?.body instanceof FormData;
    const requestHeaders = isFormData
      ? (() => {
          const h: Record<string, string> = {};
          if (headers.Authorization) h.Authorization = headers.Authorization;
          return h;
        })()
      : { ...headers, ...init?.headers };

    const res = await fetch(path, { ...init, headers: requestHeaders });

    // Don't retry auth endpoints to avoid loops
    if (res.status !== 401 || path.startsWith('/api/v1/auth/')) return res;

    const newToken = await tryRefreshToken();
    if (!newToken) return res;

    headers.Authorization = `Bearer ${newToken}`;
    const retryHeaders = isFormData
      ? { Authorization: `Bearer ${newToken}` }
      : { ...headers, ...init?.headers };

    return fetch(path, { ...init, headers: retryHeaders });
  }

  return {
    baseUrl: '',
    headers,
    fetch: doFetch,
  };
}
