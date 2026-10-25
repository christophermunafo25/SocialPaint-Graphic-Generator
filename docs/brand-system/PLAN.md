# Brand system: the plan

This folder carries the brand-system program into the platform, one phase at a time: Brand Studio as a complete graphic design system, and generation that works like a senior designer on the brand team.

- `README.md`: setting up and running a phase.
- `RULES.md`: the rules every phase follows.
- `strategy/BRAND-SYSTEM.md`: the strategy this plan implements (the bar, the ceiling today, the eight pillars, references and recipes, the generation loop, the proof).
- `PHASE-0.md`: the Claude Code prompt for Phase 0. Each later phase gets its own prompt when it starts, written against the code as it stands then.
- `CEILING.md`: written by Phase 0, the measured account of what the renderer and importer can express today.

## The bar

Set by CJ on 2026-10-08: SocialPaint's AI uses the brand's design system and the marketing team's designs so precisely that whatever it makes reads as the brand team's own work. It acts as a senior-level extension of that team and produces real, complex, layered work that would take a designer or marketer hours. The team's own work sets the bar for craft, and the proof is a blind test per tenant (`strategy/BRAND-SYSTEM.md`, "Proof").

## Decisions

Each stays open until CJ marks it. Every phase lists the decisions it needs, and its prompt stops at the recon gate while one of them is still open.

| #   | Decision                                                                                                                                                               | Recommended                                                                               | Status |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------ |
| D1  | Color roles replace Primary, Secondary and Accent (the COLOR-SCHEMES roles), derived from the palette and the team's templates and then corrected by the admin         | Yes; Secondary takes the role its use in the templates shows                              | Open   |
| D2  | Colourways write baked hex into `TemplateVariant` overrides, or templates bind to schemes live                                                                         | Baked, with a reviewed "Reapply brand" action later                                       | Open   |
| D3  | Type sizes come from the skeleton engine's per-canvas table plus one brand ratio, or from a full table admins edit; a type style's color becomes a role or stays a key | Table plus ratio; style color becomes a role                                              | Open   |
| D4  | Storage is one versioned `system` jsonb on `brand_kits` plus a `brand_references` table, or a column per pillar                                                        | `system` jsonb plus `brand_references`                                                    | Open   |
| D5  | The Character pad (Quiet to Bold, Compact to Airy) is adopted, and placed somewhere                                                                                    | Adopt it, at the top of the Layout page, with its position as the Layout card's meta line | Open   |
| D6  | The overview has twelve cards: Colors, Light & dark, Logos, Fonts, Type styles, Media, Icons, Layout, Shape & effects, Elements, Motion, References                    | Yes                                                                                       | Open   |
| D7  | Renderer depth comes first: shadows, blur and glow, radial and mesh gradients, grain, outside strokes, true alpha masks                                                | Yes                                                                                       | Open   |
| D8  | Generate's new designs get a bounded render-critique loop, which reverses "no agent for now" for that path                                                             | Yes, two rounds at most                                                                   | Open   |
| D9  | Rules 11 and 12 (one layering move, no decoration) apply only to brands without references, and each brand's references set its own layering budget                    | Yes                                                                                       | Open   |
| D10 | Generated imagery stays off unless a brand turns it on                                                                                                                 | Yes                                                                                       | Open   |
| D11 | The shared Claude Code config (`.claude/agents`, `skills`, `hooks`, `settings.json`) is versioned by narrowing the `.claude/` line in `.gitignore`                     | Yes, in Phase 0, Step 1                                                                   | Yes (CJ, 2026-10-19) |

## Phases

One phase is one prompt, one branch and one pull request. Gates are where the session stops for CJ. `strategy/BRAND-SYSTEM.md` groups this work into seven stages, which this table splits into one-session phases: stage 1 is Phases 1 to 4, stage 2 is Phases 5 to 8, stage 3 is Phases 9 to 11, stage 4 is Phase 12, stage 5 is Phases 13 to 15, stage 6 is Phase 16 and stage 7 is Phase 17.

