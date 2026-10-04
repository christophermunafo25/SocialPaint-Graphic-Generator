# New look, Phase 2: primitives

You are a senior front-end engineer on SocialPaint (this repository). This phase turns the Figma file "Master UX-UI" into code components. It produces four things:

- one React primitive per Master component, each with its interaction states built in and tested
- a dev-only `/dev/ui` route that reproduces the Interaction states table (`105:641`) and shows every primitive
- the component test tooling those tests need
- sample Generate threads in the screenshot fixture, so a thread, its result and History can be captured on the local backend

**No screen changes in this phase.** Each screen moves onto the primitives once, in the phase that rebuilds it to its frame: Phase 3 for the sidebar and page headers, Phases 4 to 8 for their areas. The old control classes stay until nothing uses them. The gate proves every existing screen is unchanged.

Be exact. Work through the steps in §5 in order, run the checks each step names, and commit after each step with `npm run verify` green. If something here turns out to be wrong once you are in the code, stop and explain the conflict instead of improvising.

---

## 1. Read these first

1. `docs/design/new-look/PLAN.md`, `RULES.md` and `BRIDGE.md` in full.
2. `docs/design/new-look/PHASE-2-COMPONENTS.md` in full. It holds every component's props, sizes, padding, radius, tokens per state and text styles, read from the file. This prompt calls it "the reference".
3. `docs/design/new-look/reference/interaction-states.png`: the Interaction states table at 1x, the `/dev/ui` gate image.
4. `src/styles/tokens.css` (the semantic tokens, the `.t-*` text classes and the elevation composites) and `src/styles/legacy-bridge.css`.
5. `src/app/router.tsx`, `src/app/App.tsx` and `vitest.config.ts`.
6. `src/lib/types.ts` (the Generate thread shapes, about lines 790 to 1005), `src/lib/stores/local/localStores.ts` (`LocalGenerateThreadStore`), `src/lib/generate/threadStorage.ts`, and the test data in `src/lib/generate/threadStorage.test.ts` and `src/lib/stores/local/generateThreadStore.test.ts`.
7. `scripts/new-look/shots.mjs` and `scripts/new-look/fixtures/dev-workspace.json`.
8. The code in §2's "Today" column. Read it for the props and behavior the primitives must cover, not to change it.

With the Figma MCP server connected, read any component by its node id (`get_design_context`, `get_screenshot`) when the reference is unclear. The live file wins over the reference.

## 2. The primitives

New folder `src/app/components/primitives/`, one file per Figma component set (or per small family), all exported from `primitives/index.ts`. Styles go in a new `src/styles/primitives.css`. "Today" is the code each primitive will replace when its screens move. "Moves in" is the phase that moves those screens.

