# New look, Phase 4: Brand Templates

You are a senior front-end engineer on SocialPaint (this repository). This phase rebuilds the Brand Templates area to the Figma file "Master UX-UI":

- **The library** (`/templates`): the filter bar, the shelves, platform filtering and search.
- **The fill page** (`/templates/:id`): the Edit details layout (PLAN decision 7). The public link page (`/l/:token`) shares its form.
- **The template chat** (`/templates/:id/chat`), reached from the fill page's "Use AI to assist".
- **The Public links dialog.**

Its first step is the stand-in provider that lets the template chat run on the local backend. Every screen in the area moves onto the Phase 2 primitives and matches its frame in both themes.

Be exact. Work through the steps in §5 in order, run the checks each step names, and commit after each step with `npm run verify` green (chain the commit on it: `npm run verify && git commit`). If something here turns out to be wrong once you are in the code, stop and explain the conflict instead of improvising.

---

## 1. Read these first

1. `docs/design/new-look/PLAN.md` (decision 7 in full), `RULES.md`, `BRIDGE.md`, `PHASE-2.md` and `PHASE-3.md`.
2. `docs/design/new-look/PHASE-4-SCREENS.md` in full ("the reference"):
   - **Part A, the library:** 13:5776, 13:6310, 13:6511 (Light) and their Dark twins.
   - **Part B, the fill page:** 156:674, and after a download 159:716.
   - **Part C, the template chat:** 13:7064 Questions, 13:7358 Building, 13:7744 Result, 13:8148 Edit details, 13:8464 Public links. Plus the Public links dialog on its own, 168:758.
3. The reference images in `docs/design/new-look/reference/` named in the reference's header.
4. The code, as the survey in this prompt's history found it:
   - **Library:** `Portal.tsx` and `templates/*`.
   - **Fill page:** `TemplateUsePage.tsx`, `TemplateFill.tsx`, `FieldInput.tsx` and `src/app/public/PublicFillPage.tsx`.
   - **Template chat:** `generate/TemplateChatPage.tsx`, and in `GeneratePage.tsx` `GenerateChat` in template mode.
   - **Chat pieces:** `InterviewView.tsx`, `LookPicker.tsx`, `EditorPanel.tsx`, `AssistantTurnView.tsx`, `Composer.tsx` and `admin/TemplateLinksDialog.tsx`.
   - **Logic:** `src/lib/generate/interview.ts`, `chatReducer.ts` and `chatRun.ts`.
5. The local backend: `LocalGenerateProvider` (`src/lib/stores/local/localStores.ts`, about line 633) and the `GenerateProvider` interface (`interfaces.ts`, about 276).

## 2. What changes

| Surface | Today | After this phase | Figma |
|---|---|---|---|
| Template chat on the local backend | Redirects to the fill page; "Use AI to assist" is hidden | A stand-in provider answers from the sample workspace; the chat runs end to end locally | none (PLAN, "The code at the start") |
| Library filter bar | `TemplateSearchField`, `GroupChips` (`.sp-platform-chip`) | `SearchField` and `PlatformChip` / `PlatformLogo`, in a horizontally scrolling chip rail with the shelf fade | 13:5776 |
| Shelves and cards | `PlatformShelf`, `TemplateCard` (look-cycling, look dots, raw colours) | Shelf heading in `.t-title-panel`, "View all", a card shaped like `ResultCard` with the go button | 13:5776 |
| Platform and search results | `.sp-resultline`, `ResultGroup` | The result line ("5 templates · Instagram", Clear), groups with a count, a three-column grid, tags on search results | 13:6310, 13:6511 |
| Fill page | A step-by-step form (step rail, Back/Next, finish step) beside a "Preview" card | The graphic on a sunken stage and one **Details** panel: Look, every field, Photo, Caption, then Download PNG; after a download, Download again and Post to LinkedIn | 156:674, 159:716 |
| Fill page header | A back button, Bulk fill and Public link (ghost), Use AI to assist (primary) | Breadcrumb "Brand Templates / {template}" with three neutral buttons: Use AI to assist, Bulk fill, Public link | 156:674 |
| Public link page | `TemplateFill` inside `PublicFrame` | The same new form, without the sidebar and header buttons | none (PLAN decision 7) |
| Template chat | `GenerateChat` in template mode on Generate's markup | The thread, composer and editor on new components, per §9 D1 | 13:7064 to 13:8464 |
| Public links dialog | Hand-rolled `role="dialog"` | `Modal` with the new link form and the link rows | 13:8464, 168:758 |

