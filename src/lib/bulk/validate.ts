// The review pass over a mapped CSV: every row is checked against the
// template's own guardrails and then measured against real glyphs, and every
// problem is collected rather than the first one stopping the row.
//
// Overflow is a refusal here, not a warning. The product promise is that
// output is on-brand by construction, so a row whose text would run past
// its box is excluded from the export unless the person opts it in. The
// measurement goes through measureProposal, the same machinery Generate
// uses, so the review can never disagree with what the renderer paints.
//
// Pure: no React, no store, and the only DOM is behind the injected
// LineMeasurer, exactly as in measureProposal and the layout pass.

import type { BrandKit, FieldValues, TemplateSchema } from "../types";
import type { LineMeasurer } from "../render/autoFit";
import { measureProposal } from "../generate/measureProposal";
import { fillableFields, rowToValues, type ColumnMap } from "./mapping";

export type RowProblem =
  | { kind: "missing_required"; fieldKey: string; label: string }
  | { kind: "too_long"; fieldKey: string; label: string; max: number; actual: number }
  | { kind: "not_an_option"; fieldKey: string; label: string; options: string[] }
  | { kind: "overflows"; fieldKey: string; label: string; characterBudget?: number };

export interface RowCheck {
  /** Zero-based index into the parsed data rows. */
  index: number;
  values: FieldValues;
  problems: RowProblem[];
  /** No problems at all. Only these rows export by default. */
  ok: boolean;
}

type CheckableSchema = Pick<
  TemplateSchema,
  "fields" | "layoutGroups" | "canvasWidth" | "canvasHeight"
>;

/** Check every row, in this order per row: required fields that are empty,
 * maxLength, select values outside the options, then measured overflow.
 * A select value that matches an option apart from case is rewritten to the
 * option's own spelling rather than reported: the spreadsheet says
 * "chicago", the template says "Chicago", and the graphic should say what
 * the admin designed. */
export function checkRows(
  schema: CheckableSchema,
  kit: BrandKit | null,
  rows: string[][],
  map: ColumnMap,
  measure: LineMeasurer,
): RowCheck[] {
  const fields = fillableFields(schema);
  return rows.map((row, index) => {
    const values = rowToValues(row, map);
    const problems: RowProblem[] = [];
    const valueOf = (key: string) => values[key] ?? "";

    for (const f of fields) {
      if (f.required && valueOf(f.fieldKey).trim() === "") {
        problems.push({ kind: "missing_required", fieldKey: f.fieldKey, label: f.label });
      }
    }

    for (const f of fields) {
      const actual = valueOf(f.fieldKey).length;
      if (f.maxLength && actual > f.maxLength) {
        problems.push({
          kind: "too_long",
          fieldKey: f.fieldKey,
          label: f.label,
          max: f.maxLength,
          actual,
        });
      }
    }

    for (const f of fields) {
      if (f.type !== "select" || !f.options?.length) continue;
      const value = valueOf(f.fieldKey);
      if (value.trim() === "") continue;
      if (f.options.includes(value)) continue;
      const canonical = f.options.find(
        (o) => o.trim().toLowerCase() === value.trim().toLowerCase(),
      );
      if (canonical !== undefined) {
        values[f.fieldKey] = canonical;
        continue;
      }
      problems.push({
        kind: "not_an_option",
        fieldKey: f.fieldKey,
        label: f.label,
        options: f.options,
      });
    }

    // "shrinks" is not a problem: shrink-to-fit is the designed behavior.
    // Only a value the renderer cannot make fit at the floor is refused.
    for (const m of measureProposal(schema, values, kit, measure).fields) {
      if (m.fit !== "overflows") continue;
      problems.push({
        kind: "overflows",
        fieldKey: m.fieldKey,
        label: m.label,
        ...(m.characterBudget !== undefined ? { characterBudget: m.characterBudget } : {}),
      });
    }

    return { index, values, problems, ok: problems.length === 0 };
  });
}
