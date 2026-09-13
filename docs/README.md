# docs 索引

分類の規則は [`docs-policy.md`](docs-policy.md)。**ストックは毎回読む前提、フローはその作業をする人だけが読む。**

## ストック（構造と規約）

| 文書 | 内容 |
| --- | --- |
| `docs-policy.md` | この索引と、ストック / フローの分け方 |
| `backend-architecture-guide.md` | DDD レイヤー依存、ドメインモデル、エラー処理 |
| `backend-testing-guide.md` | バックエンドのテスト戦略、ガードレール |
| `client-architecture-guide.md` | Feature-Sliced（ドメイン × reach: shared / pc / sp）、インポートルール、端末出し分け |
| `client-testing-guide.md` | フロントエンドのテスト戦略 |
| `shared-package-guide.md` | `@oryzae/shared` の使用ルール |
| `security-guide.md` | 脅威モデル、認可モデル（RLS / service role）、自動セキュリティ監視 |
| `design-language.md` | 面の重さ・ホバー・選択・寸法・書体の共通語彙 |
| `i18n-guide.md` | 文言の置き場と書き方 |
| `glossary.md` | 画面に出る言葉の正（同じものを 2 つの語で呼ばない） |
| `infra-guide.md` | Vercel + Supabase デプロイ |
| `observability-guide.md` | 監視・可観測性の方針 |
| `verify-harness-rollout.md` | 検証ハーネスの書き方（`*.verify.tsx` の規約） |

## フロー（時点の判断・計画・作業指示）

| 文書 | 状態 | 内容 |
| --- | --- | --- |
| `work/2026-09-13-sp-polish.md` | 進行中 | SP 仕上げの作業指示（書斎 3D・エントリー画面・一覧） |
| `entry-screen-design.md` | 進行中 | エントリー画面（PC / SP / 一覧）の最終形と issue 対応表 |
| `entry-photo-guide.md` | 進行中 | 写真の取り込み（VLM 採用理由・モデル選定・保存先） |
| `editor-effects-persistence.md` | 進行中 | エディタの視覚エフェクトの永続化 |
| `entry-backend-guide.md` | 進行中 | Entry コンテキストの実装ガイド |
| `question-backend-guide.md` | 進行中 | Question コンテキストの実装ガイド |
| `auto-fix-loop-guide.md` | 進行中 | 自動バグ修正ループ（起動経路、自動マージの許可領域、予算） |
| `verify-harness-full-migration-plan.md` | 進行中 | 検証ハーネスの全面移行計画 |
| `oryzae-study/` | 進行中 | 書斎ホームの仕様一式と実装メモ（`60-implementation-notes.md` が最新） |
| `plans/sp-architecture-cleanup.md` | 完了（archive 待ち） | SP 導入で乱れたアーキテクチャの修正計画 |
| `plans/admin-dashboard.md` | 要確認 | 管理画面の計画 |
| `plans/auth-improvement.md` | 要確認 | 認証まわりの改善計画 |

`要確認` は状態の見出しがまだ無い文書。次に触る人が「進行中 / 完了 / 失効」を付け、完了・失効なら archive へ。

## archive

役目を終えた文書。読む必要は無い。`archive/` の中身は索引に載せない。
