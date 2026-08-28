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
import { resolveFieldStyle, type ResolvedFieldStyle } from "../brand/resolveStyle";
import {
  DEFAULT_FONT_SIZE,
  measuredTextHeight,
  measuredTextWidth,
  type LineMeasurer,
} from "../render/autoFit";
import { computeLayout, fitFieldText, groupFieldKeys } from "../render/layout";

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

/** Overflow-only classification of one field with one candidate text,
 * ignoring groups (those are checked against the full layout). */
function overflowsAlone(
  field: TemplateField,
  style: ResolvedFieldStyle,
  text: string,
  measure: LineMeasurer,
): boolean {
  const mode = style.textSizing ?? "free";
  if (mode === "shrink" || mode === "fill") {
    return fitFieldText(field, style, text, measure).overflows;
  }
  // Free: the font size is fixed. A multiline box grows taller as lines
  // wrap — growth past the authored height is the overflow signal for
  // generated copy. A single line never wraps, so its signal is width.
  const size = style.fontSizePx ?? DEFAULT_FONT_SIZE;
  if (field.type !== "multiline") {
    return measuredTextWidth(style, text, size, measure) > field.width;
  }
  return measuredTextHeight(true, style, text, size, field.width, measure) > field.height;
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
): boolean {
  if (overflowsAlone(field, style, text, measure)) return false;
  const groups = containingGroups(schema, field.fieldKey);
  if (groups.length === 0) return true;
  const layout = computeLayout(schema, { ...values, [field.fieldKey]: text }, kit, measure);
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
): number {
  const fits = (len: number) =>
    len === 0 ||
    fitsInContext(schema, values, kit, measure, field, style, value.slice(0, len).trimEnd());
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
 * own options and image fields are never text, so neither is measured. */
export function measureProposal(
  schema: MeasurableSchema,
  values: FieldValues,
  kit: BrandKit | null,
  measure: LineMeasurer,
): ProposalMeasurement {
  // One layout pass with the full proposal: a stack that grows off the
  // canvas is an overflow even when every member fits its own box.
  const layout = computeLayout(schema, values, kit, measure);
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
    if (overflowsAlone(field, style, value, measure) || overflowingGroupKeys.has(field.fieldKey)) {
      fit = "overflows";
    } else {
      const mode = style.textSizing ?? "free";
      const base = style.fontSizePx ?? DEFAULT_FONT_SIZE;
      fit =
        (mode === "shrink" || mode === "fill") &&
        fitFieldText(field, style, value, measure).fontSizePx < base
          ? "shrinks"
          : "fits";
    }

    const entry: FieldMeasurement = { fieldKey: field.fieldKey, label: field.label, fit, value };
    if (fit === "overflows") {
      entry.characterBudget = characterBudget(schema, values, kit, measure, field, style, value);
    }
    fields.push(entry);
  }

  return { fields, ok: fields.every((f) => f.fit !== "overflows") };
}
