#!/usr/bin/env bash
# PostToolUse (Edit|Write): format the edited file with the repo's Prettier,
# so npm run verify's format check stays green. Never blocks.

INPUT="$(cat)"
FILE="$(printf '%s' "$INPUT" | node -e '
  let s = "";
  process.stdin.on("data", (d) => (s += d)).on("end", () => {
    try {
      process.stdout.write(JSON.parse(s).tool_input?.file_path ?? "");
    } catch {}
  });
')"
CWD="$(printf '%s' "$INPUT" | node -e '
  let s = "";
  process.stdin.on("data", (d) => (s += d)).on("end", () => {
    try {
      process.stdout.write(JSON.parse(s).cwd ?? "");
    } catch {}
  });
')"

case "$FILE" in
  *.ts | *.tsx | *.js | *.mjs | *.cjs | *.json | *.css | *.md)
    ROOT="$(git -C "${CWD:-$PWD}" rev-parse --show-toplevel 2>/dev/null)"
    [ -n "$ROOT" ] && [ -f "$FILE" ] && (cd "$ROOT" && npx --no-install prettier --write --ignore-unknown "$FILE" >/dev/null 2>&1)
    ;;
esac

exit 0