| Primitive | Figma | Today | Moves in |
|---|---|---|---|
| `Button` (`kind` primary, neutral, neutralOnPage, destructive; `size` lg, md, default, sm; optional leading `icon`) | 43:123 | `.sp-btn` and its modifiers; `.sp-chat-btn` (`generate/ChatButton.tsx`) | 3 to 8 |
| `SendButton` (`action` send, stop) | 44:9 | `generate/SendButton.tsx` (`.sp-chat-send`) | 4, 5 |
| `AttachButton` | 102:569 | `generate/PlusButton.tsx` (`.sp-plus`) | 4, 5 |
| `IconButton` (`variant` filled, ghost; `selected`) | 95:516 | `.sp-icon-btn`; `.sp-chat-icon-btn`; `generate/IconButton.tsx` | 3 to 8 |
| `RowMenuTrigger` | 44:29 | `.sp-row-menu-trigger` in `admin/brand/primitives/RowMenu.tsx` | 6 |
| `ThemeToggle` | 102:574 | `.sp-icon-btn--theme` in `Sidebar.tsx` | 3 |
| `StepperButton`, `Stepper` | 100:544, 100:545 | `generate/VariationsStepper.tsx` (`.sp-chat-stepper`) | 5 |
| `Input` (`size` default, sm, multiline), `Field` (`label`, `error`) | 48:37, 48:38 | `.sp-input` text fields; `.sp-chat-input`; `.sp-chat-field`; `FieldInput.tsx` | 4 to 8 |
| `Select` (`size` default, lg) | 49:40 | the trigger of `ui/Select.tsx`; native `<select class="sp-input">` | 4 to 8 |
| `CompactSelect` | 99:568 | `generate/PlatformSelect.tsx` (`.sp-chat-select`) | 5 |
| `Filter` | 99:547 | the filter bar dropdowns (`.sp-filterbar`) | 5, 8 |
| `SearchField` | 50:62 | `templates/TemplateSearchField.tsx` (`.sp-searchfield`) | 4, 5 |
| `Switch` | 49:45 | `Switch.tsx` (`.sp-switch`) | 6, 7 |
| `Segment`, `SegmentedControl` | 49:50, 49:51 | `.sp-segmented`; `generate/SegmentSwitch.tsx`; `.sp-chat-editor__seg` | 5, 6, 8 |
| `Tab`, `Tabs` (a `dot` color per tab) | 49:62, 49:63 | `.sp-tabstrip` | 3, 8 |
| `Chip` | 98:515 | `generate/SuggestionChip.tsx` (`.sp-chat-chip`) | 5 |
| `ChoiceChip` | 98:532 | `admin/brand/primitives/TagChoice.tsx` (`.sp-tag-choice`) | 6 |
| `PlatformChip`, `PlatformLogo` | 53:96, 53:73 | `templates/GroupChips.tsx` (`.sp-platform-chip`) | 4 |
| `Tag` (`kind` default, overlay, filter, missing) | 52:63 | `admin/brand/primitives/Tag.tsx` (`.sp-tag`); `MissingTag` in `generate/DetailTag.tsx` | 4 to 6 |
| `DetailTag` (`state` editable, sent) | 61:464 | `DetailTag` in `generate/DetailTag.tsx` | 5 |
| `Status` (`tone` positive, active, neutral; `size`) | 52:51 | the "Connected" eyebrow in `settings/IntegrationsSection.tsx` | 4, 7 |
| `Avatar` | 54:62 | `.sp-avatar` | 3 |
| `NavItem` | 54:83 | `.sp-sidebar-item`; `GooeyNavPill.tsx` | 3 |
| `SettingsRailItem` | 54:100 | `.sp-settings-rail`; `.sp-railitem` | 3, 7 |
| `Menu`, `MenuItem`, `MenuLabel`, `MenuDivider` | 57:423, 96:507, 57:419, 57:421 | `.sp-row-menu`; `MenuSurface` and `MenuRow` in `ui/Select.tsx`; `generate/AttachMenu.tsx` | 4 to 8 |
| `Tooltip` | 58:434 | `Tooltip.tsx` (`.sp-tooltip`) | 5, 8 |
| `Toast` | 58:431 | the hand-rolled `.sp-toast` blocks | 4 to 8 |
| `Progress`, `ProgressBar` | 58:450, 58:451 | none yet | 5, 6 |
| `Card`, `SettingsCard`, `Stat`, `Metric` | 58:476, 58:460, 59:449, 59:452 | `.sp-card` as Insights and Settings use it | 7, 8 |
| `Modal` | 58:484 | `ConfirmDialog.tsx`; hand-rolled `role="dialog"` panels | 4 to 8 |
| `PreviewOverlay` (the dim and the Edit button) | 104:584 | `admin/brand/primitives/EditOverlay.tsx` (`.sp-edit-overlay`) | 4 to 6 |
| `ResultCard` | 104:602 | `generate/DraftCard.tsx` (`.sp-chat-draft`) | 5 |
| `LookTile` | 104:996 | the tiles in `generate/LookPicker.tsx` (`.sp-chat-looks`) | 4 |

Not built here: the Sidebar (56:646), Account (56:1330) and Logo (54:66, 61:467) belong to Phase 3. The Composer (61:504), Message bubble (61:505), Assistant message (61:532) and Gradient glow (24:700) belong to Phase 5.

### Props the call sites need

The primitives must cover today's call sites without forcing a later phase to bend them:

