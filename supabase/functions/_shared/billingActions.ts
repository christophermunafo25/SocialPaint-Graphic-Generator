// The billing function's actions (PHASE-7B.md §2 and §8), with Stripe and
// the database injected so vitest can run them. billing/index.ts wires the
// real ones.
//
// Stripe hosts payment and every confirmation: checkout goes to Checkout,
// a switch, a cancel and a card change go to the customer portal's page
// for that one change, and Keep plan is the one change made here. None of
// these write plan state: the webhook writes what Stripe then says.

import { PLANS, isPlanKey, type BillingInterval, type PlanKey } from "./billingCatalog.ts";
import {
  cardState,
  hasUnendedPlan,
  perMonthCents,
  type BillingAccountRow,
  type PlanPrices,
  type StripeSubscriptionLike,
} from "./billing.ts";
import { HttpError } from "./http.ts";
import { requireEnum, requireUuid } from "./validate.ts";

export const ACTIONS = ["plans", "checkout", "portal", "keep"] as const;
export const PORTAL_FLOWS = ["switch", "cancel", "payment", "manage"] as const;
export type PortalFlow = (typeof PORTAL_FLOWS)[number];

/** Checkout Sessions last 30 minutes, Stripe's minimum (Q8). */
const CHECKOUT_TTL_SECONDS = 30 * 60;

export interface CheckoutRequest {
  customerId: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  accountId: string;
  companyId: string;
  expiresAt: number;
  automaticTax: boolean;
}

export interface PortalRequest {
  customerId: string;
  returnUrl: string;
  /** Where Stripe sends them once the one change is confirmed. */
  doneUrl: string;
  flow:
    | { type: "switch"; subscriptionId: string; itemId: string; priceId: string }
    | { type: "cancel"; subscriptionId: string }
    | { type: "payment" }
    | { type: "manage" };
}

export interface BillingDeps {
  /** Secrets set, and (on a test key) the caller in BILLING_TEST_EMAILS. */
  configured: boolean;
  automaticTax: boolean;
  liveKey: boolean;
  caller: { id: string; email: string; name: string | null };
  roleIn(companyId: string): Promise<"admin" | "member" | null>;
  /** Throws HttpError(400) unless the URL is on ALLOWED_ORIGINS. */
  allowedRedirect(url: unknown, field: string): string;
  db: {
    accountById(id: string): Promise<BillingAccountRow | null>;
    accountByOwner(userId: string): Promise<BillingAccountRow | null>;
    createAccount(row: {
      owner_user_id: string;
      stripe_customer_id: string;
      livemode: boolean;
    }): Promise<BillingAccountRow>;
    companyLink(companyId: string): Promise<{ billingAccountId: string | null } | null>;
    coveredCompanyName(accountId: string): Promise<string | null>;
    openCheckout(companyId: string): Promise<{ sessionId: string; expiresAt: string } | null>;
    saveCheckout(row: {
      companyId: string;
      sessionId: string;
      accountId: string;
      expiresAt: string;
    }): Promise<void>;
  };
  stripe: {
    /** The four plans' prices, cached (Q12). */
    plans(): Promise<PlanPrices[]>;
    /** Drops the cache, after Stripe rejected a price (Q12). */
    clearPlans(): void;
    /** True when Stripe refused a price (inactive or missing). */
    isPriceError(e: unknown): boolean;
    createCustomer(owner: { userId: string; email: string; name: string | null }): Promise<string>;
    createCheckout(req: CheckoutRequest): Promise<{ id: string; url: string; expiresAt: number }>;
    expireCheckout(sessionId: string): Promise<void>;
    retrieveSubscription(id: string): Promise<StripeSubscriptionLike>;
    createPortal(req: PortalRequest): Promise<string>;
    /** Keep plan: clears whichever cancel is set (Q7). */
    keep(subscriptionId: string, clear: "cancel_at" | "cancel_at_period_end"): Promise<void>;
  };
  now?(): number;
}

export interface ActionResult {
  status: number;
  body: Record<string, unknown>;
}

