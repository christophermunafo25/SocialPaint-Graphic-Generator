# Brand Templates chat: Claude Code handoff

This folder holds the build prompt for the template chat designed on the Figma page "Brand Templates · Chat" (file `94CuU70Sl6PvHv4sY9SMGE`), plus reference PNGs of every frame it builds and the component sheet, in light and dark.

- `PROMPT.md` is the prompt Claude Code follows.
- `figma/` holds the reference PNGs the prompt points to. `00-components.png` is the component sheet, and `figma/comp/` has each component set on its own.

## How to run it

1. Copy this folder into the repo as `docs/design/template-chat/`, so the prompt sits at `docs/design/template-chat/PROMPT.md` and the images at `docs/design/template-chat/figma/`. Commit it on a new branch.
2. Optional but useful: connect the Figma MCP server in Claude Code. The prompt names every node, so it can pull exact values and screenshots from the live file; it falls back to the PNGs when the server is not there.
3. Start Claude Code in the repo, switch to plan mode, and send:

   > Read docs/design/template-chat/PROMPT.md in full, then plan Phase 1.

   Review the plan, approve it, and let it build. The prompt tells it to run `npm run verify` and commit after each phase.
4. For each later phase, start a fresh session so the whole prompt fits alongside the code:

   > Read docs/design/template-chat/PROMPT.md in full. Phases 1 to N are done and committed. Do Phase N+1.

   Replace N with the last finished phase before you send it.

## Before you merge

- Section 17 of the prompt lists the 21 calls it makes where the Figma was silent or the code forced a choice. Claude Code repeats them in the PR description. Confirm or change each one.
- Section 3 records the ten decisions you made on 2026-09-28. The prompt treats them as settled.
- Every string marked "proposed copy" in section 15 is a draft for you to approve.

## When you ship

Ship in this order:

1. Apply migration `0040_template_chat.sql` (`supabase db push`). The functions and the app both read the new columns, so nothing else can go first.
2. Redeploy `template-generate`, `template-autobuild` and `brand-from-website`. All three now log token usage, and `template-generate` reads `is_optional` and takes the new request fields.
3. Deploy the app. An app ahead of the functions sends details, documents and questions to a function that ignores them.
4. Run `./supabase/verify/run.sh` against a real Postgres. The new tables are self-scoped or admin-only, and those checks are not in CI.