- **Every interactive primitive.** It forwards its ref and passes native attributes through (`type`, `form`, `name`, `aria-*`, `data-*`, event handlers). Five forms submit through a `type="submit"` button, and several controls carry `aria-describedby` or `aria-busy`.
- **Busy states.** About 15 components show a busy state with a spinner (`Loader2`). `Button` takes it in the `icon` slot together with `aria-busy`. The file draws no loading variant, so none is invented.
- **Required accessible name.** `IconButton`, `RowMenuTrigger`, `AttachButton`, `SendButton` and `StepperButton` take a required `label` that becomes `aria-label`.
- **Controlled values.** These follow the signatures in use today, so later moves are drop-in:
  - `Switch`: `checked`, `onChange(next)`, `disabled` and `ariaLabel`, as in `Switch.tsx`.
  - `Select`: `value`, `onChange`, `options` and `placeholder`, as in `ui/Select.tsx`.
  - `SegmentedControl`: `value`, `onChange` and `options`, as in `SegmentSwitch.tsx`.
  - `Stepper`: `value`, `min`, `max`, `onChange` and `label`, as in `VariationsStepper.tsx`.
  - `SearchField`: `open`, `onOpenChange`, `value`, `onChange` and `onClear`, as in `TemplateSearchField.tsx`.
- **Remaining props.**
  - `DetailTag`: `onRemove`.
  - `PlatformChip`: `selected`, `expanded` (the chevron turns down) and `platform`.
  - `MenuItem`: `icon`, `meta`, `chevron`, `selected` and `onSelect`.
  - `PreviewOverlay`: wraps its preview and takes `onEdit` and `editLabel`.
  - `Toast`: `message`, `actionLabel` and `onAction`.
  - `Tooltip`: `content` and `children`.

### Field and errors

`Field` follows the updated Figma Field (48:38; the Light and Dark example is 182:1965):

- **Parts.** A label, the control, and an optional error message.
- **The message.** It sits 6 px under the control, in `.t-caption-s` and `--state-error`. The control itself does not change.
- **No hints.** There is no hint or helper text (RULES §9).
- **Wiring.** `Field` gives the control an id, sets `aria-invalid="true"` on it when `error` is set, and points its `aria-describedby` at the message (merged with any `aria-describedby` the caller passes). The label is a `<label htmlFor>`.
- **Focus on submit.** Ship `focusFirstInvalid(form: HTMLFormElement)` with `Field`. It moves focus to the first control with `aria-invalid="true"` in document order and returns whether it found one. Forms call it on submit when validation fails. Area phases wire it up as they rebuild their forms.
- **Copy.** Error strings are proposed copy. The only one in this phase is the frame's "Add a headline." on `/dev/ui`. Later phases list theirs in their PRs.

## 3. Invariants

- **No screen changes.** No existing `.tsx` screen or component imports a primitive in this phase. `socialpaint.css`, `tokens.css` and `legacy-bridge.css` do not change. The only existing files that change are the router, `App.tsx` (for the dev route), `index.css` (one import), `vitest.config.ts`, `package.json`, the lockfile, `shots.mjs`, the fixture and docs.
- **Multi-tenant.** Primitives style the platform chrome only and never read a brand kit. The fixture threads are sample content for the local backend ("Acme Studios"), never SocialPaint content, and are never seeded into an account.
- **Tokens only.** Primitives read semantic tokens, radius and spacing tokens, elevation composites and `.t-*` classes (RULES §3 and §5). They never use a primitive token, a raw color, a legacy name or inline type. A value the file draws off the spacing scale is written as drawn, with a one-line comment naming the Figma node (RULES §4).
- **One definition per token.** `primitives.css` declares nothing at theme level, so `npm run tokens:check` keeps passing. Component-local custom properties start with `--_`, so they can never collide with a token.
- **States from the file.** Hover, pressed, selected, open, disabled and focus follow RULES §6 and the reference row for each component. Nothing else changes on hover.
- **No new runtime dependencies.** Behavior that needs a library uses what is installed: Radix dropdown-menu, dialog, tooltip, toggle-group and tabs. The new dev dependencies are the test tooling in step 2.
- **Development only.** `/dev/ui` is reachable only when `import.meta.env.DEV` is true, and its page is never in the production bundle.

## 4. Before you change anything

1. Branch from `main`: `feat/new-look-phase-2`.
2. Capture the baseline: `npm run shots -- capture .shots/before` and `npm run shots -- props .shots/props-before.json`.

