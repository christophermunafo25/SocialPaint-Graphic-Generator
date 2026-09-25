# Rebuild Generate as the chat experience designed in Figma

You are a senior product engineer on SocialPaint (this repository). Replace the current one-shot Generate page with the chat-style Generate experience designed in Figma, in light and dark, while keeping every architectural invariant this codebase already enforces.

Be exact. The Figma frames and component sheet are the visual spec. This document is the behavioral spec and the map from the design to this codebase. Where the two disagree, this document says so explicitly and says which one wins.

Work in the phases in §14. After each phase, run `npm run verify`, fix everything it reports, and commit with a message that names the phase. Never start the next phase on a red build. If something in this document turns out to be impossible or wrong once you are in the code, stop and explain the conflict instead of improvising a different design.

---

## 1. Read these before writing any code

Read them in this order. Do not skim `GeneratePage.tsx`: most of its logic survives, it just moves.

1. `docs/ARCHITECTURE.md` (stack, layers, invariants, export pipeline, theming)
2. `src/app/components/generate/GeneratePage.tsx` (the page you are replacing: run pipeline, photo handling, measurement and repair, freestyle editing, save to library)
3. `src/lib/generate/measureProposal.ts`, `repairProposal.ts`, `designToSchema.ts`, `seedHandoff.ts`
4. `src/lib/types.ts` (the `Generate*` types, `GeneratedProposal`, `GeneratedDesign`, `TemplateSchema`, `FieldValues`, `BrandAsset`)
5. `src/lib/stores/interfaces.ts`, `src/lib/stores/index.ts`, `src/lib/stores/supabase/generateProvider.ts`, `src/lib/stores/local/localStores.ts`, `src/lib/stores/local/db.ts`
6. `supabase/functions/template-generate/index.ts`, `supabase/functions/template-generate/prompt.ts`, `supabase/functions/_shared/generateValidate.ts` and its test
7. `src/app/components/SchemaRenderer.tsx` (the `SchemaRendererHandle`, `instrument`, `onWarnings`), `TemplateThumbnail.tsx`, `TemplateFill.tsx`, `FieldInput.tsx`, `imageUpload.tsx`, `ImageSourceChooser.tsx` (`ImageSourceDialog`, `pickableAssets`), `Skeleton.tsx`
8. `src/app/components/bulk/BulkExportStage.tsx` (how to rasterize a template off-screen through the one export path)
9. `src/app/components/admin/brand/primitives/EditOverlay.tsx` and the `.sp-edit-overlay` / `.sp-has-overlay` rules in `socialpaint.css`
10. `src/app/components/Portal.tsx`, `templates/GroupChips.tsx`, `templates/TemplateSearchField.tsx`, `templates/useEdgeFade.ts` (the filter bar you will reuse on History)
11. `src/app/components/layout/Page.tsx`, `src/app/components/layout/ChromeContext.tsx` (`useFullViewport`), `src/app/components/AppShell.tsx`, `src/app/components/Sidebar.tsx`
12. `src/app/router.tsx`, `src/app/App.tsx`
13. `src/lib/render/exportPng.ts`, `src/lib/render/useDataUrl.ts` (`loadDataUrl`), `src/lib/templates/platforms.ts` (`PLATFORMS`, `classifySize`, `aspectRatioOf`)
14. `src/styles/socialpaint.css`: the header comment (the non-negotiables), the primitive and semantic token blocks (roughly lines 100 to 860), `.sp-btn` (about line 950), the surface recipe (`.sp-card` and friends, about line 1280), `.sp-media-card` (about line 4770), `.sp-edit-overlay` (about line 4477), `.sp-filterbar` / `.sp-platform-chip` / `.sp-searchfield`, and every `.sp-gen-*` rule (these retire in §14 Phase 6)

## 2. Invariants you must keep

- Components import only the store interfaces through `stores` from `src/lib/stores`. New persistence goes through a new store interface with a Supabase implementation and a localStorage implementation, exactly like the existing stores.
- `SchemaRenderer` is the only renderer and `renderSchemaBlob` / `exportSchemaPng` are the only rasterization path. Never render a template any other way.
- Usage instrumentation stays inside `SchemaRenderer`. Pass `instrument={true}` only where a real published template is being filled or downloaded. Thumbnails, skeleton stages and freestyle drafts pass `instrument={false}` (a freestyle draft has no template row to attribute an event to).
- The member's photo never leaves the browser. It is not uploaded to Storage, not sent to the model, and not persisted with chat history. Only `hasImage` and `imageAspect` cross the wire, exactly as today.
- Model output is never trusted. Every new field you add to the Edge Function's response is validated server-side before it reaches the client.
- Platform chrome is never re-themed per tenant. Tenant brand colors appear only inside rendered graphics.
- Brand colours carry no meaning (read the header of `socialpaint.css`). Slime and Deep Moss appear here as identity fills on buttons and selection, never as status.
- Use tokens from `socialpaint.css`. No raw hex in components. When a Figma value has no token, add one in the Generate chat token group described in §5.3, with a light and a dark value.
- UI copy in this document is final unless it is marked **(proposed copy)**. Never use em dashes in UI copy.
- One UI face: Raveo Display through `--font-ui` / `--font-head` / `--font-body`. Mono meta text uses `--font-mono` (Geist Mono), which the design calls for on draft cards.

## 3. The Figma source of truth

File: `https://www.figma.com/design/94CuU70Sl6PvHv4sY9SMGE/UX-UI-Designs`, page **Generate · Chat** (node `282:3`).

If the Figma MCP server is connected in this session, call `get_screenshot` for the frame or component you are about to build, and `get_design_context` when you need a value this document does not give. Reference PNGs of every frame and of the component sheet ship with this prompt in `docs/design/generate-chat/figma/`. Open the matching PNG before you build each screen and again when you QA it. The PNGs are a snapshot exported on 2026-09-25; if the live Figma differs from them, the live Figma wins.

### 3.1 Frames (1440 × 1053 each)

| Step | Light | Dark | PNG | What it shows |
|---|---|---|---|---|
| 01 Start | `285:61` | `289:243` | `01-start-*.png` | Empty chat: greeting, large composer, Start from chips, Recent row |
| 02 Attach menu | `310:535` | `310:1040` | `02-attach-menu-*.png` | The + button opened: Upload a photo / Choose from Brand Studio |
| 03 Photo attached | `310:686` | `310:1181` | `03-photo-attached-*.png` | Composer holding an attachment and a typed message, Send ready |
| 04 Generating | `286:88` | `289:632` | `04-generating-*.png` | Thread: user photo + bubble, assistant status + step progress, draft skeletons, caption skeleton, compact composer in Stop state |
| 05 Result | `286:420` | `289:1187` | `05-result-*.png` | Drafts in two sizes (first card shown in its hover state), caption card with platform switch, Try next chips |
| 06 Edit | `287:176` | `289:1565` | `06-edit-*.png` | Editor panel open beside the narrowed chat; compact draft cards; the edited card outlined |
| 07 History | `315:717` | `315:1094` | `07-history-*.png` | Square card grid, filter bar, loading row, bottom scroll fade |

The rail on the left of every frame is the existing `Sidebar.tsx`. Do not rebuild it.

### 3.2 Component sets (section "Generate · Components", node `283:3`, sheet `00-components.png`)

Every set has a `Mode=Light|Dark` variant property. In the sheet, each set's light variants sit on the left half and its dark variants on the right half.

| Figma set | Node | Variant properties | Build as (§7) |
|---|---|---|---|
| `sp-button` | `283:31` | Kind: Primary/Secondary/Tertiary · Size: Default/Small · Label · Show icon · Icon (swap) | `ChatButton` |
| `sp-icon / History`, `sp-icon / New chat` | `354:879`, `354:885` | none | `HistoryIcon`, `NewChatIcon` |
| `sp-icon-btn / Send` | `283:13` | State: Disabled/Ready/Stop | `SendButton` |
| `sp-icon-btn / Attach`, `/ Download`, `/ Close` | `328:831`, `328:827`, `328:835` | none | `IconButton` presets |
| `sp-card-action` | `308:366` | Action: Edit/Download/Copy · Size: Regular/Compact | `CardAction` |
| `sp-chip` | `322:749` | Label | `SuggestionChip` |
| `sp-select` | `328:840` | Label | existing `Select` with the tile trigger |
| `sp-stepper` | `302:324` | State: Min/Mid/Max · Label | `VariationsStepper` |
| `sp-input` | `288:230` | State: Filled/Empty focused · Value | editor field styling on `FieldInput` |
| `sp-chat-composer` | `283:76` | Size: Large/Compact · State: Ready/Working/Attached · Placeholder | `Composer` |
| `sp-attach-menu` | `329:1056` | none | `AttachMenu` |
| `sp-attachment` | `328:845` | none | `AttachmentThumb` |
| `sp-chat-photo / User` | `328:847` | none | part of `UserMessage` |
| `sp-chat-bubble / User` | `328:850` | Message | part of `UserMessage` |
| `sp-chat-assistant-header` | `328:854` | none | `AssistantHeader` |
| `sp-result-card` | `284:91` | Format: Instagram Portrait/LinkedIn Landscape · Size: Regular/Compact · State: Default/Hover | `DraftCard` |
| `sp-result-card-skeleton` | `284:118` | Format | `DraftCardSkeleton` |
| `sp-caption-card` | `309:437` | State: Ready/Loading · Caption | `CaptionCard` |
| `sp-recent-card` | `329:1044` | Title · Meta | `RecentCard` |
| `sp-history-card` | `347:859` | Format · State: Default/Loading · Title · Meta | `HistoryCard` |
| `sp-scroll-fade` | `341:813` | Position: Top/Bottom | `ScrollFade` |

