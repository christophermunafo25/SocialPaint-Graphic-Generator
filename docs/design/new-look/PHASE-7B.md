# New look, Phase 7b: Billing

You are a senior engineer on SocialPaint (this repository). This phase adds plan management on Stripe: a workspace on **Early access** (Phase 7's no-plan card) can buy one of four plans, switch plans, cancel, keep a plan it was cancelling, and fix a failed payment. Stripe hosts payment and every confirmation; the app holds one row per billing owner, written only by a webhook.

It is its own pull request, right after Phase 7 merges (CJ, 2026-10-05; PLAN.md phase 7b). The server side is built first. The picker and every Plan card state except "on a plan" aren't drawn yet, so the client is built from the frames CJ adds to Master UX-UI (§8 Q1).

Be exact. Commit after each step with `npm run verify` green (`npm run verify && git commit`), and check `git branch --show-current` before every commit. If something here turns out to be wrong once you are in the code, stop and explain the conflict instead of improvising.

**Secrets.** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` and the optional `STRIPE_AUTOMATIC_TAX` are set in Supabase by CJ. Never ask for their values, never write them to a file, and never print them.

---

## 1. Read these first

1. `PLAN.md` (phase 7b), `PHASE-7.md` (§9 D1: the Early access card this phase extends) and `PHASE-7-SCREENS.md` Part B §2 (the Plan card 13:15331 / 13:16753, the one drawn state).
2. The Edge Function conventions: `supabase/functions/_shared/http.ts` (CORS from `ALLOWED_ORIGINS`, `jsonResponder`, `HttpError`, `logError`), `_shared/validate.ts` (`parseBody`, `requireUuid`, `requireAllowedRedirect`), `_shared/figma.ts` (`requireRole`, `serviceClient`), and `supabase/config.toml` (why only two functions skip the JWT check).
3. `supabase/functions/delete-company/index.ts` (it gains a refusal) and `admin/settings/AdvancedSection.tsx` (its typed confirm gains a line).
4. `src/app/components/admin/settings/UsageSection.tsx` after Phase 7, `src/lib/stores/interfaces.ts` and both backends' stores (a new `billing` store), and `src/app/routes.test.ts` (members still don't reach Plan & usage).

## 2. What the decisions say (CJ, 2026-10-05)

Recorded as given. §8 holds CJ's answers to the plan's questions (Q1 to Q13); they refine this section, and where the two differ, §8 wins.

**How it works**
- **Upgrade plan** from Early access goes to **Stripe Checkout**.
- **A plan switch** goes to the customer portal's confirm page for that one change (`flow_data.type = subscription_update_confirm`), which shows the proration.
- **Cancel plan** goes to the portal's cancel page (`subscription_cancel`); CJ sets the portal to cancel at the end of the period.
- Every Stripe page returns to `/settings/usage`.
- **Keep plan**, shown while a cancel is pending, is the one billing change made in the app: it turns `cancel_at_period_end` off.
- A plan belongs to the person who buys it (**the billing owner**) and covers the workspace it's bought in. Only the owner sees the plan's buttons; other admins see "Managed by {owner name}" (display name, else email). Members don't see Plan & usage, as today.
- **Billing appears only when the Stripe secrets are set.** Without them, and on the local backend, every workspace shows Early access with no buttons.
- **Test keys are gated** (Q2): while `STRIPE_SECRET_KEY` is a test key (`sk_test_` or `rk_test_`), billing exists only for signed-in users whose email is in `BILLING_TEST_EMAILS`; everyone else gets `{ configured: false }`.

**Data** (one migration, `0043_billing.sql`)
- `billing_accounts`, one row per owner: `owner_user_id` (unique), `stripe_customer_id` (unique), `stripe_subscription_id`, `plan` (`canvas`, `studio`, `crew` or `portfolio`), `interval` (`month` or `year`), `amount` and `currency` of the current price, `status` (Stripe's), `period_end`, `cancel_at_period_end`, `cancel_at`, `livemode` (Q2), `updated_at`. Owners read their own row; only the service role writes.
- `companies.billing_account_id`, null on Early access.
- `billing_checkout_sessions`, one open Checkout Session per workspace (Q8): `company_id` (primary key), `session_id`, `expires_at`. Service role only.
- `workspace_plan(company_id)`, security definer, for admins of that workspace: the plan fields, whether the caller is the owner, the owner's name, admins used across the workspaces on the plan, and how many workspaces it covers.
- `delete-company` per Q5 and Q6: refuses while the plan still renews, and ends a cancel-pending or incomplete subscription immediately when it goes ahead.

**Functions**
- **`billing`** (JWT, POST, CORS from `ALLOWED_ORIGINS`), with actions:
  - `plans`: `{ configured }`, plus each plan's monthly and yearly price read from Stripe when configured, so prices change in Stripe alone. A plan is the active product whose metadata `plan` is one of the four, with one monthly and one yearly price.
  - `checkout { companyId, plan, interval }`: an admin of a workspace on Early access who doesn't already own an active plan. Reuse or create the owner's Stripe customer (one per owner, with an idempotency key), one line item, and `subscription_data.metadata` carrying the billing account and the workspace. The success URL (`/settings/usage?billing=done`) and cancel URL pass `requireAllowedRedirect`. What Checkout collects is in Q11; the session expires after 30 minutes and replaces any open one for the workspace (Q8). Refused while the owner has a subscription that hasn't ended (Q9).
  - `portal { companyId, flow }`: owner only. Flows: `switch` (with plan and interval), `cancel`, `payment` (`payment_method_update`) and `manage` (the portal home, for invoices).
  - `keep { companyId }`: owner only.
- **`billing-webhook`**, `verify_jwt = false` in `config.toml` with a comment like the other two.
  - Read the raw body and verify the signature with `constructEventAsync` and `Stripe.createSubtleCryptoProvider()` (Deno has no synchronous crypto).
  - Events: `checkout.session.completed`, `customer.subscription.created`, `.updated`, `.deleted`, `invoice.paid` and `invoice.payment_failed`.
  - For each, **fetch the subscription from Stripe and write its current state** (events can arrive twice or out of order), and link the workspace named in the subscription's metadata.
  - Take the period end from the subscription **item** (since API version `2025-03-31.basil` it is no longer on the subscription). Pin the API version in the Stripe client.
  - A deleted subscription clears the plan fields, which puts the workspace back on Early access, and keeps the customer for a later upgrade.
  - Answers 200 and ignores an event whose `livemode` doesn't match the key (Q2).
  - **Backstop** (Q6): a paid subscription that can't attach to its workspace (deleted, or already on another plan that still renews) is canceled at once, its payment refunded, and the case logged for CJ.

**The Plan card** (Settings · Plan & usage; card 13:15331 Light, 13:16753 Dark)

| State | Title and line | Buttons (owner) | Stats |
|---|---|---|---|
| Early access | "Early access" | Upgrade plan (primary), for an admin who doesn't own an active plan | Admins {n}, Members "Unlimited" |
| On a plan | "{Plan} plan" over "{price} per month · Renews {date}" (per year on annual) | Cancel plan (secondary), Upgrade plan (primary) | Admin seats {used} of {included}, Brands {used} of {included} (the real count, even above the included number, Q4), Members "Unlimited", as drawn |
| Cancel pending (`cancel_at_period_end` or `cancel_at`, Q7) | "Ends {date}" in place of the renewal line (`cancel_at`, else the item's period end) | Keep plan (primary) in place of both | as on a plan |
| Payment failed (`past_due`, `unpaid` or `paused`, Q7) | "Payment failed" in place of the renewal line | Update payment (primary) | as on a plan |
| Another admin | the same card | none, plus "Managed by {owner name}" | same |

- The owner also reaches invoices and payment details (the portal home) from the card, placed as the frames show.
- Back from Stripe with `?billing=done`: re-read every 2 seconds for up to 20 seconds while the webhook lands, then drop the parameter.

**The plan picker.** Upgrade plan opens it on the `Modal` primitive: a Monthly / Annual switch and the four plans (price, included admins and brands), the current plan marked. Annual reads "{yearly price ÷ 12} per month, billed yearly". Choosing a plan goes to Checkout from Early access, or to the switch flow on a plan.

**The catalog.** Included admins and brands, in one module both the client and the functions read: Canvas 1 and 1, Studio 1 and 3, Crew 4 and 3, Portfolio 10 and 10. **Nothing is enforced.**

## 3. Invariants

- **Billing never blocks anything.** No limit is enforced, nothing locks, and `public_links_enabled` stays true for everyone.
- **The webhook is the only writer** of `billing_accounts` and `companies.billing_account_id`. `checkout`, `portal` and `keep` never write plan state themselves (`keep` asks Stripe; the webhook writes what Stripe then says).
- **Unconfigured is Early access.** With no Stripe secret, `plans` returns `{ configured: false }`, every other action refuses with a clean 400, and the card shows Early access with no buttons. The local backend behaves the same.
- **Every route and role stays as it is**; Plan & usage stays admin only.
- **Redirects** go only to `ALLOWED_ORIGINS` (`requireAllowedRedirect`).
- **Secrets** are never logged, echoed or stored outside Supabase.

## 4. Before you change anything

1. Confirm Phase 7 is merged and branch from `main`.
2. Read the Stripe docs for the pinned API version: Checkout Sessions, Billing Portal Sessions (`flow_data`), Subscriptions (items, `current_period_end` on the item), and webhook signature verification in Deno.
3. Baseline: `npm run shots -- capture .shots/before`.

## 5. Steps

### Step 1: the catalog and the migration
- `src/lib/billing/catalog.ts` (the four plans, their included admins and brands, labels), importable from `supabase/functions/_shared` the way other shared modules are.
- `0043_billing.sql`: the table, its RLS, the column, `workspace_plan`, and grants. Test the function's rules (admins only, owner flag, counts) with the repo's SQL test pattern, or document the manual check if there is none.
- Commit: "Billing: the catalog and the data".

### Step 2: the webhook
- `_shared/billing.ts`: the pure mapping from a Stripe subscription to a row (status, plan from product metadata, interval, amount and currency, period end from the item, cancel flag), with tests.
- `billing-webhook/index.ts`: raw body, async signature check, fetch-then-write, link the workspace from metadata, clear on delete. `config.toml` entry with its comment.
- Tests: the mapping and the Q7 state order, a bad signature returning 400, a duplicate and an out-of-order event leaving the same row, a `livemode` mismatch ignored with 200, and the backstop (cancel, refund, log).
- Commit: "Billing: the webhook".

### Step 3: the billing function
- `billing/index.ts` with `plans`, `checkout`, `portal` and `keep`, per §2.
- Tests: admin-only checkout, owner-only portal and keep, refusing a second plan (Q9, cancel pending included), redirects only to allowed origins, unconfigured refusals, the test-key gate (Q2), replacing an open Checkout Session (Q8), the per-month rounding (Q10), and the price-cache retry (Q12).
- **Before the client PR:** with CJ's sandbox keys in, check that `plans` reads all four plans, each with one monthly and one yearly price (Q1).
- Commit: "Billing: checkout, portal and keep".

### Step 4: delete-company
- Per Q5 and Q6: refuse while the plan still renews; with a cancel pending, end the subscription immediately with no refund; end an incomplete one silently.
- Commit: "Billing: delete waits for the plan".

### Step 5: the client (from CJ's frames)
- A `billing` store on both backends (local: unconfigured).
- The Plan card's five states, the picker, the `?billing=done` re-read, and the owner's invoices and payment link.
- **Advanced:** the delete confirm's lines (Q5, Q6), and Transfer ownership's "You keep paying for the {Plan} plan." when the person stepping down is the payer (Q3).
- `/dev/ui` specimens or fixtures for every state, Light and Dark.
- Commit: "Billing: the plan card and the picker".

### Step 6: the gate
1. `npm run verify` and `npm run build` pass.
2. Screenshots of every card state and the picker, Light and Dark, from fixtures; every other screen 0%.
3. **CJ's Stripe sandbox run:** subscribe to Canvas monthly with the test card 4242 4242 4242 4242, switch to Crew annual, cancel, keep the plan, cancel again, then cancel the subscription immediately from the Stripe dashboard and watch Early access come back. Payment failed is covered by fixtures and tests.
4. **The PR** includes the deploy steps (§7), the webhook URL to add in Stripe, its events, and the permissions a restricted live key needs.

## 6. Out of scope

- Enforcing seats and brands; what an account without a plan can do (a trial, locks).
- Add-ons: they buy nothing until limits are enforced, and the portal can't switch a subscription with more than one product.
- One plan covering more of the owner's workspaces.
- The `public_links_enabled` seam, which stays true for everyone.

## 7. Setup CJ does in Stripe (listed again in the PR)

1. **Products:** four active products with metadata `plan` = `canvas`, `studio`, `crew`, `portfolio`, each with one monthly and one yearly recurring price.
2. **Customer portal:** the login link on (Stripe adds it to customer emails, Q3); cancellations at the end of the period; subscription updates on, listing the four products and both prices each (the switch flow's confirm page needs them); proration as CJ prefers; invoices and payment methods on.
3. **Public details:** the terms of service URL, `https://www.socialpaint.ai/terms` (Checkout's terms consent needs it, Q11).
4. **Webhook endpoint:** `https://rabbycynypcpwilbaedb.supabase.co/functions/v1/billing-webhook`, on API version `2026-09-30.endive` (Q13), with the six events in §2. Its signing secret is `STRIPE_WEBHOOK_SECRET`.
5. **Secrets** (CJ sets them; never ask for values): `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, optional `STRIPE_AUTOMATIC_TAX`, and `BILLING_TEST_EMAILS` while the key is a test key.
6. **Restricted live key** (expected; the PR confirms against what the code calls): Customers write, Checkout Sessions write (create and expire), Customer portal write, Subscriptions write, Products read, Prices read, Invoices read and Refunds write (the backstop). Everything else none.
7. **Deploy:** `supabase db push` (0043), then `supabase functions deploy billing billing-webhook delete-company`.
8. **Going live** (Q2): delete the sandbox rows (`livemode` false), which puts their workspaces back on Early access; remove the sandbox webhook endpoint in Stripe; swap in the live key and live webhook secret; clear `BILLING_TEST_EMAILS`.

## 8. Decisions (CJ, 2026-10-05)

1. **Q1. PR shape.** Phase 7 merges first. The server PR (migration, `billing`, `billing-webhook`, the `delete-company` change, tests) changes nothing visible: without the Stripe secrets every workspace stays on Early access. Once CJ's sandbox keys are in, check that `plans` reads all four plans, each with one monthly and one yearly price, before starting the client PR. The client PR builds from the frames in Master UX-UI.
2. **Q2. Sandbox on the production project, with guards.**
   - While `STRIPE_SECRET_KEY` is a test key (`sk_test_` or `rk_test_`), billing exists only for signed-in users whose email is in `BILLING_TEST_EMAILS` (comma-separated). Everyone else gets `{ configured: false }`, and `checkout`, `portal` and `keep` refuse.
   - `billing_accounts` records `livemode`. The webhook answers 200 and ignores events whose `livemode` doesn't match the key.
   - Going live: a documented step deletes the sandbox rows (`livemode` false), which puts their workspaces back on Early access, and CJ removes the sandbox webhook endpoint in Stripe (§7 step 8).
3. **Q3. The payer stops being an admin.** The plan stays with the person who pays through demotion, removal and Transfer ownership. CJ turns on the customer portal's login link, which Stripe adds to its customer emails, so a payer who isn't an admin can still manage or cancel. When the person stepping down in Transfer ownership is the payer, its confirm adds "You keep paying for the {Plan} plan."
4. **Q4. Used counts.** Computed across the workspaces on the plan (in 7b, this workspace: its admins, and Brands 1). The real count shows even above the included number ("Admin seats 2 of 1" on Canvas). Nothing is enforced.
5. **Q5. A plan that still renews blocks the delete:** status `active`, `trialing`, `past_due`, `unpaid` or `paused` with no cancel pending. The owner sees "Cancel the plan before deleting this workspace." Other admins see "{owner name} pays for this workspace's plan."
6. **Q6. A cancel pending, and the backstop.**
   - With a cancel pending, the delete goes ahead and ends that subscription immediately, without a refund, and the confirm adds "Deleting this workspace also ends the {Plan} plan today." An incomplete subscription for the workspace is ended the same way, silently.
   - **Webhook backstop:** a paid subscription that can't attach to its workspace (deleted, or already on another plan that still renews) is canceled at once, its payment refunded, and the case logged for CJ.
7. **Q7. Status mapping,** checked in this order:
   - `past_due`, `unpaid`, `paused`: Payment failed.
   - `active` or `trialing` with `cancel_at_period_end` true or `cancel_at` set: Cancel pending. The end date is `cancel_at`, else the item's `current_period_end`. Keep plan clears whichever is set.
   - `active`, `trialing`: On a plan.
   - `incomplete`, `incomplete_expired`, `canceled`: Early access.
8. **Q8. Two admins at once.** One open Checkout Session per workspace, kept server side (`billing_checkout_sessions`). Starting a new one expires the older one (ignoring the error when it's no longer open). Sessions expire after 30 minutes (`expires_at`). The Q6 backstop covers anything that still slips through.
9. **Q9. An owner with a plan buying for another workspace** is refused while they have a subscription that hasn't ended, a cancel pending included: "You already have a plan on {workspace name}." Upgrade stays hidden for them.
10. **Q10. Currency and rounding.** USD only. Per month on annual is the yearly amount in cents divided by 12, rounded to the nearest cent, formatted en-US with cents ("$1,259.88"). The picker's annual line reads "{per month} per month · {yearly} billed yearly", for example "$12.99 per month · $155.88 billed yearly".
11. **Q11. What Checkout collects.**
    - The owner's account email, from the customer (not editable).
    - Cards and Link only, through `allowed_payment_method_types` (Apple Pay and Google Pay come with cards).
    - Billing address `auto`; or required and saved with `customer_update { address: auto, name: auto }` when `STRIPE_AUTOMATIC_TAX` is on.
    - `consent_collection.terms_of_service` required, which needs the terms URL CJ sets in Stripe's public details (`https://www.socialpaint.ai/terms`).
    - No phone, tax ID or promotion codes.
12. **Q12. Price cache.** Five minutes in memory per function instance. If Stripe rejects a price at checkout or switch, clear the cache and retry once.
13. **Q13. API version** `2026-09-30.endive`, through the `stripe` SDK release that pins it; CJ sets the webhook endpoint to the same version. Endive removed `payment_method_types` from Checkout Sessions, hence `allowed_payment_method_types` in Q11.