## 5. Steps

### Step 1: Generate threads in the dev fixture

- **Seed the threads.** Add them to `brand-portal-dev-db.generateThreads` in `scripts/new-look/fixtures/dev-workspace.json`, scoped the way `LocalGenerateThreadStore` reads them (`LOCAL_DEV_USER_ID` and the Acme Studios company). Build them from the shapes in `src/lib/types.ts` and the test data named in §1, and check each one by loading it through `fromStoredThread`. Three threads:
  1. **A finished result.** One user turn (detail tags belong to template chats, so a Generate thread has none). One assistant turn whose reply carries two drafts of the same post in two sizes, each with a template id from the fixture, values and a caption, plus follow-up chips.
  2. **A follow-up.** The first thread with a second user turn and a second assistant turn.
  3. **A question.** One user turn, and an assistant turn that asks a question instead of returning drafts.

  Every value is sample content in the style of the existing fixture.
- **Capture them.** Add `generate-thread` at `/generate/c/<first thread id>` and `generate-thread-question` at `/generate/c/<third thread id>` to the screenshot loop's routes.
- **Check.**
  - `npm run shots -- capture .shots/fixtures` shows the threads in both themes.
  - History lists the threads.
  - Start still shows its setup notice. If Start also lists recent threads on the local backend, it now shows these.
  - `compare .shots/before .shots/fixtures` shows History (and Start, if it lists them) changed, plus the two new routes, and nothing else.
- **Commit.** `npm run verify` passes. Commit: "New look phase 2: Generate threads in the dev fixture".

### Step 2: component test tooling

- **Install.** `npm install --save-dev @testing-library/react @testing-library/dom @testing-library/user-event happy-dom`. `@testing-library/dom` is the required peer of the React package.
- **Configure `vitest.config.ts`.** Use two projects, both extending the root config (the `@` alias):
  - **`unit`:** `environment: "node"`, with today's `include` unchanged (`src/**/*.test.ts` and `supabase/functions/_shared/*.test.ts`).
  - **`dom`:** `environment: "happy-dom"`, with `include: ["src/**/*.test.tsx"]`.

  Rewrite the file's comment to say what each project is for: the node project runs the pure unit tests, and the happy-dom project runs component tests. `npm test` runs both.
- **Smoke test.** Add `src/test/dom.test.tsx`. It renders a plain `<button>` with `@testing-library/react`, clicks it with `user-event`, and checks that the handler ran. That proves the happy-dom project runs before any primitive exists.
- **Commit.** `npm run verify` passes, and the existing tests run unchanged in the node project. Commit: "New look phase 2: component test tooling".

### Step 3: the primitive foundation and `/dev/ui`

- **The stylesheet.** Create `src/styles/primitives.css`, and import it in `src/styles/index.css` after `legacy-bridge.css` and before `tailwind.css`. No existing selector matches its classes, so screens are unaffected.
- **Shared state mechanics.** Write them once, at the top of `primitives.css`, and use them in every primitive:
  - **Fill and tint.** A component sets `--_fill` (its base) and `--_tint` (transparent at rest). The background is `linear-gradient(var(--_tint), var(--_tint)), var(--_fill)`.
    - Hover sets `--_tint` to the component's hover token.
    - Pressed (`:active`) sets it to the component's pressed token.
    - An open menu holds the pressed token (`[aria-expanded="true"]`).
    - Components with no base fill use `--_fill: transparent`.
  - **Disabled.** `:disabled` and `[aria-disabled="true"]` set `opacity: 0.4` (the Stepper button uses 0.32) and switch hover and pressed off.
  - **Focus.** Each component uses one of these looks:
    - **Default ring:** the global ring from Phase 1 (`outline: var(--focus-width) solid var(--ring); outline-offset: var(--focus-offset)`).
    - **Tight ring:** for Chip, Platform chip, Tag, Segment, Tab, Settings rail item and Look tile. It is `outline: 2px solid transparent; box-shadow: 0 0 0 var(--focus-width) var(--ring)`, composed with any shadow the component already draws.
    - **Text fields:** the caret only. Use `outline: none` on `:focus-visible`, with no border, fill or shadow change.
    - **Menu items:** their hover look on focus.
    - **Previews:** the overlay on `:focus-visible` and `:focus-within`.
  - **Demo states.** Every hover, pressed, selected, open and focus selector is paired with a `[data-demo-state="hover|pressed|selected|open|focus"]` selector that produces the same look. Only `/dev/ui` sets this attribute.
