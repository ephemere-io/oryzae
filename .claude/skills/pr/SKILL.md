---
name: pr
description: "Create a pull request with quality checks. Runs typecheck, lint, test, knip, and dependency-cruiser before creating PR."
disable-model-invocation: true
allowed-tools: "Bash(git,gh,pnpm) Read Glob Grep"
---

# PR: 品質チェック → PR 作成

## 手順

1. **現在のブランチを確認**
   - main にいる場合はフィーチャーブランチを作成する
   - `--no-verify` は使わない

2. **品質チェックを全て実行**（1つでも失敗したら修正してから PR を作成する）
   ```bash
   pnpm typecheck          # 型チェック
   pnpm lint               # Biome lint
   pnpm test               # テスト
   pnpm knip               # デッドコード検出
   pnpm dep-cruise         # アーキテクチャ依存チェック（server DDD + client feature隔離）
   ```

3. **変更内容を確認**
   ```bash
   git diff main --stat
   git log main..HEAD --oneline
   ```

4. **PR を作成**
   - `gh pr create` を使用
   - タイトル: 70文字以内
   - 本文: Summary + Test plan

## 禁止事項

- main への直接 push
- `--no-verify` でのフック回避
- 品質チェック未通過での PR 作成
