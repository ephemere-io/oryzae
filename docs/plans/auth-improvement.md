# 認証改善プラン

## ステータス: Phase 1 未着手

最終更新: 2026-04-12

---

## 背景・課題

現状の認証は email/password のみで、以下の問題がある:

1. **毎回ログインが必要** — トークン期限切れ時の自動リフレッシュが不十分。`useAuth` 初期化時に `/auth/me` で検証するが、失敗時に refresh token を使った自動更新を行わず即座にトークンをクリアしている
2. **SSO/OAuth 未対応** — Google 等のソーシャルログインがなく、会員登録の障壁が高い
3. **パスワードリセット未実装** — パスワードを忘れたユーザーが復帰できない
4. **ログイン/サインアップ UI が最小限** — エラーメッセージが英語（Supabase 原文）、ソーシャルボタンなし

## 現状のアーキテクチャ

```
Browser (localStorage)
  ├── oryzae_access_token (JWT)
  └── oryzae_refresh_token
        │
        ▼
  useAuth() hook
    ├── 初期化: getAccessToken() → GET /auth/me → OK なら認証状態セット
    ├── login(): POST /auth/login → setTokens()
    ├── signup(): POST /auth/signup → setTokens()
    └── logout(): clearTokens()
        │
        ▼
  Hono Server (apps/server)
    ├── POST /api/v1/auth/signup   — supabase.auth.signUp()
    ├── POST /api/v1/auth/login    — supabase.auth.signInWithPassword()
    ├── POST /api/v1/auth/refresh  — supabase.auth.refreshSession()
    └── GET  /api/v1/auth/me       — supabase.auth.getUser()
```

**アーキテクチャ方針（変えない部分）:**
- クライアントから Supabase への直接アクセスは禁止（バックエンド API 経由のみ）
- JWT ベースのステートレス認証
- localStorage によるトークン保管

---

## Phase 1: セッション維持の改善

**目的:** 「毎回ログイン」問題を解消する

### 1.1 トークン自動リフレッシュ

**現状の問題:**
- `useAuth` 初期化時に `/auth/me` が 401 を返すと即座に `clearTokens()` する
- refresh token を使った自動更新を試みていない

**変更内容:**

`apps/client/src/features/auth/hooks/use-auth.ts`:
- `/auth/me` が 401 を返した場合、localStorage の refresh token を使って `/auth/refresh` を呼ぶ
- refresh 成功 → 新しいトークンで `/auth/me` をリトライ
- refresh 失敗 → `clearTokens()` してログイン画面へ

`apps/client/src/lib/auth.ts`:
- `getRefreshToken()` 関数を追加

**変更ファイル:**
- `apps/client/src/features/auth/hooks/use-auth.ts`
- `apps/client/src/lib/auth.ts`
- `test/features/auth/hooks/use-auth.test.ts`（テスト追加・更新）

### 1.2 API クライアントのインターセプタ

**目的:** API 呼び出し中にトークン期限切れが発生した場合もシームレスにリフレッシュ

**変更内容:**

`apps/client/src/lib/api.ts`:
- `fetch()` が 401 を返した場合、refresh token で `/auth/refresh` を呼び、リトライする
- 無限ループ防止のため、リトライは 1 回のみ

**変更ファイル:**
- `apps/client/src/lib/api.ts`

---

## Phase 2: Google OAuth

**目的:** Google アカウントでワンクリックログインできるようにする

### 2.1 Supabase 設定（手動）

- Supabase Dashboard → Authentication → Providers → Google を有効化
- Google Cloud Console で OAuth クライアント ID/シークレットを取得
- Supabase に callback URL を設定: `https://<supabase-project>.supabase.co/auth/v1/callback`

### 2.2 サーバー側: OAuth コールバック処理

**方針:**
- Supabase の OAuth フローは PKCE（Proof Key for Code Exchange）ベース
- クライアントがフローを開始し、Supabase が直接 Google と通信
- サーバーは「code → session 交換」エンドポイントを提供

**新規エンドポイント:**

`POST /api/v1/auth/oauth/google` — OAuth フロー開始 URL を返す
```typescript
// リクエスト: { redirectTo: string }
// レスポンス: { url: string } — Google 認証画面の URL
```

`POST /api/v1/auth/oauth/callback` — 認可コードからセッションを取得
```typescript
// リクエスト: { code: string }
// レスポンス: { user: {...}, session: { accessToken, refreshToken, expiresAt } }
```

**変更ファイル:**
- `apps/server/src/contexts/shared/presentation/routes/auth.ts` — 既存ファイルに追加
- `apps/server/src/app.ts` — ルーティングは既存の `/api/v1/auth` に含まれるため変更不要