- **The route.**
  - Add `{ name: "devUi" }` to the `Route` union and both mappers in `router.tsx`, at `/dev/ui`.
  - When `import.meta.env.DEV` is false, `urlToRoute` never returns it and `App.tsx` never renders it, so production falls back to the portal as it does for any unknown path.
  - `/dev/ui` renders outside `AppShell`, full width, with no sidebar. Lazy-import its page so it stays out of the production bundle.
  - Add router tests for both branches.
- **`/dev/ui` has two parts:**
  1. **The Interaction states table.** Rebuild it to the reference's Part C, "Page layout": 3172 wide, with the title and six rules verbatim, the column header, the family headers and the component rows.
     - Each Light column is wrapped in `data-theme="light"` and each Dark column in `data-theme="dark"`, so the table looks the same whatever the app's theme.
     - Each cell renders the real primitive with `data-demo-state` set, on the cell surface the reference names, with the caption from the frame.
     - Rows fill in as their primitives land in step 4. An unbuilt row shows its label and empty cells.
  2. **The component sheet,** below the table. It shows every primitive in every kind and size, its disabled look, and `Field` with and without its error, in both themes side by side. It has no Figma counterpart; it is there to review sizes and kinds.
- **The screenshot loop.** Add `dev-ui` to its routes, and a `--width` flag (default 1440) so it can be captured at 3172.
- **Commit.** `npm run verify` passes. Commit: "New look phase 2: primitive foundation and /dev/ui".

### Step 4: build the primitives

Build in this order, one commit per family. For each primitive:

- **Values.** Exact props, sizes, padding, gap, radius, tokens per state and text classes come from the reference. The props also cover §2's "Props the call sites need".
- **Hit areas.** At least 24 × 24. The search clear button and the Detail tag remove button draw their glyph at 14, so pad them out.
- **Icons.** Use lucide-react at the drawn size with the default stroke. Lucide at 16 and 18 matches the file's strokes, and at 14 and 20 the stroke scales the way Figma's does. Existing custom glyphs stay (RULES §8).
- **Tests.** Each primitive gets a test file in the happy-dom project. Cover what behaves, not how it looks:
  - disabled ignores input
  - `aria-pressed`, `aria-selected`, `aria-checked` and `aria-expanded` reflect state
  - Segment and Tab move with the arrow keys
  - Menu opens on Enter or Space and moves with the arrow keys
  - Switch toggles on Space
  - the icon buttons expose their `label` as the accessible name
  - `Field` wires `aria-invalid` and `aria-describedby`, and `focusFirstInvalid` focuses the first invalid control

Families:

1. **Buttons:** `Button`, `SendButton`, `AttachButton`. Commit: "New look phase 2: button primitives".
2. **Icon buttons:** `IconButton`, `RowMenuTrigger`, `ThemeToggle`, `StepperButton`, `Stepper`. The theme toggle shows the sun in Light and the moon in Dark, keyed off the nearest `[data-theme]` in CSS, not in JavaScript. Commit: "New look phase 2: icon button primitives".
3. **Fields and pickers:** `Input`, `Field` (with `focusFirstInvalid`), `Select`, `CompactSelect`, `Filter`, `SearchField`. `Select` carries over the keyboard and listbox behavior of `ui/Select.tsx` into the primitive, without changing `ui/Select.tsx` itself. Commit: "New look phase 2: field primitives".
4. **Toggles:**
   - `Switch`: role `switch`, with the behavior of `Switch.tsx`.
   - `Segment` and `SegmentedControl`: Radix toggle-group, single selection.
   - `Tab` and `Tabs`: Radix tabs when it switches panels, toggle-group when it only filters.

   Commit: "New look phase 2: toggle primitives".