## 3. Invariants

- **Every route and role stays as it is.** `src/app/routes.test.ts` keeps passing. Members and admins see the library the same way. Bulk fill and Public link stay admin-only, and "Use AI to assist" shows where the template chat can run.
- **Generate stays as it is** (Phase 5), apart from what §9 D1 decides. Generate's start screen keeps its setup notice on the local backend (§9 D2).
- **Multi-tenant.** The stand-in provider answers only from the workspace's own templates (the sample workspace "Acme Studios" on the local backend), and never with SocialPaint content. It exists only on the local backend, never in a production build (PLAN, "The code at the start").
- **Tokens and primitives only** in what this phase rebuilds (RULES §3 to §6). New code reads no legacy name.
- **Shared code keeps its other users.** Where a component this phase rebuilds is also used outside the area, the in-area call sites move to the new code and the others keep theirs until their phase:
  - `GroupChips` and `TemplateSearchField` are also used by Generate History, the Template Builder and the size gallery.
  - `FieldInput` is also used by Generate's editor and composer.
  - `.sp-filterbar` and `.sp-emptystate` are also used by Generate.

  §9 D7 covers the links dialog.
- **Behavior that stays:**
  - the library's URL state (`?platform=&q=`), its search semantics and chip counts
  - the export path (`exportPng`, usage instrumentation)
  - the LinkedIn flow (`openLinkedInComposer` opens the composer and copies the caption)
  - the public link draft, the image upload and crop flows
  - the interview's client-side questions

## 4. Before you change anything

1. Work on `feat/new-look-phase-4`, branched from `main`.
2. Baseline: `npm run shots -- capture .shots/before` and `npm run shots -- props .shots/props-before.json`.

## 5. Steps

### Step 1: the stand-in provider and template chat fixtures

- **A local provider for template chats** (§9 D2).
  - On the local backend, in development builds only, the template chat runs while Generate does not.
  - Give the provider interface a separate gate for template chats (for example `isTemplateChatAvailable()`, true where `isConfigured()` is, and on the local backend in a dev build).
  - `TemplateUsePage` (`canAssist`) and `TemplateChatPage` read it. `GeneratePage` keeps reading `isConfigured()`.
- **`generate()` on the local backend** answers a template chat request (`templateIdHint` set) and refuses anything else, as today. It:
  - fills the hinted template:
    - the interview's `details` merged verbatim, as the server does in `generateValidate.ts`
    - every other text field from its own placeholder
    - image fields left for the member
  - builds the caption from the template's `captionTemplate` (`mergeCaption`)
  - returns one proposal with a `reply` and a `title`
  - when `allowQuestion` is set and nothing was given, returns a `question` instead (proposed copy: "What should the post say?")
  - waits a short, fixed delay, so the Building state shows
  - `repair()` returns the values unchanged.
- **Tests** for the provider: details merged verbatim, placeholders fill the rest, the caption is merged, a request without `templateIdHint` refuses, and the gate is false in a production build.
- **Fixture.** Add one saved template chat to the fixture: `templateId` set to "Product launch", a finished result with two looks available. Build it the way Phase 2's Generate threads were built, through `toStoredThread` and checked with `fromStoredThread`.
- **Screenshot routes:**
  - `template-chat`: Questions, at `/templates/<product launch>/chat`.
  - `template-chat-result`: the saved chat.
  - `template-chat-edit`: the saved chat with `?edit=<draft>`.
- `npm run verify` passes. Commit: "New look phase 4: a stand-in provider for the template chat".

### Step 2: the library

Build to Part A on the primitives. The page header is Phase 3's.

- **Filter bar** (13:5776).
  - `SearchField` (collapsed 50, open 440), then the chip rail: `PlatformChip` × All and the platforms in today's order, gap 7.
  - The rail scrolls horizontally behind the shelf rails' fade (`useEdgeFade`), and keeps its sticky pin (the sentinel and `data-pinned`).
  - The chips keep `GroupChips`' radiogroup keyboard: roving tabindex, arrows, Home and End.
  - A chip has no menu (none is drawn). Selected, its chevron turns down, as the component draws it.
