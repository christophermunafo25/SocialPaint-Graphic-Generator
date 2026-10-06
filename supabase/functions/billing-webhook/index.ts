// Stripe's webhook for billing (PHASE-7B.md §2). Stripe calls it with no
// JWT (config.toml: verify_jwt = false); the Stripe-Signature header,
// checked against STRIPE_WEBHOOK_SECRET on the raw body, is the
// authentication. Events from the other mode are answered 200 and ignored.
//
// The logic is _shared/billingWebhook.ts (tested); this file wires it to
// Stripe and the service-role database.

import { serviceClient } from "../_shared/figma.ts";
import { logError } from "../_shared/http.ts";
import { isTestKey } from "../_shared/billing.ts";
import { handleWebhook, type StripeEventLike } from "../_shared/billingWebhook.ts";
import { billingDb } from "../_shared/billingDb.ts";
import {
  cancelSubscription,
  cryptoProvider,
  refundInvoice,
  retrieveSubscription,
  stripeClient,
  stripeKey,
} from "../_shared/stripe.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const key = stripeKey();
  const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!key || !secret) {
    return Response.json({ error: "Billing isn't configured." }, { status: 503 });
  }
  const stripe = stripeClient(key);
  const db = billingDb(serviceClient());
  try {
    const raw = await req.text();
    const result = await handleWebhook(raw, req.headers.get("Stripe-Signature"), {
      liveKey: !isTestKey(key),
      verify: async (body, signature) =>
        (await stripe.webhooks.constructEventAsync(
          body,
          signature,
          secret,
          undefined,
          cryptoProvider,
        )) as unknown as StripeEventLike,
      stripe: {
        retrieveSubscription: (id) => retrieveSubscription(stripe, id),
        cancelSubscription: (id) => cancelSubscription(stripe, id),
        refundInvoice: (id) => refundInvoice(stripe, id),
      },
      db,
      log: (message, detail) => console.warn(`[billing-webhook] ${message}`, detail ?? {}),
    });
    return Response.json(result.body, { status: result.status });
  } catch (e) {
    // A 500 makes Stripe retry, which is right for a transient failure:
    // the handler is safe to run again.
    logError("billing-webhook", e);
    return Response.json({ error: "Webhook failed." }, { status: 500 });
  }
});