5. **Chips and tags:** `Chip`, `ChoiceChip`, `PlatformChip`, `PlatformLogo`, `Tag`, `DetailTag`, `Status`. `PlatformLogo` draws the existing marks from `lib/templates/platformIcons.tsx` in `currentColor`. Commit: "New look phase 2: chip and tag primitives".
6. **Navigation, menus and overlays:** `NavItem`, `SettingsRailItem`, `Avatar`, `Menu` and its parts (Radix dropdown-menu), `Tooltip` (Radix tooltip with the Figma surface), `Toast`. Commit: "New look phase 2: navigation and menu primitives".
7. **Previews and containers:** `PreviewOverlay`, `ResultCard`, `LookTile`, `Card`, `SettingsCard`, `Stat`, `Metric`, `Modal` (Radix dialog over `--overlay-scrim`), `Progress`, `ProgressBar`. Commit: "New look phase 2: preview and container primitives".

After each family, check two things: its rows on `/dev/ui` are complete in both columns, and `npm run shots -- compare` against `.shots/fixtures` still shows no change on any existing route.

### Step 5: the `/dev/ui` gate

1. **Capture.** `npm run shots -- capture .shots/ui --only dev-ui --width 3172`.
2. **Compare.** Crop the table (its top 4532 px) and compare it with `docs/design/new-look/reference/interaction-states.png`. For this, add a `compare-image <a> <b> <out>` command to `shots.mjs` that writes the same heatmap `compare` does, for any two images.
3. **Review.** Text antialiasing differs between Figma and Chromium, so the heatmap will not be empty. Go row by row: every element, cell surface, tint, ring and caption must land where the reference draws it, in both columns.
   - Fix any element that is off.
   - List what is left in the PR, with a sentence each.
4. **Commit** the fixes: "New look phase 2: /dev/ui matches the Interaction states table".

### Step 6: docs

- `docs/ARCHITECTURE.md`, Theming section: add this paragraph after the token paragraph.

  ```
  Interface controls are the primitives in `src/app/components/primitives/`, one per
  component on the Figma file's Master UI Elements page, styled in
  `src/styles/primitives.css` with their interaction states built in and tested in the
  happy-dom Vitest project. In development, `/dev/ui` renders every primitive and the
  file's Interaction states table. Screens move onto the primitives in the phase that
  rebuilds them (`docs/design/new-look/PLAN.md`); the `.sp-btn`, `.sp-input` and
  `.sp-chat-*` classes stay until nothing uses them.
  ```

- `docs/design/new-look/README.md`, "The screenshot loop":
  - add the `dev-ui` and Generate thread routes, `--width` and `compare-image`
  - note that the fixture now carries Generate threads
- `docs/CI.md`: say that `npm test` runs a node project and a happy-dom project.
- `npm run verify` passes. Commit: "New look phase 2: docs".

### Step 7: the gate

1. **Build.**
   - `npm run verify` and `npm run build` pass.
   - The production build has no `/dev/ui` chunk.
   - `npm run preview` at `/dev/ui` renders the portal.
2. **Properties.** Run `props` against `.shots/props-before.json`, then `props-compare`. There must be no changes and no losses.
3. **`/dev/ui`.** Rerun step 5's comparison on the final code.
4. **Screens.** Run `capture .shots/after`, then `compare .shots/before .shots/after .shots/diff`.
   - Every route present in `.shots/before` is at 0%, except History (and Start, if it lists recent threads), which changed in step 1.
   - The two thread routes and `dev-ui` are new.
5. **Keyboard.** Tab through `/dev/ui`'s component sheet in both themes:
   - every control shows the ring its component uses, and text fields show the caret
   - menus open and move by keyboard; segments and tabs move with the arrow keys
   - a Field with an error announces it: `aria-describedby` resolves to the message
6. **Open the pull request** into `main`: "New look, Phase 2: primitives". The description covers:
   - the primitives and their test coverage
   - the `/dev/ui` comparison and what it leaves
   - the `compare` table
   - the fixture threads
   - every ruling from §8 that shows on `/dev/ui`
   - anything that surprised you

## 6. Out of scope (do not do these here)

