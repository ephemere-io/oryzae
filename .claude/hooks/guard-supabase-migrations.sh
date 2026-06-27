#!/usr/bin/env bash
# PreToolUse guard: Supabase MCP で「migration ファイルが無いまま DB スキーマを変更する」のをブロックする。
#
# ルール (ユーザー指定):
#   - mcp__supabase__apply_migration は、supabase/migrations/ に対応する SQL ファイルが
#     存在する場合のみ許可（ファイル無しの本番 migration 実行を禁止）。
#   - mcp__supabase__execute_sql に DDL (CREATE/ALTER/DROP/TRUNCATE 等) が含まれる場合は
#     ブロックし、migration ファイル + apply_migration を使うよう促す（execute_sql 経由の
#     スキーマ変更で apply_migration ガードを回避させない）。SELECT 等の読取りは許可。
#
# 入力: stdin に hook JSON (tool_name, tool_input, cwd)。ブロック時は exit 2 + stderr。
set -uo pipefail

input="$(cat)"

jqget() { printf '%s' "$input" | python3 -c "import sys,json
try: d=json.load(sys.stdin)
except Exception: d={}
cur=d
for k in '$1'.split('.'):
    cur=cur.get(k, {}) if isinstance(cur, dict) else {}
print(cur if isinstance(cur, str) else '')" 2>/dev/null || true; }

tool_name="$(jqget tool_name)"

# プロジェクトルート（worktree でも正しく解決）
root="${CLAUDE_PROJECT_DIR:-}"
[ -z "$root" ] && root="$(jqget cwd)"
[ -z "$root" ] && root="$(pwd)"
mig_dir="$root/supabase/migrations"

if [ "$tool_name" = "mcp__supabase__apply_migration" ]; then
  name="$(jqget tool_input.name)"
  if [ -z "$name" ]; then
    echo "ブロック: apply_migration に name がありません。supabase/migrations/ にファイルを作ってから適用してください。" >&2
    exit 2
  fi
  if ! ls "$mig_dir"/*"$name"*.sql >/dev/null 2>&1; then
    echo "ブロック: migration '$name' に対応する SQL ファイルが見つかりません ($mig_dir)。" >&2
    echo "ルール: 先に supabase/migrations/NNNNN_${name}.sql を作成・コミットしてから apply_migration してください（MCP だけで本番 DDL を当てない）。" >&2
    exit 2
  fi

elif [ "$tool_name" = "mcp__supabase__execute_sql" ]; then
  query="$(jqget tool_input.query)"
  if printf '%s' "$query" | grep -iqE '(create([[:space:]]+or[[:space:]]+replace)?|alter|drop)[[:space:]]+(table|index|type|schema|view|materialized|function|trigger|policy|extension|sequence)|truncate[[:space:]]'; then
    echo "ブロック: execute_sql に DDL (CREATE/ALTER/DROP/TRUNCATE 等) が含まれています。" >&2
    echo "ルール: スキーマ変更は supabase/migrations/ に SQL ファイルを作成し apply_migration で適用してください（execute_sql で直接 DDL を当てない）。" >&2
    exit 2
  fi
fi

exit 0
