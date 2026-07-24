# 検証ハーネス 全コンポーネント移植 実行計画（A）

> このドキュメントは「全 client コンポーネントを検証ハーネスでカバーし、毎 PR で自動的に
> 検証が回り・可視化される構造」を作るための実行計画。SSoT の `verify-harness-rollout.md`
> を前提に、その「全面適用」フェーズを具体化する。

## 0. 着手トリガー（重要）

**Issue #363（device-first アーキテクチャ：`features/{shared,pc,sp}` 再編）が main にマージされてから着手する。**

理由: #363（PR #373/#381）は `features/<slice>/components/` を `features/pc/<slice>/components/`・
`features/shared/...` 等へ**丸ごと移設**する。先に移植すると `*.verify.tsx`・register バレル・
ゲートの対象パスが全部旧パス前提になり、衝突＋やり直しになる。#381 は現状 draft（スパイク）で
構造未確定。**新構造が固まってから Phase 0 を回す。**

## 1. スコープ（#363 後の構造で確定する）

- **対象**: `apps/client/src/features/{shared,pc,sp}/**/components/*.tsx`（現行 50 個＋#363 で増減）。
- **端末差**: pc / sp で DOM が異なる variant は**別ユニットとして verify**（shared は 1 つ）。端末で
  描画が変わるものこそハーネスで担保したい。
- **含む**: `components/ui/` のうち状態を持つ汎用部品（例 `locale-switcher`）。
- **除外**: `app/` ページ（合成＋データ取得の薄い層。孤立検証の単位でない）。`apps/admin` は別フェーズ。

## 2. なぜ「全部今すぐ」が単純でないか（実測）

現行 50 コンポーネントの実測（2026-06 時点）:

- **41 / 50 が i18n（`useTranslations`）を使用** → プロバイダ無しの孤立レンダリングでクラッシュ。
- **43 / 50 が i18n・ルーター・データ取得フック等の実行時コンテキストに依存**。
- 純粋な表示部品（LandingFaqItem のように依存ゼロ）は **約 7 個のみ**。

→ spec を 50 個書く話ではなく、**①プロバイダ土台**と、**②データ依存部品の扱い**が前提課題。

## 3. フェーズ

### Phase 0 — 棚卸し & 分類（#363 後の実ファイルで再カウント）
各部品を 3 分類:
- **(P) 純表示**: 依存ゼロ。そのまま verify 可。
- **(C) コンテキスト依存**: i18n / router / theme 等。Phase 1 のプロバイダ土台で解錠。
- **(D) データ/フック依存**: `useQuery`/`useMutation`/`supabase` 等。Phase 2 の方針が要る。

### Phase 1 — プロバイダ土台（(C) 群 ~34 個を解錠する鍵）
`@oryzae/verify`（または client の register/harness 層）に、ユニットを必要プロバイダで
ラップして孤立レンダリングできる仕組みを足す:
- `NextIntlClientProvider` ＋ messages（fixture から locale 指定可）。
- router stub（`next/navigation` のモック）、theme/context など必要分。
- 既存の `VerifiableUnit.render` を壊さず、オプトインのラッパーで包む設計にする。

### Phase 2 — データ依存（(D) 群）の方針
部品ごとに選ぶ:
- **(a) presentational / container 分離**: 表示専用を切り出して verify（推奨・本命部品）。
- **(b) フックのモック注入**: fixture でデータを差し込む。
- **(c) 当面対象外**: 瑣末なものは登録せず、ratchet で後追い（BLOCKED は作らない）。

### Phase 3 — バッチ移植（**並列ワークフロー**）
スライス単位（landing / auth / board / entries / fermentation / onboarding / questions × shared/pc/sp）。
各部品: `verifyAttrs` 付与 → `*.verify.tsx`（fixtures＝probe 必須 ＋ invariants）→ matrix 緑。
50+ 個は独立作業なので、**部品ごとに fan-out する並列ワークフロー**で一気に（生成→matrix検証→
隣接 verifier で確認）。register バレルへ 1 行ずつ追記。

### Phase 4 — ゲート ON（カバレッジを「これから 100%」に固定）
1. **新規コンポーネント必須化**: PR で追加された `features/**/components/*.tsx` に sibling
   `*.verify.tsx` が無ければ CI 失敗（新規ファイルのみ判定＝誤字/スタイル修正では発火しない）。
2. **カバレッジ・ラチェット**: 登録ユニット数の基準値をコミットし、減ったら CI 失敗。
3. **CLAUDE.md ルール**: 「client の feature コンポーネントを追加/変更したら、隣に `*.verify.tsx`
   （probe 込み）を足す/更新する」を標準ルール化（Claude セッションが既定で実行）。

### Phase 5 — 毎 PR 自動表示（GIF 手貼りの置き換え）
CI に **「Verify Report」ジョブ**（`if: always()` 非ブロッキングな"ビュー"）:
- jsdom で matrix を回し結果 JSON を出力 → `actions/github-script` で **sticky PR コメント**を投稿/更新
  （`<!-- verify-report -->` マーカーで find-and-update。spam しない）。
- 内容: ユニット×fixture の verdict テーブル、カバレッジ率、未カバーの変更部品 nudge。
- `permissions: pull-requests: write` は**このジョブだけ**に付与。
- 任意: replay `.webm` を Actions アーティファクトにアップ（インライン再生は GitHub の制約で不可＝DL リンク）。

> 注: **Phase 4-2/4-3 と Phase 5 は #363 非依存**（登録レジストリしか見ない）。必要なら #363 を待たず
> 先行投入も可能。Phase 0–3 は新構造確定が前提。

## 4. 実行手段

- Phase 3 は並列ワークフロー（fan-out: 部品ごとに spec 生成 → matrix 緑 → adversarial 確認）。
- Phase 1 / 2 / 4 / 5 は逐次。
- 「1 定義が複数利用者」を維持: CI matrix / `/verify` dashboard / `/verify/replay` / `window.__verify` /
  （新）PR レポート。

## 5. 完了の定義（DoD）

- 対象部品の verify カバレッジ 100%（または合意済みの除外リスト）。
- 全 matrix 緑（意図的 FAIL の `EXPECTED_FAIL` を除く）。
- ゲート 3 種（新規必須・ラチェット・CLAUDE.md ルール）稼働。
- 毎 PR の Verify Report コメント稼働。

## 6. リスク / 注意

- **(D) 群のリファクタは影響範囲が大きい** → スライス単位の小 PR で段階的に。
- **pc / sp の二重メンテ**（同一部品の 2 variant 分の fixture/invariant）。
- #363 が再度構造変更したら Phase 0 で scope を再確認。
- 端末別 variant のレンダリングは Phase 1 の土台で「端末コンテキスト」も切替可能にしておく。
