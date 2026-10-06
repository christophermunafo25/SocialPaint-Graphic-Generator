import { describe, expect, it } from "vitest";
import {
  PlanCache,
  billingConfigured,
  cardState,
  formatUsd,
  hasUnendedPlan,
  perMonthCents,
  planFieldsFromSubscription,
  plansFromPrices,
  stillRenews,
  type StripePriceLike,
  type StripeSubscriptionLike,
} from "./billing.ts";

const product = (plan: string, active = true) => ({
  id: `prod_${plan}`,
  active,
  metadata: { plan },
});
const price = (
  id: string,
  plan: string,
  interval: string,
  amount: number,
  extra: Partial<StripePriceLike> = {},
): StripePriceLike => ({
  id,
  active: true,
  unit_amount: amount,
  currency: "usd",
  recurring: { interval },
  product: product(plan),
  ...extra,
});

const sub = (over: Partial<StripeSubscriptionLike> = {}): StripeSubscriptionLike => ({
  id: "sub_1",
  customer: "cus_1",
  status: "active",
  livemode: false,
  cancel_at: null,
  cancel_at_period_end: false,
  metadata: { billing_account_id: "acct", company_id: "co" },
  latest_invoice: "in_1",
  items: {
    data: [
      {
        id: "si_1",
        current_period_end: 1_791_936_000, // 2026-10-14T00:00:00Z
        price: price("price_crew_m", "crew", "month", 5999),
      },
    ],
  },
  ...over,
});

describe("planFieldsFromSubscription (PHASE-7B §2)", () => {
  it("takes the plan from the product, the price's interval and amount, and the item's period end", () => {
    expect(planFieldsFromSubscription(sub())).toEqual({
      stripe_subscription_id: "sub_1",
      plan: "crew",
      interval: "month",
      amount: 5999,
      currency: "usd",
      status: "active",
      period_end: "2026-10-14T00:00:00.000Z",
      cancel_at_period_end: false,
      cancel_at: null,
    });
  });

  it("keeps an unknown plan or interval out", () => {
    const odd = sub({
      items: { data: [{ id: "si", current_period_end: 0, price: price("p", "gold", "week", 1) }] },
    });
    const fields = planFieldsFromSubscription(odd);
    expect(fields.plan).toBeNull();
    expect(fields.interval).toBeNull();
    expect(fields.period_end).toBeNull();
  });

  it("records a scheduled cancel", () => {
    const f = planFieldsFromSubscription(sub({ cancel_at: 1_791_936_000 }));
    expect(f.cancel_at).toBe("2026-10-14T00:00:00.000Z");
  });
});

describe("cardState (Q7, in order)", () => {
  const s = (status: string, cancel_at_period_end = false, cancel_at: string | null = null) =>
    cardState({ status, cancel_at_period_end, cancel_at });
  it("maps every status", () => {
    expect(s("past_due")).toBe("payment_failed");
    expect(s("unpaid")).toBe("payment_failed");
    expect(s("paused")).toBe("payment_failed");
    expect(s("active", true)).toBe("cancel_pending");
    expect(s("trialing", false, "2026-10-14T00:00:00Z")).toBe("cancel_pending");
    expect(s("active")).toBe("on_plan");
    expect(s("trialing")).toBe("on_plan");
    expect(s("incomplete")).toBe("early_access");
    expect(s("incomplete_expired")).toBe("early_access");
    expect(s("canceled")).toBe("early_access");
    expect(cardState({ status: null, cancel_at_period_end: false, cancel_at: null })).toBe(
      "early_access",
    );
  });
  it("Payment failed wins over a pending cancel", () => {
    expect(s("past_due", true)).toBe("payment_failed");
  });
});

describe("stillRenews (Q5) and hasUnendedPlan (Q9)", () => {
  const row = (status: string | null, cancel = false) => ({
    stripe_subscription_id: status ? "sub" : null,
    status,
    cancel_at_period_end: cancel,
    cancel_at: null,
  });
  it("blocks deletion while a plan renews", () => {
    for (const st of ["active", "trialing", "past_due", "unpaid", "paused"]) {
      expect(stillRenews(row(st))).toBe(true);
    }
    expect(stillRenews(row("active", true))).toBe(false);
    expect(stillRenews(row("incomplete"))).toBe(false);
    expect(stillRenews(row("canceled"))).toBe(false);
  });
  it("counts a pending cancel as a plan that hasn't ended", () => {
    expect(hasUnendedPlan(row("active", true))).toBe(true);
    expect(hasUnendedPlan(row("incomplete"))).toBe(false);
    expect(hasUnendedPlan(row(null))).toBe(false);
    expect(hasUnendedPlan(null)).toBe(false);
  });
});

