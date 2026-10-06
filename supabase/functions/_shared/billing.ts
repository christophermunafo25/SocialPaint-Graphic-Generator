// Billing's rules (new look, Phase 7b; docs/design/new-look/PHASE-7B.md),
// pure so vitest can exercise them under Node. The Edge Functions wire them
// to Stripe and the database; nothing here imports Stripe or touches Deno.
//
// Stripe objects are typed structurally: only the fields read here.

import { isPlanKey, type BillingInterval, type PlanKey } from "./billingCatalog.ts";

export interface StripeProductLike {
  id: string;
  active?: boolean;
  metadata: Record<string, string>;
}

export interface StripePriceLike {
  id: string;
  active?: boolean;
  unit_amount: number | null;
  currency: string;
  recurring: { interval: string } | null;
  product: string | StripeProductLike;
}

export interface StripeSubscriptionLike {
  id: string;
  customer: string | { id: string };
  status: string;
  livemode: boolean;
  cancel_at: number | null;
  cancel_at_period_end: boolean;
  metadata: Record<string, string>;
  latest_invoice: string | { id: string } | null;
  items: {
    data: Array<{ id: string; current_period_end: number; price: StripePriceLike }>;
  };
}

/** The plan fields of a billing_accounts row, as the webhook writes them. */
export interface PlanFields {
  stripe_subscription_id: string | null;
  plan: PlanKey | null;
  interval: BillingInterval | null;
  amount: number | null;
  currency: string | null;
  status: string | null;
  period_end: string | null;
  cancel_at_period_end: boolean;
  cancel_at: string | null;
}

/** A row as the functions read it back. */
export interface BillingAccountRow extends PlanFields {
  id: string;
  owner_user_id: string;
  stripe_customer_id: string;
  livemode: boolean;
}

/** What a deleted (or ended) subscription leaves: Early access, the
 * customer kept for a later upgrade. */
export const CLEARED_PLAN: PlanFields = {
  stripe_subscription_id: null,
  plan: null,
  interval: null,
  amount: null,
  currency: null,
  status: null,
  period_end: null,
  cancel_at_period_end: false,
  cancel_at: null,
};

const iso = (seconds: number | null | undefined): string | null =>
  seconds ? new Date(seconds * 1000).toISOString() : null;

export const idOf = (v: string | { id: string } | null | undefined): string | null =>
  v == null ? null : typeof v === "string" ? v : v.id;

/** A subscription's current state as row fields: the plan from its
 * product's metadata, the interval and amount from its price, and the
 * period end from its item (since API version 2025-03-31.basil it is no
 * longer on the subscription). */
export function planFieldsFromSubscription(sub: StripeSubscriptionLike): PlanFields {
  const item = sub.items.data[0];
  const price = item?.price;
  const product = price && typeof price.product !== "string" ? price.product : null;
  const plan = product?.metadata?.plan;
  const interval = price?.recurring?.interval;
  return {
    stripe_subscription_id: sub.id,
    plan: isPlanKey(plan) ? plan : null,
    interval: interval === "month" || interval === "year" ? interval : null,
    amount: price?.unit_amount ?? null,
    currency: price?.currency ?? null,
    status: sub.status,
    period_end: iso(item?.current_period_end),
    cancel_at_period_end: sub.cancel_at_period_end,
    cancel_at: iso(sub.cancel_at),
  };
}

/** Statuses after which a subscription is over. */
const ENDED = new Set(["canceled", "incomplete_expired"]);
/** Statuses of a subscription that still bills (or is trying to). */
const BILLING = new Set(["active", "trialing", "past_due", "unpaid", "paused"]);

export const isEnded = (status: string | null): boolean => !status || ENDED.has(status);

export type CardState = "early_access" | "on_plan" | "cancel_pending" | "payment_failed";

/** Q7, checked in this order: past_due, unpaid and paused are Payment
 * failed; active or trialing with a cancel set is Cancel pending; active or
 * trialing is On a plan; anything else (incomplete, incomplete_expired,
 * canceled, none) is Early access. */
export function cardState(
  row: Pick<PlanFields, "status" | "cancel_at_period_end" | "cancel_at">,
): CardState {
  const s = row.status;
  if (s === "past_due" || s === "unpaid" || s === "paused") return "payment_failed";
  if (s === "active" || s === "trialing") {
    return row.cancel_at_period_end || row.cancel_at ? "cancel_pending" : "on_plan";
  }
  return "early_access";
}

/** Q5: a plan that still renews blocks deleting its workspace. */
export function stillRenews(
  row: Pick<PlanFields, "status" | "cancel_at_period_end" | "cancel_at">,
): boolean {
  return !!row.status && BILLING.has(row.status) && !row.cancel_at_period_end && !row.cancel_at;
}

/** Q9: an owner with a subscription that hasn't ended, a cancel pending
 * included, can't buy another. An incomplete one (Checkout not finished)
 * doesn't count: Checkout creates the subscription only once it's paid. */
