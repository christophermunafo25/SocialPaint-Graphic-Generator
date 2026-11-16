// The measurement pass over a generated proposal — the phase that decides
// whether Generate is good. The Edge Function can check character counts and
// nothing else (Deno has no font stack); this module measures every proposed
// value against real glyphs, through the SAME machinery every surface renders
// with (autoFit + the layout pass), so measurement can never diverge from
// painting.
//
// Pure: the only I/O is the injected LineMeasurer — canvas-backed in the app
// (createCanvasMeasurer), a deterministic fake under vitest, exactly like
// layout.test.ts.

import type { BrandKit, FieldValues, TemplateField, TemplateSchema } from "../types";
import { isFreeGroup } from "../types";
import { resolveFieldStyle, type ResolvedFieldStyle } from "../brand/resolveStyle";
import {
  DEFAULT_FONT_SIZE,
  measuredTextHeight,
  measuredTextWidth,
  type LineMeasurer,
} from "../render/autoFit";
import {
  computeLayout,
  fitFieldText,
  groupFieldKeys,
  groupOfField,
  platePad,
  type LayoutOptions,
} from "../render/layout";

/** How one proposed value sits in its box:
 *  - "fits": nothing to do.
 *  - "shrinks": textSizing shrink/fill fitted it below the set size but at or
 *    above the floor — acceptable by design, nothing to do.
 *  - "overflows": the shrink hit its floor, a free box grew past its authored
 *    extent, or a containing group overflows the canvas. Repair material. */
export type FieldFit = "fits" | "shrinks" | "overflows";

export interface FieldMeasurement {
  fieldKey: string;
  label: string;
  fit: FieldFit;
  /** The value that was measured. */
  value: string;
  /** Only when fit === "overflows": the largest character count that
   * measurably fits (with a safety margin) — the hard budget a repair
   * request carries. */
  characterBudget?: number;
}

export interface ProposalMeasurement {
  /** One entry per filled, member-editable text/multiline field. */
  fields: FieldMeasurement[];
  /** True when nothing overflows — the proposal can be shown as-is. */
  ok: boolean;
}

type MeasurableSchema = Pick<
  TemplateSchema,
  "fields" | "layoutGroups" | "canvasWidth" | "canvasHeight"
>;

/** How far a free multiline box may grow past its authored height before
 * that counts as overflow. A line box is the font size times the line
 * height, rarely a whole pixel, while boxes are drawn to whole pixels: a
 * one-line 26px subhead at 1.36 is 35.36 tall in a 35px box. That growth
 * is rounding no one can see, and without the allowance every value in
 * such a box measured as overflowing, whatever its length, so no repair
 * could ever fit it. Half a pixel admits rounding and never a line. */
const SUBPIXEL_PX = 0.5;

/** Overflow-only classification of one field with one candidate text,
 * against its own box (a containing stack's canvas check is separate).
 *
 * Inside a stack, growth along the stack's direction belongs to the stack:
 * the stack pushes its siblings and the canvas check decides. Growth across
 * the stack, and anything outside one, still has to fit the field's box. A
 * plate paints at its set size and hugs, so it is measured that way. */
function overflowsAlone(
  schema: MeasurableSchema,
  field: TemplateField,
  style: ResolvedFieldStyle,
  text: string,
  measure: LineMeasurer,
): boolean {
  const group = groupOfField(field.fieldKey, schema.layoutGroups);
  const axis = group && !isFreeGroup(group) ? group.direction : undefined;
  const singleLine = field.type !== "multiline";
  const size = style.fontSizePx ?? DEFAULT_FONT_SIZE;

  if (field.plateColor) {
    const pad = platePad(field);
    if (singleLine) {
      return (
        axis !== "horizontal" &&
        measuredTextWidth(style, text, size, measure) + pad.x > field.width + SUBPIXEL_PX
      );
    }
    const wrapWidth = Math.max(1, field.width - pad.x);
    return (
      axis !== "vertical" &&
      measuredTextHeight(true, style, text, size, wrapWidth, measure) + pad.y >
        field.height + SUBPIXEL_PX
    );
  }

  const mode = style.textSizing ?? "free";
  if (mode === "shrink" || mode === "fill") {
    // A stack hugs a single line at whatever size it fits, floor included.
    if (singleLine && axis === "horizontal") return false;
    return fitFieldText(field, style, text, measure).overflows;
  }
  // Free: the font size is fixed. A multiline box grows taller as lines
  // wrap — growth past the authored height is the overflow signal for
  // generated copy. A single line never wraps, so its signal is width.
  if (singleLine) {
    return axis !== "horizontal" && measuredTextWidth(style, text, size, measure) > field.width;
  }
  return (
    axis !== "vertical" &&
    measuredTextHeight(true, style, text, size, field.width, measure) > field.height + SUBPIXEL_PX
  );
}

