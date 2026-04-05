#!/bin/bash
# hooks テストカバレッジ検証スクリプト
# apps/client/src/features/*/hooks/ の各ファイルに対応するテストが存在するか確認
# CI で実行し、テストの無い hooks があれば失敗する

set -euo pipefail

HOOKS_DIR="apps/client/src/features"
TESTS_DIR="apps/client/test/features"
ERRORS=0

for hook_file in $(find "$HOOKS_DIR" -path '*/hooks/*.ts' -o -path '*/hooks/*.tsx' 2>/dev/null); do
  # src/features/auth/hooks/use-auth.ts → auth, use-auth
  relative="${hook_file#$HOOKS_DIR/}"
  feature="${relative%%/*}"
  filename=$(basename "$hook_file")
  basename_no_ext="${filename%.*}"

  # 対応するテストファイルを探す
  test_file="$TESTS_DIR/$feature/hooks/$basename_no_ext.test.ts"
  test_file_tsx="$TESTS_DIR/$feature/hooks/$basename_no_ext.test.tsx"

  if [ ! -f "$test_file" ] && [ ! -f "$test_file_tsx" ]; then
    echo "MISSING TEST: $hook_file"
    echo "  Expected: $test_file"
    ERRORS=$((ERRORS + 1))
  fi
done

if [ "$ERRORS" -gt 0 ]; then
  echo ""
  echo "$ERRORS hook(s) have no corresponding test file."
  echo "Fix: Create test files in test/features/{feature}/hooks/{hook-name}.test.ts"
  exit 1
fi

echo "All hooks have corresponding test files."