export function hasUnendedPlan(
  row: Pick<PlanFields, "stripe_subscription_id" | "status"> | null,
): boolean {
  return !!row?.stripe_subscription_id && !!row.status && BILLING.has(row.status);
}

/** Q2: a test key (sk_test_ or rk_test_) gates billing to the signed-in
 * users whose email is in BILLING_TEST_EMAILS; a live key opens it to all.
 * No key, no billing. */
export function billingConfigured(
  secretKey: string | undefined,
  email: string | null | undefined,
  testEmailsCsv: string | undefined,
): boolean {
  if (!secretKey) return false;
  if (!isTestKey(secretKey)) return true;
  const allowed = (testEmailsCsv ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return !!email && allowed.includes(email.trim().toLowerCase());
}

export const isTestKey = (key: string): boolean =>
  key.startsWith("sk_test_") || key.startsWith("rk_test_");

/** Q10: per month on annual is the yearly amount in cents divided by 12,
 * rounded to the nearest cent. */
export const perMonthCents = (yearlyCents: number): number => Math.round(yearlyCents / 12);

/** Q10: USD only, en-US with cents ("$1,259.88"). */
export const formatUsd = (cents: number): string =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

export interface PlanPrices {
  plan: PlanKey;
  month: { priceId: string; amount: number };
  year: { priceId: string; amount: number };
}

/** The four plans from Stripe's active prices (§2 `plans`): a plan is the
 * active product whose metadata "plan" names it, with one monthly and one
 * yearly price, both USD. A plan missing either price, or with more than
 * one of an interval, is left out (and reported), so prices change in
 * Stripe alone. */
export function plansFromPrices(prices: StripePriceLike[]): {
  plans: PlanPrices[];
  problems: string[];
} {
  const byPlan = new Map<PlanKey, { month: StripePriceLike[]; year: StripePriceLike[] }>();
  for (const price of prices) {
    if (price.active === false || typeof price.product === "string") continue;
    if (price.product.active === false) continue;
    const plan = price.product.metadata?.plan;
    const interval = price.recurring?.interval;
    if (!isPlanKey(plan) || (interval !== "month" && interval !== "year")) continue;
    const slot = byPlan.get(plan) ?? { month: [], year: [] };
    slot[interval].push(price);
    byPlan.set(plan, slot);
  }
  const plans: PlanPrices[] = [];
  const problems: string[] = [];
  for (const plan of ["canvas", "studio", "crew", "portfolio"] as const) {
    const slot = byPlan.get(plan);
    const month = slot?.month ?? [];
    const year = slot?.year ?? [];
    if (month.length !== 1 || year.length !== 1) {
      problems.push(`${plan}: ${month.length} monthly and ${year.length} yearly prices`);
      continue;
    }
    const usd = [month[0], year[0]].every((p) => p.currency === "usd" && p.unit_amount !== null);
    if (!usd) {
      problems.push(`${plan}: prices must be USD amounts`);
      continue;
    }
    plans.push({
      plan,
      month: { priceId: month[0].id, amount: month[0].unit_amount! },
      year: { priceId: year[0].id, amount: year[0].unit_amount! },
    });
  }
  return { plans, problems };
}

/** Q12: the plans read from Stripe, kept five minutes in memory per
 * function instance. `clear()` drops them when Stripe rejects a price. */
export class PlanCache {
  private value: { at: number; plans: PlanPrices[] } | null = null;
  constructor(private readonly ttlMs = 5 * 60_000) {}
  async get(load: () => Promise<PlanPrices[]>, now = Date.now()): Promise<PlanPrices[]> {
    if (this.value && now - this.value.at < this.ttlMs) return this.value.plans;
    const plans = await load();
    this.value = { at: now, plans };
    return plans;
  }
  clear(): void {
    this.value = null;
  }
}

export type DeleteDecision =
  { allow: true; endSubscription: string | null } | { allow: false; message: string };

/** Q5 and Q6, deleting a workspace: a plan that still renews blocks it
 * (the payer is told to cancel; another admin is told who pays). With a
 * cancel pending, or an incomplete subscription, the delete goes ahead and
 * ends that subscription immediately, without a refund. */
export function deleteDecision(
  account: Pick<
    BillingAccountRow,
    "owner_user_id" | "stripe_subscription_id" | "status" | "cancel_at_period_end" | "cancel_at"
  > | null,
  callerId: string,
  ownerName: string | null,
): DeleteDecision {
  if (!account?.stripe_subscription_id || isEnded(account.status)) {
    return { allow: true, endSubscription: null };
  }
  if (stillRenews(account)) {
    return {
      allow: false,
      message:
        account.owner_user_id === callerId
          ? "Cancel the plan before deleting this workspace."
          : `${ownerName ?? "Someone else"} pays for this workspace's plan.`,
    };
  }
  return { allow: true, endSubscription: account.stripe_subscription_id };
}
