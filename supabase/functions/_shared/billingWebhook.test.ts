import { describe, expect, it } from "vitest";
import type { BillingAccountRow, PlanFields, StripeSubscriptionLike } from "./billing.ts";
import { CLEARED_PLAN } from "./billing.ts";
import {
  handleWebhook,
  subscriptionIdOf,
  type StripeEventLike,
  type WebhookDeps,
} from "./billingWebhook.ts";

const PERIOD_END = 1_791_936_000;

function subscription(over: Partial<StripeSubscriptionLike> = {}): StripeSubscriptionLike {
  return {
    id: "sub_1",
    customer: "cus_1",
    status: "active",
    livemode: false,
    cancel_at: null,
    cancel_at_period_end: false,
    metadata: { billing_account_id: "acct_1", company_id: "co_1" },
    latest_invoice: "in_1",
    items: {
      data: [
        {
          id: "si_1",
          current_period_end: PERIOD_END,
          price: {
            id: "price_crew_m",
            unit_amount: 5999,
            currency: "usd",
            recurring: { interval: "month" },
            product: { id: "prod_crew", metadata: { plan: "crew" } },
          },
        },
      ],
    },
    ...over,
  };
}

function account(over: Partial<BillingAccountRow> = {}): BillingAccountRow {
  return {
    id: "acct_1",
    owner_user_id: "u1",
    stripe_customer_id: "cus_1",
    livemode: false,
    ...CLEARED_PLAN,
    ...over,
  };
}

/** An in-memory Stripe and database. */
function world(opts: {
  subs: StripeSubscriptionLike[];
  accounts?: BillingAccountRow[];
  companies?: Record<string, string | null>;
  liveKey?: boolean;
}) {
  const subs = new Map(opts.subs.map((s) => [s.id, s]));
  const accounts = new Map((opts.accounts ?? [account()]).map((a) => [a.id, a]));
  const companies = new Map(Object.entries(opts.companies ?? { co_1: null }));
  const calls: string[] = [];
  const logs: string[] = [];
  const deps: WebhookDeps = {
    liveKey: opts.liveKey ?? false,
    verify: async (raw, sig) => {
      if (sig !== "good") throw new Error("No signatures found matching the expected signature");
      return JSON.parse(raw) as StripeEventLike;
    },
    stripe: {
      retrieveSubscription: async (id) => subs.get(id)!,
      cancelSubscription: async (id) => {
        calls.push(`cancel ${id}`);
      },
      refundInvoice: async (id) => {
        calls.push(`refund ${id}`);
      },
    },
    db: {
      accountById: async (id) => accounts.get(id) ?? null,
      accountByCustomer: async (c) =>
        [...accounts.values()].find((a) => a.stripe_customer_id === c) ?? null,
      updateAccount: async (id, fields: PlanFields) => {
        accounts.set(id, { ...accounts.get(id)!, ...fields });
      },
      companyLink: async (id) =>
        companies.has(id) ? { billingAccountId: companies.get(id)! } : null,
      linkCompany: async (id, acct) => {
        companies.set(id, acct);
      },
      unlinkAccount: async (acct) => {
        for (const [id, a] of companies) if (a === acct) companies.set(id, null);
      },
    },
    log: (m) => logs.push(m),
  };
  return { deps, accounts, companies, calls, logs, subs };
}

const event = (type: string, object: Record<string, unknown>, livemode = false) =>
  JSON.stringify({ id: `evt_${type}`, type, livemode, data: { object } });

