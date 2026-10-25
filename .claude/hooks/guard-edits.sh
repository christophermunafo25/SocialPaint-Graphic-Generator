#!/usr/bin/env bash
# PreToolUse (Edit|Write): block edits that have to go through another path.
# Exit 2 blocks the tool call and shows the message to Claude.

INPUT="$(cat)"
read_field() {
  printf '%s' "$INPUT" | node -e '
    let s = "";
    process.stdin.on("data", (d) => (s += d)).on("end", () => {
      try {
        const j = JSON.parse(s);
        const v = process.argv[1].split(".").reduce((o, k) => (o == null ? o : o[k]), j);
        process.stdout.write(typeof v === "string" ? v : "");
      } catch {}
    });
  ' "$1"
}

FILE="$(read_field tool_input.file_path)"
CWD="$(read_field cwd)"
[ -z "$FILE" ] && exit 0

ROOT="$(git -C "${CWD:-$PWD}" rev-parse --show-toplevel 2>/dev/null)"
[ -z "$ROOT" ] && exit 0
REL="${FILE#"$ROOT"/}"

case "$REL" in
  supabase/migrations/*.sql)
    # A migration that has reached main may already be applied; fix it with a
    # new migration. One added on this branch stays editable until it merges.
    for ref in origin/main main; do
      if git -C "$ROOT" cat-file -e "$ref:$REL" 2>/dev/null; then
        echo "Blocked: $REL is already on main. Add a new migration with the next reserved number instead." >&2
        exit 2
      fi
    done
    ;;
  src/styles/tokens.css)
    echo "Blocked: src/styles/tokens.css is generated. Change design/tokens/master.tokens.json through the Figma export, then run npm run tokens." >&2
    exit 2
    ;;
  test/fidelity/fixtures/*/golden.png)
    echo "Blocked: goldens come from Figma or from fidelity.mjs bless. Use those commands, and only with CJ's approval." >&2
    exit 2
    ;;
esac

exit 0