- **Shelves.**
  - The heading is `.t-title-panel`. "View all" is the underlined text link on the right, selecting the shelf's platform as today.
  - The rail gap is 16, cards are 302 wide, and the right edge fades over 96 to `--surface-page`.
  - Space between shelves, as drawn: 32.
- **Template card.**
  - Built from the `ResultCard` anatomy: padding 8, `--radius-card`, `--elevation-small`, the preview at its aspect ratio with radius 15.
  - Title in `.t-label-l`; meta "{W} × {H}" plus " · {n} looks" when it has several looks, in `.t-caption-s` and `--text-secondary`.
  - A 32 filled `IconButton` go arrow.
  - Hover and focus per §9 D6.
  - The look dots and their raw colours go.
- **Results** (13:6310 and 13:6511).
  - **Result line:** "{n} templates · {Platform}" or "{n} results for “{q}”" in the mono eyebrow style (`.t-mono-eyebrow`), and a small "Clear" `Button` (neutral on page).
  - **Groups:** each with its label and "{n} templates" count, in a three-column grid of 327 cards (gap as drawn, 17, commented).
  - **Search results:** cards show their tags (§8).
  - **Spacing as drawn:** 24 between groups under a platform, 28 under a search.
- **Empty, no-results and loading** are not drawn. They keep today's content and copy, rebuilt on the primitives: `Button`, the page column, and a skeleton in the new card shape.
- **Cleanup.** Delete the legacy rules this replaces that nothing else uses. `GroupChips`, `TemplateSearchField`, `.sp-filterbar`, `.sp-emptystate` and the rail fade stay for their other users (§3).
- **Commit.** `npm run verify` passes. Commit: "New look phase 4: the library".

### Step 3: the fill page and the public link page

Build to Part B.

- **Header.**
  - **Breadcrumb:** "Brand Templates" (a link, `.t-label-m`, `--text-secondary`), "/", then the template's name (`.t-label-m`, `--text-strong`), gap 8.
  - Build the breadcrumb once, as a shell piece in `layout/` with its styles in `shell.css`, because the template chat and Generate (Phase 5) use it too.
  - **Actions:** neutral-on-page `Button`s with icons: "Use AI to assist" (Sparkles), "Bulk fill" (LayoutGrid), "Public link" (Link). Each keeps its current condition.
- **Split.** Under the header, gap 24.
  - The **stage** fills the rest: `--control-fill`, radius 20, padding 40, the graphic centred at its aspect ratio with radius 20 and `--elevation-small`, the `SchemaRenderer` as today.
  - The **Details panel** is fixed at 380.
- **Details panel** (shared with the template chat's Edit details, §9 D4):
  - Container: padding 20, gap 16, `--radius-card`, `--surface-raised`, `--elevation-small`. Title "Details" in `.t-title-card`.
  - Fields, in the template's order (gap 12): "Look" (a `SegmentedControl` of the template's looks, when it has more than one), then every member field as a `Field` with `Input` or `TextArea`, the image fields as a `Field` with the Upload control (§9 D5), then "Caption" (a `TextArea`).
  - A field the template marks optional shows "Optional" right of its label; Caption has the "Copy text" Action (§9 D3, D8). The fill page never shows Edited.
  - The fields scroll inside the panel; its title and footer stay fixed (not drawn; ruled in §8).
- **Footer.**
  - **Before a download:** one full-width primary `Button` (lg) "Download PNG".
  - **After a download:** "Download again" (neutral, lg, hugging its label) and "Post to LinkedIn" (primary, lg, the rest of the width, with the LinkedIn mark). Post to LinkedIn runs today's `openLinkedInComposer` with the caption.
- **Required fields.** A required field that is empty when the person presses Download shows its error under the control (Phase 2 `Field`), and focus moves to the first one (`focusFirstInvalid`). The download waits until they are filled. This replaces today's disabled button and "Fill required: …" line (RULES §9). Error strings are proposed copy (§7).
- **The step form goes:** the step rail, the steps, Back and Next, the finish step, "Suggested caption" and "Reset to suggestion" (§9 D8), and the Preview card.
- **The toast.** Today's export toast (downloaded, shared, error, popup blocked) moves onto the `Toast` primitive, keeping its copy.
- **The public link page** renders the same form inside `PublicFrame`: no sidebar, no header buttons. `allowUploads` and the draft behave as today. The public page cannot render on the local backend (it reads an Edge Function), so add a component test that renders the form in its public configuration and checks:
  - no header buttons
  - no image field when `allowUploads` is false
  - the draft values restore