- **Screens.** Moving any screen or existing component onto a primitive, and deleting or changing any legacy class, wrapper or token. Each area phase does that for its screens; Phase 9 removes what is left.
- **Components owned by later phases.** The Sidebar, Account, Logo, Composer, Message bubble, Assistant message and Gradient glow.
- **The template chat.** Its states on the local backend: Phase 4's first step adds the stand-in provider.
- **Tokens.** Editing the token JSON or `tokens.css`. A value the file lacks goes to Figma first (README, "Updating tokens").

## 7. Expected changes

- **On screen:** none. Every route captured in `.shots/before` is unchanged, except History (and Start, if it lists recent threads), which now shows the fixture threads.
- **New:** `/dev/ui` (development only), and the two Generate thread routes in the screenshot loop.
- **Copy:** none on any screen. `/dev/ui` copy comes verbatim from the frame.

## 8. Rulings on what the file leaves open

Where the file and RULES disagree, the file wins (RULES, opening line), and the PR records each case that shows on `/dev/ui`.

| Item | Ruling |
|---|---|
| Disabled opacity | 0.4 with no hover everywhere; 0.32 on the Stepper button, as drawn. Input, Select, Field and Switch have no disabled variant in the file, so they use the same 0.4 rule. |
| Input Small radius | 7, as drawn. RULES §4 says 9 for inputs; the file wins. |
| Select Default height | 36, as drawn; Input Default is 40. The Large select (40) is the one that sits beside inputs in forms. |
| Search field open | No tint. The caret shows, as the description says. |
| Choice chip focus | 2 px out, as drawn. RULES §6 does not list it among the tight rings. |
| Detail tag focus | The ring wraps the remove button only, as drawn. |
| Tag Default and Overlay | Not interactive: they render a `span`, with no hover and no focus. |
| Raw glyphs | Filter chevron: lucide `ChevronDown` at 16 (the frame's 9 × 4.5 vector is lucide's chevron at that size). Search clear: lucide `X` at 14 in a 24 × 24 hit area. Send's Stop: a 12 × 12 square at `--radius-xs`. |
| Theme toggle radius | `--radius-pill`. The file has a raw 999. |
| Ghost icon button selected | Only on raised surfaces, where `--state-selected` reads. On the page it would vanish in Light. |
| Result card download | The Filled Icon button at its standard 32. The file draws this instance at 34. |
| Lit edges | Result card, Card, Settings card, Menu and Modal take their elevation composite and no stroke, since the composites carry the Dark bevel (RULES §4). Toast keeps its `--border-raised` stroke and Tooltip its `--border-default` stroke, as drawn. |
| Toast action | A text button: label in `.t-button-m`, the hover tint over transparent, and the 2 px-out ring. The file draws plain text. |
| Modal scrim | `--overlay-scrim`. The component has none. |
| Status in Dark | Positive and Active render the same in Dark, as drawn. |
| Off-scale spacing | Kept as drawn, with the node named in a comment. The reference lists each one. |

For the area phases, today's variants map onto Button like this:

- **Primary:** `.sp-btn-primary` and `kind=primary`.
- **Neutral and Neutral on page:** ghost, tertiary, secondary and plain `.sp-btn` become Neutral inside cards and panels, and Neutral on page on the page.
- **Destructive:** `.sp-btn-danger`, `data-tone="danger"` and destructive confirms.
- **The chat button's accent kind** (Public link) becomes Neutral on page (PLAN decision 7).
- **Size:** `.sp-btn-lg` becomes Large.

## 9. Decisions (CJ, 2026-10-04)

1. **Scope.** Phase 2 builds the primitives, `/dev/ui` and the tests, and leaves every screen as it is. Each screen changes once, in the phase that rebuilds it to its frame.
2. **The template chat on the local backend** waits for Phase 4. Its first step adds a stand-in provider that runs only on the local backend, never in a production build, and answers from the sample workspace, never SocialPaint content.
3. **Component tests.** `@testing-library/react`, `@testing-library/dom`, `@testing-library/user-event` and `happy-dom` are added as dev dependencies. Node stays the default environment; `*.test.tsx` runs in a happy-dom project.
4. **Field.** It has error text and no hint text (RULES §9). The error goes under the input as the Figma Field shows. Area phases remove today's hints as they rebuild their forms; where a hint stated a rule, the rule shows as the error when it is broken.
