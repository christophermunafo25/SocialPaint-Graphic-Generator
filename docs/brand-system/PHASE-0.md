# Brand system, Phase 0: the ruler

You are working in the SocialPaint repo. This phase builds the measuring stick every later brand-system phase is judged by, and measures where the renderer and importer stand today. It changes no product behavior.

Read these in full before planning: `CLAUDE.md`, `docs/brand-system/PLAN.md`, `docs/brand-system/RULES.md`, the sections "The bar" and "The ceiling today" in `docs/brand-system/strategy/BRAND-SYSTEM.md`, and this prompt. Then plan in plan mode and wait for approval.

## Why this phase exists

SocialPaint's AI has to produce work the brand team would sign, including layered work with depth. The renderer is the ceiling: whatever it can't draw, nothing upstream can make. Before the renderer changes, two things have to exist. One is a harness that renders real fixtures through the real export path in Chromium, Firefox and WebKit and compares them with Figma. The other is a precise, measured account of what today's schema can and can't express for two real designs.

Needs decision D11 (version the shared Claude Code config). If it is still open in `PLAN.md`, ask before Step 1.

## Read before writing

| File                                                                                                                   | Why                                                                                                                                                                                                                                         |
| ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/new-look/shots.mjs`                                                                                           | The existing Playwright loop: `withServer` (a Vite dev server on the local backend with the Supabase env blanked), localStorage seeding, and `compare` (per-channel threshold 6, magenta heatmap). Reuse its approach without modifying it. |
| `scripts/new-look/fixtures/dev-workspace.json`                                                                         | The sample workspace (Acme Studios) and its brand kit, which the starter fixtures use.                                                                                                                                                      |
| `src/app/App.tsx` (the `DevUiPage` lazy import and its route branch) and `src/app/router.tsx` (`devUi`, `case "dev"`)  | The dev-only route pattern: a lazy import behind `import.meta.env.DEV`, so production builds drop the page and its chunk.                                                                                                                   |
| `src/app/components/SchemaRenderer.tsx`                                                                                | The props (`schema`, `values`, `brandKit`, `instrument`, `variantId`, `emptyFields`) and `SchemaRendererHandle.renderBlob()`.                                                                                                               |
| `src/lib/render/exportPng.ts`                                                                                          | `renderSchemaBlob`: image readiness, font loading and embedding, then html-to-image.                                                                                                                                                        |
| `src/lib/render/fonts.ts`                                                                                              | `registerCustomFont(asset)` and `loadBrandFonts(kit, fontAssets)`, for fixture fonts.                                                                                                                                                       |
| `src/lib/templates/starters/` (`blueprints.ts`, `materialize.ts`, `seed.ts`)                                           | How a starter becomes a template with Light and Dark variants for a given kit.                                                                                                                                                              |
| `src/lib/types.ts`                                                                                                     | `TemplateSchema`, `TemplateField`, `BrandKit`, `BrandAsset`, `TemplateVariant`.                                                                                                                                                             |
| `supabase/functions/_shared/figmaLayers.ts`, `supabase/functions/_shared/extract.ts`, `src/lib/figma/composeLayers.ts` | What the importer keeps as fields, what it bakes into the background, and the warnings it raises. Read only.                                                                                                                                |
| `.github/workflows/ci.yml`, `docs/CI.md`                                                                               | CI conventions for the new workflow.                                                                                                                                                                                                        |
| `.gitignore`, `.prettierignore`                                                                                        | `.gitignore` ignores all of `.claude/` today; `.prettierignore` skips `docs`.                                                                                                                                                               |

## Scope

In: kit wiring, a dev-only render route, the fixture format, the golden fetch script, the runner, the first fixtures, a fidelity CI workflow, and the ceiling report.

Out: every change to rendering, export, import, templates, Brand Studio, Generate, schemas and migrations.

## What not to touch

- `src/app/components/SchemaRenderer.tsx`, `src/lib/render/**`, `src/lib/types.ts`, `src/lib/figma/**` and `supabase/**`: read only.
- `scripts/new-look/**`: copy its approach into the new scripts and leave the screenshot loop as it is.
- Any production route, store or stylesheet. The new route exists only in dev builds.
- `package.json` dependencies. Playwright is already a devDependency, so add nothing; if a step seems to need a package, stop and report.

## Steps

Commit after each step with `npm run verify` green.

### Step 1: Kit wiring

- The kit added `CLAUDE.md`, `.worktreeinclude`, `.claude/settings.json`, `.claude/hooks/*.sh`, `.claude/agents/*.md`, `.claude/skills/*/SKILL.md` and `docs/brand-system/**`. Because `.gitignore` ignores all of `.claude/`, replace that one line with `.claude/settings.local.json` and `.claude/worktrees/`, keeping every other line, so the shared config is versioned and local state stays out.
- Add `test/fidelity/out/` and `test/fidelity/fonts-private/` to `.gitignore`.
- Run `chmod +x .claude/hooks/*.sh`, then prove each hook by piping a sample payload (`{"cwd": "<repo root>", "tool_input": {"file_path": "<path>"}}`) into it:
  - `guard-edits.sh` with a committed migration (expect exit 2 and its message), with a new migration file name (exit 0), and with `src/styles/tokens.css` (exit 2);
  - `format-edited.sh` on a scratch `.ts` file, which it formats, then delete the scratch file.
- `npm run verify` must pass with the kit files in place (prettier checks `CLAUDE.md` and the `.claude` markdown and JSON once they are no longer ignored).
- **Gate 1:** report the hook results, then continue.

### Step 2: The dev render route

- Add `/dev/render/:fixture` following the `devUi` pattern exactly: the router's `case "dev"` branch, a lazy page in `App.tsx` behind `import.meta.env.DEV`, and the page under `src/app/dev/`.
- The page loads the fixture by name through `import.meta.glob("/test/fidelity/fixtures/*/fixture.json")`, so production builds include none of them. It registers the fixture's fonts with `registerCustomFont`, then mounts `SchemaRenderer` with `instrument={false}`, the fixture's `values`, brand kit, `variantId` and `emptyFields` (default `"placeholder"`), inside a container at least the canvas size so the scale is 1, on a plain body with no app chrome.
- Starter fixtures are built in the page. `starter-<blueprintKey>` materializes that blueprint against the brand kit in `scripts/new-look/fixtures/dev-workspace.json` through the same code path seeding uses, and `?variant=dark` selects the Dark variant.
- The page sets `window.__spFidelity = { ready, render }`. `ready` resolves when fonts and images have loaded, and `render()` calls the handle's `renderBlob()` and returns the PNG as base64.
- Prove the production build excludes all of it: run `npm run build` and confirm that no fixture name and no `__spFidelity` string appears anywhere in `dist/`.

