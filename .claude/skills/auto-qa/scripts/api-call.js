// Usage: evaluate_script で実行。args に [method, path, bodyJson] を渡す。
// 例: evaluate_script({ function: <このファイルの内容>, args: ["POST", "/api/v1/entries", '{"content":"test","mediaUrls":[],"editorType":"plaintext","editorVersion":"1.0.0","extension":{}}'] })
//
// Hono バックエンド API を直接呼び出し、結果をJSONで返す。
// 認証トークンは localStorage から自動取得する。
async (method, path, bodyJson) => {
  const token = localStorage.getItem('oryzae_access_token');
  const baseUrl = '';
  const headers = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const options = { method, headers };
  if (bodyJson && method !== 'GET') {
    options.body = bodyJson;
  }
  const res = await fetch(`${baseUrl}${path}`, options);
  const data = await res.json();
  return { status: res.status, data };
}