describe("billingConfigured (Q2)", () => {
  it("opens to everyone on a live key, nobody without one", () => {
    expect(billingConfigured("sk_live_x", "a@b.com", undefined)).toBe(true);
    expect(billingConfigured("rk_live_x", null, undefined)).toBe(true);
    expect(billingConfigured(undefined, "a@b.com", "a@b.com")).toBe(false);
  });
  it("gates a test key to BILLING_TEST_EMAILS", () => {
    expect(billingConfigured("sk_test_x", "CJ@Acme.com", "cj@acme.com, qa@acme.com")).toBe(true);
    expect(billingConfigured("rk_test_x", "qa@acme.com", "cj@acme.com,qa@acme.com")).toBe(true);
    expect(billingConfigured("sk_test_x", "other@acme.com", "cj@acme.com")).toBe(false);
    expect(billingConfigured("sk_test_x", "cj@acme.com", undefined)).toBe(false);
  });
});

describe("prices (Q10)", () => {
  it("rounds the annual per-month figure to the nearest cent", () => {
    expect(perMonthCents(15588)).toBe(1299);
    expect(perMonthCents(59900)).toBe(4992);
    expect(perMonthCents(100)).toBe(8);
  });
  it("formats USD with cents", () => {
    expect(formatUsd(125988)).toBe("$1,259.88");
    expect(formatUsd(1299)).toBe("$12.99");
  });
});

describe("plansFromPrices (§2 plans)", () => {
  const all = [
    price("c_m", "canvas", "month", 1299),
    price("c_y", "canvas", "year", 15588),
    price("s_m", "studio", "month", 2999),
    price("s_y", "studio", "year", 35988),
    price("w_m", "crew", "month", 5999),
    price("w_y", "crew", "year", 71988),
    price("p_m", "portfolio", "month", 9999),
    price("p_y", "portfolio", "year", 119988),
  ];
  it("reads all four plans, each with one monthly and one yearly price", () => {
    const { plans, problems } = plansFromPrices(all);
    expect(problems).toEqual([]);
    expect(plans.map((p) => [p.plan, p.month.amount, p.year.amount])).toEqual([
      ["canvas", 1299, 15588],
      ["studio", 2999, 35988],
      ["crew", 5999, 71988],
      ["portfolio", 9999, 119988],
    ]);
  });
  it("leaves out a plan with a missing or doubled price, and skips inactive ones", () => {
    const { plans, problems } = plansFromPrices([
      ...all.filter((p) => p.id !== "s_y"),
      price("w_m2", "crew", "month", 6999),
      price("p_old", "portfolio", "month", 1, { active: false }),
      { ...price("x", "canvas", "month", 1), product: product("canvas", false) },
    ]);
    expect(plans.map((p) => p.plan)).toEqual(["canvas", "portfolio"]);
    expect(problems).toEqual([
      "studio: 1 monthly and 0 yearly prices",
      "crew: 2 monthly and 1 yearly prices",
    ]);
  });
  it("refuses non-USD prices", () => {
    const { plans, problems } = plansFromPrices([
      price("c_m", "canvas", "month", 1299, { currency: "eur" }),
      price("c_y", "canvas", "year", 15588),
    ]);
    expect(plans.find((p) => p.plan === "canvas")).toBeUndefined();
    expect(problems[0]).toBe("canvas: prices must be USD amounts");
  });
});

describe("PlanCache (Q12)", () => {
  it("keeps plans five minutes, and reloads after clear()", async () => {
    const cache = new PlanCache();
    let loads = 0;
    const load = async () => {
      loads++;
      return [];
    };
    await cache.get(load, 0);
    await cache.get(load, 4 * 60_000);
    expect(loads).toBe(1);
    await cache.get(load, 6 * 60_000);
    expect(loads).toBe(2);
    cache.clear();
    await cache.get(load, 6 * 60_000);
    expect(loads).toBe(3);
  });
});
