# 管理画面 (Admin Dashboard) — 作業プラン

## ステータス: Phase 3 完了

最終更新: 2026-04-12

---

## 完了した作業（Phase 1 + 2 + 3）

### アーキテクチャ

- `apps/admin` — 独立した Next.js アプリ（port 3001）
- Feature-Sliced Architecture: `app/`, `features/`, `components/ui/`（shadcn）, `lib/`
- `apps/client` と同一のガードレール（dep-cruise, vitest, playwright, biome, knip）
- バックエンドは既存の `apps/server` を共有（catch-all API route 経由）

### バックエンド

- `adminAuthMiddleware` — `is_admin` チェック + service-role Supabase クライアント
  - ファイル: `apps/server/src/contexts/shared/presentation/middleware/admin-auth.ts`
- Admin API ルート（`/api/v1/admin/*`）:
  - `GET /api/v1/admin/dashboard/stats` — ユーザー数、エントリー数、発酵数（成功/失敗）
  - `GET /api/v1/admin/users` — ユーザー一覧 + per-user 利用統計
  - `GET /api/v1/admin/fermentations` — 全発酵一覧（ページネーション）
  - `GET /api/v1/admin/fermentations/costs` — generation_id 付き発酵のコスト照会
  - `GET /api/v1/admin/fermentations/costs/by-user` — ユーザー別コスト集計
  - `GET /api/v1/admin/fermentations/:id/cost` — 個別コスト照会
  - `GET /api/v1/admin/analytics/overview` — PV・セッション・滞在時間
  - `GET /api/v1/admin/analytics/pages` — ページ別アクセス
  - `GET /api/v1/admin/analytics/daily` — 日別推移

### コンテキスト分離（Phase 3 で実施）

admin ルートを適切な bounded context に配置:

| ルート | コンテキスト | 理由 |
|---|---|---|
| admin-auth middleware | shared | 横断的関心事 |
| admin-dashboard | shared | 複数コンテキストの集計ビュー |
| admin-users | user | ユーザードメイン |
| admin-fermentations | fermentation | 発酵ドメイン |
| admin-analytics | analytics | プロダクト利用行動 |

### Vercel AI Gateway

- `@ai-sdk/anthropic` → `gateway('anthropic/claude-sonnet-4-20250514')` に切り替え済み
- `providerMetadata.gateway.generationId` を `fermentation_results.generation_id` に保存
- コストは `gateway.getGenerationInfo()` でリアルタイム照会（DB キャッシュなし）
- DB マイグレーション: `00007_add_generation_id_to_fermentation_results.sql`

### PostHog

- `posthog-js` を `apps/client` に導入済み
- `PostHogProvider` で全ページビュー自動計測
- `useAuth` に `posthog.identify()` / `posthog.reset()` 追加
- PostHog API は analytics コンテキストの `PostHogGateway` 経由で admin に提供
- PostHog Project ID: 378500

### フロントエンド（apps/admin）

- shadcn/ui: Button, Card, Table, Badge, Avatar, Input, Label, Separator
- Lucide Icons でサイドバーにアイコン
- 6画面:
  - `/dashboard` — 統計カード（Users, Entries, Fermentations, Success Rate, Cost Tracked）
  - `/users` — ユーザー一覧（登録日、最終ログイン、エントリー数、問い数、発酵数）
  - `/fermentations` — 全発酵プロセス一覧（成功/失敗バッジ、Cost Tracking 有無）
  - `/costs` — ユーザー別コスト集計 + Gateway per-request コスト詳細
  - `/analytics` — PostHog 行動メトリクス（PV、セッション、滞在時間、ページ別、日別推移）

### E2E テスト

- Playwright で admin の E2E テストカバレッジ:
  - `e2e/auth.spec.ts` — ログイン/リダイレクト/ログアウト
  - `e2e/dashboard.spec.ts` — 統計表示・サイドバーナビゲーション
  - `e2e/fixtures/auth.ts` — admin ログインフィクスチャ

### デプロイ

- admin: https://oryzae-admin.vercel.app（Vercel 別プロジェクト）
- 環境変数: `AI_GATEWAY_API_KEY`, `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`
- **要設定**: `POSTHOG_PERSONAL_API_KEY`（Analytics ページで使用）

---

## 重要な技術的決定

| 決定 | 理由 |
|---|---|
| `apps/admin` を独立 Next.js アプリに | 「admin は機能ではなくアプリケーション」。Feature-Sliced Architecture を admin 内でも適用 |
| admin ルートを各コンテキストに分散 | user, analytics を新設。shared には横断的関心事のみ残す |
| Vercel AI Gateway | 価格の静的管理不要、リアルタイム per-request コスト、Vercel エコシステムとの親和性 |
| コストは DB キャッシュなし | 現規模では getGenerationInfo のリアルタイム照会で十分。スケール時に再検討 |
| PostHog | プロダクト分析、AI ネイティブ、無料枠で十分、autocapture |
| PostHogGateway | infrastructure に分離し、他の gateway パターンと一貫性を持たせる |
| shadcn/ui | admin 専用。client には導入しない（Oryzae の世界観と合わない） |

## 既知の注意点

- **Turbopack キャッシュ**: `apps/server/dist/` を更新しても、Next.js の `.next/` キャッシュが古いコードを使うことがある。`rm -rf apps/client/.next apps/admin/.next` で解消
- **`.env` の管理**: client と admin で同じ環境変数が必要。`.env.example` で文書化済み。Vercel 側は各プロジェクトに個別設定
- **admin ユーザー**: Supabase の `auth.users.raw_user_meta_data` に `{"is_admin": true}` を設定。現在 `yukiagatsuma@gmail.com`, `dominick.chen@gmail.com`, `test@oryzae.dev` が admin
