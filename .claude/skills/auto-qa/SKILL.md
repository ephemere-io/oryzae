---
name: auto-qa
argument-hint: "[テストしたい内容 or PR URL]"
allowed-tools: mcp__chrome-devtools__*, Read, Grep, Glob, Bash(git diff:*), Bash(git log:*), Bash(gh pr:*)
description: >
  Automated QA on localhost using Chrome DevTools MCP. Navigate the app, fill forms,
  and verify UI state against expected values. Use this skill whenever the user asks to test a PR,
  verify a feature, check for regressions, run QA, run E2E tests, confirm UI behavior, or validate
  that a page displays correctly. Also use when the user shares a PR URL and asks to check its test cases.
---

# Auto QA Skill

localhost:3001（フロントエンド）+ localhost:3000（バックエンド）に対し、Chrome DevTools MCP で自動QAを実行する。
自然言語の指示・PR URL・明示的テストケースのいずれからでも実行可能。

## このスキルの構造

| ディレクトリ | 役割 | いつ使うか |
|---|---|---|
| `references/` | ドメイン知識・UI パターンの詳細。必要なものだけ Read する | Phase 1 のテストケース導出時 |
| `scripts/` | `evaluate_script` でブラウザ内実行する JS ヘルパー | Phase 2 の認証、Phase 3 の API 操作時 |
| `examples/` | 過去の実行例。テストケース導出の粒度や結果報告の書き方の参考 | Phase 1 で導出精度を上げたいとき |
| `feedback.log` | 実行サマリーの蓄積ログ。Phase 5 で自動追記される | スキル改善の傾向分析時 |

## Phase 1: テストケースの導出

**ユーザーの指示: $ARGUMENTS**

あらゆる入力からテストケースを自動導出する。

### 入力パターン別の処理

**A. 自然言語の指示**（例: 「エントリの作成・編集フローを確認して」）

1. [references/domain-rules.md](references/domain-rules.md) を読み、指示に該当するソースコードの場所を特定
2. 該当するドメインモデル層のコード（`apps/server/src/contexts/`）やフロントエンドのコード（`apps/client/src/features/`）を `Read` / `Grep` で動的に読み、実際のバリデーションロジック・UI構造を把握
3. 把握したルールから以下を網羅的に導出:
   - **正常系**: ルール範囲内で操作が成功する
   - **境界値**: 制限値ちょうど（成功）/ 制限値+1（エラー）
   - **異常系**: 正しいエラーメッセージが表示される
   - **UI表示**: 関連画面の表示が期待通り
4. 各テストケースに戦略（A/B/C）を割り当て

**B. PR URL**（例: `https://github.com/ephemere-io/oryzae/pull/1234`）

1. `gh pr diff <番号> -R ephemere-io/oryzae` で差分を取得
2. 変更ファイル・ロジックを分析し、影響を受けるビジネスルール・UI を特定
3. [references/domain-rules.md](references/domain-rules.md) を参照し、A と同様にテストケースを導出
4. PR にテストケースのチェックボックスがあれば、それも取り込む

**C. 現在のブランチの差分**

!`git diff main...HEAD --stat 2>/dev/null || echo "no diff"`

差分がある場合は B と同様に分析。

**D. 明示的テストケース** — ユーザーが具体的に提示した場合はそのまま使用。

### 導出結果の確認

テストケースをテーブルで提示し、**ユーザーの確認を得てから** Phase 2 に進む。

| # | テストケース | 戦略 | 前提条件 | 期待結果 |
|---|------------|------|---------|---------|
| 1 | ... | A/B/C | ... | ... |

## Phase 2: 認証

### ログイン

1. `navigate_page` → `http://localhost:3001/login`
2. テストアカウントのメール・パスワードをユーザーに確認し、`fill` + `click` でログイン
3. `/entries` への遷移を確認

認証トークンは localStorage に保持されるため、一度ログインすればセッションが有効な限り再認証不要。

### セッション切れ

`/login` にリダイレクトされた場合は再ログイン。

## Phase 3: テスト実行

### Strategy A: スナップショット比較（デグレテスト）
変更前後のUI表示を比較してリグレッション確認。
→ 詳細: [references/strategy-snapshot-comparison.md](references/strategy-snapshot-comparison.md)

### Strategy B: ユーザー操作テスト
ページ遷移・クリック・フォーム入力で UI 検証。
→ 詳細: [references/strategy-user-operation.md](references/strategy-user-operation.md)
→ UI パターン: [references/ui-patterns.md](references/ui-patterns.md)

### Strategy C: API バリデーションテスト
`evaluate_script` で API を直接呼び出して検証。
→ 詳細: [references/strategy-api-validation.md](references/strategy-api-validation.md)

## Phase 4: 結果報告

| # | テストケース | 戦略 | 期待値 | 結果 | 証跡 |
|---|------------|------|--------|------|------|
| 1 | ... | A/B/C | ... | PASS/FAIL/BLOCKED | スクショ/レスポンス |

- **PASS**: 期待値と一致
- **FAIL**: 不一致（差異の詳細を記載）
- **BLOCKED**: 前提条件不足で到達不可（手動テストを推奨）

PR にチェックボックスがあれば `gh pr edit -R ephemere-io/oryzae` で結果を反映。

## Phase 5: 振り返りとスキル改善

**テスト完了後、必ずこの Phase を実行する。** これにより `/auto-qa` は使うたびに賢くなる。

### 1. 今回の実行を examples/ に保存

今回のテスト実行が以下のいずれかに該当する場合、`examples/` に新しいファイルとして保存する:
- 過去の examples/ にない種類のテスト
- 既存の example にない戦略の組み合わせ
- 特に効率的だった実行パターン

ファイル名: `examples/{テスト対象の短い英語名}.md`
フォーマットは既存の examples/ を参考にする。既存 example と同種のテストだった場合はスキップ。

### 2. トラブルシューティングの更新

今回の実行で新しいエラーや回避策を発見した場合、下のトラブルシューティングセクションに追記する。

### 3. references/ の修正

戦略の手順に不足や誤りがあった場合、該当する reference ファイルを修正する。

### 4. フィードバックログ

`feedback.log` に今回の実行サマリーを1行追記する:

```
YYYY-MM-DD | テスト対象 | 戦略 | 結果(PASS/FAIL/BLOCKED数) | 発見事項（あれば）
```

## トラブルシューティング

- **`take_snapshot` が空**: `wait_for` でテキスト出現を待つ / `take_screenshot` で確認
- **"Element with uid X no longer exists"**: 再度 `take_snapshot` で最新uid取得
- **`navigate_page` タイムアウト**: `take_snapshot` で確認（読み込み済みの場合あり）
- **セッション切れ**: Phase 2 の認証を再実行
- **localhost 未起動**: `pnpm --filter @oryzae/server dev` と `pnpm --filter @oryzae/client dev` を起動
