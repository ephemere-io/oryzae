/**
 * テスト用の `Response` を作る。
 *
 * 以前は `{ ok, json } as Response` という最小スタブを各テストが自前で持っていたが、
 * これは `as` キャストであり、本物の `Response` と挙動がずれる（`ok` が status と
 * 連動しない、`text()` や `headers` が無い、二重読み取りが検出されない等）。
 * jsdom / undici の実装が使えるので、本物を組み立てる。
 */
export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * 旧 `mockResponse(ok, body)` と同じ呼び口。`ok` は status から導出されるので、
 * 失敗側は 400 を使う（従来のスタブと同じ値）。
 */
export function mockResponse(ok: boolean, body: unknown): Response {
  return jsonResponse(body, ok ? 200 : 400);
}

/** JSON にならない body（HTML やプレーンテキスト）を返す場合。 */
export function textResponse(body: string, status = 200): Response {
  return new Response(body, { status, headers: { 'Content-Type': 'text/plain' } });
}
