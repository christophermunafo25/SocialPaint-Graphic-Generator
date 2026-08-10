# Canvas editing interaction audit — bug register

Phase 0 deliverable. Audit of the Template Builder's canvas editing experience
(FieldOverlayEditor, TemplateBuilder, FieldInspector/InspectorControls,
GradientEditor, SchemaRenderer, autoFit, useHistory, fieldOps) against the
Figma bar. Items marked **confirmed** were reproduced in the running app;
**plausible** items are code-derived and need the Phase 5 walk.

Severity: **blocking** > **rough** > **polish**.

**Phase 1 status (pointer/drag foundation, shipped):** react-moveable replaced
by `canvasGesture.ts` + in-house selection chrome. Fixed: #1 (select+drag in
one gesture), #2 (drag threshold), #3 (pointer capture), #4 partially (Escape
cancels the drag and keeps selection; shortcuts are inert mid-drag), #5 (grid
quantization removed; smart guides with ⌘/Ctrl suppression), #7 (draw path
rAF-throttled), #9 (min clamp live, from the start rect), #10/#25 (real
per-frame geometry, no style fights, memoized content), #12 (removed with the
transform preview — resize now writes real dimensions per frame, which also
pre-empts the Phase 2 stretch fix), #15 (rotated resize verified drift-free),
#16 (rounding once at commit). Still open for later phases: resize modifier
keys, corner-font-scaling semantics (Phase 2), numeric gradient inputs
(Phase 3), #6, #11, #13, #14, and the polish rows.

**Phase 2 status (resize semantics, shipped):** #8/#9/#10 closed — resize
changes the box and only the box. Corner font-scaling deleted; font size never
changes as a side effect of a resize (fit modes still derive their DISPLAYED
size from the new width, identical live and after release). Shift =
proportional (dominant-axis driven, snap applied to the driving edge before
the ratio), Alt/Option = from-center; both read live per frame, combinable.
Min clamp verified: stops at 16 with the anchored edge fixed, no inversion,
no release jump. Auto-height does not exist in the element data model (fields
have fixed height; text modes are free/shrink/fixed) — adding it is a data
model change, reported rather than made. Remaining from #13: shift axis-lock
on MOVE and arrow-key nudge (Phase 4).

**Phase 3 status (numeric inputs, shipped):** #17, #18, #19, #20 closed. The
existing `NumericField` was extended, not duplicated. GradientEditor's two raw
inputs (stop position, angle) now run on NumericField — clearing a stop
reverts instead of committing 0; a lone `-` in angle reverts instead of
writing NaN. `LegacyFieldInspector` + `InlineNum` + `CornerRadiusControl`
(~940 lines of dead code carrying the per-keystroke constant-fallback
pattern) deleted, along with their orphaned imports. Display format trims
trailing zeros ("45", not "45.00") while precision stays enforced on commit.
Undo coalescing is now opt-in: keystroke streams (`stream` flag) collapse by
time window, pointer gestures collapse by hold, and discrete numeric commits
are exactly one undo entry each — verified with two commits 50ms apart
undoing as two steps. Every `?? constant` commit fallback now reverts to the
field's current value instead.

**Phase 4 status (remaining register, shipped):** All rough items closed —
#22 alt-click digs through overlapping elements (top → beneath, wrapping,
rotation-aware hit test, drags in the same gesture); #23 double-click enters
in-place text editing for fixed text (contentEditable mirror of the real
render — same face, fitting, alignment; Enter/blur commits ONE undo entry,
Escape reverts) and focuses the inspector Name for member-editable elements;
#14/#12 handles thin to corners-only below 28 screen px per axis; #13 shift
axis-locks moves (dominant axis, re-read per frame) and arrows nudge 1px /
shift 10px with streak coalescing; #6 moves clamp live so ≥24 canvas px of
the selection stays on canvas (bleeds still allowed, total loss impossible).
Polish closed: #24 undo/redo re-selects the fields the history jump changed;
#21 scrub commits are rAF-throttled with an exact landing on release.
Closed as designed: #16 half-pixel centering is inherent to the integer
x/y/w/h data model (error bounded at ±0.5, no accumulation); #30 screen-space
snap thresholds match design-tool convention; #27 font-loading effect is
cheap (downstream cache) and left keyed as-is.

