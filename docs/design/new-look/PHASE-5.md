# New look, Phase 5: Generate

You are a senior front-end engineer on SocialPaint (this repository). This phase rebuilds Generate to the Figma file "Master UX-UI":

- **Start** (`/generate`): the greeting, the Composer with its platform select and Variations stepper, the attach menu, and Recent.
- **The thread** (`/generate/c/:id`): the person's messages, the assistant's turns while they build and once they are done, the caption card, Try next and the composer dock.
- **The editor**: Edit details beside the narrowed chat, with the size switch.
- **History** (`/generate/history`).

It finishes what Phase 4 started (PHASE-4.md §9 D1 and D2):
- Generate moves onto the Composer, Message bubble and Assistant message that Phase 4 built for the template chat, and the legacy chat views are deleted.
- The local stand-in answers Generate too, behind one switch.

Be exact. Work through the steps in §5 in order, run the checks each step names, and commit after each step with `npm run verify` green (chain the commit on it: `npm run verify && git commit`). If something here turns out to be wrong once you are in the code, stop and explain the conflict instead of improvising.

**A note on familiar interactions.** CJ has asked to keep interactions people already use when a frame leaves them out (the library's look-stepping hover and the fill page's steps came back after Phase 4). §9 records what CJ decided for each interaction the frames drop. If you find another one, stop and ask.

---

## 1. Read these first

1. `docs/design/new-look/PLAN.md` (decision 7 and its amendment), `RULES.md`, `BRIDGE.md`, `PHASE-2.md`, `PHASE-3.md` and `PHASE-4.md` (§9).
2. `docs/design/new-look/PHASE-5-SCREENS.md` in full ("the reference"):
   - **Part A:** Start 13:1453, Attach menu 13:1601, Connectors 13:1850, Add a detail 13:2140.
   - **Part B:** Photo attached 13:2301, Details added 13:2454, Sent 13:2639, Generating 13:2824.
   - **Part C:** Result 13:2985, Edit 13:3150, History 13:3359.
   - Each Light frame's Dark twin is listed there.
3. The reference images `docs/design/new-look/reference/generate-*.png`.
4. The code:
   - **Pages:** `generate/GeneratePage.tsx` (`GenerateChat`, its Start and thread branches, `SavedChat`) and `generate/GenerateHistoryPage.tsx`.
   - **Legacy views:** `Composer.tsx` (the view; its behaviour is `useComposer`), `AttachMenu.tsx`, `PlatformSelect.tsx`, `VariationsStepper.tsx`, `UserMessage.tsx`, `AssistantTurnView.tsx`, `DraftCard.tsx`, `DraftCardSkeleton.tsx`, `CaptionCard.tsx`, `SuggestionChip.tsx`, `RecentChats.tsx`, `RecentCard.tsx`, `HistoryCard.tsx`, `EditorPanel.tsx` (the legacy branch), `ChatHeader.tsx`, `ChatButton.tsx` and `ScrollFade.tsx`.
   - **New-look pieces Phase 4 built:** `chat/ChatComposer.tsx`, `chat/Messages.tsx`, `chat/TemplateChatViews.tsx`, `details/DetailsPanel.tsx`, `templates/PlatformFilter.tsx`, `templates/LibrarySearch.tsx`, and the primitives.
   - **Logic:** `src/lib/generate/*` (`chatReducer`, `chatRun`, `runCopy`, `tryNext`, `linkedFields`, `details`, `draftView`).
   - **Server:** `supabase/functions/template-generate/index.ts` (how `details` are read, about line 924) and `supabase/functions/_shared/generateValidate.ts`.
5. The local stand-in: `src/lib/stores/local/templateChatStandIn.ts` and `LocalGenerateProvider`.

## 2. What changes