/** Groups that (directly or nested) contain the field. */
function containingGroups(schema: MeasurableSchema, fieldKey: string) {
  const groups = schema.layoutGroups ?? [];
  return groups.filter((g) => groupFieldKeys(g, groups).includes(fieldKey));
}

/** Does this candidate text keep the field inside its box AND keep every
 * containing group on the canvas? The group half re-runs the real layout
 * pass with the candidate substituted, so the budget accounts for stack
 * growth, not just the field's own box. */
function fitsInContext(
  schema: MeasurableSchema,
  values: FieldValues,
  kit: BrandKit | null,
  measure: LineMeasurer,
  field: TemplateField,
  style: ResolvedFieldStyle,
  text: string,
  opts: LayoutOptions,
): boolean {
  if (overflowsAlone(schema, field, style, text, measure)) return false;
  const groups = containingGroups(schema, field.fieldKey);
  if (groups.length === 0) return true;
  const layout = computeLayout(schema, { ...values, [field.fieldKey]: text }, kit, measure, opts);
  return groups.every((g) => layout.groupRects.get(g.id)?.overflows !== true);
}

/** Safety margin on a measured budget: the repair writes DIFFERENT glyphs
 * than the ones measured, so the budget backs off rather than handing the
 * model a limit that only the failed value's exact letters could meet. */
const BUDGET_MARGIN = 0.9;

/** The largest character count that measurably fits, from a binary search
 * over prefixes of the actual overlong value — real glyphs, not an average-
 * width guess. Zero means this field alone cannot fix the overflow (a
 * sibling in the same group is the real culprit). */
export function characterBudget(
  schema: MeasurableSchema,
  values: FieldValues,
  kit: BrandKit | null,
  measure: LineMeasurer,
  field: TemplateField,
  style: ResolvedFieldStyle,
  value: string,
  opts: LayoutOptions = {},
): number {
  const fits = (len: number) =>
    len === 0 ||
    fitsInContext(schema, values, kit, measure, field, style, value.slice(0, len).trimEnd(), opts);
  let lo = 0;
  let hi = value.length;
  // Largest len with fits(len); fits(0) holds by definition.
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (fits(mid)) lo = mid;
    else hi = mid - 1;
  }
  return Math.floor(lo * BUDGET_MARGIN);
}

/** Measure one proposal's values against the real template. Covers filled,
 * member-editable text and multiline fields; select values are the admin's
 * own options and image fields are never text, so neither is measured.
 * `opts` must match what the surface paints (its emptyFields mode and the
 * look's hidden keys), so a stack is measured the way it will render. */
export function measureProposal(
  schema: MeasurableSchema,
  values: FieldValues,
  kit: BrandKit | null,
  measure: LineMeasurer,
  opts: LayoutOptions = {},
): ProposalMeasurement {
  // One layout pass with the full proposal: a stack that grows off the
  // canvas is an overflow even when every member fits its own box.
  const layout = computeLayout(schema, values, kit, measure, opts);
  const groups = schema.layoutGroups ?? [];
  const overflowingGroupKeys = new Set(
    groups
      .filter((g) => layout.groupRects.get(g.id)?.overflows === true)
      .flatMap((g) => groupFieldKeys(g, groups)),
  );

  const fields: FieldMeasurement[] = [];
  for (const field of schema.fields) {
    if (field.static) continue;
    if (field.type !== "text" && field.type !== "multiline") continue;
    const value = values[field.fieldKey];
    if (typeof value !== "string" || !value) continue;

    const style = resolveFieldStyle(field, kit);
    let fit: FieldFit;
    if (
      overflowsAlone(schema, field, style, value, measure) ||
      overflowingGroupKeys.has(field.fieldKey)
    ) {
      fit = "overflows";
    } else {
      const mode = style.textSizing ?? "free";
      const base = style.fontSizePx ?? DEFAULT_FONT_SIZE;
      // A plate paints at its set size whatever the mode, so it never shrinks.
      fit =
        !field.plateColor &&
        (mode === "shrink" || mode === "fill") &&
        fitFieldText(field, style, value, measure).fontSizePx < base
          ? "shrinks"
          : "fits";
    }

    const entry: FieldMeasurement = { fieldKey: field.fieldKey, label: field.label, fit, value };
    if (fit === "overflows") {
      entry.characterBudget = characterBudget(
        schema,
        values,
        kit,
        measure,
        field,
        style,
        value,
        opts,
      );
    }
    fields.push(entry);
  }

  return { fields, ok: fields.every((f) => f.fit !== "overflows") };
}