const NOT_AVAILABLE = "Billing isn't available for this workspace.";

export async function handleBilling(
  body: Record<string, unknown>,
  deps: BillingDeps,
): Promise<ActionResult> {
  const action = requireEnum(body.action, "action", ACTIONS);
  if (action === "plans") return plans(deps);
  if (!deps.configured) throw new HttpError(400, NOT_AVAILABLE);
  const companyId = requireUuid(body.companyId, "companyId");
  if ((await deps.roleIn(companyId)) !== "admin") {
    throw new HttpError(403, "Admin access required.");
  }
  if (action === "checkout") return checkout(companyId, body, deps);
  if (action === "portal") return portal(companyId, body, deps);
  return keep(companyId, deps);
}

/** §2 plans: whether billing is configured for the caller, and each plan's
 * prices from Stripe with what the catalog includes. */
async function plans(deps: BillingDeps): Promise<ActionResult> {
  if (!deps.configured) return { status: 200, body: { configured: false, plans: [] } };
  const prices = await deps.stripe.plans();
  return {
    status: 200,
    body: {
      configured: true,
      plans: PLANS.flatMap((info) => {
        const p = prices.find((x) => x.plan === info.key);
        if (!p) return [];
        return [
          {
            plan: info.key,
            label: info.label,
            includedAdmins: info.includedAdmins,
            includedBrands: info.includedBrands,
            month: { amount: p.month.amount },
            year: { amount: p.year.amount, perMonth: perMonthCents(p.year.amount) },
          },
        ];
      }),
    },
  };
}

function requirePlan(body: Record<string, unknown>): { plan: PlanKey; interval: BillingInterval } {
  if (!isPlanKey(body.plan)) throw new HttpError(400, "Choose a plan.");
  const interval = requireEnum(body.interval, "interval", ["month", "year"] as const);
  return { plan: body.plan, interval };
}

/** Run a Stripe call with a plan's price; if Stripe rejects the price,
 * reload the prices and try once more (Q12). */
async function withPrice<T>(
  deps: BillingDeps,
  plan: PlanKey,
  interval: BillingInterval,
  run: (priceId: string) => Promise<T>,
): Promise<T> {
  const priceFor = async () => {
    const p = (await deps.stripe.plans()).find((x) => x.plan === plan);
    if (!p) throw new HttpError(400, "That plan isn't available.");
    return p[interval].priceId;
  };
  try {
    return await run(await priceFor());
  } catch (e) {
    if (!deps.stripe.isPriceError(e)) throw e;
    deps.stripe.clearPlans();
    return run(await priceFor());
  }
}

const withParam = (url: string, key: string, value: string): string => {
  const u = new URL(url);
  u.searchParams.set(key, value);
  return u.toString();
};

/** §2 checkout: an admin of a workspace on Early access, who doesn't
 * already pay for a plan that hasn't ended (Q9), goes to Checkout. */
