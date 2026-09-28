# Generate chat redesign: Claude Code handoff

This folder holds the build prompt for moving SocialPaint's Generate page to the chat design on the Figma page "Generate · Chat", plus reference PNGs of every frame and the component sheet in light and dark.

- `PROMPT.md` is the prompt Claude Code follows.
- `figma/` holds the 15 reference PNGs the prompt points to.

## How to run it

1. Copy this folder into the repo as `docs/design/generate-chat/`, so the prompt sits at `docs/design/generate-chat/PROMPT.md` and the images at `docs/design/generate-chat/figma/`. Commit it on a new branch.
2. Optional but useful: connect the Figma MCP server in Claude Code. The prompt uses it to pull screenshots and exact values from the live file when it is available, and falls back to the PNGs when it is not.
3. Start Claude Code in the repo, switch to plan mode, and send:

   > Read docs/design/generate-chat/PROMPT.md in full, then plan Phase 1.

   Review the plan, approve it, and let it build. The prompt tells it to run `npm run verify` and commit after each phase.
4. For the later phases, start a fresh session for each one so the whole prompt fits alongside the code:

   > Read docs/design/generate-chat/PROMPT.md in full. Phases 1 to N are done and committed. Do Phase N+1.

   Replace N with the last finished phase number before you send it.

## Before you merge

- Section 15 of the prompt lists the 16 decisions it makes where the Figma was silent or disagreed with the code. Claude Code will repeat them in the PR description. Confirm or change each one.
- Every string marked "proposed copy" is a draft for you to approve.
- The Terms of Service and Privacy Policy URLs are placeholders (`https://www.socialpaint.ai/terms` and `/privacy`) until you give the real ones.

## When you ship

- Apply migration `0038_generate_threads.sql` (`supabase db push`) no later than the client deploy. Until the table exists, chats still run but cannot be saved.
- Redeploy the Edge Function (`supabase functions deploy template-generate`). The new client does not break against the old function, but follow-ups lose their earlier context and chats get no titles or replies until the new one is live.
