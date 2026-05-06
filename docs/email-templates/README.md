# Supabase メールテンプレート (SSoT)

Supabase Dashboard → **Authentication → Emails → Email Templates** に貼り付ける HTML の正本。
ロケール分岐は Supabase の Go template 構文で行い、`user_metadata.locale` (`ja` / `en`) を参照する。

## 設計判断: なぜ `{{ .ConfirmationURL }}` を使わないか

Microsoft (Outlook / Microsoft 365) は **差出人ドメインとリンク先ドメインが乖離している** メールを SmartScreen でサイレントに破棄する（迷惑フォルダにすら入らない）。

```
差出人:  noreply@mail.oryzae.ephemere.io   ← DKIM 通過
リンク:  https://<project>.supabase.co/... ← 別ドメイン → ✗ サイレント破棄
```

Gmail はこの組み合わせを許容するが、Outlook は許容しない。Custom Domain (Supabase Pro $35/月) を入れずにこれを解消するため、**`{{ .TokenHash }}` を使って自社ドメイン (`{{ .SiteURL }}/auth/confirm`) 経由で `verifyOtp` を呼ぶフロー** に統一している。

```
[ メール内リンク ] {{ .SiteURL }}/auth/confirm?token_hash=...&type=signup&next=/entries/new
                                ↑ 自社ドメイン
       ↓ クリック
[ /auth/confirm page ] → POST /api/v1/auth/verify-otp { tokenHash, type }
       ↓
[ サーバー ] supabase.auth.verifyOtp({ token_hash, type })
       ↓ session 返却
[ クライアント ] setTokens → router.push(next)
```

差出人もリンクも `oryzae.ephemere.io` に揃うので Outlook 通過。

## ロケール伝搬の仕組み

```
[ja/en どちらかで動いている Next.js (next-intl)]
   ↓ useLocale() の値を payload に乗せる
[POST /api/v1/auth/signup { ..., locale: "en" }]            → supabase.auth.signUp({ options: { data: { locale: "en" } } })
[POST /api/v1/auth/oauth/google { ..., locale: "en" }]      → redirectTo に ?locale=en を埋め込む
[POST /api/v1/auth/oauth/callback { code, locale: "en" }]   → admin.updateUserById で user_metadata.locale を保存
   ↓
[Supabase Auth がメール送信] → テンプレ内 `{{ .Data.locale }}` で言語分岐
```

`.Data.locale` が空の既存ユーザーは `else` ブランチ（日本語）にフォールバックする。

## テンプレ一覧

| テンプレート | type | next | ファイル |
|---|---|---|---|
| Confirm signup | `signup` | `/entries/new` | `confirm-signup.html` |
| Reset password | `recovery` | `/reset-password` | `reset-password.html` |
| Change email address | `email_change` | `/account` | `change-email.html` |
| Magic link | `magiclink` | `/entries/new` | `magic-link.html` |

### Subject (件名)

Subject 欄は HTML を含められないため、**両言語をスラッシュで併記**する：

| Template | Subject |
|---|---|
| Confirm signup | `Oryzae: メールアドレスの確認 / Confirm your email` |
| Reset password | `Oryzae: パスワード再設定 / Reset your password` |
| Change email | `Oryzae: メールアドレス変更の確認 / Confirm your new email` |
| Magic link | `Oryzae: ログインリンク / Sign-in link` |

> 件名側で言語分岐したい場合は将来 [Send email hook](https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook) を使うと完全制御可能。

## Supabase Dashboard 必須設定

### 1. URL Configuration

**Authentication → URL Configuration**:

- **Site URL**: `https://oryzae.ephemere.io` （`{{ .SiteURL }}` で展開される）
- **Redirect URLs** に以下を追加:
  - `https://oryzae.ephemere.io/auth/confirm`
  - `https://oryzae.ephemere.io/auth/confirm?**`（query 含む）
  - `https://oryzae.ephemere.io/reset-password`
  - `https://oryzae.ephemere.io/account`
  - `https://oryzae.ephemere.io/entries/new`
  - 既存の `/callback` 関連も保持（OAuth 用）

ローカル開発用に `http://localhost:3000/...` の同等パスも追加。

### 2. Email Templates

各テンプレートを Dashboard 上で書き換え:
- このディレクトリの `*.html` を **Message body** にコピペ
- 上記の **Subject** を貼付

## 運用ルール

- このディレクトリの HTML が **正本**。Dashboard 側の編集は禁止し、変更時は必ずこのファイルを更新 → コピペで反映する。
- 検証は `auth.signup.email_sent_*` の i18n キーと文言の方向性を揃える。
- ブランドカラー `#18181b` (zinc-900) は `apps/client` の primary に揃えてある。変更時は両方更新。
- `{{ .ConfirmationURL }}` は **使わない**（Outlook サイレント破棄のため）。常に `{{ .TokenHash }}` + `{{ .SiteURL }}/auth/confirm` の組み合わせを使う。
