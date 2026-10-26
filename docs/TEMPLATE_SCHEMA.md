# Template schema

A template is **data, not code**: a background image plus an array of guarded
fields, rendered by the single `SchemaRenderer` component. No per-template JSX
exists anywhere. Source of truth: `src/lib/types.ts` (`TemplateSchema`,
`TemplateField`) ↔ `templates` / `template_fields` tables.

## TemplateSchema

| Field | Notes |
|---|---|
| `canvasWidth` / `canvasHeight` | Pixel size of the canvas. Chosen at creation — a `SIZE_CATALOG` preset (`src/lib/templates/platforms.ts`) or a custom size — and **every consumer reads from here** — renderer scale math, builder overlay, `toPng` export. New preset sizes = new catalogue entries, one file. |
| `backgroundUrl` | Storage URL of the uploaded/imported PNG. Converted to a data URL before render/export. |
| `fields` | Ordered `TemplateField[]`. **Array order is the member FORM order** (the sequence fields appear in the end-user's form — reordered by dragging in the builder's field list). Canvas paint order is the separate per-field `zIndex`. |
| `captionTemplate` | Merge string with `{field_key}` placeholders, e.g. `"{name} celebrated {years} incredible years!"`. Members see the merged result, can edit it, and copy it. Image fields have no caption value. |
| `backgroundColor` / `backgroundGradient` | Canvas base fill for blank-built templates: background image, then gradient, then color, then white. The gradient is the shared `TextGradient` shape (see **Gradients**). |
| `canvasEffects` | Optional `FieldEffect[]` on the whole canvas (migration 0048, `templates.canvas_effects`). `noise` paints over every field, as a Figma frame effect does; `innerShadow` insets the canvas edge; other types are ignored here. See **Effects**. |
| `variants` | Optional `TemplateVariant[]` — the template's colourways, sharing these fields and this geometry. See **Variations** below. Absent or a single entry means single-variant: no picker, no filmstrip, the pre-feature path byte for byte. |
| `status` | `draft` \| `published`. Only published templates appear in the member portal. |

## TemplateField

Placement (canvas pixel space):

- `x`, `y`, `width`, `height` — the field box. `x/y` are the box's top-left,
  unless `anchor: "center"` (then they're the box center — for center-anchored
  text à la the original name banner).
- `rotation` — degrees about the box center.
- `zIndex` — canvas paint (layer) order, higher on top; controlled by the
  builder's "To front / To back". Deliberately decoupled from the fields
  array order (= form order). Never negative — layer moves renormalize all
  fields to 0..n-1 so nothing paints behind the background image.

Fixed elements:

- `static: true` + `staticValue` — the element exists on the graphic but is
  NOT member-editable: no form entry, no required check, no tag chip. The
  admin fixes the content (`staticValue` = the text, or an image URL uploaded
  from the inspector). Full canvas editing, styling, z-order, and clipboard
  behavior still apply. A leftover `{tag}` referencing a fixed text element
  merges to its `staticValue`. `select` fields can't be static.

Types:

- `text` / `multiline` — single/multi-line text.
- `image` — member uploads a photo; cropped to `aspectRatio` (falls back to
  the box's own ratio); `objectFit` cover/contain; `cornerRadius`
  (`{tl, tr, br, bl}` px, uniform = all equal via the builder's link toggle)
  renders identically in the builder, member preview, and PNG export because
  all three go through `SchemaRenderer`.
- `select` — fixed `options` list.
- `shape` — decorative design element (`shape`: rect | ellipse | triangle |
  star; a "Line" is a thin rect). Fill reuses the text pipeline (`colorHex` /
  `textGradient`); rects honor `cornerRadius`; non-rects
  render as inline SVG so gradients survive the PNG export. Always
  `static: true` — shapes never appear in the member form.

Brand binding (the rules engine — OPTIONAL, an opt-in reuse convenience;
admins style fields freely and directly by default):

- `typeStyleKey` — binds the field to a named brand type style ("role") from
  the brand kit. Every property the style defines (font, weight, case, color,
  letter spacing, line height, fixed size, max length, auto-fit) overrides the
  field-level values below and is locked: the builder disables those controls
  and shows the rule sentences; changing the style in Brand Studio restyles
  every bound field across every template. Properties the style leaves
  undefined stay field-editable. Resolution lives in
  `src/lib/brand/resolveStyle.ts`.

Locked styling (member can NEVER change these — used when no type style
defines the property):

- `fontFamily`, `fontSizePx`, `align`, `verticalAlign` (top/middle/bottom
  placement within the box, default middle), `uppercase`, `letterSpacingPx`,
  `lineHeight`.
- `colorHex` — any exact color via the full picker (brand colors copy their
  hex here at pick time; there is no field-level palette binding, only a
  bound type style's `colorKey` stays live); `textGradient` — an optional
  text-fill gradient (angle + stops). Precedence: type style → colorHex;
  gradient wins over solid when set. `fontWeight` is a free 100–900 value.

Shape, plate and mask (migrations 0034 to 0036):

- `strokeColor` + `strokeWidthPx` — a shape's outline (`#RRGGBB`, px, at
  least 1 when a color is set).
- `strokeAlign` — where that outline sits (migration 0048): `inside`
  (default, the painted size never exceeds the box), `center` or `outside`
  (painted beyond the box without moving it, the radius growing with it).
- `plateColor` + `platePaddingX` / `platePaddingY` — text fields only: a
  plate behind the text, sized to the rendered text plus padding and sharing
  the field's `cornerRadius` (unset radius renders a pill).
- `maskUrl` — image fields only: an alpha mask image stretched over the
  field's box.

Gradients: `textGradient` (and `backgroundGradient` on the canvas) is
`{ angle, stops[{ position 0..1, color }], kind?, center?, radius? }`.
Absent `kind` is linear along `angle`. `kind: "radial"` ignores the angle
and spreads from `center` (fractions of the box, default 0.5, 0.5) out to
`radius` (fractions of the box's width and height, default 0.5, 0.5). No
column is needed: the shape lives in the existing jsonb.

Effects (`effects`, migration 0048, `template_fields.effects`): depth,
painted in list order (Figma's order, bottom to top). Effects never change
layout; stacks still space by the box. Colors are `#RRGGBBAA`, lengths canvas
px. A malformed entry is skipped at render time (`src/lib/render/effects.ts`).

- `dropShadow` `{ x, y, blur, spread?, color }` — a glow is a drop shadow at
  0, 0 in a brand color. Painted as a CSS `drop-shadow()` filter on every
  field type, following the painted alpha (a rect's corners, a shape, the
  glyphs and plate, a masked photo's shape). `spread` is stored but not
  painted: filters have no spread, and `box-shadow`, which has one, is
  misplaced by WebKit when html-to-image exports through an SVG
  foreignObject.
- `innerShadow` `{ x, y, blur, spread?, color }` — rect shapes, images and
  the canvas only; ignored elsewhere. Painted as a blurred frame inside the
  box's clip (a ring of the color around a hole the size of the box, moved
  by the offset and shrunk by the spread). On a masked photo it follows the
  photo's box under the mask, not the mask's own edge.
- `layerBlur` `{ radius }` — blurs the element (CSS `blur()` at half the
  radius, as Figma exports it).
- `noise` `{ color, size, density, seed? }` — Figma's monotone grain: grains
  of `color` (its alpha is the strongest grain) covering `density` (0..1),
  each `size` px. Seeded, so every export of a template paints the same
  grain.

In the builder (brand-system Phase 2) every field has an Effects section and
the empty-selection rail has one for the canvas (grain and inner shadow).
Rows list the effects in paint order and drag to reorder. What the builder
writes goes through `normalizeEffects` (`src/app/components/builder/effectOps.ts`):
offsets within ±500, blur 0 to 200, spread ±200, grain size 0.5 to 16 and
coverage 0 to 1; kinds the target can't paint (an inner shadow on text or an
ellipse) are dropped, and an empty list is stored as no key. The stroke row's
Position control writes `strokeAlign` (Inside writes nothing). Colourways stay
optional: these controls always edit the template, and a template with
colourways can change a look's effects or stroke and plate colors on the
"This variation" tab, each with "Use base" to drop the change. The edit canvas
leaves a field unclipped when it paints beyond its box (a drop shadow, glow,
layer blur, or a shape's center or outside stroke) and paints the canvas's
inner shadow over the background and its grain over the fields, as the
export does; the grain also lies lightly over a selected element's own
handles, and the multi-selection box sits above it. A shadow or stroke cut
off at the canvas edge raises one non-blocking builder warning.

Guardrails:

- `maxLength` — hard char limit enforced by the input.
- `textSizing` — how text responds to its content, always measured against
  real glyphs (`src/lib/render/autoFit.ts`):
  - `free` (or absent): the font size is fixed and the box grows taller as
    lines wrap.
  - `shrink`: the box is exactly as drawn; the font shrinks from the set size
    until the text fits, never below its floor.
  - `fill`: the box is exactly as drawn; the font is the largest size that
    fits, growing up from its floor.
- `minFontScale` — the floor for `shrink` and `fill`, as a fraction of the
  set size (0.25 to 1; the builder's "Min text" shows it as a percentage).
  New fields and imports get 0.75. It wins over `minFontSizePx`.
- `minFontSizePx` — the older absolute floor in px. Templates saved before
  `minFontScale` keep it and render exactly as before; with neither set the
  floor is 18px. Both are read through `minFontSizeFor` only.
- `aspectRatio` — enforced by the crop dialog for image fields.
- `optional` — the admin marked this member field optional (text, multiline,
  select or image). An optional field never blocks download, and when it is
  empty it is left off the graphic wherever a member works: the fill page,
  public links, bulk fill and the chats (`src/lib/render/emptyFields.ts`).
  Inside a layout group the stack closes up around it. The builder and
  gallery thumbnails keep painting its placeholder. Turning Fixed on clears
  it. In the caption an empty optional tag merges to nothing.
- Requiredness is derived, never stored: a non-fixed field is required
  unless it is `optional`; shapes never are (`isRequiredField` in
  `src/lib/templates/fieldRules.ts`, mirrored for the Edge Functions).
- `required` — legacy column, never read. It stays in the table so old rows
  load; nothing sets it.
- `placeholder` — ghost text in the form and on the canvas preview.

Identity:

- `fieldKey` — stable human slug (`team_name`) used by caption merge tags.
  Unique per template; derived from the label (never an auto index), so a
  field named "Employee name" tags as `{employee_name}`. Renaming a field
  re-derives the key AND rewrites existing tags inside `captionTemplate`
  (`retagCaption` in `src/lib/caption.ts`). Copy/paste/duplicate always mints
  a fresh unique key. Field rows are replaced wholesale on each builder save,
  and `fieldKey` is what keeps captions valid across edits.

## Variations

A variation is an **appearance override layer**, never a copy of the
template. One field array, N override maps (`templates.variants`, one jsonb
blob, migration 0031). Because the field identity is shared, a filler's
entered values survive switching looks: they fill the form once and can
export it in every colourway.

`TemplateVariant`: `id` (client-minted, persisted verbatim), `name`,
`isDefault` (exactly one — what an old link, a bulk row with no look column,
or a pin to a deleted variation renders), canvas overrides
(`backgroundColor` / `backgroundGradient`, replaced as a pair when either is
set; `backgroundUrl`), and `overrides: Record<fieldKey, VariantFieldOverride>`.

`VariantFieldOverride` is a **closed** set and the whitelist is the product:
`colorHex`, `textGradient`, `typeStyleKey`, `opacity`, `plateColor`,
`strokeColor`, `effects` (the field's whole list, replaced as a unit),
`staticValue` (fixed elements only), `hidden`. A variation may also replace
the canvas's `canvasEffects`. Everything else on a field — position, size,
rotation, z, font, size, tracking, alignment, guardrails, type, identity,
layout groups — is shared and cannot diverge. `src/lib/templates/variants.ts`
proves that at compile time and ignores any other key found in stored JSON.
If two looks need different geometry, that is a different template.

Overrides are keyed by `fieldKey` for the same reason layout groups are:
field rows are re-minted on every save. Renaming a field re-keys every
variation's overrides (`retagVariants`) beside the caption tags; deleting one
prunes them (`pruneVariants`); adding one creates no override anywhere — the
builder's Form list says "not styled in N" rather than guessing.

Rendering has exactly one insertion point: `SchemaRenderer` takes an optional
`variantId`, merges the schema once (`applyVariantToSchema`), and everything
downstream — `resolveFieldStyle`, `autoFit`, the layout pass, `exportPng` —
runs on the merged schema unaware. The builder paints the selected frame
through the same merge; the filmstrip above the canvas is every variation
rendering the same draft, which is why moving an element moves it in every
frame at once.

## Rendering contract

`SchemaRenderer` renders any schema into a live-scaled canvas
(`scale = min(containerW/canvasW, containerH/canvasH, 1)`), places each field
absolutely in canvas space, and exposes `exportPng()` (dimensions from the
schema). It records `open` on mount and `download` after successful export —
the single instrumentation point for the usage dashboard. Builder previews
pass `instrument={false}`.