describe("billing webhook (PHASE-7B §2, Q2, Q6)", () => {
  it("answers 400 to a bad or missing signature, and writes nothing", async () => {
    const w = world({ subs: [subscription()] });
    const body = event("customer.subscription.created", { id: "sub_1" });
    expect((await handleWebhook(body, "forged", w.deps)).status).toBe(400);
    expect((await handleWebhook(body, null, w.deps)).status).toBe(400);
    expect(w.accounts.get("acct_1")!.plan).toBeNull();
  });

  it("writes the subscription's current state and links its workspace", async () => {
    const w = world({ subs: [subscription()] });
    const res = await handleWebhook(
      event("checkout.session.completed", { mode: "subscription", subscription: "sub_1" }),
      "good",
      w.deps,
    );
    expect(res.status).toBe(200);
    expect(w.accounts.get("acct_1")).toMatchObject({
      stripe_subscription_id: "sub_1",
      plan: "crew",
      interval: "month",
      amount: 5999,
      status: "active",
      period_end: "2026-10-14T00:00:00.000Z",
    });
    expect(w.companies.get("co_1")).toBe("acct_1");
  });

  it("finds the subscription on an invoice under parent (basil)", () => {
    expect(
      subscriptionIdOf({
        id: "e",
        type: "invoice.payment_failed",
        livemode: false,
        data: { object: { parent: { subscription_details: { subscription: "sub_9" } } } },
      }),
    ).toBe("sub_9");
  });

  it("leaves the same row for a duplicate or out-of-order event", async () => {
    const w = world({ subs: [subscription()] });
    const created = event("customer.subscription.created", { id: "sub_1" });
    await handleWebhook(created, "good", w.deps);
    const first = { ...w.accounts.get("acct_1")! };
    // The subscription is cancelled at period end; then the stale "created"
    // arrives again: Stripe's current state wins both times.
    w.subs.set("sub_1", subscription({ cancel_at_period_end: true }));
    await handleWebhook(event("customer.subscription.updated", { id: "sub_1" }), "good", w.deps);
    await handleWebhook(created, "good", w.deps);
    expect(w.accounts.get("acct_1")).toEqual({ ...first, cancel_at_period_end: true });
  });

  it("puts the workspace back on Early access when the subscription is deleted, keeping the customer", async () => {
    const w = world({ subs: [subscription()] });
    await handleWebhook(event("customer.subscription.created", { id: "sub_1" }), "good", w.deps);
    w.subs.set("sub_1", subscription({ status: "canceled" }));
    await handleWebhook(event("customer.subscription.deleted", { id: "sub_1" }), "good", w.deps);
    expect(w.accounts.get("acct_1")).toEqual(account());
    expect(w.companies.get("co_1")).toBeNull();
  });

  it("ignores an event from the other mode with 200", async () => {
    const w = world({ subs: [subscription()] });
    const res = await handleWebhook(
      event("customer.subscription.created", { id: "sub_1" }, true),
      "good",
      w.deps,
    );
    expect(res).toEqual({ status: 200, body: { ignored: "livemode" } });
    expect(w.accounts.get("acct_1")!.plan).toBeNull();
  });

  it("ends, refunds and logs a subscription whose workspace is gone (Q6)", async () => {
    const w = world({ subs: [subscription()], companies: {} });
    await handleWebhook(
      event("invoice.paid", { parent: { subscription_details: { subscription: "sub_1" } } }),
      "good",
      w.deps,
    );
    expect(w.calls).toEqual(["cancel sub_1", "refund in_1"]);
    expect(w.logs[0]).toContain("no longer exists");
    expect(w.accounts.get("acct_1")!.plan).toBeNull();
  });

  it("ends a subscription for a workspace already on another plan that renews (Q6)", async () => {
    const other = account({
      id: "acct_2",
      owner_user_id: "u2",
      stripe_customer_id: "cus_2",
      stripe_subscription_id: "sub_other",
      status: "active",
    });
    const w = world({
      subs: [subscription()],
      accounts: [account(), other],
      companies: { co_1: "acct_2" },
    });
    await handleWebhook(event("customer.subscription.created", { id: "sub_1" }), "good", w.deps);
    expect(w.calls).toEqual(["cancel sub_1", "refund in_1"]);
    expect(w.companies.get("co_1")).toBe("acct_2");
  });

  it("ends a second subscription for an owner whose first hasn't ended (Q9 backstop)", async () => {
    const paying = account({
      stripe_subscription_id: "sub_first",
      status: "active",
      plan: "canvas",
    });
    const w = world({ subs: [subscription({ id: "sub_2" })], accounts: [paying] });
    await handleWebhook(event("customer.subscription.created", { id: "sub_2" }), "good", w.deps);
    expect(w.calls).toEqual(["cancel sub_2", "refund in_1"]);
    expect(w.accounts.get("acct_1")!.stripe_subscription_id).toBe("sub_first");
  });

  it("an ended subscription that isn't the account's current one changes nothing", async () => {
    const paying = account({
      stripe_subscription_id: "sub_first",
      status: "active",
      plan: "canvas",
    });
    const w = world({
      subs: [subscription({ id: "sub_2", status: "canceled" })],
      accounts: [paying],
      companies: { co_1: "acct_1" },
    });
    await handleWebhook(event("customer.subscription.deleted", { id: "sub_2" }), "good", w.deps);
    expect(w.accounts.get("acct_1")!.plan).toBe("canvas");
    expect(w.companies.get("co_1")).toBe("acct_1");
  });
});
