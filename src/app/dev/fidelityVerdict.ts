// The fidelity runner's decisions (scripts/fidelity/fidelity.mjs): which dev
// render address a fixture loads, and whether a measured render passes.
// Dependency-free and erasable TypeScript, so Node runs this file directly
// from the script and Vitest tests it here.

export const DEFAULT_TOLERANCE = 0.25;

export type Engine = "chromium" | "firefox" | "webkit";

/** The parts of a fixture.json the runner decides with. */
export interface VerdictFixture {
  name: string;
  kind: "figma" | "starter";
  variantId?: string | null;
  baseline?: Partial<Record<Engine, number>>;
  tolerance?: number;
}

export type RenderOutcome =
  | { status: "rendered"; file: string }
  | { status: "skipped"; reason: string }
  | { status: "error"; message: string };

export interface Comparison {
  changedPct: number;
  sizeMatches: boolean;
}

export type Verdict =
  "pass" | "better" | "worse" | "size" | "error" | "skipped" | "no golden" | "no baseline";

/** The dev render address for a fixture. A starter fixture named
 * starter-<key>-<variant> with that variantId renders blueprint <key> in
 * that colourway; a figma fixture renders its own file. */
export function routeFor(fixture: VerdictFixture): string {
  if (fixture.kind === "starter") {
    let key = fixture.name.slice("starter-".length);
    const variant = fixture.variantId;
    if (variant && key.endsWith(`-${variant}`)) key = key.slice(0, -(variant.length + 1));
    const route = `/dev/render/starter-${encodeURIComponent(key)}`;
    return variant ? `${route}?variant=${encodeURIComponent(variant)}` : route;
  }
  return `/dev/render/${encodeURIComponent(fixture.name)}`;
}

/** Pass or fail for one fixture on one engine. A missing font is skipped
 * and never fails. A missing golden or baseline fails when `strict` (CI),
 * so deleting either can't turn a regression green; locally it is
 * reported without failing, which is how a new fixture gets its first
 * numbers. `cmp` is null when there was nothing to compare. */
export function verdictFor(
  fixture: VerdictFixture,
  engine: Engine,
  outcome: RenderOutcome,
  cmp: Comparison | null,
  strict: boolean,
): { verdict: Verdict; failed: boolean } {
  if (outcome.status === "skipped") return { verdict: "skipped", failed: false };
  if (outcome.status === "error") return { verdict: "error", failed: true };
  if (!cmp) return { verdict: "no golden", failed: strict };
  if (!cmp.sizeMatches) return { verdict: "size", failed: true };
  const baseline = fixture.baseline?.[engine];
  if (baseline === undefined) return { verdict: "no baseline", failed: strict };
  const tolerance = fixture.tolerance ?? DEFAULT_TOLERANCE;
  if (cmp.changedPct > baseline + tolerance) return { verdict: "worse", failed: true };
  if (cmp.changedPct < baseline - tolerance) return { verdict: "better", failed: false };
  return { verdict: "pass", failed: false };
}