**Phase 5 status (verification walk, complete):** All ten checklist scenarios
pass. One defect found AND fixed during the walk: the Phase 4 handle-thinning
rule hid the side handles on a standard 480×90 text row at fit zoom (22
screen px tall < 28px threshold) — replaced with edge-strip resize surfaces:
the whole border is grabbable at any size (Figma model), dots are wayfinding
and thin per-axis without ever costing the interaction. Verified: side-drag
reflow at constant font with a uniform (never stretched) content transform;
fast jump-drags; outside-window release commits exactly at the visibility
clamp with no stuck state; window-blur and Escape cancel mid-drag with
selection kept and clean state after; clear-and-blur reverts; digit-by-digit
typing commits nothing until Enter; Escape reverts fields; resize + one undo
restores fully; rotated (30°) resize along its own axes with the anchor
corner fixed to 0.4px; min-clamp stop/pick-up to exact expected values;
scale change (viewport 1600→1100, scale 0.243→0.191) with pixel-exact cursor
tracking; move/resize/commit each repeated 3× with identical results and no
drift.

Feels-off notes (not defects, candidates for future passes):
- Rotate handle is a small floating target (16px, 26px above the box);
  Figma-style rotate zones just outside the corners would be kinder.
- Dragging on empty canvas draws a new field; users with Figma muscle memory
  will expect marquee selection there. Worth a deliberate design decision
  (e.g. marquee by default, draw behind a modifier or palette mode).
- Multi-selection gets group MOVE only — no group resize/rotate handles.
- No global cursor override while a gesture is live; the cursor can flicker
  crossing other elements mid-drag.
- The label chip can collide with the rotate-handle stem on short elements.
- Alt-click deep-select and shift-axis-lock are undiscoverable; one line in
  the canvas hint copy would carry them.
- Pen/touch: capture is wired via setPointerCapture but only mouse-class
  pointers were driven in verification — worth a quick trackpad/touch sanity
  check on real hardware.

## Pointer and drag mechanics

| # | What the user sees | Origin | Root cause | Severity |
|---|---|---|---|---|
| 1 | First drag on an unselected element selects it but does not move it; only the second press drags. **Confirmed.** | `FieldOverlayEditor.tsx:266-276`, `116-123` | Moveable's target binds via a post-render effect (`targetEls`), so it mounts after the pointer-down and can never join the gesture that selected the element. | blocking |
| 2 | A click that slips 1px commits a position change (≈4 canvas px at fit zoom), an undo entry, and an autosave. | `FieldOverlayEditor.tsx:382-391` | Moveable drag has no movement threshold and `onDragEnd` commits whenever `lastEvent` exists. | rough |
| 3 | Release outside the window / pen or touch drags / cmd-tab mid-drag may leave the drag live or stuck. **Plausible — verify in Phase 5.** | `react-moveable`→`gesto` (no `setPointerCapture`); no cancel handling in `FieldOverlayEditor.tsx` | Gesto listens on `window` for mouseup and never captures the pointer; nothing cancels the gesture on window blur. | rough |
| 4 | Escape mid-drag kills the drag *and* the selection (element snaps back, deselected); Delete mid-drag deletes the element being dragged. | `TemplateBuilder.tsx:484-489` | The global keydown handler doesn't know a canvas gesture is in progress. | rough |
| 5 | Elements move in 10-canvas-px steps and can never sit between grid lines; guides capture from ~25-40 canvas px away; no modifier disables snapping. **Confirmed** (commits land on multiples of 10; center guide captured X during a normal drag). | `FieldOverlayEditor.tsx:157-170` | `snapGridWidth` (10 canvas px ≈ 2.4 screen px) is smaller than `snapThreshold` (6 screen px), so every pointer position is inside a snap zone; snap is unconditional. | rough |
| 6 | An element dragged past the canvas edge disappears (overflow hidden) and is only recoverable via the field list + inspector. | `FieldOverlayEditor.tsx:176`, `commitPos` (no clamp) | No drag bounds and no commit clamp, with a clipping container and no pasteboard. | rough |
| 7 | Drawing a new field re-renders per pointer event. | `FieldOverlayEditor.tsx:209-219` | `setDraw` writes React state on every pointermove (no rAF batching). Draw path *does* use pointer capture correctly. | polish |