| Surface | Today | After this phase | Figma |
|---|---|---|---|
| Generate on the local backend | "Generate isn't available on this backend" | The stand-in answers library requests too; one switch (`isConfigured()`) for both chats | none (PHASE-4.md §9 D2) |
| Start | 26px greeting with a sub-line, the legacy chat box, Start from chips, the library-empty note, Recent 4 across | The 40px greeting, the Composer with the Compact select and Stepper, Recent as one row of three, legal links unlined; no Start from row, no sub-line, no library-empty note | 13:1453 |
| Attach menu | One UPLOAD section: Photo, File, Brand Studio | The new menu: UPLOAD (Photo, File, Brand Studio) and DETAILS (Headline, Date & time, Location, Link), placed under the composer; Add a detail in its place | 13:1601, 13:2140 |
| Composer | Legacy chat box: attachments row, platform select, Variations stepper | `ChatComposer` with the Compact select, Stepper, a Tags row of detail tags, and the new attachment tiles | 13:2301, 13:2454 |
| The person's message | Photo 160 × 107 over a bubble, legacy tags | The Message bubble, a 64 photo and file tiles above it, sent detail tags in the bubble | 13:2639 |
| The assistant's turn | Byline with the name, legacy progress, post-sketch skeletons, legacy cards | The Assistant message (mark only), Progress, a skeleton per expected draft, Result cards, one Caption card with its draft switch, Try next on Chips | 13:2639, 13:2824, 13:2985 |
| Thread chrome | Chat breadcrumb, tertiary History and secondary New chat, top fade, the Brand Studio footnote line | The shared breadcrumb, History neutral and New chat primary, top and bottom fades, legal links alone | 13:2985 |
| Editor | Legacy inline panel or sheet | The Phase 4 Details panel in the Edit frame's layout (chat narrows to 611, panel 380 with the size switch and its own stage), the sheet kept below 1180 | 13:3150 |
| History | Open search field, `GroupChips`, legacy cards, a description line | The library's filter bar (collapsed Search field, Platform chips for the platforms in use), the card grid with the library card's hover, paging; no description | 13:3359 |

## 3. Invariants