Format values in the Figma (Instagram Portrait, LinkedIn Landscape) are examples. In code, a card's shape comes from the draft's own `canvasWidth / canvasHeight`, so every size in `SIZE_CATALOG` works.

## 4. What changes

| Today | After this work |
|---|---|
| A hero, one big prompt card, and a results grid on one scrolling page | A chat: a Start state, then a thread of user messages and assistant turns, each turn holding drafts, a caption card and Try next suggestions, with a docked composer |
| Mode toggle (My templates / Something new) in the composer | Removed from the composer. Freestyle runs from the "Try another layout" suggestion, and automatically when the library is empty (as today) |
| Starter pills that paste a sample healthcare brief | "Start from" chips that pin one of the company's published templates for the next send (the existing `templateIdHint`) |
| Choosing a card navigates to the fill page (library) or swaps the page for `TemplateFill` (freestyle) | Choosing a card opens the Editor panel beside the chat. Editing and export happen in place for both kinds of draft. No navigation |
| Fixed 3 proposals | Variations stepper, 1 to 3 (the server's existing `count` range) |
| Nothing is persisted | Chats persist without photos. The Start state lists recent chats and a new History page lists them all |
| "Your drafts" step list during a run | An assistant turn with a status sentence, a three-step progress bar, and skeleton cards that are replaced in place as drafts resolve |

## 5. Tokens

### 5.1 Figma variables to CSS tokens

Use the CSS token in the right-hand column. Values are shown so you can check your work against the PNGs.

| Figma variable | Light | Dark | CSS token |
|---|---|---|---|
| Theme `bg/surface` | #FFFFFF | #18191A | `--bg-surface` (the CSS dark value #171819 wins; the one-step drift is known) |
| Theme `bg/hover` | #E2E2E2 | #2A2A2A | `--bg-hover` |
| Theme `text/primary` | #272727 | #F1F1F1 | `--text-primary` |
| Theme `text/secondary` | #636363 | #A0A0A0 | `--text-secondary` |
| Theme `text/muted` | #272727 at 70% | #F1F1F1 at 56% | `--text-muted` |
| Theme `border/default` | #272727 at 8% | #F1F1F1 at 10% | `--border` |
| Theme `chip/fg` | #272727 | #F1F1F1 | `--chip-fg` |
| Theme `chip/tile` | #F1F1F1 | #252627 | new `--gen-tile` (the CSS `--chip-tile` is #F9F9F8 in light, which is not this value) |
| Brand `surface/page` | #FFFFFF | #0B0B0C | light `--white`, dark `--bg-canvas` |
| Brand `surface/raised` | #F9F9F8 | #171819 | light `--bg-canvas` (page background), dark `--bg-card` |
| Brand `surface/sunken` | #ECECEC | #2F3133 | new `--gen-sunken` (`--paper-100` / `--ink-700`) |
| Brand `surface/inverse` | #0B0B0C | #FFFFFF | new `--gen-inverse` (`--ink-900` / `--white`) |
| Brand `text/primary` | #0B0B0C | #F9F9F8 | `--text-heading` |
| Brand `text/inverse` | #FFFFFF | #0B0B0C | new `--gen-on-inverse` (`--white` / `--ink-900`) |
| Brand `accent/green` | #17FF7E | #17FF7E | `--slime` |
| Brand `field/green`, Primitives `green/deep-moss` | #082A23 | #082A23 | `--deep-moss` |
| Page background (frame fill) | #F9F9F8 | #0B0B0C | `--bg-canvas` |
| Scrim on media | #0B0B0C at 56% | same | `--media-overlay` |

Surfaces already implemented in CSS that match the design exactly, so reuse them rather than re-deriving:

- **Card surface** (composer, draft cards and skeletons, caption card, recent and history cards, attach menu, editor panel): the `.sp-card` surface recipe. Light is `--bg-surface` plus `--shadow-card` (6px 6px 25px at 5% #353535). Dark is `--bg-card` (#171819) plus the lit edge (inside hairlines weighted 0.65 top, 0.25 sides, 0.55 bottom at the card alpha 0.15) plus `--card-highlight` plus `--shadow-card` (6px 6px 25px at 15% black). Radius 20 (`--radius-card`), except the attach menu (12).
- **Chip surface** (suggestion chips): the chip edge from the same recipe (`--edge-alpha-chip`, 0.25, top weight 0.75). Light draws no edge and uses `--shadow-rest`. Dark draws the edge and no shadow.
- **Hover elevation** (attach menu only): `--shadow-card-hover` (10% light, 30% dark).

### 5.2 Radius, sizing and type used by this page

- Radii: 5 (`--radius-control`), 9, 12 (`--radius-control-lg`), 15 (`--radius-media-plate`), 20 (`--radius-card`), 999 (`--radius-pill`). Nothing else. 9 has no control token yet: add `--radius-control-md: 9px` beside `--radius-control-lg` and use it for every 9px control. Do not borrow `--radius-media-inner` (also 9px), which names the media card's thumbnail well.
- Control heights on this page come from the Figma, not from `--control-*`: small controls are 36px, default buttons 44px, Send 44px, Attach 36px, card actions 34px (regular) and 28px (compact), editor inputs 40px. Add these as tokens in the Generate group (`--gen-h-sm: 36px`, `--gen-h-md: 40px`, `--gen-h-lg: 44px`) rather than scattering literals.
- Type used: page title 30 Medium −2% (`.sp-page-title`), greeting 26/125% Medium −1.5%, body 15/150% Regular, composer 16/150% Regular (`--type-composer-size`), labels 13/125% Regular −1%, small labels 12/125%, card titles 15 Medium −1% (regular) and 14 (compact), mono meta 12/140% +4% (regular) and 11 (compact), editor title 18/125% Medium −1%.

### 5.3 New tokens

Add one group to `socialpaint.css`, headed `/* ── Generate chat (Figma "Generate · Chat", 2026-09-25) ── */`, with the dark values in the `[data-theme="dark"]` block and the light values in the `[data-theme="light"]` block. Every Generate chat component reads only these tokens plus the existing semantic ones.

| Token | Light | Dark | Used by |
|---|---|---|---|
| `--gen-btn-primary-bg` / `-fg` | `--slime` / `--deep-moss` | `--slime` / `--ink-900` | Primary buttons (Download PNG) |
| `--gen-btn-secondary-bg` / `-fg` | `--deep-moss` / `--slime` | `--white` / `--ink-900` | Secondary buttons (New chat) |
| `--gen-btn-tertiary-bg` / `-fg` | `--paper-100` / `--ink-900` | `--ink-700` / `--text-primary` | Tertiary buttons (History, Load more style actions) |
| `--gen-tile` | `--gray` (#F1F1F1) | `--chip-raised` (#252627) | Attach button, platform select, stepper, editor inputs |
| `--gen-sunken` | `--paper-100` | `--ink-700` | User bubble, card actions, Send disabled, switch tracks, progress track, skeleton shapes |
| `--gen-inverse` / `--gen-on-inverse` | `--ink-900` / `--white` | `--white` / `--ink-900` | Progress fill, attachment remove button, selected-card outline, focused input border |
| `--gen-well` | `--bg-hover` | `--bg-hover` | The well behind a draft preview, recent card thumbnail, chat photo |
| `--gen-stage` | `--bg-hover` | `--bg-canvas` | History card stage and draft skeleton well (dark is the deep well) |
| `--gen-stage-graphic` | `--white` | `--bg-hover` | History card placeholder graphic while a thumbnail has not rendered |
| `--gen-chip-bg` | `--bg-surface` | `--bg-canvas` | Suggestion chips |
| `--gen-send-ready-bg` / `-fg` | `--deep-moss` / `--slime` | same | Send, ready |
| `--gen-send-stop-bg` / `-fg` | `--slime` / `--deep-moss` | same | Send, stop |
| `--gen-seg-on-bg` / `-fg` | `--deep-moss` / `--slime` | `#3d4042` / `--slime` | Caption platform switch, selected segment |
| `--gen-seg-on-shadow` | `--shadow-card` | none | Caption switch selected segment |
| `--gen-editor-seg-on-bg` / `-fg` | `--bg-surface` / `--text-primary` | `#3d4042` / `--slime` | Editor size switch, selected segment |
| `--gen-menu-item-hover` | `--paper-050` | `--bg-hover` | Attach menu row hover |
| `--gen-fade` | `--bg-canvas` | `--bg-canvas` | Scroll fades |
| `--gen-h-sm` / `--gen-h-md` / `--gen-h-lg` | 36px / 40px / 44px | same | Control heights (§5.2) |

`#3d4042` has no primitive. Add it once in the token block with a comment ("selected segment on a sunken track, dark; Figma Generate · Chat") and never repeat the hex.

## 6. Icons

Use `lucide-react` (already the app's icon set) at 16px with `strokeWidth={1.5}` for: plus (Attach), image (Upload a photo), folder (Choose from Brand Studio), download, copy, pencil (edit overlay, already inside `EditOverlay`), x (close, remove), arrow-up (Send ready and disabled), chevron-down (select), minus and plus (stepper, stroke 1.2 at 16px), search, layout-grid and chevron-right (already inside `GroupChips`).

Two icons are custom and must match the Figma exactly. Create `src/app/components/generate/icons.tsx` exporting `HistoryIcon` and `NewChatIcon`: 16 × 16 SVG, `fill="none"`, `stroke="currentColor"`, `strokeWidth={1.5}`, `strokeLinecap="round"`, `strokeLinejoin="round"`, same props shape as a lucide icon (`className`, `style`, `aria-hidden`).

- `HistoryIcon` (a clock whose ring rewinds counter-clockwise):
  - `M2.36 10.05A6 6 0 1 0 2.36 5.95`
  - `M4.41 4.51L2.36 5.95L1.71 3.53`
  - `M8 5.25V8L10 9.25`
- `NewChatIcon` (a speech bubble with a plus):
  - `M4.5 2.5H11.5A2.5 2.5 0 0 1 14 5V9A2.5 2.5 0 0 1 11.5 11.5H7.5L4.75 13.75V11.5H4.5A2.5 2.5 0 0 1 2 9V5A2.5 2.5 0 0 1 4.5 2.5Z`
  - `M8 5V9M6 7H10`
- The Stop glyph is a filled 12 × 12 rounded square (radius 2) in `--gen-send-stop-fg`, centred in a 20 × 20 box.

## 7. Components

All new components live in `src/app/components/generate/`. Styles go in `socialpaint.css` under the Generate chat group, with classes prefixed `sp-chat-`. Each component renders its light or dark look purely from tokens: no `theme === "dark"` branches in TSX.

### 7.1 `ChatButton` (Figma `sp-button`)

Props: `kind: "primary" | "secondary" | "tertiary"`, `size: "default" | "small"`, `icon?: ReactNode` (leading), standard button props. Class `sp-chat-btn` with `data-kind` and `data-size`.

| | Default | Small |
|---|---|---|
| Height | 44 (`--gen-h-lg`) | 36 (`--gen-h-sm`) |
| Radius | 12 | 9 |
| Padding | 0 18px | 0 14px |
| Icon gap | 8 | 6 |
| Label | 14/125% Regular | 13/125% Regular |
| Icon | 16px, `currentColor` | 16px, `currentColor` |

Colors come from `--gen-btn-{kind}-bg` / `-fg` (§5.3). No border, no shadow, no outline at rest. This is deliberate: buttons are solid color with no drop shadow, so they never read as suggestion chips (which are white with a shadow in light and outlined in dark). Hover: background `color-mix(in srgb, var(--bg) 88%, var(--fg))`. Active: `color-mix(in srgb, var(--bg) 80%, var(--fg))`. Disabled: opacity 0.4, `cursor: default`. Focus-visible: the app's `--focus-ring`. One line always (`white-space: nowrap`), like `.sp-btn`. The Figma sets labels in Display Regular, which departs from the design-system note that controls use Medium: build it as drawn.

Where they appear:
- Header, chat states: `History` (tertiary, small, `HistoryIcon`) then `New chat` (secondary, small, `NewChatIcon`), 8px apart, right-aligned in the page header.
- History page header: `New chat` (secondary, small, `NewChatIcon`) on the title row.
- Editor footer: `Download PNG` (primary, default, full width, no icon).

Do not change `.sp-btn` or `.sp-btn-primary`. The rest of the app keeps its buttons until CJ decides otherwise (§15).

### 7.2 `SendButton` (Figma `sp-icon-btn / Send`)

44 × 44 circle. States: `disabled` (bg `--gen-sunken`, arrow-up 20px box, 1.5 stroke, `--text-muted`), `ready` (bg `--gen-send-ready-bg`, arrow `--gen-send-ready-fg`), `stop` (bg `--gen-send-stop-bg`, stop glyph `--gen-send-stop-fg`). Accessible names: "Generate" when ready or disabled, "Stop generating" when stop.

### 7.3 `IconButton` presets

- Attach: 36 circle, bg `--gen-tile`, plus glyph 18px box, stroke 1.5, `--text-primary`. Accessible name "Add a photo". Toggles the attach menu (`aria-expanded`, `aria-haspopup="menu"`).
- Close: 32 circle, transparent, x glyph 16, `--text-secondary`; hover bg `--bg-hover`. Accessible name "Close editor".
- Download (on draft cards): 34 circle (28 on compact cards), bg `--gen-sunken`, download glyph 16, `--text-primary`. Accessible name `Download "<template name>" PNG`.

### 7.4 `CardAction` (Figma `sp-card-action`)

32 circle (28 compact), bg `--gen-sunken`, glyph 16, 1.5 stroke, `--text-primary`. Used for Copy on the caption card (32). The Edit action is not placed anywhere: editing opens from the hover overlay on the preview (§7.14).

### 7.5 `SuggestionChip` (Figma `sp-chip`)

Height 36, radius 9, padding 0 14px, label 13/125% Regular −1% in `--chip-fg`, one line. Light: bg `--gen-chip-bg` (white), `--shadow-rest`, no edge. Dark: bg `--gen-chip-bg` (#0B0B0C), the chip edge (§5.1), no shadow. Hover: light `--shadow-rest-hover`; dark raise `--edge-alpha` to `--edge-alpha-chip-hover`. `aria-pressed` when it pins something (Start from). Selected (a pinned Start from chip): bg `--chip-bg-selected`, label `--chip-fg-selected`, which is the app's neutral selection (read the "Selection is neutral everywhere" comment in `socialpaint.css`).

Row labels ("Start from", "Try next") are 13/125% Regular in `--text-muted`, vertically centred with the chips, 8px gap to the first chip, chips 8px apart.

### 7.6 Platform select (Figma `sp-select`)

Reuse `ui/Select.tsx` and the platform options the current page builds (`Any platform` first with the globe mark, then `PLATFORMS`, dimming uncovered platforms in library mode with the existing menu caption). Only the trigger changes: height 36, radius 9, bg `--gen-tile`, padding 0 10px 0 12px, gap 6, label 13/125% Regular −1% in `--chip-fg`, chevron-down 16 in `--text-secondary` at stroke 1.2. The Figma trigger shows no leading platform mark; keep the current `triggerIcon` only if it fits inside the same 36px height without changing the width rules.

### 7.7 `VariationsStepper` (Figma `sp-stepper`)

A tile: height 36, radius 9, bg `--gen-tile`, padding 0 4px 0 12px, gap 6. Label "Variations" 13/125% **Medium** −1% in `--chip-fg`. Then a group: Decrease (28 circle, minus 16, stroke 1.2, `--text-primary`), the value (20 wide, 14/125% Medium −1%, tabular numerals), Increase (28 circle, plus 16).

Range 1 to 3 (the server clamps `count` to 1 to 3; the Figma's Max frame shows 4 as a sample, and this document wins). Decrease disables at 1 and Increase at 3 (opacity 0.32, `cursor: not-allowed`). Hover on an enabled button: bg `color-mix(in srgb, var(--text-primary) 8%, transparent)`; active: `transform: scale(0.88)`.

The value rolls in the direction you stepped and settles with a small bounce, using the Web Animations API on the number element: out `translateY(0) → translateY(∓18px)`, opacity 1 → 0, 130ms `ease-in`; swap the text; in `translateY(±18px) → 0`, opacity 0 → 1, 190ms `cubic-bezier(0.3, 1.5, 0.5, 1)`. Stepping up moves the old number up and out. Under `prefers-reduced-motion: reduce` (or when `animate` is missing), swap the text with no animation. The value element is `aria-live="polite"`. The buttons are labelled "Fewer variations" and "More variations". Default value 2 (**decision**, §15).

### 7.8 Editor fields (Figma `sp-input`)

Do not fork `FieldInput`: it owns the guardrails (maxLength, required, options, crop). Give it an optional `variant?: "default" | "chat"` prop that swaps the control class to `sp-chat-input`: height 40 (`--gen-h-md`), radius 12, padding 0 12px, bg `--gen-tile`, 1px border `--border`, value 14/125% Regular `--text-primary`, placeholder `--text-muted`. Focus: border `--gen-inverse` (the Figma draws a 0.5px stroke; use 1px so it renders on every display), no glow. Multiline fields keep their textarea with the same colors and radius and a 40px minimum height. Select fields use the same look.

Field wrapper: label row (label 12/125% Medium `--text-secondary`, and on the right "Optional" 12/125% Regular `--text-muted` when the field is not required), 6px gap, then the control. Fields stack 12px apart.

### 7.9 `Composer` (Figma `sp-chat-composer`)

A card (`.sp-card` surface recipe, radius 20). It is one `<form>` with the textarea, the tools and Send.

| Variant | When | Size | Padding | Contents, top to bottom |
|---|---|---|---|---|
| Large, Ready | Start state | 760 wide, 148 tall when empty | 18 12 14 20, gap 8 | textarea (min 64px), toolbar |
| Large, Attached | Start state with at least one attachment | 760 wide, hugs | 18 12 14 20, gap 12 | attachments row, textarea, toolbar |
| Compact, Ready | Thread states, idle | 760 wide (fills the chat column in Edit), 104 tall when empty | 16 12 12 20, gap 8 | textarea (min 24px), toolbar |
| Compact, Working | Thread states, a run in flight | same | same | textarea, toolbar with Send in Stop state |

Textarea: borderless, transparent, 16/150% Regular (`--type-composer-size`), `--text-primary`, placeholder `--text-muted`, auto-grows up to 6 lines then scrolls, `maxLength={1500}` (the server's cap). Placeholder on the Start state: "Describe the post. Add any dates, names, or links it needs." In the thread: "Ask for changes or describe a new post". When a Start from chip is pinned: "Describe your <template name> post. Add any dates, names, or links it needs." **(proposed copy)**.

Toolbar: a row, space-between, centred. Left group (gap 8): Attach, then, on the Large variants only, the platform select and the Variations stepper. Right: Send. The compact composer shows only Attach and Send; follow-ups reuse the platform and variation count of the thread's last send.

Send is `ready` when the trimmed text is non-empty and no run is in flight; `disabled` otherwise; `stop` while a run is in flight (clicking it stops the run, §9.3). Enter sends and Shift+Enter breaks the line (keep the current `onBriefKeyDown` behavior). Pasting an image anywhere in the composer, or dropping one on it, attaches it through the existing pipeline (`readAndDownscale`, `imageAspectOf`, `UPLOAD_ACCEPT`, `MAX_UPLOAD_BYTES`, `rejectionMessage`, `useUploadChip` / `UploadChipView`). Keep the current focus-within treatment of `.sp-gen-composer` by porting it to the new class.

### 7.10 `AttachMenu` (Figma `sp-attach-menu`)

A popover anchored to the Attach button: top = button bottom + 8px, left aligned with the button. Width 236, padding 6, rows 2px apart, radius 12, card surface with the hover elevation (§5.1). Rows: height 36, radius 9, padding 0 10px, gap 10, icon 16, label 14/125% Regular `--text-primary`; hover and keyboard-active row bg `--gen-menu-item-hover`.

1. "Upload a photo" (image icon): opens the native file picker with the existing accept list and size cap.
2. "Choose from Brand Studio" (folder icon): opens `ImageSourceDialog` showing `pickableAssets(useBrand().assets)`. On pick, `loadDataUrl(asset.url)`, then `imageAspectOf`, and attach the data URL. Hide this row when there are no pickable assets.

Use `role="menu"` / `role="menuitem"`, arrow keys to move, Enter to choose, Escape closes and returns focus to the Attach button, click outside closes. It opens above the composer if there is not enough room below.

### 7.11 `AttachmentThumb` (Figma `sp-attachment`)

64 × 64, radius 9, bg `--gen-well`, the image `object-fit: cover`. Remove button: 15 × 15 circle at top 4 / right 4, bg `--gen-inverse`, x glyph 10px box at stroke 1, color `--gen-on-inverse`, accessible name "Remove photo". Attachments sit in a row, gap 8. One photo per message in this version (the server knows about one photo); attaching a second replaces the first.

### 7.12 `UserMessage` (Figma `sp-chat-photo / User` and `sp-chat-bubble / User`)

Right-aligned column, gap 6. Optional photo first: 160 × 107, radius 15, `object-fit: cover`, bg `--gen-well`. Then the bubble: max-width 472, radius 12, padding 12px 16px, bg `--gen-sunken`, text 15/150% Regular `--text-primary`, `white-space: pre-wrap`, `overflow-wrap: anywhere`.

### 7.13 `AssistantHeader` (Figma `sp-chat-assistant-header`)

Row, gap 10: the SocialPaint mark at 20px (reuse `BrandMark` if it renders the mark alone at that size, otherwise export the mark path from it; the mark is Slime in both themes) and "SocialPaint" 14/125% Medium `--text-primary`.

### 7.14 `DraftCard` (Figma `sp-result-card`)

A card (`.sp-card` recipe), padding 8, radius 20, column. The preview height is fixed by size and the width follows the draft's aspect ratio:

| | Regular | Compact (editor open) |
|---|---|---|
| Preview height | 264 | 184 |
| Preview width | 264 × width ÷ height | 184 × width ÷ height |
| Preview radius / bg | 15 / `--gen-well` | same |
| Meta row padding | 16 8 8 8, gap 8 | 12 6 4 6, gap 6 |
| Title | 15/125% Medium −1%, truncate | 14/125% Medium −1%, truncate |
| Meta | mono 12/140% +4% `--text-muted`, truncate | mono 11/140% +4% |
| Download | 34 circle | 28 circle |

The Figma examples are Instagram 4:5 (Regular card 227 wide, preview 211 × 264) and LinkedIn 1.91:1 (Regular card 521 wide, preview 505 × 264). Clamp the preview width to the chat column width minus 16; when it clamps, pin the width instead and let the height follow.

Preview content: `TemplateThumbnail` with the draft's values and, when this turn had a photo, the photo in its target slot (reuse `imageTargetFor` from the current page), letterboxed with `contain` inside the well.

Title: the template name (for freestyle drafts, the design name). Meta on Regular cards: `${canvasWidth} × ${canvasHeight} · ${aspectRatioOf(canvasWidth, canvasHeight)}` using the multiplication sign, for example "1080 × 1350 · 4:5". Meta on Compact cards: the draft's platform label as the Figma draws it (frame 06 and the component sheet), for example "Instagram" or "LinkedIn": `platformById(classifySize(w, h).platforms[0]).label`, falling back to the Regular size meta when the size maps to no platform. **(Decision by CJ, 2026-09-25: the Figma compact meta wins over the single size format this section first gave.)**

Interaction:
- The preview is a button with class `sp-has-overlay` and `EditOverlay` inside it (40px chip on Regular, `small` 32px chip on Compact). It shows on hover (hover-capable devices only) and on keyboard focus, exactly like Brand Studio. Accessible name `Edit "<name>"`. Activating it opens the Editor panel on this draft (§9.5).
- Download exports this draft directly without opening the editor (§9.6).
- The draft being edited gets an inside outline: `box-shadow: inset 0 0 0 1px var(--gen-inverse)` composed with the card's existing box-shadow list (read the surface recipe comment: compose the full list, never replace it).

Draft cards in one turn sit in a row, gap 12, wrapping when they do not fit.

### 7.15 `DraftCardSkeleton` (Figma `sp-result-card-skeleton`)

Same outer geometry as a Regular `DraftCard` of the expected aspect. While the model call is in flight the aspect is unknown: use 4:5 for the first slot and 1.91:1 for the second and third (this matches the frame). Well bg `--gen-stage`. Inside the well, skeleton shapes in `--gen-sunken`, positioned in percent of the well so they scale: logo bar (8% × 25% at top-left), image block, two headline bars, a button pill and a url bar, as drawn in the component. Meta row: title bar 90 × 10 radius 5, meta bar 130 × 8 radius 4, and a 34px circle. Reuse `Bone` from `Skeleton.tsx` for the shapes if it takes a color, otherwise add a `tone` prop to it. `aria-hidden`. A skeleton is replaced in place by its `DraftCard` when that draft resolves, and removed when a draft is dropped.

### 7.16 `CaptionCard` (Figma `sp-caption-card`)

Card recipe, full chat-column width, padding 16 16 20 20, gap 12.

Header row (space-between, centred): left group (gap 12) with "Caption" (14/125% Medium −1%) and the platform switch; right, a Copy `CardAction` (32) named "Copy caption".

Platform switch: track bg `--gen-sunken`, radius 9, padding 4, gap 4. One segment per draft in this turn, labelled with the draft's platform (`classifySize(w, h).platforms[0]` through `platformById(...).label`); if two drafts share a platform, label them with their template names instead. Segment height 28, radius 5, padding 0 10px, label 10/125% Regular −1%. Selected: bg `--gen-seg-on-bg`, label `--gen-seg-on-fg`, plus `--gen-seg-on-shadow`. Unselected: transparent, label `--text-secondary`. It is a `role="radiogroup"` with arrow-key navigation like `GroupChips`. Selecting a segment shows that draft's caption. With one draft, hide the switch.

Caption text: 15/150% Regular `--text-primary`, `white-space: pre-wrap`. The caption is `proposal.caption || mergeCaption(schema, values)`, recomputed from current values when the member edits a draft whose caption came from the template (`captionTemplate`).

Copy writes the visible caption to the clipboard and swaps the glyph to a check for 1.5s with a visually hidden "Caption copied" status (**proposed copy**).

Loading state: same card; header skeleton (title bar 56 × 10 radius 5, switch block 150 × 36 radius 9, a 32 circle) and two caption lines (12 tall radius 6, the second at 50% width), all `--gen-sunken`, lines 10 apart with 6px vertical padding.

### 7.17 `RecentCard` (Figma `sp-recent-card`)

Card recipe, 181 wide on the Start state (four across the 760 column with 12px gaps; use a 4-column grid so it adapts), padding 8. Thumbnail: 104 tall, radius 15, bg `--gen-well`, showing the chat's first draft with `TemplateThumbnail`, letterboxed with `contain`. Meta block padding 10 6 4 6, gap 2: title 14/125% Medium −1% truncate, meta 12/125% Regular `--text-secondary` truncate (format in §9.9). The whole card is one button that opens the chat.

### 7.18 `HistoryCard` (Figma `sp-history-card`)

A square card: `aspect-ratio: 1`, card recipe, padding 8, radius 20, column.

- Stage (fills the space above the meta): radius 15, bg `--gen-stage`, padding 16, centring its content. Inside, a box with the draft's own aspect ratio, as large as fits inside the padded stage, holding `TemplateThumbnail`. Until the thumbnail renders, the box shows `--gen-stage-graphic` with radius 5. The graphic never fills the stage edge to edge; the padding is the point of this card.
- Meta, padding 10 6 4 6, gap 2: title 14 Medium truncate, meta 12 Regular `--text-secondary` truncate.
- Loading state: the stage keeps its background and the graphic box is `--gen-sunken` (in the draft skeleton's 4:5 or 1.91:1 shape, alternating), and the meta shows two bars (128 × 10 and 84 × 8, radius 5) 9 apart, sized so the card height does not change when real content arrives.

The whole card is one button (`aria-label` "Open <title>").

### 7.19 `ScrollFade` (Figma `sp-scroll-fade`)

An absolutely positioned, pointer-transparent overlay, 56 tall, spanning the scroll container's width, pinned to its top (`position: top`) or bottom (`position: bottom`). Background: a linear gradient of `--gen-fade` from 100% opacity at the pinned edge through 85% at 30%, 40% at 65%, to 0% at the far edge (build the stops with `color-mix(in srgb, var(--gen-fade) N%, transparent)`). Blur: `backdrop-filter: blur(8px)` masked with the same direction (`mask-image: linear-gradient(to bottom, #000, transparent)` for top, reversed for bottom) so the blur eases from 8px at the pinned edge to none. It fades in and out over `--dur-state`. The top fade shows only once the container is scrolled (`scrollTop > 0`); the bottom fade shows only while there is more content below. Messages and cards look like they slide under the header rather than being cut off by it.

### 7.20 `EditorPanel`

Specified in §8.5 because it only exists in the Edit layout.

## 8. Screens and layout

### 8.1 Page frame

- Start state: the normal document page (`Page`), content centred. No page title: the dark Start frames have none and the current page has none, so the light frames' "Generate" title is not built (**decision**, §15).
- Thread states (a chat with at least one message, with or without the editor): call `useFullViewport(true)` so the document stops scrolling, then lay the route out as a full-height column: page header (breadcrumb and actions), the thread (the only scrolling region, flex 1, `min-height: 0`), the composer dock. Use the `.sp-page` gutters (`--page-pad`) for the sides and 45px top in the Figma, which maps to the existing 48px page top padding; the bottom padding is 24px.
- History: a full-height column as well (`useFullViewport(true)`): header, filter bar, the grid as the only scrolling region, footer links.

### 8.2 Start state (frames 01 to 03)

A column, 760 wide, centred horizontally and vertically in the space below the top of the page (the frame gives the column 48px of bottom padding inside that space):

1. Greeting, centred, gap 8:
   - "What are we painting today?" 26/125% Medium −1.5% `--text-heading`. (This replaces the old h1 step and the brand mark above it, which the frames do not draw.)
   - "Describe it and I'll build it from your templates, already on brand." 15/140% Regular `--text-secondary`.
2. 28px, then the Large composer.
3. 16px, then the Start from row (hidden when the library is empty or still loading).
4. 56px, then Recent (hidden when the member has no chats): header row (space-between, 4px left padding) with "Recent" (15/125% Medium −1% `--text-primary`) and a "View all" text button (13/110% Medium +1%, height 32, padding 0 8px) that opens History; then 12px; then up to four `RecentCard`s.
5. Footer links at the bottom of the page: "Terms of Service" and "Privacy Policy", 12/125% Regular `--text-muted`, underlined, 16 apart, centred (§11.3 for the URLs).

When the library is empty the composer still works (freestyle, as today), and under the composer show the existing line "No published templates yet, so drafts come fresh from your brand kit." in 12px `--text-muted`, centred, 12px below.

The dev backend state (`!stores.generate.isConfigured()`) keeps today's honest empty state with its existing copy, under the greeting.

### 8.3 Attach flow (frames 02 and 03)

Attach opens the menu (§7.10). Once a photo is attached the composer becomes Large, Attached: the thumbnail row above the text. The frame shows the member's typed message in `--text-primary` and Send ready.

### 8.4 Thread states (frames 04 and 05)

Page header (space-between, centred, one line, 36 tall):
- Breadcrumb, gap 8: "Generate" (14/125% Medium `--text-secondary`, a link to a new chat), "/" (14 Regular `--text-muted`), the chat title (14/125% Medium `--text-primary`, truncate at 40% of the header width). While the first turn is running the title is "New chat" (**proposed copy**) until the server's title arrives (§10).
- Actions (gap 8): `History` and `New chat` buttons (§7.1).

Thread: scrolls; padding 16 0 32 0; its content is one column, 760 wide, centred, messages 24px apart. The top `ScrollFade` sits inside it. Keep the view pinned to the bottom while new content arrives if the member was already within 80px of the bottom; otherwise leave their scroll position alone.

Assistant turn, a column with gap 16:
1. `AssistantHeader`.
2. Status block (gap 8): the status sentence (15/150% Regular `--text-primary`) and, while running, the progress row (gap 12): a 120 × 4 track (radius 2, `--gen-sunken`) with a fill in `--gen-inverse` at `step ÷ 3` of its width, and a label in mono 12/140% +4% `--text-muted` reading `${step} of 3 · ${stepLabel}` (§9.2). The fill width animates over `--dur-panel`. When the turn is done, the progress row disappears and the status sentence becomes the reply.
3. Drafts row: skeletons while running, then `DraftCard`s.
4. `CaptionCard` (Loading while running).
5. When the turn is the latest and done: the Try next row (§9.4), "Try next" label plus up to three `SuggestionChip`s. Older turns do not show it.

Composer dock: padding 16 0 0 0, gap 10, centred: the Compact composer (760, or the chat column's width in Edit), then the footnote row (gap 12, 12/125% Regular `--text-muted`): "Every graphic follows your Brand Studio rules." then the Terms of Service and Privacy Policy links.

### 8.5 Edit state (frame 06)

Below the page header, a row with 24px top padding and gap 24: the chat column (flex 1) and the Editor panel (380 wide, full height). The chat column keeps its own thread and dock; its thread padding becomes 0 32 32 32 and its column fills the available width instead of 760. Draft cards switch to Compact. The edited draft's card is outlined (§7.14). Below 1180px of viewport width, the panel overlays the chat as a right-hand sheet (full height, the same panel, with a scrim of `--media-overlay` behind it) instead of pushing it.

Editor panel: card recipe, radius 20, padding 20, gap 16, column, `role="complementary"` labelled "Edit details".

1. Header row (space-between): "Edit details" 18/125% Medium −1%, and the Close icon button.
2. Size switch, when the turn has more than one draft: track bg `--gen-sunken`, radius 12, padding 4, gap 4, height 40. Segments share the width equally, 32 tall, radius 9, label 13/125% −1%: `${platformLabel} · ${aspectRatioOf(w, h)}` (for example "Instagram · 4:5" and "LinkedIn · 1.91:1"). Selected: bg `--gen-editor-seg-on-bg`, label `--gen-editor-seg-on-fg`, and in light `--shadow-rest`. Light labels are Medium, dark labels Regular, as drawn. Unselected label `--text-secondary`. A radiogroup.
3. Preview stage: fills the width, 290 tall, radius 15, the selected draft rendered by a live `SchemaRenderer` (`instrument` true for library drafts, false for freestyle) letterboxed with `contain` on a `--gen-well` background (the Figma draws a 216 × 270 placeholder for 4:5). Layout warnings from `onWarnings` show under the stage in 12px `--text-muted`, like `TemplateFill` does today.
4. Fields: the linked field groups (§9.5), each rendered with `FieldInput variant="chat"` (§7.8), 12 apart. The list scrolls inside the panel when it is taller than the space left.
5. A flexible spacer.
6. Footer (gap 10, centred): the hint "Edits update both sizes." (12/125% Regular `--text-muted`) when there are exactly two drafts, "Edits update every size." **(proposed copy)** when there are three, nothing when there is one; then the `Download PNG` button (primary, default, full width).

For a freestyle draft and an admin viewer, add a `Save to library` button (tertiary, default, full width) above Download PNG, with the current page's save behavior and its existing copy ("Saving…", "Saved to Brand Templates.", "Open in the builder", the save error). This is not in the frame (**decision**, §15).

Focus moves to the first field when the panel opens (or to the field the Try next action targets), Escape closes it, and focus returns to the preview button that opened it.

### 8.6 History (frame 07)

Route `/generate/history` (§11.1). Layout, top to bottom:

1. Header (page gutters, gap 8): breadcrumb "Generate" / "History" (same style as §8.4); the title row (space-between): "History" in `.sp-page-title` and the `New chat` button; the description "Every chat and the posts it made, newest first. Open one to pick up where you left off." (14/120% Regular `--text-secondary`).
2. 24px, then the filter bar: reuse `.sp-filterbar` with `TemplateSearchField` (placeholder "Search chats", aria-label "Search chats") and `GroupChips`. Add an optional `allLabel` prop to `GroupChips` (default "All") and pass "All chats". Build the facets from the platforms present in the member's chats (a small query, §12), in `PLATFORMS` order. Selecting a chip or typing is a navigation, as on Brand Templates (`platform` and `q` in the URL).
3. 16px, then the grid's scroll container: it runs the full width of the page region and carries the side gutter as its own inner padding (24 top, gutter sides, 0 bottom), so card shadows are never clipped by the scrolling edge. Inside, the grid: `grid-template-columns: repeat(auto-fill, minmax(220px, 1fr))`, gap 12. At 1440 the Figma gets four columns of 244.75.
4. Top and bottom `ScrollFade`s inside the scroll container (§7.19). In the frame the bottom fade is showing because more chats load below.
5. Footer links, as on the Start state.

Infinite scroll: load 12 chats at a time. An `IntersectionObserver` sentinel after the grid (root: the scroll container, `rootMargin: "0px 0px 400px 0px"`) requests the next page; while it loads, append four `HistoryCard` loading placeholders; stop when a page comes back short. Announce "Showing N chats" in a `.sp-live` region after each load **(proposed copy)**.

Empty (no chats at all): an `.sp-emptystate` with the title "No chats yet" and the body "Chats you start in Generate show up here, newest first." and a `New chat` button **(proposed copy)**. Empty after filtering: reuse the Brand Templates pattern ("No chats match “q”." with Clear) **(proposed copy)**. Load failure: `ErrorState` with "We couldn't load your chats." and "Check your connection and try again." **(proposed copy)**.

## 9. Behavior

### 9.1 Chat model (client)

Create `src/lib/generate/chat.ts` with the types, and `src/lib/generate/chatReducer.ts` with a pure reducer that owns every transition. Components never mutate turns directly.

```ts
export interface ChatPhoto { dataUrl: string; aspect: number; source: "upload" | "paste" | "brand"; assetId?: string }

export interface ChatDraft {
  id: string;                     // stable per draft, for keys and selection
  proposal: GeneratedProposal;
  schema: TemplateSchema;         // fetched (library) or designToSchema (freestyle)
  values: FieldValues;            // measured and repaired values, then the member's edits
}

export interface UserTurn {
  id: string; role: "user"; text: string; createdAt: string;
  photo?: ChatPhoto;              // in memory only, never persisted
  hadPhoto?: { aspect: number };  // what is persisted instead
  platformHint?: PlatformId; variations: number; templateIdHint?: string;
  intent: "brief" | "followUp" | "platform" | "freestyle";
}

export type AssistantPhase = "asking" | "measuring" | "done" | "stopped" | "error";

export interface AssistantTurn {
  id: string; role: "assistant"; createdAt: string;
  replyTo: string;                // the UserTurn id
  phase: AssistantPhase;
  step: 1 | 2 | 3;
  stepLabel: string;
  status: string;                 // the sentence shown above the drafts
  expected: number;               // skeleton count while asking
  drafts: ChatDraft[];
  pendingSlots: number;           // skeletons still unresolved while measuring
  reply?: string;                 // from the server (§10)
  warnings: string[];
  error?: string;
  meta?: { model: string; candidateCount: number; mode: "library" | "freestyle" };
}

export interface ChatThread {
  id: string | null;              // null until first persisted
  title: string;
  turns: Array<UserTurn | AssistantTurn>;
  createdAt: string; updatedAt: string;
}
```

UI state that is not part of the thread (open editor draft id, selected caption tab per turn, attach menu open) lives in component state.

### 9.2 A run

Sending (from the composer, a Start from chip plus text, or a Try next action that runs the model) appends a `UserTurn` and an `AssistantTurn`, then:

1. **Step 1, asking.** `stepLabel` "Reading your brief" **(proposed copy)**. Status: "Reading your brief and choosing from your templates." in library mode, "Designing new layouts from your brand kit." in freestyle **(both proposed copy)**. Show `min(variations, 3)` skeletons. Call `stores.generate.generate(company.id, input)` with the input built as today (brief, platformHint, templateIdHint, count, mode, `hasImage` and `imageAspect` only), plus `followUp` for follow-ups (§9.3).
2. **Step 2, measuring.** `stepLabel` is "Rendering both sizes" when the proposals span exactly two distinct canvas sizes, "Rendering N sizes" for three, and "Rendering your draft" for one **(the first is the frame's copy, the other two are proposed copy)**. Status: "Filling in your A and B templates." using the proposals' template names (one name: "your A template"; three: "A, B, and C"). Freestyle: "Laying out N new designs." **(proposed copy)**. Resolve proposals one by one exactly as `resolveProposal` does today (designToSchema for freestyle plus `measureProposal`; `stores.templates.get` plus `repairProposal` for library), replacing each skeleton in place as a draft lands. Keep the existing warning strings for dropped drafts.
3. **Step 3.** Advance to step 3 with `stepLabel` "Checking every line fits" **(proposed copy)** while any repair round is in flight, and in any case once the last proposal is being resolved, so the bar reaches the end before the turn completes. The bar moves by step, never by time: the duration cannot be predicted.
4. **Done.** `phase: "done"`. The status becomes `reply` from the server, or, if it is absent, "Here you go, with a caption for each draft." **(proposed copy)**. Warnings render under the drafts in 12px `--text-muted`, one per line, as today. The provenance line ("Drafted by <model> from …") moves into the drafts' accessible description only; it is not drawn.
5. **Nothing fit.** If every proposal is dropped, `phase: "error"` with today's copy ("None of the drafts fit their templates. Try a shorter brief, or fill a template directly. The library is unaffected.") and a `Try again` button (tertiary, small) that re-sends the same user turn.
6. **Server error.** `phase: "error"` with the server's sentence (already surfaced by `readErrorMessage`, including the rate-limit message) and the same `Try again`.

The photo used for a turn is snapshotted on its `UserTurn`, exactly like `Results.image` today; attaching or removing a photo later never re-derives earlier drafts.

### 9.3 Stopping, follow-ups and the composer while running

- While a turn runs, the composer's text stays editable but Send is in its Stop state. Stop aborts: add an optional last parameter `opts?: { signal?: AbortSignal }` to `GenerateProvider.generate` and `GenerateProvider.repair`, forward the signal to `supabase().functions.invoke` in the Supabase provider when the installed `@supabase/functions-js` accepts `signal` (check its `FunctionInvokeOptions` type), and ignore it in the local provider. In every case, tag each run with an id and ignore late results from a stopped or superseded run. An aborted request can still finish on the server and count toward the rate limit; that is acceptable. The measuring loop checks the flag between drafts. The turn becomes `phase: "stopped"` with the status "Stopped. The drafts that finished are below." **(proposed copy)**, keeping any drafts that already resolved.
- A follow-up (text sent in the thread) builds `followUp: { previousBrief, drafts }` from the thread's first brief and the latest done turn's drafts (`templateId`, `templateName`, current `values`, text fields only) and sends the new text as `brief`. Mode follows the latest turn: if its drafts were freestyle, the follow-up runs in freestyle with `brief` set to the previous brief plus a blank line plus the new text, and no `followUp` object.
- Only one run at a time. Starting a new chat (New chat) while a run is in flight stops it first.

### 9.4 Try next

`src/lib/generate/tryNext.ts`, pure and unit-tested. For the latest done turn, return at most three actions in this order:

1. **Fill an empty optional field.** The first member text field, in form order across the turn's drafts, that is optional, empty, and not an image field. Label: `Add a ${label.toLowerCase()}` ("an" before a vowel sound). Action: open the Editor panel on the first draft that has that field and focus it (frame 06 shows exactly this for Location). No model call.
2. **Another platform.** The first of `facebook`, `instagram`, `linkedin` that none of the turn's drafts covers (by `classifySize`). Label: `Make a ${platformLabel} version`. Action: a run with `intent: "platform"`, the user text equal to the label, `platformHint` set, `count: 1`, and the `followUp` context so the facts carry over.
3. **Another layout.** Label: "Try another layout". Only when the active brand kit has at least one palette color (freestyle refuses otherwise). Action: a freestyle run with `count: 1`, `platformHint` from the first draft's platform, and the brief from §9.3.

Chip clicks that run the model behave like sending a message: the label appears as the user bubble. Hide the row while a run is in flight.

### 9.5 Editing

`src/lib/generate/linkedFields.ts`, pure and unit-tested:

- Build field groups across the turn's drafts. Consider member (non-static) text, multiline and select fields. Group by `fieldKey`; fields with different keys but the same normalized label (lowercase, alphanumerics only) also join a group. Select fields only group when their option lists are identical.
- Each group has: `label` (from the first draft that has it, in that draft's form order, followed by fields only other drafts have, in their order), `required` (true if any member is required), `maxLength` (the smallest across members), and `members: Array<{ draftId, fieldKey }>`.
- Editing a group writes the value to every member draft. The hint in the footer says so.
- Image fields: a draft whose member image slot is filled by the turn's photo does not list that slot. Any other empty member image slot appears after the text groups as its own entry, rendered with `FieldInput` (upload and crop at the slot's own aspect), labelled with the size it belongs to when more than one draft exists, for example "Headshot · Instagram" **(decision**, §15; the frame shows only text fields).
- The size switch picks which draft the preview shows and which draft Download PNG exports. Edits apply to all drafts regardless.
- Opening the panel on a library draft is the moment that corresponds to opening the fill page today: the panel's live `SchemaRenderer` with `instrument` true records the `open`, and its `exportPng()` records the `download`, so Insights keeps counting Generate traffic the same way. Freestyle drafts use `instrument={false}`.

### 9.6 Downloading from a draft card

The card's Download renders the draft through the one export path without opening the editor. Mount one hidden-but-laid-out `SchemaRenderer` per request (copy the off-screen technique from `BulkExportStage`: real dimensions, far outside the viewport, never `display: none`), wait for the commit of those exact values plus two animation frames, then call its handle's `exportPng()`. Library drafts use `instrument` true (the fill page's open plus download semantics), freestyle drafts false. Show the button's busy state while it runs (spinner is not in the frame: dim the glyph to 40% and set `aria-busy`). Surface `ExportAssetError` messages the way `TemplateFill` does.

### 9.7 Start from chips

Up to five chips built from the company's published templates (`stores.templates.listPublished`), most recently updated first. If the route carries `?template=<id>` (the existing hint from template cards) and that template is published, it is pinned on load and appears first. Clicking a chip pins it (`aria-pressed`, selected style) and clicking it again unpins it; only one is pinned at a time. The pinned template is sent as `templateIdHint` on the next send and then unpinned. The Figma's chip labels (Now hiring, Event announcement, Team spotlight, Webinar promo, Company update) are sample template names, not copy (**decision**, §15).

### 9.8 Persistence

- A chat is saved the first time its first assistant turn reaches `done`, `stopped` or `error` (a chat with no finished turn is not saved). On creation, replace the URL with `/generate/c/<id>` (`navigate(..., { replace: true })`).
- It is updated after every later turn finishes and after editor changes (debounced 800ms).
- Saved: the title, the turns (user text, `hadPhoto` aspect, hints, variation count, intent; assistant phase, reply, warnings, error, meta, and for each draft its `proposal` including `design` for freestyle, and its current `values`), `platforms` (distinct platform ids across all drafts), and a `preview` (the first draft of the first done turn: its `templateId` or `design`, values, and canvas size). Never saved: photo data URLs, image field values that are data URLs, UI state. Strip every value that starts with `data:` before saving.
- Reopening a chat restores the thread. Library drafts refetch their template with `stores.templates.get`; if it is gone or unpublished, the card shows today's copy ("<name> is no longer available.") in place of the preview and cannot be edited or downloaded. Freestyle drafts rebuild from the stored design. Photos are not restored: slots show the thumbnail placeholder portrait, and the first reopened turn that had a photo shows, under its bubble, "Photos aren't saved with chats. Attach it again to use it in a new draft." in 12px `--text-muted` **(proposed copy)**.
- A failed save never interrupts the chat. Keep the thread in memory, retry at the next save point, and until a save succeeds show "This chat isn't saved yet." in 12px `--text-muted` under the composer **(proposed copy)**. This is also what happens before migration 0038 is applied.
- Cap a stored chat at 40 turns; beyond that, stop appending and show "This chat is full. Start a new chat to keep going." above the composer **(proposed copy)**.

### 9.9 Recent and History data

- Recent (Start state): the four most recently updated chats.
- History: all chats, newest first, 12 per page, filtered by platform (`platforms` contains) and by a case-insensitive title search.
- Meta line on recent and history cards: the chat's platform labels in order, joined with ", ", then " · ", then the date of `updatedAt`: "Today", "Yesterday", `MMM d` in the current year ("Sep 19"), `MMM d, yyyy` otherwise. Use `date-fns` (already a dependency). Put the formatter in `src/lib/generate/relativeDate.ts` with tests.
- The chat title: the server's `title` from the first turn (§10); if absent, the first six words of the first brief with a trailing ellipsis when truncated.

### 9.10 Keyboard, focus, accessibility, motion

- The thread is a `role="log"` with `aria-live="polite"` and `aria-relevant="additions"`. The status sentence has `role="status"`. The progress bar is a `role="progressbar"` with `aria-valuemin=1`, `aria-valuemax=3`, `aria-valuenow=step` and `aria-valuetext` equal to the progress label.
- Every card, chip, segment and menu row is reachable by keyboard with the app's focus ring. The hover overlay also shows on `:focus-visible`.
- New chat focuses the composer. Opening a chat from History focuses the composer. After a run finishes, focus stays where it was.
- Motion: skeleton-to-card swaps have no transition; the progress fill and the scroll fades use `--dur-panel` / `--dur-state`, which the stylesheet already zeroes under reduced motion.

## 10. Server changes (`template-generate`)

Keep the function's contract otherwise byte-for-byte. Add tests to `supabase/functions/_shared/generateValidate.test.ts` for every new parser and validator, and make `npm run typecheck:deno` pass.

1. **`followUp` (optional request field).** Shape: `{ previousBrief: string (1 to 1500 chars), drafts: Array<{ templateId: string, templateName: string (at most 120), values: Array<{ fieldKey: string (at most 60), value: string (at most 4000) }> }> (0 to 3) }`. Parse it with the helpers in `_shared/validate.ts`, rejecting anything else with a 400 in the existing style. In library mode, do not narrow the candidate list with it; add a section to `buildUserText` after the brief:

   > This is a follow-up in a chat. The member's earlier brief: … Their current drafts (templateId, name, values): … Their new message is the Brief above. If the message asks for changes, keep the same templates and revise only what it asks for. If it describes a different post, treat it as a new brief. Reuse facts from the earlier brief unless the new message replaces them.

   Drafts whose `templateId` is not in the candidate list are dropped from that section silently.

2. **`reply` and `title` (optional model output).** Add both as optional top-level string properties next to `proposals` in `PROPOSE_POSTS_TOOL` and `PROPOSE_DESIGNS_TOOL` (not in `required`). Validate in `generateValidate.ts`: trim, collapse whitespace, replace every em dash (U+2014) together with the spaces around it with ", ", drop the field if empty; `reply` at most 280 characters (cut at the last sentence end or word boundary before the limit), `title` 2 to 60 characters with no trailing punctuation. Return them in both response branches. Add `reply?: string` and `title?: string` to `GenerateResult` in `src/lib/types.ts`, and `followUp?: GenerateFollowUp` to `GenerateInput`.

3. **`prompt.ts`.** Append:

   > ## Reply and title
   > - reply: one or two sentences to the member about what you made, in the same plain voice as the values: which sizes, and any assumption they should check (for example where a button link points). No exclamation marks, no marketing filler, and never an em dash.
   > - title: two to five words naming the post in sentence case, no closing punctuation (for example "Creative Director post").
   >
   > ## Platforms
   > When the brief names more than one platform, cover each named platform with at least one proposal before repeating a platform.
   >
   > ## Follow-ups
   > A request may include the member's current drafts and a new message. Revise those drafts when the message asks for changes; start fresh when it describes a different post. Never drop facts from the earlier brief that the new message did not replace.

4. **Member-facing messages carry no em dash.** The chat shows the server's errors and `warnings` to the member, and many of them contain an em dash (U+2014) today. Rewrite every string that can reach the member without one, keeping its meaning: `HttpError` messages, `{ error }` bodies, and every `warnings.push(...)` in `template-generate/index.ts` and `_shared/generateValidate.ts`. Split at the dash into two sentences, or use a colon or comma where that reads better. For example, the rate-limit message becomes "You've hit the generate limit (10 in 10 minutes). Try again in a few minutes. The library and the manual fill path are unaffected." (the numbers stay interpolated from `LIMITS`). Apply the same rule on the client to the two fallbacks in `src/lib/stores/supabase/generateProvider.ts` ("Generate failed. Try again." and "The repair round failed. Try again.") and the two `ExportAssetError` messages in `src/lib/render/exportPng.ts`, which the card download surfaces. Leave `errors.push(...)` strings (they go back to the model in the retry turn and never reach the member), the model-facing text in `buildUserText` and `prompt.ts`, test names and code comments as they are. Update any test that asserts on a changed string.

5. **Unchanged:** `count` stays 1 to 3, the rate limits stay as they are (their message changes only as item 4 says), the repair path is untouched, and nothing is written to the database.

6. **Deploy note for CJ:** this needs `supabase functions deploy template-generate` after merge. Say so in the PR description. The client must tolerate a function that does not return `reply` or `title` yet (it falls back, §9.2 and §9.9).

## 11. Routing, navigation and links

### 11.1 Routes

In `src/app/router.tsx`:

```ts
| { name: "generate"; templateId?: string; threadId?: string }
| { name: "generateHistory"; platform?: PlatformId; q?: string }
```

| URL | Route |
|---|---|
| `/generate` | `{ name: "generate" }` (a new chat) |
| `/generate?template=<id>` | `{ name: "generate", templateId }` (pins a Start from chip) |
| `/generate/c/<threadId>` | `{ name: "generate", threadId }` |
| `/generate/history?platform=<id>&q=<text>` | `{ name: "generateHistory", platform, q }` (unknown platform reads as none, like the portal) |

Keep `routeToUrl` and `urlToRoute` in step, and extend the router tests if they exist. In `App.tsx`, render the chat page for `generate` with `key={route.threadId ?? "new"}` so switching chats resets state, and the History page for `generateHistory`. In `Sidebar.tsx`, the Generate item's `matches` becomes `["generate", "generateHistory"]`.

### 11.2 Buttons

- `History` → `/generate/history`.
- `New chat` → `/generate` (stops a running turn first; the current chat is already saved).
- Breadcrumb "Generate" → `/generate`.
- A recent or history card → `/generate/c/<id>`.
- "View all" → `/generate/history`.

### 11.3 Legal links

There are no Terms of Service or Privacy Policy links in the app yet. Add `src/lib/legalLinks.ts` exporting `TERMS_URL` and `PRIVACY_URL`, set to `https://www.socialpaint.ai/terms` and `https://www.socialpaint.ai/privacy` (**decision**: confirm the real URLs with CJ, §15). Open them in a new tab with `rel="noopener noreferrer"`.

## 12. Persistence layer

### 12.1 Migration `supabase/migrations/0038_generate_threads.sql`

```sql
-- Generate chats: one row per chat, private to the member who made it.
-- Photos are never stored (the member's photo never leaves the browser);
-- turns hold briefs, hints, proposals and field values only.
create table generate_threads (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies(id) on delete cascade,
  user_id     uuid not null default auth.uid() references users(id) on delete cascade,
  title       text not null default '' check (char_length(title) <= 120),
  platforms   text[] not null default '{}',
  preview     jsonb,
  turns       jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index generate_threads_owner_recent
  on generate_threads (company_id, user_id, updated_at desc);

alter table generate_threads enable row level security;

-- Strictly self-scoped, like user_notification_prefs: not even a company
-- admin reads another member's chats.
create policy self_read_generate_threads on generate_threads for select
  using (user_id = auth.uid() and company_id in (select current_company_ids()));
create policy self_insert_generate_threads on generate_threads for insert
  with check (user_id = auth.uid() and company_id in (select current_company_ids()));
create policy self_update_generate_threads on generate_threads for update
  using (user_id = auth.uid() and company_id in (select current_company_ids()))
  with check (user_id = auth.uid() and company_id in (select current_company_ids()));
create policy self_delete_generate_threads on generate_threads for delete
  using (user_id = auth.uid() and company_id in (select current_company_ids()));
```

There is no `updated_at` trigger convention in this repo, so the store sets `updated_at` explicitly on every update. Tell CJ in the PR that the migration must be applied (`supabase db push`).

### 12.2 Store interface

In `interfaces.ts`, add and wire into `Stores` as `generateThreads`:

```ts
export interface GenerateThreadStore {
  list(companyId: string, opts: { limit: number; before?: string; platform?: PlatformId; q?: string }):
    Promise<{ items: GenerateThreadSummary[]; nextBefore: string | null }>;
  platformsInUse(companyId: string): Promise<PlatformId[]>;
  get(companyId: string, id: string): Promise<GenerateThreadRecord | null>;
  create(companyId: string, input: GenerateThreadInput): Promise<GenerateThreadRecord>;
  update(companyId: string, id: string, input: GenerateThreadInput): Promise<void>;
  remove(companyId: string, id: string): Promise<void>;
}
```

Define `GenerateThreadSummary` (`id`, `title`, `platforms`, `preview`, `createdAt`, `updatedAt`), `GenerateThreadRecord` (summary plus `turns`), `GenerateThreadInput` (`title`, `platforms`, `preview`, `turns`) and the stored turn shapes in `src/lib/types.ts`, derived from §9.1 minus everything §9.8 says is never saved. `before` is the `updatedAt` of the last item of the previous page (keyset pagination on `updated_at desc, id desc`).

- `SupabaseGenerateThreadStore` in `src/lib/stores/supabase/generateThreadStore.ts`: select only summary columns for `list`, `contains('platforms', [platform])` for the platform filter, `ilike('title', …)` with `%` and `_` escaped for search, `lt('updated_at', before)` for paging, `limit(limit + 1)` to know whether another page exists. `platformsInUse` reads the `platforms` column for the member's rows and returns the distinct set in `PLATFORMS` order.
- `LocalGenerateThreadStore` in `localStores.ts`, with a `generateThreads` collection added to `Db` and `empty()` in `db.ts` (the existing spread upgrades old dev databases without a migration). Scope rows by company and by the dev user.

## 13. Copy deck

Final copy from the frames (use verbatim):

| Where | Copy |
|---|---|
| Start greeting | What are we painting today? |
| Start subline | Describe it and I'll build it from your templates, already on brand. |
| Start composer placeholder | Describe the post. Add any dates, names, or links it needs. |
| Thread composer placeholder | Ask for changes or describe a new post |
| Start chips label | Start from |
| Recent header | Recent · View all |
| Attach menu | Upload a photo · Choose from Brand Studio |
| Platform select default | Any platform |
| Stepper label | Variations |
| Header buttons | History · New chat |
| Breadcrumb root | Generate |
| Assistant name | SocialPaint |
| Progress label (two sizes) | 2 of 3 · Rendering both sizes (the pattern: `${step} of 3 · ${stepLabel}`) |
| Status while filling | Filling in your Now hiring and Open role templates. (the pattern, with the real template names) |
| Caption card | Caption |
| Follow-ups label | Try next |
| Follow-up chips | Add a location · Make a Facebook version · Try another layout (the patterns in §9.4) |
| Editor title | Edit details |
| Editor size switch | Instagram · 4:5 · LinkedIn · 1.91:1 (the pattern) |
| Editor optional tag | Optional |
| Editor hint (two drafts) | Edits update both sizes. |
| Editor primary | Download PNG |
| Composer footnote | Every graphic follows your Brand Studio rules. |
| Legal links | Terms of Service · Privacy Policy |
| History title and description | History · Every chat and the posts it made, newest first. Open one to pick up where you left off. |
| History filter | All chats |

Sample content in the frames that is not copy: the brief ("We're hiring a Creative Director…"), the reply ("Here you go, in both sizes…"), the caption text, the chat titles and dates, and the template names. These come from the member, the model and the library.

Every other string in this document marked **(proposed copy)** is a draft for CJ to confirm; ship it as written if he has not changed it.

## 14. Phases, files and acceptance

### Phase 1: tokens, primitives and icons

Add the §5.3 token group; `icons.tsx`; `ChatButton`, `SendButton`, the icon button presets, `CardAction`, `SuggestionChip`, `VariationsStepper`, the `Select` tile trigger, `FieldInput variant="chat"`, `ScrollFade`, `AttachmentThumb`, `UserMessage`, `AssistantHeader`, `DraftCard`, `DraftCardSkeleton`, `CaptionCard`, `RecentCard`, `HistoryCard`.

Accept when: each component matches its set in `00-components.png` in both themes at 100% zoom (compare side by side); no raw hex outside the token block; `npm run verify` is green.

### Phase 2: server

§10 in full, with tests.

Accept when: the new validators are tested (reply trimming and length, title rules, em dash replacement, followUp parsing and rejection); an old client payload still produces a byte-for-byte compatible response apart from the two optional fields and the reworded messages (§10 item 4); no member-facing string in the function, `generateProvider.ts` or `exportPng.ts` contains an em dash; `npm run verify` (which includes `typecheck:deno`) is green.

### Phase 3: the chat

`chat.ts`, `chatReducer.ts` (+ tests for every transition, including stop, superseded runs, dropped drafts and errors), a `useChatController` hook that runs §9.2 and §9.3, `tryNext.ts` (+ tests), the rewritten `GeneratePage.tsx` (Start state and thread states), `Composer`, `AttachMenu`, the routes in §11.1, `useFullViewport`, the top scroll fade.

Accept when: frames 01 to 05 are reproduced in both themes at 1440 × 1053 (open each PNG next to the running app); a run shows three steps, skeletons that turn into cards in place, the caption card, and Try next; Stop works mid-run; a follow-up revises the drafts; paste and drop attach a photo; Choose from Brand Studio attaches a brand image; the photo never appears in any network request (check the request body in devtools).

### Phase 4: the editor

`linkedFields.ts` (+ tests), `EditorPanel`, compact cards and the selected outline, direct card downloads (§9.6), Save to library for freestyle.

Accept when: frame 06 is reproduced in both themes; editing a shared field updates both previews; Download PNG and the card download produce the same bytes as the fill page for the same template and values; opens and downloads appear in Insights for library drafts and never for freestyle drafts; "Add a location" opens the panel with Location focused.

### Phase 5: persistence and History

The migration, the store interface and both implementations, saving and resuming chats (§9.8), Recent on the Start state, the History page (§8.6), `relativeDate.ts` (+ tests), the `GroupChips` `allLabel` prop, the sidebar `matches`.

Accept when: frame 07 is reproduced in both themes; a chat survives a reload at `/generate/c/<id>`; History pages in 12s with loading cards and stops at the end; platform chips and search filter correctly and live in the URL; another member of the same company cannot read the chat (verify the RLS policies against a real Postgres, as `supabase/verify` does for links); no stored row contains `data:`.

### Phase 6: cleanup and QA

- Remove what no longer has a caller: the `.sp-gen-*` rules, `STARTERS`, the mode toggle markup, `ProposalCard`, `SkeletonCard`, and `seedHandoff.ts` together with the `takeSeed` call in `TemplateUsePage.tsx` if Generate was its only producer (grep first).
- Update the Generate section of `docs/ARCHITECTURE.md` (chats, persistence, the new function fields) and the `GenerateProvider` comment in `interfaces.ts`.
- QA in both themes at 1440, 1280, 1024 and 768 wide; keyboard-only pass through every state; reduced-motion pass; Safari export check (the double `toPng` path is unchanged, but confirm a card download works there).

Accept when: `npm run verify` is green, the bundle has no dead Generate code, and every open question in §15 is listed in the PR description with the choice you made.

## 15. Decisions this document makes (list them in the PR for CJ)

1. The Start state has no page title (the dark frames and today's page have none; the light frames show "Generate").
2. The My templates / Something new toggle leaves the composer. Freestyle runs from "Try another layout" and when the library is empty.
3. "Start from" chips are the company's published templates and pin `templateIdHint`; the frame's labels are sample names.
4. Variations runs 1 to 3 to match the server; the frame's Max sample shows 4. Default 2.
5. The progress bar has three steps: reading the brief, rendering, checking the fit.
6. The server returns an optional `reply` and `title`, and accepts a `followUp` context.
7. Try next is derived on the client by the rules in §9.4.
8. Chats persist in a new `generate_threads` table, private to their author, without photos.
9. Unfilled member image slots appear in the editor after the text fields.
10. Freestyle drafts show Save to library in the editor for admins.
11. Terms and Privacy URLs are placeholders until CJ confirms them.
12. The new button kinds are scoped to Generate. Rolling them out app-wide (buttons as solid color, no shadow, distinct from chips) is a separate change.
13. Button and chip labels are Display Regular as drawn, which departs from the design-system note that controls use Medium.
14. Chip labels are 13px (the component default). Some frames carry 10px labels as per-instance tweaks; they are not built.
15. The editor's selected segment differs by theme as drawn (white with a shadow and Medium labels in light, #3d4042 with Slime Regular labels in dark).
16. Below 1180px the editor becomes an overlay sheet; the frames only show 1440.
17. Compact draft cards show the platform name as their meta, as the Figma draws it; Regular cards keep the size meta (CJ, 2026-09-25).

## 16. Out of scope

Sharing to LinkedIn from the chat, bulk runs from the chat, multi-photo messages, editing the caption text, deleting or renaming chats from History (the store supports `remove`; the UI for it is a later change), and the public-link page.

Also out of scope: keeping em dashes out of the captions and field values the model writes. The generator's own system prompt uses them heavily, so the model will too. That is a separate change to `prompt.ts` and the validators; do not make it here.