- **`FieldInput`** keeps its `variant="chat"` users (Generate's editor and composer, Phase 5). The fill page stops using it, apart from the image upload logic it shares (§9 D5).
- `npm run verify` passes. Commit: "New look phase 4: the fill page".

### Step 4: the template chat

Build to Part C, per §9 D1.

- **Header.** The breadcrumb "Brand Templates / {template}", with:
  - "Fill in by hand" (neutral, pencil; back to the fill page)
  - "Bulk fill" (neutral, layout grid; admin)
  - "Public link" (primary, link icon; admin), Deep Moss as drawn

  Edit details adds " / Edit details" to the breadcrumb and shows one "Back to chat" (neutral, arrow-left).
- **Questions** (13:7064).
  - **Thread:** the assistant's intro with the template's thumbnail (112 × 140), each question as assistant text, each answer as a message bubble, and "Skipped" for a skipped one.
  - **The photo question** offers "Skip" and "Back" `Chip`s.
  - **The composer:** an `AttachButton`, the text field, and `SendButton`. It has no platform select or variations stepper (§9 D1). Its placeholder per state, as drawn: "Attach a photo with the plus" on the photo question, otherwise "Anything to add while the paint’s still wet?"
- **Building** (13:7358). The photo answer as a 64 thumbnail, then "Filling in {template}.", then `Progress` with today's step labels (`runCopy`), and skeletons for the result card, the look picker and the caption card. Send shows Stop.
- **Result** (13:7744).
  - The reply text.
  - The fill-in row: "Fill in" and a `Tag` kind Missing per gap.
  - The `ResultCard` (Edit opens Edit details; Download).
  - The look picker card: `LookTile`s in a radiogroup on a sunken well, with "Look" and the look's name under it.
  - The Caption card: the caption with a copy `IconButton`.
- **Edit details** (13:8148). A split view:
  - The stage, with the composer under it.
  - The Details panel (§9 D4) titled "Edit details", with a close `IconButton`, the template's fields, and the footer "Discard" (neutral) and "Download PNG" (primary).
  - A field whose value differs from when the panel opened shows Edited (§9 D3, D4). Missing and Too long show on the Field's error line.
- **Public links** opens the dialog from step 5.
- **Behavior stays.** The interview, runs, follow-ups, saving, looks, edits and downloads keep their logic (`useChatController`, `chatReducer`, `chatRun`, `interview.ts`). Only the views change.
- `npm run verify` passes. Commit: "New look phase 4: the template chat".

### Step 5: the Public links dialog

- `TemplateLinksDialog` becomes a `Modal` (560, `--overlay-scrim`), titled "Public links" with the link icon. The geometry is Part C's Public links.
  - **New link:** Name, "Stops working after", "Open limit", Look ("Visitor chooses" and the looks), and "Allow photo uploads" (a `Switch`), then a full-width primary "Create link".
  - **Links:** one row per link. Each row shows its name and an `Active` `Status`, then "New address" and "Revoke" as small neutral `Button`s. Below those it has `Stat`s (Created, Expires, Opens, Last used), its Look `Select` and its Photo uploads `Switch`.
  - **Keep** today's behavior: the address is shown once, with "Copy link", when a link is created or gets a new address, and revoking and regenerating are confirmed.
- **Scope** per §9 D7.
- `npm run verify` passes. Commit: "New look phase 4: the Public links dialog".

### Step 6: legacy names and docs

- **Delete** the legacy rules and names that only this phase's replaced code read. BRIDGE §3 loses the readers that are gone (`--shadow-rest` on platform chips and the filter bar search, `--edit-chip-bg`/`--media-overlay` where previews moved).
- **Update** `docs/ARCHITECTURE.md`: the fill page's Details panel, the template chat's stand-in on the local backend, and the breadcrumb.
- `npm run tokens:check` and `npm run verify` pass. Commit: "New look phase 4: legacy names and docs".

### Step 7: the gate

1. **Build.** `npm run verify` and `npm run build` pass.
   - The production bundle has no stand-in provider: `rg` the build for its reply strings.
2. **Reachability.** `routes.test.ts` passes. Then click through by hand on the local backend in both roles:
   - The library: a chip, search, Clear and View all.
   - A card opens the fill page.
   - Use AI to assist opens the template chat. Answer the questions, build, open Edit details, Discard, then Back to chat.
   - Fill in by hand returns to the fill page.
   - Download, then Post to LinkedIn. Confirm the window and the copied caption.
   - Public link opens the dialog (admin).
   - A member sees no Bulk fill and no Public link.
3. **Screens.** Run `capture .shots/after`, then `compare .shots/before .shots/after .shots/diff`.
   - **Expected changes:** `brand-templates`, `template-fill`, and the new `template-chat*` routes.
   - **Generate unchanged:** Generate's routes stay at 0%, unless §9 D1 says otherwise.
   - **Everything else** stays at 0%.
   - **Side by side with the reference images,** Light and Dark: the library default, platform and search; the fill page before and after a download; the five template chat states and the dialog. Capture the states the routes don't reach (platform, search, after a download, Building, the dialog) by script.
4. **Keyboard**, both themes:
   - The library: search, the chips' arrow keys, shelf tracks and cards.
   - The fill page: header buttons, Look, fields, Download and the error focus.
   - The template chat: composer, chips, look tiles, Edit details and the dialog, where focus stays inside and Escape closes.
5. **Open the pull request** into `main`: "New look, Phase 4: Brand Templates". Include:
   - what changed
   - the `compare` table and the side by sides
   - every ruling and decision as built
   - the proposed copy
   - anything that surprised you

## 6. Out of scope (do not do these here)

- **Generate:** its start, threads, History and its own result layout (Phase 5), except as §9 D1 decides.
- **Other users of shared code:** the Template Builder and the size gallery's use of the shared search field, chips and rail fade.
- **Bulk fill's page** (its own design is not drawn; it keeps its Phase 3 header).
- **A design for the public link page beyond the shared form** (PLAN, Scope).
- **Admin actions in the library:** none are drawn.

## 7. Expected changes

- **Changes:** the library, the fill page, the public link page's form, the template chat and the Public links dialog, all as §2 describes.
- **Unchanged:** every other screen, apart from §9 D1 and D7.
- **New copy from the frames:**
  - the fill page: "Details", "Download again", "Post to LinkedIn"
  - the template chat: "Fill in by hand", "Back to chat", "Edit details", "Discard", "Skipped", "Look", "Caption", "Filling in {template}.", "Attach a photo with the plus", "Anything to add while the paint’s still wet?", the intro "Let’s fill in {template}. I’ve got {n} questions for you. The last ones are optional."
  - the library: "Clear", "{n} templates · {Platform}", "{n} results for “{q}”"
- **Proposed** (not in the frames; list in the PR):
  - the required-field error, for example "Fill in {label}."
  - the stand-in's question, "What should the post say?"
  - the stand-in's reply and title
  - the photo field's "Add a photo" and "Replace" (§9 D5)
  - "Copy text" and "Copied" on the Caption field (§9 D8)
- **Copy that goes:** the step form's labels and helper lines ("Step 0N of 0M", "Fill required: …", the LinkedIn helper lines), "Suggested caption", "Reset to suggestion" (§9 D8), the image field's source tabs and "Adjust crop" (§9 D5), and "Preview". List each in the PR.

## 8. Rulings on what the file leaves open

| Item | Ruling |
|---|---|
| Platform chip menu | None. A chip filters as today; selected, its chevron turns down, as the component draws it. |
| Chip rail overflow | Scrolls horizontally behind the same 96 fade as the shelves. (The search frame silently drops chips.) |
| Search and a platform together | As today: the query first, then the chip, with chip counts from the searched set. |
| Spacing that differs by state | As drawn per state: 32 between shelves, 24 between platform groups, 28 between search groups; 16 rail gap; 17 grid gap (commented). |
| Card meta and result line type | `.t-caption-s` for the meta (the frame's 12/1.4) and `.t-mono-eyebrow` for the result line. The nearest classes, noted in the PR. |
| Go button | The filled `IconButton` at its standard 32 (the frame draws 34). |
| Card tags in search results | `Tag` kind default: they label the template and do nothing when pressed. The frame draws the Filter look (a button style); noted in the PR. |
| Details panel overflow | The fields scroll inside the panel; the title and footer stay put. |
| Chat chips | The `Chip` primitive (`--control-fill`). The frame's `--surface-sunken` is the same colour in Light. |
| Composer in template mode | No platform select or variations stepper, as drawn. |
| Progress copy | Today's step labels (`runCopy`); the frame shows only step 2's ("2 of 3 · Rendering your draft"). |
| Public link button | Deep Moss in the template chat header (as drawn) and neutral on the fill page (PLAN decision 7). |
| Status pill size | `Status` default size, in both themes. The Light frame draws small; the Dark frame draws default. |

## 9. Decisions (CJ, 2026-10-04)

The Figma changes these lean on are in the Master file.

1. **D1. Chat components.** Phase 4 builds the Composer, Message bubble and Assistant message to their Master frames (61:504, 61:505, 61:532) and moves only the template chat onto them. Generate keeps its current chat until Phase 5, which moves it over and deletes the old component, so Generate's screens stay at 0% in this phase.
2. **D2. The stand-in's switch.** The template chat gets its own switch, `isTemplateChatAvailable()`, so Generate keeps its setup notice locally (it reads `isConfigured()`). The stand-in runs only on the local backend, never in a production build, and the local `generate()` answers only template chat requests (`templateIdHint` set). Phase 5 extends it to Generate and folds the two switches into one.
3. **D3. Field markers.** The Figma Field (48:38) has, besides Error:
   - **Edited:** a 6 px `--state-selection` dot and the word in Caption/S, 5 apart, 8 after the label.
   - **Optional:** right-aligned on the label row.
   - **Action:** a text action at the far right of the label row, Label/XS on `--text-strong`.
   - **Control:** swaps the Input for Upload (D5).

   Example frame 217:2271. Missing and Too long, which the editor shows today as red-dot statuses, move to the Field's error line, so the label row only ever shows Edited. Today's "(required)" suffix goes: required is the default. The markers are not hint text (RULES §9).
4. **D4. One Details panel,** configured per place. The fields come from the template in both.
   - **Title:** "Details" on the fill page; "Edit details" in the chat, which also has the header close.
   - **Footer:** "Download PNG" on the fill page, then "Download again" and "Post to LinkedIn" after a download; "Discard" and "Download PNG" in the chat.
   - **Photo:** the fill page shows the Photo field. In the chat the turn's photo fills its slot, so only image slots it leaves empty show, as today.
   - **Edited:** in the chat only, when a value differs from when the panel opened. The fill page never shows it.
5. **D5. The photo field** is drawn: Upload (216:2291), Value Empty or Filled, State Default or Hover, with Focus.
   - The whole row is one button that opens today's picker (brand images or a device file; the device alone on the public link page). A file dropped on the row takes the same road, and every pick opens the cropper.
   - **Empty** reads "Add a photo", built like the inputs' placeholders ("Add" plus the label with its article).
   - **Filled** shows the picked file's or brand image's name (the field label when there is none) and "Replace".
   - Today's inline source tabs and the "Adjust crop" link go; re-cropping is Replace.
   - The image logic moves out of `FieldInput` into a shared module, so Generate's composer keeps working.
6. **D6. The template card.** It stays one button that opens the fill page, and stops cycling looks. On hover and keyboard focus it shows the drawn preview hover (Result card 104:602 and the Interaction states rule; `PreviewOverlay` builds it): the `--overlay-hover` dim and the Edit circle, as part of the card's look, `aria-hidden` and not a second button.
7. **D7. The Public links dialog** is rebuilt once, to 168:758 and 168:846, and used from all three places: the template chat, the fill page, and the Template Builder and Settings › Sharing. The buttons that open it in the Template Builder and Settings › Sharing stay as they are until their phases.
8. **D8. Caption tools.** "Reset to suggestion" goes; copying stays. Post to LinkedIn only copies on its way to LinkedIn and only appears after a download, and the chat's Result draws a Copy caption button. So the Caption field on all six panel frames (fill page, Downloaded and Edit details, Light and Dark) has a "Copy text" Action at the right of its label row (D3). It reads "Copied" for 1.6 s after a click, as today. The caption keeps following the fields until the person types in it.
9. **D9. Download again.** PLAN decision 7 and the Downloaded frames already say it.
