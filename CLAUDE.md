# SocialPaint

A multi-tenant brand template platform. Admins build locked graphic templates, members fill them, and every export stays on brand. Vite and React on the front end, Supabase (Postgres, Storage and Deno Edge Functions) behind it, deployed on Vercel. `docs/ARCHITECTURE.md` and `docs/TEMPLATE_SCHEMA.md` describe the system.

## Commands

- `npm run dev` starts Vite. With no `VITE_SUPABASE_URL` the app runs on the local backend (`src/lib/stores/local/`, localStorage).
- `npm run verify` runs the token check, both typechecks, lint, the format check and the tests. It passes before every commit. CI runs the same steps plus a build.
- `node scripts/new-look/shots.mjs` is the screenshot loop for platform screens.
- `node scripts/fidelity/fidelity.mjs run` is the render fidelity harness for graphics (built in brand-system Phase 0).

## Architecture to build on, never around

- `SchemaRenderer` (`src/app/components/SchemaRenderer.tsx`) is the only path that draws a graphic: in the builder, the fill page, the public link page, Generate and export. Export goes through `renderSchemaBlob` and `exportSchemaPng` in `src/lib/render/exportPng.ts`.
- `canvasGesture.ts` is the builder's only pointer-gesture core.
- `TemplateSchema`, `TemplateField`, `LayoutGroup` and `BrandKit` in `src/lib/types.ts` are frozen, along with every table column. Changing one is CJ's decision: propose the exact shape at the phase's recon gate and wait.
- Field colors are baked hex with no live palette binding (migration 0023). Type styles are the one live brand channel. Colourways are `TemplateVariant` overrides with baked values.
- Edge Functions can't import from `src`, so shared logic is mirrored into `supabase/functions/_shared/` and stays byte-identical to its twin.

## Rules

- No hex literals in TSX, no off-scale spacing, and no emoji anywhere, including comments and copy.
- Platform UI follows `docs/design/new-look/RULES.md`.
- Copy is sentence case and second person, with no exclamation points, no em dashes, and no helper lines explaining how the UI works.
- Migrations are additive. Add the next number and never edit a committed migration (a hook blocks it).
- Every model call is a forced tool call whose result is validated before use.

## How work runs here

Programs live in `docs/`, each with a plan, rules, and one prompt per phase:

- `docs/design/new-look/`: the platform UI from the Master UX-UI Figma file.
- `docs/brand-system/`: Brand Studio as a complete graphic design system, and generation that works like a senior designer on the brand team.

For each phase, plan in plan mode first, then build in steps, committing after each step with `npm run verify` green, and stop at every gate the prompt names. Report anything outside the phase's scope instead of changing it. Before opening the pull request, run the `phase-reviewer` subagent, and the `fidelity-checker` subagent when the phase touches rendering, export, import or template types.

When the Figma MCP server is connected, read exact values from the files and nodes the prompts name instead of estimating them.
