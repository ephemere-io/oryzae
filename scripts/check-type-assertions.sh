#!/bin/bash
# as キャストの検出スクリプト
# export { x as Y } 構文と biome-ignore コメント付きの行は除外
# CI で実行し、未許可の as キャストがあれば失敗する

set -euo pipefail

SEARCH_DIR="apps/client/src"
ERRORS=0

# as キャストを含む行を検索（export 構文と型パラメータを除外）
while IFS= read -r line; do
  file=$(echo "$line" | cut -d: -f1)
  lineno=$(echo "$line" | cut -d: -f2)
  content=$(echo "$line" | cut -d: -f3-)

  # export { x as Y } 構文を除外
  if echo "$content" | grep -qE '^\s*export\s+\{'; then
    continue
  fi

  # import type { X as Y } 構文を除外
  if echo "$content" | grep -qE '^\s*import\s'; then
    continue
  fi

  # 前の行が @type-assertion-allowed コメントなら許可
  prev_line=$(sed -n "$((lineno - 1))p" "$file" 2>/dev/null || echo "")
  if echo "$prev_line" | grep -q '@type-assertion-allowed'; then
    continue
  fi

  echo "ERROR: $file:$lineno: $content"
  ERRORS=$((ERRORS + 1))
done < <(grep -rn ' as [A-Z]' "$SEARCH_DIR" --include='*.ts' --include='*.tsx' 2>/dev/null || true)

if [ "$ERRORS" -gt 0 ]; then
  echo ""
  echo "Found $ERRORS type assertion(s)."
  echo "Fix: Replace 'as' casts with type guards."
  echo "Exception: If unavoidable (browser API), add '// @type-assertion-allowed: <reason>' on the line above."
  exit 1
fi

echo "No type assertions found."
