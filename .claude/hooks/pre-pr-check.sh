#!/bin/bash
# PR 作成前の品質チェック
# 1. 全自動検証ツール実行
# 2. domain model/service のテストファイル存在チェック

set -e

cd "$(git rev-parse --show-toplevel)"

ERRORS=""

# === 自動検証ツール ===
echo "=== typecheck ===" >&2
if ! pnpm typecheck 2>&1 >/dev/null; then
  ERRORS="${ERRORS}typecheck failed\n"
fi

echo "=== lint ===" >&2
if ! pnpm lint 2>&1 >/dev/null; then
  ERRORS="${ERRORS}lint failed\n"
fi

echo "=== test ===" >&2
if ! pnpm test 2>&1 >/dev/null; then
  ERRORS="${ERRORS}test failed\n"
fi

echo "=== dep-cruise ===" >&2
if ! pnpm dep-cruise 2>&1 >/dev/null; then
  ERRORS="${ERRORS}dep-cruise failed\n"
fi

echo "=== knip ===" >&2
if ! pnpm knip 2>&1 >/dev/null; then
  ERRORS="${ERRORS}knip failed\n"
fi

# === テストファイル存在チェック ===
echo "=== test file existence ===" >&2

for src in $(find apps/server/src/contexts/*/domain/models -name '*.ts' ! -name '*.test.ts' ! -name '*.d.ts' 2>/dev/null); do
  test_file="${src%.ts}.test.ts"
  if [ ! -f "$test_file" ]; then
    ERRORS="${ERRORS}Missing test: ${test_file}\n"
  fi
done

for src in $(find apps/server/src/contexts/*/domain/services -name '*.ts' ! -name '*.test.ts' ! -name '*.d.ts' 2>/dev/null); do
  test_file="${src%.ts}.test.ts"
  if [ ! -f "$test_file" ]; then
    ERRORS="${ERRORS}Missing test: ${test_file}\n"
  fi
done

# === 結果出力 ===
if [ -n "$ERRORS" ]; then
  echo "{\"decision\":\"block\",\"reason\":\"PR 作成前チェック失敗:\\n${ERRORS}\"}"
  exit 0
fi

echo "{\"decision\":\"allow\"}"
