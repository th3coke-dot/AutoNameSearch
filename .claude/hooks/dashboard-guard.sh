#!/usr/bin/env bash
# Blocks dashboard-builder from touching anything outside .dashboard/ and its own memory.
input=$(cat)
if command -v jq >/dev/null 2>&1; then
  p=$(printf '%s' "$input" | jq -r '.tool_input.file_path // .tool_input.path // empty')
else
  p=$(printf '%s' "$input" | python3 -c 'import sys,json;t=json.load(sys.stdin).get("tool_input",{});print(t.get("file_path") or t.get("path") or "")')
fi
[ -z "$p" ] && p="$CLAUDE_PROJECT_DIR"
case "$p" in /*) ;; ~*) p="$HOME${p#\~}" ;; *) p="$CLAUDE_PROJECT_DIR/$p" ;; esac
case "$p" in *..*) echo "dashboard-builder: '..' not allowed in paths ($p)" >&2; exit 2 ;; esac
case "$p" in
  "$CLAUDE_PROJECT_DIR/.dashboard"|"$CLAUDE_PROJECT_DIR/.dashboard/"*) exit 0 ;;
  "$HOME/.claude/agent-memory/dashboard-builder"|"$HOME/.claude/agent-memory/dashboard-builder/"*) exit 0 ;;
esac
echo "dashboard-builder may only use .dashboard/ and its memory (blocked: $p)" >&2
exit 2