| Phase | Track | Builds                                                                                                                                                                                  | Needs                                          | Done when                                                                                                  | Status      |
| ----- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ----------- |
| 0     | Ruler | Kit wiring, a dev-only render route, the fixture format, golden fetching, the fidelity runner on Chromium, Firefox and WebKit, the first fixtures, a fidelity CI workflow, `CEILING.md` | D11                                            | Every fixture renders on three engines with recorded baselines; `CEILING.md` lists what Phase 1 should add | Done        |
| 1     | A     | Depth in the renderer: shadow, blur and glow, radial and mesh gradients, grain, outside stroke, as field and canvas properties with export parity                                       | Phase 0, D7, property shapes at the recon gate | The GTM composer fixture rebuilt with depth matches its golden within baseline on all engines              | Not started |
| 2     | A     | Depth in the builder: inspector controls, variant override keys, validators, starters                                                                                                   | Phase 1                                        | Builder edits round-trip through save and export                                                           | Not started |
| 3     | A     | Icons and vectors: an icon element recolorable by role, vector shapes from the paths the importer records                                                                               | Phase 1                                        | Fixtures with icons and vectors match their goldens                                                        | Not started |
| 4     | A     | Import fidelity: offline import replay from saved node JSON, effects kept as properties, radial gradients as fields, true alpha masks, vectors                                          | Phases 1 to 3                                  | The GTM composer and Feature Highlight frames import as live layers that match their goldens               | Not started |
| 5     | B     | The system model: `brand_kits.system`, pure resolvers (roles, schemes, contrast fixes, type scale), off-palette enforcement on shapes, strokes, plates and the background               | D1, D3, D4                                     | Resolvers tested; every existing fixture renders unchanged                                                 | Not started |
| 6     | B     | Colors (roles, neutrals, pairings, gradients), the Light & dark page, and "Add colourway" in the builder                                                                                | Phase 5, D2, D6, new-look Phase 9 merged       | Screens match their frames; generated colourway fixtures pass contrast                                     | Not started |
| 7     | B     | Type scale, Layout, Shape & effects, and the Character control                                                                                                                          | Phase 5, D5                                    | Same                                                                                                       | Not started |
| 8     | B     | Imports fill the system: the website pull asks for radius, shadow, spacing and weights; tokens.json consumes the groups it skips; Figma variables and effect styles                     | Phases 5 to 7                                  | Fixture sites and token files produce the expected systems                                                 | Not started |
| 9     | C     | The recipe format: a parser for the `role · kind · key=value` grammar and the skeleton library ingested to checked-in JSON, with a parser report                                        | Phase 0                                        | All 424 skeleton frames parse, with the report listing anything unsupported                                | Not started |
| 10    | C     | References: the `brand_references` table, import from Figma and templates, decomposition into recipes, the admin review, coverage by use case, the learned read-out                     | Phases 4, 5, 9, D4                             | Fixture references decompose and pass review                                                               | Not started |
| 11    | C     | Elements: composite elements from references, the Elements page, the builder's insert menu                                                                                              | Phase 10                                       | Elements render correctly on every scheme                                                                  | Not started |
| 12    | C     | Media: cut-outs by background removal, tagging, product UI captures, photo direction                                                                                                    | D10                                            | Fixture media tagged and cut out                                                                           | Not started |
| 13    | D     | The compose compiler: recipe or skeleton plus system plus slot copy in, `TemplateSchema` out, with the deterministic checks                                                             | Phases 5, 9, 11                                | Every skeleton compiles against three fixture tenants with zero check failures                             | Not started |
| 14    | D     | Generate v2 behind a flag: plan and shortlist, team recipes first, re-flow across sizes                                                                                                 | Phase 13                                       | The eval harness pass rates beat today's freestyle on the same briefs                                      | Not started |
| 15    | D     | The critique loop: client render, critique function, fixed edit vocabulary, two rounds                                                                                                  | Phase 14, D8                                   | Eval scores improve over Phase 14 at a documented cost per draft                                           | Not started |
| 16    | D     | Corrections and proof: draft edits become proposed rules, the blind-test page, the hours-saved log                                                                                      | Phase 14                                       | SocialPaint (tenant one) runs its first blind test                                                         | Not started |
| 17    | E     | Motion: presets, entrance tokens, animated export                                                                                                                                       | Later                                          | Animated fixtures export on all engines                                                                    | Not started |

## Tracks and sequencing

- **Track A** (renderer and import, Phases 1 to 4) can run beside new-look Phase 9, which works in stylesheets and lint while Track A works in the renderer, the types, the importer and the builder inspector.
- **Track B** (the system, Phases 5 to 8) starts after new-look Phase 9 merges, because both touch Brand Studio.
- **Track C** (the portfolio, Phases 9 to 12): Phase 9 can start right after Phase 0; the rest follows Tracks A and B.
- **Track D** (generation, Phases 13 to 16) follows Track C.
- **Track E** (motion, Phase 17) comes last.
- Parallel tracks run in separate worktrees (`claude --worktree brand-a`). `src/lib/types.ts`, `src/lib/stores/supabase/rows.ts` and the migrations folder are shared, so a phase reserves its migration numbers here when it starts and rebases before it merges.

## Migration numbers reserved

None yet.
