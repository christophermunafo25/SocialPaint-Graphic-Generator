// The starter seeder: materialize every blueprint the company does not
// already have and create the missing ones through the ordinary template
// store insert path. Client-side by design — it runs as the admin the
// create_company_with_admin RPC just minted, so RLS passes without any
// service-role involvement.
//
// Idempotent by starterKey: a template whose autobuildMeta carries
// source "starter" claims its key, so onboarding re-runs and the admin's
// "Restore starter templates" action only ever create what is missing.
// Restore after a palette change therefore means: delete the starter, then
// restore — the re-seed bakes the current palette (see materialize.ts for
// the drift tradeoff).
//
// NEVER throws: seeding is a bonus on top of onboarding, and a failed
// insert must not fail the flow. Every outcome lands in the summary.

import type { Stores } from "../../stores/interfaces";
import { STARTER_BLUEPRINTS } from "./index";
import { materializeStarter, type MaterializeContext } from "./materialize";

export interface SeedResult {
  /** starterKeys created in this run. */
  created: string[];
  /** starterKeys already present (skipped). */
  existing: string[];
  /** starterKeys whose insert failed, with the message. */
  failed: Array<{ starterKey: string; error: string }>;
}

export type SeedContext = Omit<MaterializeContext, "seededAt">;

/** Seed the missing starter templates for one company. Sequential inserts
 * (each is a template row plus its field rows); failures are collected per
 * template so one bad insert never blocks the rest. */
export async function seedStarterTemplates(
  stores: Pick<Stores, "templates">,
  ctx: SeedContext,
): Promise<SeedResult> {
  const result: SeedResult = { created: [], existing: [], failed: [] };

  let present: Set<string>;
  try {
    const templates = await stores.templates.listAll(ctx.company.id);
    present = new Set(
      templates
        .map((t) => t.autobuildMeta)
        .filter((m) => m?.source === "starter" && m.starterKey)
        .map((m) => m!.starterKey!),
    );
  } catch (e) {
    // Cannot tell what exists — creating anyway could duplicate, so report
    // every starter as failed instead.
    const error = e instanceof Error ? e.message : String(e);
    result.failed = STARTER_BLUEPRINTS.map((b) => ({ starterKey: b.starterKey, error }));
    return result;
  }

  for (const blueprint of STARTER_BLUEPRINTS) {
    if (present.has(blueprint.starterKey)) {
      result.existing.push(blueprint.starterKey);
      continue;
    }
    try {
      await stores.templates.create(materializeStarter(blueprint, ctx));
      result.created.push(blueprint.starterKey);
    } catch (e) {
      result.failed.push({
        starterKey: blueprint.starterKey,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
  return result;
}
