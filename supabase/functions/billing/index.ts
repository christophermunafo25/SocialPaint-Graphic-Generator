// Billing (PHASE-7B.md §2): plans, checkout, portal and keep for the Plan
// card. POST with the caller's JWT; CORS from ALLOWED_ORIGINS like the
// other functions. The logic is _shared/billingActions.ts (tested); this
// file wires it to Stripe and the service-role database.
//
// Billing exists only when STRIPE_SECRET_KEY is set; on a test key only
// for the signed-in users in BILLING_TEST_EMAILS (Q2). Everyone else gets
// { configured: false } and the rest is refused.

import { createClient } from "npm:@supabase/supabase-js@2";
import type Stripe from "npm:stripe@23.0.0";
import { serviceClient } from "../_shared/figma.ts";
import {
  GENERIC_ERROR,
  HttpError,
  handleOptions,
  jsonResponder,
  logError,
} from "../_shared/http.ts";
import { parseBody, requireAllowedRedirect } from "../_shared/validate.ts";
import { PlanCache, billingConfigured, isTestKey, plansFromPrices } from "../_shared/billing.ts";
import {
  handleBilling,
  type CheckoutRequest,
  type PortalRequest,
} from "../_shared/billingActions.ts";
import { billingDb } from "../_shared/billingDb.ts";
import {
  listPlanPrices,
  retrieveSubscription,
  stripeClient,
  stripeKey,
} from "../_shared/stripe.ts";

/** Prices read from Stripe, five minutes per instance (Q12). */
const planCache = new PlanCache();

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  const json = jsonResponder(req);
  try {
    const caller = await signedInUser(req);
    if (!caller) return json({ error: "Not signed in." }, 401);
    const body = await parseBody(req);

    const service = serviceClient();
    const db = billingDb(service);
    const profile = await db.user(caller.id);
    const key = stripeKey();
    const configured = billingConfigured(key, caller.email, Deno.env.get("BILLING_TEST_EMAILS"));
    const stripe = key && configured ? stripeClient(key) : null;

    const result = await handleBilling(body, {
      configured,
      automaticTax: Deno.env.get("STRIPE_AUTOMATIC_TAX") === "on",
      liveKey: !!key && !isTestKey(key),
      caller: { id: caller.id, email: caller.email, name: profile?.name ?? null },
      roleIn: async (companyId) => {
        const { data } = await service
          .from("memberships")
          .select("role")
          .eq("user_id", caller.id)
          .eq("company_id", companyId)
          .maybeSingle();
        return (data as { role: "admin" | "member" } | null)?.role ?? null;
      },
      allowedRedirect: requireAllowedRedirect,
      db,
      stripe: stripeActions(stripe),
    });
    return json(result.body, result.status);
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    logError("billing", e);
    return json({ error: GENERIC_ERROR }, 500);
  }
});

async function signedInUser(req: Request): Promise<{ id: string; email: string } | null> {
  const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data, error } = await client.auth.getUser();
  if (error || !data.user?.email) return null;
  return { id: data.user.id, email: data.user.email };
}

/** The Stripe calls the actions make. Only reached when configured. */
function stripeActions(stripe: Stripe | null) {
  const s = () => {
    if (!stripe) throw new HttpError(400, "Billing isn't available for this workspace.");
    return stripe;
  };
  return {
    plans: () =>
      planCache.get(async () => {
        const { plans, problems } = plansFromPrices(await listPlanPrices(s()));
        if (problems.length) console.warn("[billing] plans in Stripe need attention", problems);
        return plans;
      }),
    clearPlans: () => planCache.clear(),
    isPriceError: (e: unknown) => {
      const err = e as { type?: string; code?: string; param?: string };
      return (
        err?.type === "StripeInvalidRequestError" &&
        (err.code === "resource_missing" || (err.param ?? "").includes("price"))
      );
    },
    createCustomer: async (owner: { userId: string; email: string; name: string | null }) => {
      const customer = await s().customers.create(
        {
          email: owner.email,
          ...(owner.name ? { name: owner.name } : {}),
          metadata: { owner_user_id: owner.userId },
        },
        // One customer per owner, even if two checkouts start at once.
        { idempotencyKey: `billing-customer-${owner.userId}` },
      );
      return customer.id;
    },
    createCheckout: async (r: CheckoutRequest) => {
      const metadata = { billing_account_id: r.accountId, company_id: r.companyId };
      const session = await s().checkout.sessions.create({
        mode: "subscription",
        customer: r.customerId,
        line_items: [{ price: r.priceId, quantity: 1 }],
        success_url: r.successUrl,
        cancel_url: r.cancelUrl,
        expires_at: r.expiresAt,
        client_reference_id: r.companyId,
        metadata,
        subscription_data: { metadata },
        // Q11: cards and Link (Apple Pay and Google Pay come with cards),
        // the address only as tax needs it, the terms, and nothing else.
        allowed_payment_method_types: ["card", "link"],
        billing_address_collection: r.automaticTax ? "required" : "auto",
        ...(r.automaticTax
          ? {
              automatic_tax: { enabled: true },
              customer_update: { address: "auto" as const, name: "auto" as const },
            }
          : {}),
        consent_collection: { terms_of_service: "required" },
      });
      if (!session.url) throw new Error("Checkout returned no URL.");
      return { id: session.id, url: session.url, expiresAt: session.expires_at };
    },
    expireCheckout: async (id: string) => {
      await s().checkout.sessions.expire(id);
    },
    retrieveSubscription: (id: string) => retrieveSubscription(s(), id),
    createPortal: async (r: PortalRequest) => {
      const done = { type: "redirect" as const, redirect: { return_url: r.doneUrl } };
      const flow_data =
        r.flow.type === "switch"
          ? {
              type: "subscription_update_confirm" as const,
              subscription_update_confirm: {
                subscription: r.flow.subscriptionId,
                items: [{ id: r.flow.itemId, price: r.flow.priceId, quantity: 1 }],
              },
              after_completion: done,
            }
          : r.flow.type === "cancel"
            ? {
                type: "subscription_cancel" as const,
                subscription_cancel: { subscription: r.flow.subscriptionId },
                after_completion: done,
              }
            : r.flow.type === "payment"
              ? { type: "payment_method_update" as const, after_completion: done }
              : undefined;
      const session = await s().billingPortal.sessions.create({
        customer: r.customerId,
        return_url: r.returnUrl,
        ...(flow_data ? { flow_data } : {}),
      });
      return session.url;
    },
    keep: async (id: string, clear: "cancel_at" | "cancel_at_period_end") => {
      await s().subscriptions.update(
        id,
        clear === "cancel_at" ? { cancel_at: "" } : { cancel_at_period_end: false },
      );
    },
  };
}