Not an issue: pointer coordinates are converted through a live
`getBoundingClientRect` per event (`toCanvas`), so scroll/resize mid-drag is
correct; there is no canvas zoom feature today, so zoom-transform bugs can't
exist yet (Phase 1's shared handler should still centralize the conversion).

## Resize semantics — the known stretch bug

| # | What the user sees | Origin | Root cause | Severity |
|---|---|---|---|---|
| 8 | **The stretch-then-snap.** Mid-drag the content (glyphs included) is stretched with a non-uniform `transform: scale(sx, sy)`; real dimensions commit only on release, when text suddenly reflows/refits. | `FieldOverlayEditor.tsx:404-409` (preview), `413-435` (commit) | Resize previews by transform instead of writing real dimensions per frame. | blocking |
| 9 | Font size changes on resize: corner drags rescale `fontSizePx` by the height ratio on release; side drags of auto-fit/fixed-width text also jump size on release when the fitter recomputes. Spec: box changes, font size never does. | `FieldOverlayEditor.tsx:429-434`; `SchemaRenderer.tsx:313-317` + `autoFit.ts` | Deliberate "font follows the box" behavior plus fit recomputation, both contrary to the required model. | blocking |
| 10 | Text never reflows during the drag — only once, on release. | same as #8 | Content isn't re-laid-out per frame; it's transform-stretched. | blocking (subsumed by #8) |
| 11 | Box can be dragged below the minimum (to ~0), then jumps to 16 canvas px on release; when the clamp engages on a top/left-handle resize the committed origin isn't recomputed, so the box can shift. | `FieldOverlayEditor.tsx:421-426` | `Math.max(16, …)` applies only at commit, after Moveable's unclamped geometry, without re-deriving left/top. | rough |
| 12 | During a resize the box may flicker: React re-renders every frame (dims readout state) and rewrites each box's style from *committed* state, fighting Moveable's direct DOM writes until the next pointermove; every fixed-width text field re-measures glyphs per frame. **Plausible — verify visually.** | `FieldOverlayEditor.tsx:67-72`, `285-301`, `411` | `showDims` sets state per frame; box styles derive from stale committed fields during the gesture. | rough |
| 13 | No shift-proportional resize, no alt-from-center, no shift axis-lock on move, no arrow-key nudge of the canvas selection. | `FieldOverlayEditor.tsx` (no `keepRatio`/modifier wiring), `TemplateBuilder.tsx:451-493` | Never implemented. | rough |
| 14 | On a small element the resize/rotate handles crowd and overlap the body — aiming at the box grabs a handle. **Confirmed** (accidental top-handle resize while trying to drag a 480×90 box at fit zoom). | Moveable default handles, `FieldOverlayEditor.tsx:381` | Fixed-size handles with no minimum-element accommodation. | rough |
| 15 | Rotated-element resize: Moveable computes rotation-aware origins, but the after-the-fact clamp/rounding of #11 applies. **Verify in Phase 5** that a rotated element resizes along its own axes without origin drift. | `FieldOverlayEditor.tsx:413-435` | — | verify |
| 16 | Repeated resizes of an odd-sized center-anchored element can walk position by ±1px (rounding a stored center + halved width per commit). | `FieldOverlayEditor.tsx:127-132` | Round-tripping rounded center coordinates. | polish |

## Numeric inputs — the known "defaults to a constant" bug

Finding first: the inspector rebuild (commit `a583171`) already implements most
of the Phase 3 contract. `NumericField` (`InspectorControls.tsx:239-426`) keeps
a draft string while focused, commits on Enter/blur, reverts on Escape and on
unparseable/empty input, clamps and enforces precision on commit, steps with
arrows (shift ×10), and scrubs with pointer capture + one undo entry per
gesture. **Runtime-verified:** clearing W and blurring reverts to the prior
value; typing "12" digit-by-digit commits nothing until Enter. The literal
constant-fallback bug no longer exists in the live inspector — it survives in
two other places:

| # | What the user sees | Origin | Root cause | Severity |
|---|---|---|---|---|
| 17 | **Gradient editor wrecks values while typing.** Clearing a stop's position instantly commits 0 (gradient collapses — **confirmed**, 100→0 on clear); clearing the angle commits 0; typing a lone `-` in angle writes `NaN` into state and the background renders `linear-gradient(NaNdeg …)` (invisible) until retyped. Applies to the canvas background gradient. | `GradientEditor.tsx:55-70` (stop), `93-99` (angle) | Controlled-by-parsed-state inputs committing `Number(e.target.value)` on every keystroke with no draft, no NaN guard. | blocking |
| 18 | (Latent) The old per-keystroke pattern lives on in dead code: `LegacyFieldInspector` + `InlineNum` + `CornerRadiusControl` (~1,300 lines, exported, never rendered) commit `Number()`/`|| 0` per keystroke. | `FieldInspector.tsx:169-204`, `1171-2010`, `2422-2487` | Kept "while controls migrate"; migration is complete. | polish (delete) |
| 19 | Font size displays as "45.00". | `FieldInspector.tsx:901-909` (precision 2) + `InspectorControls.tsx:269` (`toFixed` always) | Display formatting always pads to the precision instead of trimming trailing zeros. | polish |
| 20 | Two commits of the same property within 400ms collapse into one undo entry (fast Enter-Enter loses the intermediate undo stop). | `TemplateBuilder.tsx:253-272`, `useHistory.ts:20` | Time-window coalescing keyed only on property name, applied to discrete commits as well as streams. | polish |
| 21 | Scrubbing a numeric label writes state per pointer event (no rAF batch) — full builder re-render per mousemove. | `InspectorControls.tsx:328-337` | Un-throttled commit in `onScrubMove`. | polish |

Also checked and clean: FillPicker's hex/opacity/gradient controls use
NumericField/HexInput with proper draft-commit semantics and pointer-captured
sliders; Max chars and Crop ratio use `allowEmpty` NumericFields (empty is a
legitimate "unset", not a constant).

## Modifier keys and constraints

Covered by #13. Existing: shift/⌘-click multi-select, ⌘C/X/V/D, ⌥⌘C/V style
clipboard, Delete, Escape-deselect, ⌘Z/⇧⌘Z. Missing vs spec: shift-proportional
resize, alt-from-center resize, shift axis-lock move, arrow nudge (+shift for
×10), and a snap-suppression modifier.

## Selection and hit testing

| # | What the user sees | Origin | Root cause | Severity |
|---|---|---|---|---|
| 22 | No way to select an element underneath another from the canvas (no alt-click / click-again deep select; ⌘-click is taken by multi-select). Top box under the pointer always wins, even where it's visually transparent. | `FieldOverlayEditor.tsx:266-276` | Hit testing is the DOM box, topmost z only. | rough |
| 23 | No double-click-to-edit text on the canvas; text content/labels are edited only in the inspector. | absent from `FieldOverlayEditor.tsx` | Never implemented. | rough |
| 24 | Undo of a delete (or redo of an add) doesn't restore selection. | `TemplateBuilder.tsx:124-146` vs `selectedIds` state | Selection lives outside the history state. | polish |

Selection correctly survives move/resize/inspector edits (ids are stable), and
a deleted field is pruned from selection.

## Undo and redo

Healthy overall — **confirmed**: one entry per drag/resize gesture (commit on
release), one per numeric commit, one per scrub gesture (`hold` flag), no-op
commits don't burn entries, autosave doesn't break coalescing, history resets
on load/save boundaries. Defects: #20 (over-coalescing across discrete
commits), #24 (selection not restored).