### Step 3: Fixture format and goldens

- `test/fidelity/fixtures/<name>/fixture.json` holds `{ name, kind: "figma" | "starter", source?: { fileKey, nodeId }, schema?, values?, brandKit?, fonts?: [{ family, file, weight, style }], variantId?, emptyFields?, unsupported?: string[], baseline?: { chromium?, firefox?, webkit? }, tolerance? }`. Images and fonts a fixture uses sit beside it and are referenced by root-relative URLs, which Vite serves in dev.
- Commit a font file only when its license allows redistribution. Otherwise it goes in the gitignored `test/fidelity/fonts-private/`, and the runner reports a fixture whose font is missing as skipped, never as passed.
- `golden.png` for `figma` fixtures comes from `scripts/fidelity/goldens.mjs fetch <name>`, which exports the node at scale 1 through the Figma REST images endpoint using `FIGMA_TOKEN` from the environment (never committed, never used in CI). For `starter` fixtures, `fidelity.mjs bless <name>` records today's Chromium render as the golden.
- For each `figma` fixture, the same script saves the raw node JSON (`/v1/files/:key/nodes?ids=…&geometry=paths`) as `figma-node.json`, which Phase 4 uses to replay the importer offline.

### Step 4: The runner

- `scripts/fidelity/fidelity.mjs` with three commands: `run [--only a,b] [--engines chromium,firefox,webkit]`, `bless <name>`, and `baseline <name>`, which records the current percentages as the fixture's baseline and runs only when CJ approves.
- It starts its own Vite server on the local backend (the `withServer` approach from shots.mjs, on a different port) and drives Playwright's `chromium`, `firefox` and `webkit` with a viewport larger than the biggest canvas and `deviceScaleFactor: 1`.
- Per fixture and engine, it calls `window.__spFidelity.render()`, saves `test/fidelity/out/<engine>/<name>.png`, compares it with `golden.png` using the shots.mjs compare logic, and saves `test/fidelity/out/<engine>/<name>.heatmap.png`.
- It prints a table (fixture, engine, changed %, baseline, verdict) and writes `test/fidelity/out/report.json`. It exits non-zero when any engine's changed share exceeds its baseline by more than the fixture's tolerance (default 0.25 points), or when a render's size differs from its golden.
- Document `npx playwright install chromium firefox webkit` in `docs/brand-system/README.md`.

