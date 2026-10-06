// The Stripe client for the billing functions (PHASE-7B.md Q13): the SDK
// release that pins API version 2026-09-30.endive, on fetch and SubtleCrypto
// since Deno has no synchronous crypto. The webhook endpoint in Stripe is
// set to the same version.
//
// STRIPE_SECRET_KEY is set by CJ in Supabase; it is never logged or echoed.

import Stripe from "npm:stripe@23.0.0";
import type { StripePriceLike, StripeSubscriptionLike } from "./billing.ts";

export const STRIPE_API_VERSION = "2026-09-30.endive";

export const cryptoProvider = Stripe.createSubtleCryptoProvider();

export function stripeKey(): string | undefined {
  return Deno.env.get("STRIPE_SECRET_KEY") || undefined;
}

export function stripeClient(key: string): Stripe {
  return new Stripe(key, {
    apiVersion: STRIPE_API_VERSION,
    httpClient: Stripe.createFetchHttpClient(),
  });
}

/** A subscription with what planFieldsFromSubscription reads expanded. */
export async function retrieveSubscription(
  stripe: Stripe,
  id: string,
): Promise<StripeSubscriptionLike> {
  const sub = await stripe.subscriptions.retrieve(id, { expand: ["items.data.price.product"] });
  return sub as unknown as StripeSubscriptionLike;
}

/** Ends a subscription now, with no refund (deleting a workspace, Q6). */
export async function cancelSubscription(stripe: Stripe, id: string): Promise<void> {
  await stripe.subscriptions.cancel(id);
}

/** Refunds every paid payment an invoice collected (Q6's backstop). */
export async function refundInvoice(stripe: Stripe, invoiceId: string): Promise<void> {
  const invoice = await stripe.invoices.retrieve(invoiceId, { expand: ["payments"] });
  if (!invoice.amount_paid) return;
  for (const p of invoice.payments?.data ?? []) {
    if (p.status !== "paid") continue;
    const intent = p.payment.payment_intent;
    const intentId = typeof intent === "string" ? intent : intent?.id;
    if (intentId) await stripe.refunds.create({ payment_intent: intentId });
  }
}

/** Every active recurring price with its product expanded, for `plans`. */
export async function listPlanPrices(stripe: Stripe): Promise<StripePriceLike[]> {
  const prices: StripePriceLike[] = [];
  for await (const price of stripe.prices.list({
    active: true,
    type: "recurring",
    expand: ["data.product"],
    limit: 100,
  })) {
    prices.push(price as unknown as StripePriceLike);
  }
  return prices;
}