## Snapping and alignment

Guides exist (canvas edges/centers + other elements). Defects: #5
(always-snapped grid, grabby thresholds, no modifier escape); threshold is in
screen px so snap reach in canvas px grows as the viewport shrinks
(`FieldOverlayEditor.tsx:162-167`) — polish.

## Rendering

| # | What the user sees | Origin | Root cause | Severity |
|---|---|---|---|---|
| 25 | Per-frame full-component re-render during resize (all field boxes + canvas glyph re-measure for fixed-width text) — see #12. Moves and rotates are clean (direct DOM writes, at most one state write per gesture). | `FieldOverlayEditor.tsx:67-72` | Dims readout is React state updated per frame. | rough |
| 26 | Release flash: content transform resets and text re-renders at committed size — the visible half of #8. | `FieldOverlayEditor.tsx:416-419` | Same as #8. | blocking (same fix) |
| 27 | `loadGoogleFonts` effect re-runs on every field commit (every drag end). Cached downstream, but it's per-commit work on the hot path. | `FieldOverlayEditor.tsx:89-91` | Effect keyed on the whole `fields` array. | polish |

## Notes for Phase 1 (no fixes made)

Today there are four separate drag systems: Moveable (field
move/resize/rotate), raw pointer events (draw-to-create), HTML5 DnD (palette →
canvas), and the sidebar's pointer handlers (NumericField scrub, FillPicker
sliders — these two are already well-behaved). The Phase 1 shared-handler work
concerns the canvas set. Fixing #1 (mount-after-pointerdown) inside
react-moveable likely requires its `dragStart`-forwarding API or replacing
Moveable with the shared handler — flagging now that this is the fork in the
road for Phase 1/2 scope.
