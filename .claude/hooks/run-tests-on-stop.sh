#!/usr/bin/env bash
# Stop hook: run typecheck + unit tests. If anything fails, force Claude to keep working.
#
# - Reads stop_hook_active from stdin to break out of infinite loops
# - Emits {"decision":"block","reason":"..."} to stdout (exit 0) on failure
#   so Claude is told to fix the failures before stopping
# - Exits 0 silently on success

set -uo pipefail

INPUT=$(cat 2>/dev/null || true)
STOP_HOOK_ACTIVE=$(printf '%s' "$INPUT" | jq -r '.stop_hook_active // false' 2>/dev/null || echo "false")

# Already in a stop-hook iteration → let Claude actually stop, even if tests still fail.
# (Claude will have surfaced the failure in the previous turn; user can intervene.)
if [ "$STOP_HOOK_ACTIVE" = "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0

run_step() {
  local label="$1"
  shift
  local output
  output=$("$@" 2>&1)
  local status=$?
  if [ "$status" -ne 0 ]; then
    local trunc
    trunc=$(printf '%s' "$output" | tail -c 4000)
    jq -n --arg label "$label" --arg out "$trunc" \
      '{decision: "block", reason: ("Stop hook: \($label) failed. Fix it before stopping.\n\n```\n\($out)\n```")}'
    exit 0
  fi
}

run_step "pnpm typecheck" pnpm typecheck
run_step "pnpm test" pnpm test

exit 0
