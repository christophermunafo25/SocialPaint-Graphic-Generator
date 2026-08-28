// One repair round for one proposal: measure, send the overflowing fields
// back with their measured budgets, merge the rewrites, measure again. Never
// more than one round — if the rewrite still overflows, the caller drops the
// proposal rather than showing a member a graphic with text off the edge.
//
// Pure except for the injected repair function (the GenerateProvider in the
// app, a stub under vitest), mirroring how the layout pass injects its
// measurer.

import type { BrandKit, FieldValues, GenerateRepairField, TemplateSchema } from "../types";
import type { LineMeasurer } from "../render/autoFit";
import { measureProposal, type ProposalMeasurement } from "./measureProposal";

/** The server round-trip, injected: template-generate's repair path via the
 * GenerateProvider. Returns a rewrite for each requested fieldKey. */
export type RepairFn = (templateId: string, fields: GenerateRepairField[]) => Promise<FieldValues>;

export interface RepairOutcome {
  /** The values to show — the originals when nothing overflowed, otherwise
   * the originals with the surviving rewrites merged in. */
  values: FieldValues;
  /** False means the proposal still overflows after its one repair round
   * (or the round itself failed) and must not be shown. */
  ok: boolean;
  /** Whether a repair round actually ran. */
  repaired: boolean;
  /** The final measurement, for anything the surface wants to report. */
  measurement: ProposalMeasurement;
}

type MeasurableSchema = Pick<
  TemplateSchema,
  "fields" | "layoutGroups" | "canvasWidth" | "canvasHeight"
>;

export async function repairProposal(
  proposal: { templateId: string; values: FieldValues },
  schema: MeasurableSchema,
  kit: BrandKit | null,
  measure: LineMeasurer,
  repair: RepairFn,
): Promise<RepairOutcome> {
  const first = measureProposal(schema, proposal.values, kit, measure);
  if (first.ok) {
    return { values: proposal.values, ok: true, repaired: false, measurement: first };
  }

  const requests: GenerateRepairField[] = first.fields
    .filter((f) => f.fit === "overflows")
    .map((f) => ({
      fieldKey: f.fieldKey,
      value: f.value,
      // A zero budget means this field alone cannot fix the overflow; 1 is
      // the smallest budget the server accepts, and the re-measure below is
      // what actually decides whether the round worked.
      characterBudget: Math.max(1, f.characterBudget ?? 1),
    }));

  let rewrites: FieldValues;
  try {
    rewrites = await repair(proposal.templateId, requests);
  } catch {
    // The round itself failed (server, network, validation). The proposal is
    // still overflowing, so it cannot be shown — same outcome as a rewrite
    // that did not fit.
    return { values: proposal.values, ok: false, repaired: true, measurement: first };
  }

  const merged: FieldValues = { ...proposal.values };
  for (const request of requests) {
    const rewrite = rewrites[request.fieldKey];
    if (typeof rewrite === "string" && rewrite.trim()) merged[request.fieldKey] = rewrite.trim();
  }

  const second = measureProposal(schema, merged, kit, measure);
  return { values: merged, ok: second.ok, repaired: true, measurement: second };
}
