// Usage: evaluate_script で実行。args 不要。
// localStorage から認証トークンを取得する。
() => {
  return localStorage.getItem('oryzae_access_token');
}
