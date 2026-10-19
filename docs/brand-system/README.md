# Brand system: Claude Code handoff

This folder carries the brand-system program into the platform one phase at a time, the same way `docs/design/new-look/` carried the new look.

| Path                       | What it is                                                      |
| -------------------------- | --------------------------------------------------------------- |
| `PLAN.md`                  | The bar, the decisions, the phases, the tracks and their status |
| `RULES.md`                 | The rules every phase follows                                   |
| `strategy/BRAND-SYSTEM.md` | The strategy the plan implements                                |
| `PHASE-0.md`               | The prompt for Phase 0; later phases get theirs when they start |
| `CEILING.md`               | Written by Phase 0                                              |

The kit also adds files outside this folder:

| Path                                      | What it is                                                                                                                                          |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CLAUDE.md`                               | What every Claude Code session in this repo reads first                                                                                             |
| `.claude/agents/fidelity-checker.md`      | Runs the fidelity harness and reports regressions, read only                                                                                        |
| `.claude/agents/phase-reviewer.md`        | Reviews a finished phase against its prompt and the rules with a fresh context, read only                                                           |
| `.claude/skills/fidelity/`                | `/fidelity`: run the harness, add a fixture, read results                                                                                           |
| `.claude/skills/field-property/`          | `/field-property`: the end-to-end checklist for a new `TemplateField` property                                                                      |
| `.claude/skills/brand-kit-change/`        | `/brand-kit-change`: the checklist for any `BrandKit` or `brand_kits` change                                                                        |
| `.claude/settings.json`, `.claude/hooks/` | Hooks: block edits to committed migrations and to generated `tokens.css`, format each edited file, and restate the rules after a context compaction |
| `.worktreeinclude`                        | Copies `.env`, `.env.local` and private fixture fonts into new worktrees                                                                            |

## Getting it into the repo

1. From the repo root, start the Phase 0 branch and unzip the kit into it:

   ```bash
   git switch -c brand-system/phase-0
   unzip -n ~/Downloads/socialpaint-brand-system-kit.zip
   ```

   `-n` keeps any file you already have. If you keep a local `.claude/settings.json`, merge the kit's `hooks` block into it.

2. Commit the kit as the branch's first commit ("Add the brand-system handoff kit"). The `.claude/` files stay untracked until Phase 0's first step narrows `.gitignore`.
3. Add a Figma personal access token to `.env.local` as `FIGMA_TOKEN` (read access is enough). Only the golden fetch script uses it.
4. Install the three browser engines once: `npx playwright install chromium firefox webkit`.
5. Connect the Figma MCP server in Claude Code. The prompts name frames by file key and node id, and the sessions read exact values from the live files.
6. Run Phase 0 in this checkout. The kit isn't on `main` yet, so a new worktree wouldn't contain it. From Phase 1 on, each phase can run in its own worktree.

## Running a phase

1. Start Claude Code at the repo root. From Phase 1 on, give each phase a fresh worktree: `claude --worktree brand-<phase>`.
2. Switch to plan mode and send:

   > Read CLAUDE.md, docs/brand-system/PLAN.md, RULES.md and PHASE-<n>.md in full, then plan Phase <n>.

3. Review the plan and approve it. The session builds in steps, commits after each one with `npm run verify` green, and stops at every gate.
4. At the end it runs `phase-reviewer` (and `fidelity-checker` when rendering is involved), fixes what they flag, and opens a pull request into `main`.
5. CI, the fidelity workflow and the Vercel preview are the review. Merge when all three look right.
6. The next phase's prompt is written against the merged code, so ask for it after the merge.

Tracks that don't share files can run at the same time in separate worktrees (see "Tracks and sequencing" in `PLAN.md`).

## The fidelity harness

Install the three browser engines once per machine:

```bash
npx playwright install chromium firefox webkit
```

Then, from the repo root:

```bash
node scripts/fidelity/fidelity.mjs run                   # every fixture on chromium, firefox and webkit
node scripts/fidelity/fidelity.mjs run --only gtm-composer
node scripts/fidelity/fidelity.mjs run --engines webkit
node scripts/fidelity/goldens.mjs fetch <fixture>        # figma fixtures, needs FIGMA_TOKEN
node scripts/fidelity/fidelity.mjs bless <fixture>       # starter fixtures: today's Chromium render becomes the golden
node scripts/fidelity/fidelity.mjs baseline <fixture> --approved   # only once CJ approves the numbers
```

The runner starts its own Vite dev server on the local backend (port 4327, or `--port`; `--base` uses one already running). Results land in `test/fidelity/out/`: each render, its heatmap (changed pixels in magenta), and `report.json`. It exits non-zero when a render errors, changes size, or gets worse than its baseline by more than the fixture's tolerance (default 0.25 points). A fixture with a missing private font or no golden is reported as skipped, never as passed. `bless` refuses to replace an existing golden and `baseline` refuses to run without `--approved`.

Starter fixtures render with Google Fonts, so a run needs network access. `test/fidelity/README.md` describes the fixture format.
