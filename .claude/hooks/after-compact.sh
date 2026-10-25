#!/usr/bin/env bash
# SessionStart (compact): after the context is compacted, restate where the
# session stands. Whatever this prints is added to Claude's context.

BRANCH="$(git branch --show-current 2>/dev/null)"
echo "The context was just compacted. Before continuing, re-read CLAUDE.md, the program's RULES.md and the phase prompt this session is implementing (docs/brand-system/ or docs/design/new-look/), and check the last gate you reported. Current branch: ${BRANCH:-unknown}."
exit 0