async function checkout(
  companyId: string,
  body: Record<string, unknown>,
  deps: BillingDeps,
): Promise<ActionResult> {
  const { plan, interval } = requirePlan(body);
  const returnUrl = deps.allowedRedirect(body.returnUrl, "returnUrl");

  const link = await deps.db.companyLink(companyId);
  if (!link) throw new HttpError(404, "Workspace not found.");
  if (link.billingAccountId) {
    const current = await deps.db.accountById(link.billingAccountId);
    if (current && cardState(current) !== "early_access") {
      throw new HttpError(409, "This workspace already has a plan.");
    }
  }

  let account = await deps.db.accountByOwner(deps.caller.id);
  if (hasUnendedPlan(account)) {
    const where = await deps.db.coveredCompanyName(account!.id);
    throw new HttpError(409, `You already have a plan on ${where ?? "another workspace"}.`);
  }
  if (!account) {
    const customerId = await deps.stripe.createCustomer({
      userId: deps.caller.id,
      email: deps.caller.email,
      name: deps.caller.name,
    });
    account = await deps.db.createAccount({
      owner_user_id: deps.caller.id,
      stripe_customer_id: customerId,
      livemode: deps.liveKey,
    });
  }

  // One open Checkout Session per workspace (Q8): a new one expires the
  // older, ignoring the error when it's no longer open.
  const now = deps.now?.() ?? Date.now();
  const open = await deps.db.openCheckout(companyId);
  if (open && Date.parse(open.expiresAt) > now) {
    await deps.stripe.expireCheckout(open.sessionId).catch(() => undefined);
  }

  const session = await withPrice(deps, plan, interval, (priceId) =>
    deps.stripe.createCheckout({
      customerId: account!.stripe_customer_id,
      priceId,
      successUrl: withParam(returnUrl, "billing", "done"),
      cancelUrl: returnUrl,
      accountId: account!.id,
      companyId,
      expiresAt: Math.floor(now / 1000) + CHECKOUT_TTL_SECONDS,
      automaticTax: deps.automaticTax,
    }),
  );
  await deps.db.saveCheckout({
    companyId,
    sessionId: session.id,
    accountId: account.id,
    expiresAt: new Date(session.expiresAt * 1000).toISOString(),
  });
  return { status: 200, body: { url: session.url } };
}

/** The workspace's plan, if the caller is the one who pays for it. */
async function ownedPlan(companyId: string, deps: BillingDeps): Promise<BillingAccountRow> {
  const link = await deps.db.companyLink(companyId);
  const account = link?.billingAccountId ? await deps.db.accountById(link.billingAccountId) : null;
  if (!account) throw new HttpError(409, "This workspace doesn't have a plan.");
  if (account.owner_user_id !== deps.caller.id) {
    throw new HttpError(403, "Only the person who pays for this plan can change it.");
  }
  return account;
}

/** §2 portal: the owner, to the portal page for one change: switch (with
 * plan and interval), cancel, payment, or the portal home (manage). */
async function portal(
  companyId: string,
  body: Record<string, unknown>,
  deps: BillingDeps,
): Promise<ActionResult> {
  const flow = requireEnum(body.flow, "flow", PORTAL_FLOWS);
  const returnUrl = deps.allowedRedirect(body.returnUrl, "returnUrl");
  const account = await ownedPlan(companyId, deps);
  const base = {
    customerId: account.stripe_customer_id,
    returnUrl,
    doneUrl: withParam(returnUrl, "billing", "done"),
  };
  const subscriptionId = account.stripe_subscription_id;

  if (flow === "manage" || flow === "payment") {
    return {
      status: 200,
      body: { url: await deps.stripe.createPortal({ ...base, flow: { type: flow } }) },
    };
  }
  if (!subscriptionId) throw new HttpError(409, "This workspace doesn't have a plan.");
  if (flow === "cancel") {
    const url = await deps.stripe.createPortal({
      ...base,
      flow: { type: "cancel", subscriptionId },
    });
    return { status: 200, body: { url } };
  }
  const { plan, interval } = requirePlan(body);
  const sub = await deps.stripe.retrieveSubscription(subscriptionId);
  const itemId = sub.items.data[0]?.id;
  if (!itemId) throw new HttpError(409, "This plan can't be changed here.");
  const url = await withPrice(deps, plan, interval, (priceId) =>
    deps.stripe.createPortal({
      ...base,
      flow: { type: "switch", subscriptionId, itemId, priceId },
    }),
  );
  return { status: 200, body: { url } };
}

/** §2 keep: the owner turns a pending cancel off; the one billing change
 * made in the app. */
async function keep(companyId: string, deps: BillingDeps): Promise<ActionResult> {
  const account = await ownedPlan(companyId, deps);
  if (!account.stripe_subscription_id || cardState(account) !== "cancel_pending") {
    throw new HttpError(409, "This plan isn't set to end.");
  }
  await deps.stripe.keep(
    account.stripe_subscription_id,
    account.cancel_at ? "cancel_at" : "cancel_at_period_end",
  );
  return { status: 200, body: { ok: true } };
}