- **Every route and role stays as it is.** `src/app/routes.test.ts` keeps passing.
- **The template chat stays as Phase 4 built it.** It already renders on the new chat components. Shared pieces that change here (the caption card, the Result card's sizes, the skeletons) must leave its screens at 0%, apart from what §9 says for both chats.
- **Multi-tenant.** The stand-in answers only from the workspace's own templates and never with SocialPaint content. It exists only on the local backend in a development build.
- **Tokens and primitives only** in what this phase rebuilds. New code reads no legacy name.
- **Behaviour that stays,** drawn or not:
  - **Sending:** Enter sends, Shift+Enter breaks a line; Stop; the auto-grow to six lines.
  - **Attachments:** paste, drag and drop with its announcement, the upload chip while a file is read, and the photo and document error line.
  - **Chat notes:** "This chat is full", "This chat isn't saved yet", and the reopened chat's photo note.
  - **Saving:** saving and the first-save address change; reopening a saved chat; the gone-template card; New chat.
  - **The thread:** warnings, Try again, the Fill in row, compact cards while the editor is open, and the outlined draft being edited.
  - **The editor:** linked fields across sizes, its export error toast, and the sheet below 1180 with its Tab trap.
  - **History:** paging with loading cards, its URL state (`?platform=&q=`), and its empty, no-match and error states.
  - **Focus moves:** the composer on a new chat, and the History title on arrival.
  - Usage instrumentation and the photo never leaving the browser.

## 4. Before you change anything

1. Work on `feat/new-look-phase-5`, branched from `main`.
2. Baseline: `npm run shots -- capture .shots/before` and `npm run shots -- props .shots/props-before.json`.

## 5. Steps

### Step 1: the stand-in answers Generate, behind one switch

- **One switch** (PHASE-4.md §9 D2). `isTemplateChatAvailable()` goes. `isConfigured()` is true on Supabase, and on the local backend in a development build. Generate's local "isn't available" state then shows only in a production build on the local backend.
- **`generate()` on the local backend** answers library requests as well as template chats:
  - It picks up to `count` published templates, preferring the `platformHint`, in a fixed order.
  - It fills each one as the template chat stand-in does: the member's values verbatim, every other text field from its placeholder, and image fields left empty.
  - It merges each template's caption, returns a reply and a title, and waits the same fixed delay.
  - A follow-up keeps the previous drafts' values.
- **Freestyle requests** (`mode: "freestyle"`) are refused with today's message; the local backend has no model to design with.
- **Tests:** library requests, the platform preference, the count, follow-ups, refusing freestyle, and the switch being false in a production build.
- **Screenshot routes:** `generate` now renders the Start state's composer locally, so it is an expected change. Add `generate-thread-edit` (a saved thread with `?edit=`) for the editor.
- Commit: "New look phase 5: the stand-in answers Generate".

### Step 2: the Composer and Start

Build to Part A §1 and Part B §1.

- **The Composer.** Generate moves onto `ChatComposer`, which gains:
  - its `output` row: the `CompactSelect` (platform) and the `Stepper` (Variations) before Send, on the Start state only
  - the Tags row (built in step 3)
  - the attachment tiles of Part B: the 64 photo, and the file tile with its 50 type tile, the name without its extension, and the type (PDF, TXT or MD) on the second line (§9 D7)
- **Platform select.** The Compact select keeps today's menu: "Any platform" and each platform with its mark, dimming the platforms the library does not cover, with today's caption.
- **Variations stepper.** It keeps today's range (1 to 3), default of 2, labels ("Fewer variations", "More variations") and the number's roll (§9 D2): port the roll, and the end buttons staying focusable at the limits, into the `Stepper` primitive.
- **Start state:**
  - The greeting (`.t-title-metric`) sits 35 over the composer, with no sub-line.
  - No Start from row and no library-empty note (§9 D0). Remove the chips, the pin, the `/generate?template=` link (the `generate` route's `templateId`) and its router test. The server's `templateIdHint` stays: the template chat uses it.
  - Recent, 75 under the composer: one row of three cards in three columns, with View all (§9 D1). Recent cards take the library card's hover: the shadow deepens, no dim (§9 D11).
  - Legal links follow, not underlined.
  - The unavailable state (a production build on the local backend) and the 400ms reveal stay.
- Commit: "New look phase 5: the composer and Start".

### Step 3: the attach menu and details

Build to Part A §2 and §4, per §9 D3 to D6. The server change lands first in this step, as its own commit.

- **The menu's look.** 300 wide, Elevation/Medium, radius 16, the section labels and dividers, rows on the Menu item anatomy (icon 18, label, meta, chevron). It sits 10 under the composer box, keeping today's flip and scroll rules and its keyboard (arrows, Home and End, Escape, Tab, ArrowUp and ArrowDown on the closed plus).
- **Behind the menu:** the Recent row alone blurs 3px while the attach menu or Add a detail is open (§9 D6).
- **The plus tooltip** becomes "Add" (§9 D3).
- **Rows** (§9 D3):
  - UPLOAD: Photo, File, and Brand Studio (today's brand-image pick, §9 D5).
  - DETAILS: Headline, Date & time, Location, Link, each with a chevron.
  - No CONTEXT section and no Connectors.
- **Add a detail** (13:2140): the row's panel replaces the menu in place, with Back, the row's name, an Input and Add (Button primary, sm). Enter adds; Back returns to the menu; Escape closes and returns focus to the plus; an empty value can't be added. Date & time is typed as text.
- **Tags** (§9 D4): one per kind, in the Tags row, scrolling behind its fade.
  - Clicking a tag's value opens Add a detail filled in; its x removes it.
  - Choosing a kind that already has a tag edits that tag.
  - A tag goes with the message it was added to and shows in the sent bubble.
- **Server change first** (§9 D4). Today `template-generate` refuses details without a pinned template (a 400) and keys them by a template field. Give it generic details: a kind (headline, date, place, link) and a value, at most one per kind, given to the model as facts it uses wherever they fit, for library and freestyle runs alike. A template chat's field-keyed details keep working unchanged. Add tests, and deploy the function before the client change goes live; the PR says so.
- Commits: "New look phase 5: details on the server", then "New look phase 5: the attach menu and details".

### Step 4: the thread

Build to Part B §3 and §4 and Part C §1.

- **Header.** The shared breadcrumb (`layout/Breadcrumb.tsx`): "Generate" (not underlined) / the chat's title. History is Button neutral with its icon; New chat is Button primary.
- **The person's message:**
  - A right-aligned column: the 64 photo and the file tiles (no remove), then the Message bubble.
  - Sent detail tags go in the bubble's Tags slot, keeping each tag's accessible name "{label}: {value}".
- **The assistant's turn,** on the Assistant message (mark only):
  - **While it builds:** the status sentence and `Progress` (keeping today's progressbar wiring: 1 to 3, named by the sentence), then a skeleton Result card per expected draft at its aspect (`skeletonAspects`), then the caption card's loading state. Both are plain grey wells, as drawn (§9 D12).
  - **Once done:** the reply, then the Fill in row, the Result cards, the warnings, and the caption card with its draft switch and Copy (one `CaptionCard` for both chats; the template chat's has no switch).
  - **Result card labels** (§9 D9): the size alone on regular cards ("1080 × 1350", without the ratio); compact cards keep the platform name. Result cards keep the dim and the Edit button on hover and focus (104:602).
  - **Try next:** the row on `Chip`s with "Try next" in Caption/M.
  - **Failure:** Try again (Button neutral, sm).
- **Result card.** The `ResultCard` primitive grows what Generate needs:
  - a size (regular 264, compact 184) and fitting to the column
  - the editing outline (0.75 `--text-strong`) with `aria-current`
  - a blocked Download (40%, still opens the editor) and a busy one
  - the gone-template well
  - the provenance description

  The template chat keeps its look.
- **Fades:** the top fade (68) and a bottom fade (56) while there is more below.
- **The dock:** the compact Composer and the legal links alone (§9 D11).
- Commit: "New look phase 5: the thread".

### Step 5: the editor

Build to Part C §2, per §9 D8.

- **Layout.** The chat narrows to 611 and the panel (380) sits 24 beside it, from the header to the page's foot. Below 1180 the same panel is the sheet over a scrim, as today.
- **The panel** is the Phase 4 Details panel (`details/DetailsPanel.tsx`), which gains a size switch and a stage slot for Generate:
  - "Edit details" and Close
  - the size switch, a `SegmentedControl` with "Instagram · 4:5" segments (two or more drafts)
  - the 290 stage inside the panel (§8 for its fill), with the stage's first layout warning under it
  - the linked fields on `DetailField`: Optional, Edited markers, and Missing and Too long on each field's error line; the image slots the photo leaves on the Upload control
  - the footer: Discard and Download PNG; for admins on a freestyle draft, Save to library as a full-width neutral button above that row, with today's saved state ("Saved to Brand Templates." and Open in the builder) and error. "Edits update both sizes." goes.
- **Behaviour stays:** linked edits across sizes, focus on open and on a focus request, Escape, the export toast, and usage.
- Commit: "New look phase 5: the editor".

### Step 6: History

Build to Part C §3, per §9 D12.

- **Header:** the breadcrumb "Generate / History", the title in Title/Page, and New chat (primary). The description line goes.
- **Filter bar:** the library's, `LibrarySearch` collapsed to its icon (placeholder "Search chats") and `PlatformFilter` with an `allLabel` of "All chats" over the platforms the chats use (§9 D11), with the same sticky pin and rail fade.
- **The grid:** four columns of square History cards, 12 apart, with the loading cards finishing the last row and the 132 bottom fade.
- **Cards:** one button each, with the library card's hover: the shadow deepens, no dim (§9 D11). The empty, no-match and error states keep their copy, restyled.
- Commit: "New look phase 5: History".

### Step 7: legacy names and docs

- **Delete** the legacy Generate views nothing renders any more:
  - the legacy `Composer` view, `PlusButton`, `PlatformSelect`, `VariationsStepper` and the legacy `SendButton`
  - `UserMessage`, `AssistantHeader`, `AssistantTurnView`, `DraftCard`, `DraftCardSkeleton`, the legacy `CaptionCard`, `SuggestionChip` and `ChipRow`
  - `SegmentSwitch`, `ChatButton`, `ChatHeader`, `ChatBreadcrumb`, `EditorField` and the legacy `DetailTag`
  - `GroupChips`, when nothing else uses it

  Delete the `.sp-chat-*` rules and the `--gen-*` names only they read, and the template chat's remaining legacy layout classes once the thread frame, scroll and dock move.
- **BRIDGE §3:** drop the readers that are gone.
- **ARCHITECTURE:** Generate on the new look, the one switch, and details for Generate (generic kinds on the server).
- Commit: "New look phase 5: legacy names and docs".

### Step 8: the gate

1. **Build.** `npm run verify` and `npm run build` pass, and the production bundle has no stand-in.
2. **Reachability.** `routes.test.ts` passes. Click through on the local backend in both roles:
   - **Start:** add each kind of detail, edit one by clicking it, remove one, then send a brief with a photo and a file. While it builds, see the progress and skeletons.
   - **Result:** switch the caption between drafts, copy it, use a Try next chip.
   - **Editor:** open it, switch sizes, edit a field, download.
   - **History:** filter, search, open a chat.
   - **Editor:** Discard, and Save to library on a freestyle draft as an admin (the stand-in refuses freestyle, so check it with a component test).
3. **Screens.** `capture .shots/after`, then `compare .shots/before .shots/after .shots/diff`.
   - **Expected changes:** `generate*`.
   - **Template chat:** 0% unless §9 says otherwise.
   - **Everything else:** 0%.
   - **Side by side** with the reference images in Light and Dark: all eleven states, capturing those the routes don't reach by script.
4. **Keyboard**, both themes:
   - the composer, the platform select and the stepper
   - the attach menu and its sub-views
   - tags, the result cards, the caption switch and Try next
   - the editor (Escape, the sheet's trap)
   - History's search, chips and cards
5. **Open the pull request** into `main`: "New look, Phase 5: Generate". Include:
   - what changed
   - the `compare` table and side by sides
   - every ruling and decision as built
   - the proposed copy
   - surprises

## 6. Out of scope (do not do these here)

- Brand Studio, Settings and Insights (Phases 6 to 8).
- Connectors, Web page and Past post (the attach menu's CONTEXT section), each its own feature after the new look (§9 D3).
- The Template Builder and the size gallery's search field.

## 7. Expected changes

- **Changes:** Start, the thread, the editor and History, as §2 describes. The local backend now runs Generate in a development build.
- **Unchanged:** every other screen, apart from what §9 says for both chats.
- **New copy from the frames:**
  - the attach menu's sections and rows: "Upload" (Photo, File, Brand Studio), "Details" (Headline, Date & time, Location, Link)
  - "Add" on the detail panel
  - "All chats"
- **Proposed** (not in the frames; list in the PR):
  - each detail's placeholder
- **CJ's copy:** the plus tooltip "Add" (was "Add photos and files").
- **Copy that goes:**
  - the greeting's sub-line
  - "Start from", the chips' pinned placeholder ("Describe your {name} post…"), and "No published templates yet, so drafts come fresh from your brand kit."
  - "SocialPaint" beside the mark
  - "Every graphic follows your Brand Studio rules."
  - History's description line
  - "Edits update both sizes." / "Edits update every size."

  List each in the PR.

## 8. Rulings on what the file leaves open

| Item | Ruling |
|---|---|
| Greeting type | `.t-title-metric` (40, −0.03em); its 1.1 leading against the frame's 1.2 is noted in the PR. |
| Composer gap | Phase 4's 24 between untrimmed rows draws the frame's trimmed 30. |
| Composer edge | No visible ring: the 5px edge lies under the fill (Phase 4's gate fix). The frames' raw 25% / 6% values are not tokens. |
| Menu surfaces in Dark | All floating panels follow the attach menu: `--surface-raised`, Elevation/Medium, no stroke. The frames disagree with each other. |
| Menu label tracking | The frames' 0.08em goes into `MenuLabel`; it is a Menu primitive change, so `/dev/ui` is an expected change. |
| Open submenu parent | `--state-selected` (open menus count as selected); the frames' raw `#f1f1ef` is not a state token. |
| Add button | Button primary, sm (28); the frame draws 29. |
| Connected pill | `Status` positive, sm. |
| Tag rail | Scrolls sideways behind a 121 fade to `--surface-raised`, with 48 of room at its end, as drawn. |
| Chip fill in Dark | The `Chip` primitive's `--control-fill`; the frames' `--surface-sunken` is the same value in Light. |
| Editor stage fill | `--surface-sunken`, with the fill page's hairline, so a white graphic still reads; the frame draws none. |
| Download PNG height | Button primary, lg (44), full width; the frame's 59 is a padding artefact of the footer box. |
| Step 1 copy | Today's "Reading your brief"; the frame's step 1 names templates that are not known yet. |

## 9. Decisions (CJ, 2026-10-04)

Numbered as CJ gave them.

0. **D0. Start from chips go**, as drawn. "Use this one" exists only in code comments (since 2026-08-28), and nothing has linked to Generate with a template since PR #151; filling one chosen template with AI is the fill page's Use AI to assist. Remove the chips, the pin and the `/generate?template=` link with its test. The library-empty line ("No published templates yet, so drafts come fresh from your brand kit.") goes too. The server's `templateIdHint` stays; the template chat uses it.
1. **D1. Recent:** three columns, one row of three.
2. **D2. Variations** keep the default of 2 and the number's roll. The drawn Start, Sent and Result flow asks for Instagram and LinkedIn and gets two posts, which takes two, so the Start frame's 1 is a sample. This is CJ's call, and it settles the generate-chat PROMPT's §15 item 4.
3. **D3. The attach menu:**
   - **Upload:** Photo, File, and today's Brand Studio image pick.
   - **Details:** Headline, Date & time, Location, Link.
   - **Left out:** Context (Web page, Past post) and Connectors stay out until each is built as its own feature; PLAN.md no longer lists Connectors in Phase 5.
   - **Tooltip:** the plus's becomes "Add", since the menu holds details too.
4. **D4. Details**, built now with the server change:
   - One tag per kind: clicking a tag's value opens Add a detail filled in, its x removes it, and choosing a kind that already has a tag edits that tag.
   - Date & time is typed as text, as drawn (13:2285).
   - Today's `template-generate` rejects details without a pinned template (400), so the server change lands first in the PR and the function is deployed before the client change goes live. The PR notes the deploy step.
5. **D5. The Brand Studio row** keeps today's brand image pick. The link to the Brand Studio page was a prototype stand-in, now removed from the four attach menus in the file; members can't open Brand Studio.
6. **D6. Blur:** as drawn, a 3px blur on the Recent row only, while the attach menu or Add a detail is open.
7. **D7. The file tile:** the name without its extension on the first line, as drawn, and the type (PDF, TXT or MD) on the second until connectors exist.
8. **D8. The editor** moves onto the Phase 4 Details panel:
   - Discard and Download PNG; Missing and Too long on each field's error line; Edited markers.
   - Save to library stays for admins on freestyle drafts, as a full-width neutral button above that row, with today's saved state and error.
   - "Edits update both sizes." goes.
9. **D9. Result card labels:** the size alone on normal cards ("1080 × 1350", without the ratio), as drawn. The small cards keep the platform name (CJ, 2026-09-25). This is an exception to the Edit frame, which draws sizes there: the platform names match the panel's size switch.
10. **D10. Small text:** drop the greeting's sub-line, "SocialPaint" beside the assistant mark (the mark stays), the "Every graphic follows your Brand Studio rules." footnote (Terms of Service and Privacy Policy stay), and History's description.
11. **D11. History:**
    - **Chips:** only the platforms the chats use; the frame's chips are sample data.
    - **Search:** collapsed to its icon, as drawn.
    - **Hover:** the library card's hover since CJ's call after Phase 4: the shadow deepens, no dim. Recent cards on Start take the same hover. Result cards keep the dim and Edit button (Result card 104:602).
12. **D12. Loading:** plain grey wells, as drawn in the Generating frame, for the result cards and the caption card.
