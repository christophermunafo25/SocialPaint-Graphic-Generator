// The four plans (PHASE-7B.md §2): what each includes. Prices live in
// Stripe alone (the active product whose metadata "plan" is the key, with
// one monthly and one yearly price); this file holds only what Stripe
// doesn't. Nothing here is enforced: the Plan card shows "{used} of
// {included}", and going over changes nothing.
//
// Mirror of src/lib/billing/catalog.ts for the Deno runtime, which cannot
// import from src. The two must stay identical; a test compares them.

export type PlanKey = "canvas" | "studio" | "crew" | "portfolio";
export type BillingInterval = "month" | "year";

export interface PlanInfo {
  key: PlanKey;
  /** "Crew", shown as "Crew plan". */
  label: string;
  includedAdmins: number;
  includedBrands: number;
}

export const PLANS: readonly PlanInfo[] = [
  { key: "canvas", label: "Canvas", includedAdmins: 1, includedBrands: 1 },
  { key: "studio", label: "Studio", includedAdmins: 1, includedBrands: 3 },
  { key: "crew", label: "Crew", includedAdmins: 4, includedBrands: 3 },
  { key: "portfolio", label: "Portfolio", includedAdmins: 10, includedBrands: 10 },
];

export const PLAN_KEYS: readonly PlanKey[] = PLANS.map((p) => p.key);

export function isPlanKey(v: unknown): v is PlanKey {
  return typeof v === "string" && (PLAN_KEYS as readonly string[]).includes(v);
}

export function planInfo(key: PlanKey): PlanInfo {
  return PLANS.find((p) => p.key === key)!;
}
