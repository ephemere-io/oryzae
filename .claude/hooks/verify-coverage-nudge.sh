#!/usr/bin/env bash
# PostToolUse hook: クライアントの feature コンポーネントを Write/Edit したのに、
# 隣に *.verify.tsx が無ければ Claude に「検証ハーネスを足して」と気づかせる。
#
# - 非ブロッキング（exit 0）。additionalContext で Claude の文脈に注意を注入するだけ。
# - 対象は apps/client/src/features/**/components/*.tsx（.verify/.test は除外）。
#   #363 後に features/{shared,pc,sp}/.../components/ になっても ** で引き続きマッチする。
# - 純表示で状態を持たない部品には verify 不要なので、あくまで「気づき」レベル。

set -uo pipefail

INPUT=$(cat 2>/dev/null || true)
FILE=$(printf '%s' "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null || true)
[ -z "$FILE" ] && exit 0

# クライアントの feature コンポーネントだけを対象に。
case "$FILE" in
  */apps/client/src/features/*/components/*.tsx) : ;;
  *) exit 0 ;;
esac
# verify/test ファイル自身は対象外。
case "$FILE" in
  *.verify.tsx | *.test.tsx) exit 0 ;;
esac

SIBLING="${FILE%.tsx}.verify.tsx"
[ -f "$SIBLING" ] && exit 0

NAME=$(basename "$FILE" .tsx)
jq -n --arg n "$NAME" '{
  hookSpecificOutput: {
    hookEventName: "PostToolUse",
    additionalContext: ("⚠ 検証ハーネス: `\($n).tsx` に対応する `\($n).verify.tsx` がありません。状態や見た目を持つコンポーネントなら、コンポーネントに data-verify-* 契約（verifyAttrs）を付け、隣に `\($n).verify.tsx`（fixtures に probe を1つ含む + invariants）を追加して register に登録してください。手順は docs/verify-harness-rollout.md §3。純粋に表示するだけで状態を持たない部品なら不要です。")
  }
}'
exit 0
