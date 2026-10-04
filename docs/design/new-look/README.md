# New look: Claude Code handoff

This folder carries the Figma file "Master UX-UI" (`mEJRslarcQDkgPeY6AObi5`) into the platform, one phase at a time.

- `PLAN.md`: decisions, scope, the phases and the screen map.
- `RULES.md`: the rules every phase follows (tokens, corners, elevation, type, interaction states, copy, multi-tenant).
- `BRIDGE.md`: how old token names map to the Figma tokens until Phase 9.
- `PHASE-1.md`: the Claude Code prompt for Phase 1. Later phases get their own prompt in this folder when they start.

The kit also adds files outside this folder:

| Path | What it is |
|---|---|
| `design/tokens/master.tokens.json` | The export of the Figma file: 155 variables, 46 text styles, 7 effect styles |
| `design/tokens/figma-export/` | The Figma development plugin that writes that JSON |
| `scripts/build-tokens.mjs` | Generates `src/styles/tokens.css` from the JSON, and checks it (`--check`) |
| `scripts/new-look/shots.mjs`, `scripts/new-look/fixtures/` | The screenshot loop and the sample workspace it runs on |
| `src/styles/legacy-bridge.css` | Old token names pointed at Figma tokens |

## Getting it into the repo

1. Unzip the kit at the root of the repo. Every path in it is already where it belongs.
2. Start a branch from `main` for Phase 1 and commit the kit as its first commit ("Add the new look handoff kit").

## Running a phase

1. Optional but useful from Phase 2 on: connect the Figma MCP server in Claude Code. The prompts name every frame and component by node id, so it can pull exact values and screenshots from the live file.
2. Start Claude Code at the repo root on the phase's branch, switch to plan mode, and send:

   > Read docs/design/new-look/PLAN.md, RULES.md, BRIDGE.md and PHASE-1.md in full, then plan Phase 1.

3. Review the plan, approve it, and let it build. It commits after each step with `npm run verify` green and stops at the gate.
4. It opens a pull request into `main`. CI and the Vercel preview are the review. Merge when both look right.
5. For the next phase, start a fresh session on a new branch from the updated `main` and name that phase's prompt instead.

## Updating tokens later

The Figma file stays the source of truth. To change a color, radius, spacing value, text style or shadow:

1. Change the variable or style in the Figma file.
2. In Figma, run the export plugin. The first time: Plugins › Development › Import plugin from manifest…, and pick `design/tokens/figma-export/manifest.json`. After that it is under Plugins › Development › "SocialPaint token export".
3. Save the file it offers over `design/tokens/master.tokens.json`.
4. Run `npm run tokens` and commit both files.

`npm run tokens:check` (part of `npm run verify` and CI from Phase 1 on) fails when `tokens.css` and the JSON disagree, or when a stylesheet redeclares a token. A Claude session with the Figma connector can also run the plugin's `exportTokens()` through `use_figma`; that tool truncates long results, so it returns one section at a time.

## The screenshot loop

```bash
npx playwright install chromium            # once
npm run shots -- capture .shots/before     # 23 routes, onboarding and /dev/ui, both themes, 1440 wide
npm run shots -- compare .shots/before .shots/after .shots/diff
npm run shots -- capture .shots/ui --only dev-ui --width 3172
npm run shots -- compare-image docs/design/new-look/reference/interaction-states.png .shots/ui/dev-ui-light.png .shots/ui-diff/states.png
npm run shots -- props .shots/props.json   # every custom property at the root, both themes
npm run shots -- props-compare .shots/a.json .shots/b.json
```

`capture` and `props` start their own Vite server on port 4317 with the Supabase variables blanked, so they always run on the local backend, and seed it with a sample workspace ("Acme Studios", six starter templates). `--only brand-templates,settings-workspace` limits a capture, and `--base http://127.0.0.1:5173` points it at a server that is already running. `compare` writes a heatmap per changed screen: magenta marks the pixels that moved. The fill page is captured at `/templates/<id>`. Generate and the template chat need Supabase and the model key, so on the local backend Generate shows its setup notice and the chat is not captured. The fixture carries three Generate threads (a result in two sizes, a follow-up, a question), so History and two threads are captured (`generate-thread`, `generate-thread-question`); the template chat's states wait for Phase 4's stand-in provider.

`dev-ui` is the primitives sheet (development builds only). Its Interaction states table is 3172 wide like the frame, so capture it with `--width 3172` and compare it with the Figma export using `compare-image`, which writes the same heatmap as `compare` for any two images over their overlap. Expect text antialiasing, Figma's corner smoothing and the artwork stand-ins in the heatmap; anything else is a difference to fix.

If a change to the local backend's storage format breaks the seed, refresh it: run the app on the local backend, finish onboarding, then copy the `brand-portal-dev-db` and `brand-portal-company` entries from localStorage into the matching fields of `scripts/new-look/fixtures/dev-workspace.json`.