### Step 5: The first fixtures

- `starter-*`: all six blueprints in Light and Dark. Bless them on Chromium, then record baselines for all three engines.
- `gtm-composer`: the grainy green gradient panel with the floating composer on the "Sign in and sign up" page of Master UX-UI (file `mEJRslarcQDkgPeY6AObi5`, page node `194:2`; find the frame with the Figma MCP server or the REST API). Build its `schema` by hand from the exact Figma values, using only what `TemplateField` supports today: gradient shapes, rect radius, text plates, 8-digit hex for alpha, image fields, opacity and z order. Where an ingredient can't be expressed, approximate it the way an admin would today (a second shape for a halo, a texture image for grain) or leave it out, and list it in `unsupported` with the reason.
- `feature-highlight`: Figma file `g9mjhQHoPVgYbBIPKR1VsT`, node `62-1210` ("Feature Highlight Post / Light / Green"), built the same way.
- Fetch both goldens and both node JSON files, run all engines, and record baselines.
- **Gate 2:** report the table with heatmap paths and the `unsupported` lists, then stop and wait for CJ.

### Step 6: CI

- Add `.github/workflows/fidelity.yml`. It runs on pull requests that touch `src/app/components/SchemaRenderer.tsx`, `src/lib/render/**`, `src/lib/types.ts`, `src/lib/figma/**`, `src/lib/templates/**`, `supabase/functions/_shared/extract.ts`, `supabase/functions/_shared/figmaLayers.ts`, `scripts/fidelity/**` or `test/fidelity/**`.
- It sets up Node and npm the way `ci.yml` does, runs `npx playwright install --with-deps chromium firefox webkit` and `node scripts/fidelity/fidelity.mjs run`, and uploads `test/fidelity/out/` as an artifact on every run, pass or fail.
- Keep it out of `npm run verify` so verify stays fast, and record that in `docs/CI.md`.

### Step 7: The ceiling report

- Write `docs/brand-system/CEILING.md`. For each figma fixture, give a table of ingredients (what it is, its Figma value, today's support as live, workaround or missing, and the file and line that limits it), then the changed share per engine with heatmap paths and where on the canvas the changed pixels concentrate.
- Add an importer section from reading `figmaLayers.ts`, `extract.ts` and `composeLayers.ts` against each `figma-node.json`: which nodes the importer would make into fields, which it would bake into the background, and which warnings it would raise.
- Close with the capabilities Phase 1 should add, ordered by their visual impact on these fixtures, each with a proposed `TemplateField` or `TemplateSchema` property shape. These are proposals only; CJ decides at Phase 1's recon gate.
- Set Phase 0's status in `docs/brand-system/PLAN.md` to Done.

## Gate report

End the phase with this report, then run the `phase-reviewer` and `fidelity-checker` subagents, fix every must-fix finding, and open the pull request into `main`.

1. Commits, one line each.
2. Hook test results.
3. The fixture table: fixture, engine, changed %, baseline.
4. Unsupported ingredients per figma fixture.
5. The proposed Phase 1 properties with their shapes.
6. Anything you were unsure of or left out, and why.
7. The tails of `npm run verify` and `npm run build`.