### 2.3 クライアント側: OAuth ログインフロー

**新規コンポーネント:**

`apps/client/src/features/auth/components/google-login-button.tsx`
- 「Google でログイン」ボタン
- クリック → `POST /api/v1/auth/oauth/google` → 返された URL にリダイレクト
- Google 認証後、Supabase が callback URL にリダイレクト

**新規ページ:**

`apps/client/src/app/(auth)/callback/page.tsx`
- Supabase からの OAuth callback を処理するページ
- URL パラメータの `code` を取得 → `POST /api/v1/auth/oauth/callback` → トークン保存 → `/entries` にリダイレクト

**既存ファイル変更:**
- `apps/client/src/features/auth/components/login-form.tsx` — Google ボタンを追加
- `apps/client/src/features/auth/components/signup-form.tsx` — Google ボタンを追加
- `apps/client/src/features/auth/hooks/use-auth.ts` — `loginWithOAuthCode()` メソッド追加

**テスト:**
- `test/features/auth/hooks/use-auth.test.ts` — OAuth ログインのテスト追加
- `e2e/auth.spec.ts` — callback ページの基本テスト追加

### 2.4 環境変数

追加不要（Supabase Dashboard 側の設定のみ。サーバーの既存 `SUPABASE_URL` / `SUPABASE_ANON_KEY` で動作）

---

## Phase 3: パスワードリセット

**目的:** パスワードを忘れたユーザーが自力で復帰できるようにする

### 3.1 サーバー側

**新規エンドポイント:**

`POST /api/v1/auth/reset-password` — リセットメール送信
```typescript
// リクエスト: { email: string }
// レスポンス: { message: string }
// 内部: supabase.auth.resetPasswordForEmail(email, { redirectTo })
```

`POST /api/v1/auth/update-password` — 新パスワード設定
```typescript
// リクエスト: { accessToken: string, password: string }
// レスポンス: { message: string }
// 内部: supabase.auth.updateUser({ password }) （リセットトークンで認証済みセッションを使用）
```

**変更ファイル:**
- `apps/server/src/contexts/shared/presentation/routes/auth.ts`
- `packages/shared/src/schemas/credentials.ts` — パスワードリセット用スキーマ追加

### 3.2 クライアント側

**新規ページ・コンポーネント:**
- `apps/client/src/app/(auth)/forgot-password/page.tsx`
- `apps/client/src/features/auth/components/forgot-password-form.tsx` — メアド入力 → リセットメール送信
- `apps/client/src/app/(auth)/reset-password/page.tsx`
- `apps/client/src/features/auth/components/reset-password-form.tsx` — 新パスワード入力 → 更新

**既存ファイル変更:**
- `apps/client/src/features/auth/components/login-form.tsx` — 「パスワードを忘れた方」リンク追加

---

## Phase 4: ログイン/サインアップ UI 改善

**目的:** よりリッチで信頼感のあるログイン体験

### 4.1 エラーメッセージの日本語化

Supabase の英語エラーメッセージをユーザーフレンドリーな日本語に変換:

| Supabase エラー | 表示メッセージ |
|---|---|
| `Invalid login credentials` | メールアドレスまたはパスワードが正しくありません |
| `User already registered` | このメールアドレスは既に登録されています |
| `Password should be at least 6 characters` | パスワードは6文字以上で入力してください |
| `Email rate limit exceeded` | しばらく時間をおいてから再度お試しください |

**変更ファイル:**
- `apps/client/src/features/auth/utils/error-messages.ts`（新規）
- `apps/client/src/features/auth/components/login-form.tsx`
- `apps/client/src/features/auth/components/signup-form.tsx`

### 4.2 UI の仕上げ

- ログイン/サインアップフォーム間のセパレーター（「または」）
- Google ログインボタンを上部に配置
- フォームの loading 状態をスケルトン/スピナーで改善

---

## 実装順序

```
Phase 1 (セッション維持) → Phase 2 (Google OAuth) → Phase 3 (パスワードリセット) → Phase 4 (UI改善)
```

Phase 1 は既存コードの修正のみで完了でき、最も体験改善のインパクトが大きい。
Phase 2 は Supabase Dashboard での手動設定が前提条件。
Phase 3, 4 は Phase 2 と並行して進められる。

---

## 対象外（スコープ外）

- MFA（多要素認証）— 将来的に検討
- Apple / GitHub 等の追加 OAuth プロバイダー — Google で基盤を作った後に横展開
- メールアドレス確認フロー — Supabase デフォルト設定に依存（現状は自動確認）
- admin アプリの OAuth 対応 — admin は email/password のまま（セキュリティ上の理由）
