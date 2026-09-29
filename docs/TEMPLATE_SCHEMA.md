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
`colorHex`, `textGradient`, `typeStyleKey`, `opacity`, `staticValue` (fixed
elements only), `hidden`. Everything else on a field — position, size,
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
