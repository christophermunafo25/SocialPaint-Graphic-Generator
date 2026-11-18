# ElevenLabs: implement it

You are a senior front-end engineer on SocialPaint (this repository). This prompt moves the whole platform onto the ElevenLabs system in the Figma file "Master UX-UI New Brand Eleven Labs Inspired" (`dQ8bQq3V7Bue5pvFrI2g9X`), from Phase E1 to Phase E9, one phase and one pull request at a time. The rest of this folder is the brief, and this file is how you run it.

Run one phase at a time, and build it straight through. CJ has dropped plan mode and the recon gates for this program (2026-11-17), so where `CLAUDE.md` or a phase prompt says to plan in plan mode first or to stop at a gate for answers, skip it. Read what the phase needs, build it step by step, run its checks and open one pull request into `main`. Then stop, since the next phase starts from `main` once CJ merges it, unless CJ asks you to keep going, in which case branch the next phase from the last one and say so in its pull request. Never merge your own pull request and never push to `main`. To see where the program stands, read the Status column of the Phases table in `PLAN.md`, which every phase updates, and run the first phase that has not merged.

This prompt was written against `main` at `c54794a` (#202), like the rest of the kit. Recount anything it counts before you rely on it.

---

## 1. Read these first

In this order, in full, before you plan anything:

1. `README.md` in this folder, for what the program is and the page map of the Figma file.
2. `PLAN.md`, for CJ's decisions, the judgement calls, what changed from v2, the phases and the screen map with every frame's node id in Light and Dark.
3. `PROMPT.md`, the brief. Section 3 holds the tokens, section 5 every component with its node and its code, section 6 the patterns and section 7 the seven interactions.
4. `RULES.md`, which every phase follows. Section 12 is how a phase runs. Where a rule and the file disagree, the file wins and the pull request records the exception.
5. `BRIDGE.md`, for every token and component change with the phase that builds it, and the fixes made in the file.
6. The phase's own prompt. Phases E1 and E2 have one each (`PHASE-E1.md`, `PHASE-E2.md`). From Phase E3 on, section 5 of this file is the brief and `PLAN.md` holds the frames.
7. `reference/`, the working builds of the interactions, `liquid-selection.html` for section 7.1 and `microinteractions.html` for sections 7.2 to 7.7. Open them in a browser and turn on Slow motion.

Then read `CLAUDE.md` and `docs/ARCHITECTURE.md` for how the repository works.

## 2. Before Phase E1

- If you are on `main`, branch first. If the kit is not committed yet, commit it on its own as the branch's first commit.
- Run `git log --oneline c54794a..main` and `git apply --check docs/design/elevenlabs/phase-e1-tokens.patch`, and note both in E1's pull request. Phase E1 applies the patch in its step 2, and that step says what to do if `main` has moved and the patch no longer applies.
- Connect the Figma MCP server and confirm it reads the file. If the `figma-design-to-code` skill is installed, load it before your first `get_design_context`.
- Take the baseline `PHASE-E1.md` section 3 lists. The full capture takes about 45 minutes, so run it in the background and leave `src/` alone until it finishes.

## 3. Reading the Figma file

The file was audited for this handoff on 2026-11-17.

**What you can rely on**

- Every variable carries its CSS name as its Web code syntax, so `get_design_context` and `get_variable_defs` return `var(--surface-page)` for a bound value instead of its hex. Use those names. The token patch puts every one of them in `tokens.css`.
- All 20 text styles are bound to variables, and each maps to a `.t-*` class in `tokens.css`, so Title/Page is `.t-title-page` and Label/XS is `.t-label-xs`.
- The 39 core components and the 42 product components all carry descriptions. Each core component also has a board on its type page with its React component, file, CSS class, how its properties map to props, the tokens it reads and its accessibility notes, and `PROMPT.md` section 5 maps both sets to code. The 62 icons are named after their lucide glyphs. Code Connect is not set up, since Figma offers it only on Organization and Enterprise plans, so map components through those tables.
- Every Dark frame sets the Color collection's Dark mode on itself, and every Light frame has a Dark twin except the sign-in gate and Create account.
- Every node id in this kit resolves, except the three `BRIDGE.md` records as gone (`2216:222`, `6148:5716` and `6148:5698`).

**How to call it**

- Work frame by frame from `PLAN.md`'s screen map. Use `get_metadata` for the tree of a large frame, `get_design_context` for its structure and values, and `get_screenshot` to look at it. What comes back is a reference to adapt to the primitives and tokens already in `src/`, never code to paste.
- Read a component on its board on its type page (`PROMPT.md` section 5), not from an instance on a screen.
- Read an interaction on Foundations › Interactions (`6262:353`), beside `PROMPT.md` section 7 and its reference build.

**What to read around**

- Screens often draw a component as plain frames named after it instead of placing an instance. Build each one with the component it is named after, and take only its placement and content from the frame. The ones that matter most are the composer on Generate and on the sign-in panel (Composer `6024:218`, `ChatComposer`), the breadcrumbs and the inspector's tabs in Template Builder (Breadcrumb `2213:111`, Tabs `4015:673`), the row menus in Template Builder and Brand Studio (Menu `2213:159`), the Tags, Slots and Logos filter in Brand Studio (the filter is the `SegmentedControl` in `admin/brand/LogosDetail.tsx`, so it takes the liquid selection), the four headline cards on Insights (Metric `2215:223`), the Footer Links on the sign-in gate and Create account, and the label and control pairs named Field on most screens (Field `4015:628`).
- A few frames share a component's name without being one. The frames named switch on the sign-in gate hold the "Don't have an account?" line, the link rows in Brand Studio's Import are an Input beside an Import button, and the frames named Logo inside Generate's recent cards and Create account's workspace preview are artwork.
- Template artwork, font specimens and the onboarding previews use the tenant's fonts and colors on purpose, in Template Builder, Brand Studio and Create account. They are content (`RULES.md` section 2), so never turn their values into tokens or chrome.
- The App shell and Settings page patterns draw their pages at half size to fit their boards. Measure from their source frames, `6010:2064` and `6095:1220`.
- Frames named spacer are empty spacing frames, built as a gap and never as an element. Layers named `sp-*` mirror the CSS classes the code already has, which helps you find the rule that draws them.
- Hidden layers are alternate states. Create account's workspace preview keeps a skeleton and a filled version of each row with one of them hidden, and its first step hides Back. A label row in the Details panel keeps a hidden Copy action, on the fill page and in the Details panel pattern. Build what each frame shows.
- The Sidebar's lockup (`6243:8529`) is CJ's update, and Phase E2 builds `BrandMark.tsx` from it. The sign-in gate places the same lockup as instances of CJ's New Logo Dark 1 (`6243:17235`), a component set on Foundations with a `#1C1F1E` variant and a white one, at 24 tall on `logo/ink`. The Logo component (`54:66`) still draws the earlier lockup from the v2 library, and Create account and the Cover place it. Ask CJ before you build from or change any of the three.
- The page after Docs whose name is a row of dashes only divides the system pages from the screens, and the All Screens page after it is empty.

## 4. How every phase runs

`RULES.md` section 12 is the procedure. In short:

1. Branch from `main` once the previous phase has merged.
2. Read what the phase builds, meaning its frames (`PLAN.md`, Screen map), the components and interactions it touches and the code it changes, from the phase prompt for E1 and E2 and from section 5 below for E3 to E9. Then start building, with no plan to approve and no stop for questions.
3. Build in steps, committing after each one with `npm run verify` green.
4. Capture `.shots/after`, compare it with `.shots/before`, and set every changed route beside its Light and Dark frames. For anything that moves, open the matching reference build beside the app with Slow motion on.
5. Run the gate in `RULES.md` section 12 and the phase's own checks. Then run the `phase-reviewer` subagent, and the `fidelity-checker` subagent whenever the phase comes near rendering, export, import or template types, as E1, E3, E4 and E5 do.
6. Open the pull request into `main` as "ElevenLabs, Phase EN: <name>", with the phase's status updated in `PLAN.md`, what it settled struck from `BRIDGE.md`, and the answer it took to every open question. Then stop until CJ merges it.

## 5. The phases

| Phase | Brief | What lands | Interactions it adds |
|---|---|---|---|
| E1 Foundation | `PHASE-E1.md` | The token patch, every primitive change in `PROMPT.md` section 5.1, every surface that would vanish, `/dev/ui` from the boards | 7.1 the liquid selection, 7.2 the Toast with Brand Studio's and Settings' timers moved onto it, 7.3 the swap, `busy` and `CONFIRM_MS` in Button and Icon Button, 7.4 the checkbox mark, 7.5 press scale and 7.6 in Upload |
| E2 Shell | `PHASE-E2.md` | The flush sidebar, the Outline buttons, CJ's lockup on `--logo-ink`, the 64 header row and the Page Header with the area icon | None |
| E3 Brand Templates | Below | The library, the 46 filter bar, search, the fill page with the 380 Details panel, public links | The fill page's toast moves onto the Toast's timer |
| E4 Generate | Below | The one-line composer, the result thread, History, `VariationTile`, the copy button on captions | 7.6 the Result Card's arrival, 7.3 its downloads' check, and the export toasts move onto the Toast's timer |
| E5 Template Builder | Below | The list and its dialogs, the editor's 64 header row, the stage, the variations bar, the 320 inspector | The list's toasts move onto the Toast's timer, and the two image uploads pass `busy` |
| E6 Brand Studio | Below | The overview and its eighteen detail states | None |
| E7 Settings and Insights | Below | Seven settings sections and the dashboard | 7.7 the headline numbers' roll |
| E8 Sign in and Create account | Below | Eight gate screens and ten onboarding steps, Light only | None |
| E9 Cleanup | Below | Every bridged name no phase reads any more, and the transparent bevel and glow tokens if CJ agrees | None |

What E1 builds into a primitive reaches every screen that uses it with no further work. The variations bar, the Logos filter and every other Segmented Control already have the liquid selection, every Copy that swaps to a check already draws it, and every Toast already eases in. A Toast only waits under the pointer and eases out once its caller hands it the timer, which is why those moves sit in the phases above.

### Phase E3: Brand Templates

It builds Brand Templates 01 to 03 and the fill page 04 to 07, each with its Dark twin (`PLAN.md`, Screen map). That covers the library and its shelves, the filter bar at 46 with the Large Search Field and the Platform Chips (judgement calls 3 and 4), search, the fill page with the 380 Details panel, and the public links dialog. The Platform Chip moves to 46 on `--radius-chip` with its logo tile on `--radius-tile` (`PROMPT.md` section 5.2). The `.sp-lib-search` rules in `brand-templates.css` that reshape the Search Field round at 50 give way to the frame's sizes, and History reads the same rules, so check it in this phase too (`PHASE-E1.md`, section 7). The fill page's toast in `TemplateFill.tsx` moves onto the Toast's `open`, `duration` and `onTimeout`, keeping its timing.

### Phase E4: Generate

It builds Start through History (`PLAN.md`, Screen map). Build the one-line composer from Composer `6024:218` in `chat/ChatComposer.tsx`, the result thread with the Result Card's stage on `--surface-stage`, History, the rename of `LookTile` to `VariationTile` (data names keep theirs, `RULES.md` section 11), and the copy button on generated captions (judgement call 10). `ResultCard` gains `arrive`, which the thread sets on the card a run has just finished, in Generate and in the template chat (`chat/GenerateTurn.tsx`, `chat/TemplateChatViews.tsx`, `PROMPT.md` section 7.6). Its Download and Download both confirm with the check through Button's `busy` and `CONFIRM_MS` (section 7.3). The export toasts in `generate/EditorPanel.tsx` and `generate/GeneratePage.tsx` move onto the Toast's timer. Leave the "Chat box options" frame (`6023:4409`) alone. The gate adds a finished run, a revisit and a size switch beside `reference/microinteractions.html` at slow motion, since only the finished run may play.

### Phase E5: Template Builder

It builds the list and the editor (`PLAN.md`, Screen map). Build the list and its dialogs, the editor's bar as the 64 header row (`RULES.md` section 10), the stage, the variations bar and the 320 inspector. The list's toasts in `admin/AdminTemplates.tsx` move onto the Toast's timer, each keeping its duration. The background and static image Uploads (`builder/TemplateBuilder.tsx`, `builder/FieldInspector.tsx`) pass `busy` while they upload, since they are the only callers that track an upload today. Nothing in `RULES.md` section 11 changes, so `SchemaRenderer`, the export and `canvasGesture.ts` keep their code, and the `fidelity-checker` must find every fixture at its baseline.

### Phase E6: Brand Studio

It builds the overview and its eighteen detail states, with logo plates on `--plate-dark` and `--plate-light`. Type specimens and font rows show the tenant's fonts, so they never read a type token. Brand Studio's Undo already waits under the pointer from E1.

### Phase E7: Settings and Insights

It builds the seven Settings sections and the Insights dashboard. Insights draws its four headline numbers with `InsightKpi` (`admin/insights/InsightKpi.tsx`) today, while its frame draws them as frames named Metric · Exports and so on, laid out like Metric (`2215:223`). Build them on `Metric` and give it `roll` (`PROMPT.md` section 7.7). If `InsightKpi` has to stay, give it the roll instead and say why in the pull request. The roll is not the count-up new-look Phase 8 removed (its D10). It never counts from zero, it plays only when new numbers land after the member changes the range or a filter, and CJ added it on 2026-11-17 (decision 13). Its timing is `useRoll`'s, moved into one place both share. The Sharing and Public links rows already draw the check from E1.

### Phase E8: Sign in and Create account

It builds the eight gate screens and the ten onboarding steps, Light only (decision 9). The previews inside onboarding are template artwork in the tenant's fonts, so they stay content. Both draw their lockup through `PreAppShell`'s `BrandLockup`, which is CJ's updated lockup from Phase E2 on. The sign-in frames draw that one, but Create account's frames still place the earlier Logo, so build onboarding with the updated lockup the code already draws and note the difference in the pull request.

### Phase E9: Cleanup

Everything new-brand Phase 10 owes (`docs/design/new-brand/PLAN.md`), every bridged name in `legacy-bridge.css` that no phase reads any more, and the transparent bevel and glow tokens if CJ agrees (judgement call 6). Its gate is a grep that finds nothing legacy left.

## 6. Rules that hold in every phase

- `RULES.md` throughout, and `CLAUDE.md`. Every value is a token, and a rule you write reads a semantic name, never a primitive, a raw color or a bridged name.
- Hover never animates beyond its color change, and nothing moves or scales an arrow. Motion follows `PROMPT.md` section 7, with direct feedback for the pointer only, arrivals for everyone and nothing on first paint.
- Lists and cards load as skeletons shaped like what they replace, and a busy control waits 400 ms before it shows a spinner.
- No copy beyond what the frames show, and no helper copy. A string a frame does not show is proposed copy, listed in the pull request for CJ.
- The interface says "variations". Terms of Service and Privacy Policy stay at the bottom of every page.
- Nothing in `RULES.md` section 11 changes, migrations stay additive, and Edge Function mirrors stay byte-identical to their twins.
- Read the Figma file and never change it. The Logo component, the Sidebar's lockup and New Logo Dark 1 stay as they are in the file, and the code's lockup is built from the Sidebar's (`6243:8529`).

## 7. When something is not settled

Keep building. Take the recommended answer where a prompt gives one and the reading closest to the frames where it does not, and list each call in the pull request for CJ, along with anything in `RULES.md` section 13 a change touched. Stop and ask only before something that cannot be undone, such as a migration that drops a table or a column, or a change that would alter a template's output or an export.

## 8. Done

The program is done when every phase has merged, every route matches its frames in Light and in Dark, every interaction matches its reference build, and Phase E9 finds nothing legacy.
