// The billing webhook's logic (PHASE-7B.md §2, Q2, Q6), with Stripe and the
// database injected so vitest can run it. billing-webhook/index.ts wires the
// real ones.
//
// Every event is a nudge, never a source: the subscription it names is
// fetched from Stripe and its current state written, so an event that
// arrives twice or out of order leaves the same row.

import {
  CLEARED_PLAN,
  hasUnendedPlan,
  idOf,
  isEnded,
  planFieldsFromSubscription,
  stillRenews,
  type BillingAccountRow,
  type PlanFields,
  type StripeSubscriptionLike,
} from "./billing.ts";

/** The events the endpoint listens for (§7 step 4). */
export const BILLING_EVENTS = [
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
] as const;

export interface StripeEventLike {
  id: string;
  type: string;
  livemode: boolean;
  data: { object: Record<string, unknown> };
}

export interface WebhookDeps {
  /** Whether the secret key is a live one; events from the other mode are
   * answered 200 and ignored (Q2). */
  liveKey: boolean;
  /** Checks the Stripe-Signature header against the raw body; throws when
   * it doesn't match. */
  verify(rawBody: string, signature: string): Promise<StripeEventLike>;
  stripe: {
    /** With items.data.price.product expanded. */
    retrieveSubscription(id: string): Promise<StripeSubscriptionLike>;
    cancelSubscription(id: string): Promise<void>;
    /** Refunds what the invoice collected; nothing if it collected nothing. */
    refundInvoice(invoiceId: string): Promise<void>;
  };
  db: {
    accountById(id: string): Promise<BillingAccountRow | null>;
    accountByCustomer(customerId: string): Promise<BillingAccountRow | null>;
    updateAccount(id: string, fields: PlanFields): Promise<void>;
    companyLink(companyId: string): Promise<{ billingAccountId: string | null } | null>;
    linkCompany(companyId: string, accountId: string): Promise<void>;
    unlinkAccount(accountId: string): Promise<void>;
  };
  log(message: string, detail?: Record<string, unknown>): void;
}

export interface WebhookResult {
  status: number;
  body: Record<string, unknown>;
}

/** The subscription an event is about, if any. */
export function subscriptionIdOf(event: StripeEventLike): string | null {
  const o = event.data.object as Record<string, unknown>;
  switch (event.type) {
    case "checkout.session.completed":
      return o.mode === "subscription"
        ? idOf(o.subscription as string | { id: string } | null)
        : null;
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      return typeof o.id === "string" ? o.id : null;
    case "invoice.paid":
    case "invoice.payment_failed": {
      // Since basil an invoice names its subscription under parent.
      const parent = o.parent as {
        subscription_details?: { subscription?: string | { id: string } | null } | null;
      } | null;
      return idOf(parent?.subscription_details?.subscription ?? null);
    }
    default:
      return null;
  }
}

export async function handleWebhook(
  rawBody: string,
  signature: string | null,
  deps: WebhookDeps,
): Promise<WebhookResult> {
  if (!signature) return { status: 400, body: { error: "Missing Stripe-Signature." } };
  let event: StripeEventLike;
  try {
    event = await deps.verify(rawBody, signature);
  } catch {
    return { status: 400, body: { error: "Bad signature." } };
  }
  if (event.livemode !== deps.liveKey) {
    return { status: 200, body: { ignored: "livemode" } };
  }
  if (!(BILLING_EVENTS as readonly string[]).includes(event.type)) {
    return { status: 200, body: { ignored: "type" } };
  }
  const subscriptionId = subscriptionIdOf(event);
  if (!subscriptionId) return { status: 200, body: { ignored: "no subscription" } };

  const sub = await deps.stripe.retrieveSubscription(subscriptionId);
  await applySubscription(sub, deps);
  return { status: 200, body: { received: true } };
}

/** Write a subscription's current state, link its workspace, or (when it
 * can't attach) end it (Q6's backstop). */
export async function applySubscription(
  sub: StripeSubscriptionLike,
  deps: WebhookDeps,
): Promise<void> {
  const account =
    (sub.metadata.billing_account_id
      ? await deps.db.accountById(sub.metadata.billing_account_id)
      : null) ?? (await deps.db.accountByCustomer(idOf(sub.customer)!));
  if (!account) {
    deps.log("billing-webhook: a subscription with no billing account", {
      subscription: sub.id,
      customer: idOf(sub.customer),
    });
    return;
  }

  if (isEnded(sub.status)) {
    // Only the account's current subscription clears it; an older one (or
    // one the backstop ended) is history.
    if (account.stripe_subscription_id === sub.id) {
      await deps.db.updateAccount(account.id, CLEARED_PLAN);
      await deps.db.unlinkAccount(account.id);
    }
    return;
  }

  // A second subscription while the owner's first hasn't ended (Q9 slipped).
  if (
    account.stripe_subscription_id &&
    account.stripe_subscription_id !== sub.id &&
    hasUnendedPlan(account)
  ) {
    return backstop(sub, "the owner already pays for a plan", deps);
  }

  const companyId = sub.metadata.company_id;
  const company = companyId ? await deps.db.companyLink(companyId) : null;
  if (!company) return backstop(sub, "its workspace no longer exists", deps);
  if (company.billingAccountId && company.billingAccountId !== account.id) {
    const other = await deps.db.accountById(company.billingAccountId);
    if (other && stillRenews(other)) {
      return backstop(sub, "its workspace is already on another plan", deps);
    }
  }

  await deps.db.updateAccount(account.id, planFieldsFromSubscription(sub));
  await deps.db.linkCompany(companyId, account.id);
}

/** Q6: a paid subscription that can't attach is canceled at once, its
 * payment refunded, and the case logged for CJ. */
async function backstop(
  sub: StripeSubscriptionLike,
  reason: string,
  deps: WebhookDeps,
): Promise<void> {
  deps.log(`billing-webhook: ended a subscription because ${reason}`, {
    subscription: sub.id,
    customer: idOf(sub.customer),
    company: sub.metadata.company_id ?? null,
  });
  await deps.stripe.cancelSubscription(sub.id);
  const invoice = idOf(sub.latest_invoice);
  if (invoice) await deps.stripe.refundInvoice(invoice);
}
