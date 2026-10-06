import { describe, expect, it } from "vitest";
import { CLEARED_PLAN, type BillingAccountRow, type PlanPrices } from "./billing.ts";
import {
  handleBilling,
  type BillingDeps,
  type CheckoutRequest,
  type PortalRequest,
} from "./billingActions.ts";
import { HttpError } from "./http.ts";

const CO = "11111111-1111-4111-8111-111111111111";
const APP = "https://app.socialpaint.ai/settings/usage";

const PRICES: PlanPrices[] = [
  {
    plan: "canvas",
    month: { priceId: "c_m", amount: 1299 },
    year: { priceId: "c_y", amount: 15588 },
  },
  {
    plan: "crew",
    month: { priceId: "w_m", amount: 5999 },
    year: { priceId: "w_y", amount: 71988 },
  },
];

const account = (over: Partial<BillingAccountRow> = {}): BillingAccountRow => ({
  id: "acct_cj",
  owner_user_id: "cj",
  stripe_customer_id: "cus_cj",
  livemode: false,
  ...CLEARED_PLAN,
  ...over,
});

function setup(opts: {
  role?: "admin" | "member" | null;
  configured?: boolean;
  caller?: string;
  accounts?: BillingAccountRow[];
  link?: string | null;
  open?: { sessionId: string; expiresAt: string } | null;
  priceFailsOnce?: boolean;
}) {
  const accounts = new Map((opts.accounts ?? []).map((a) => [a.id, a]));
  const calls: string[] = [];
  let checkoutReq: CheckoutRequest | null = null;
  let portalReq: PortalRequest | null = null;
  let priceFails = opts.priceFailsOnce ?? false;
  const deps: BillingDeps = {
    configured: opts.configured ?? true,
    automaticTax: false,
    liveKey: false,
    caller: { id: opts.caller ?? "cj", email: "cj@acme.com", name: "CJ" },
    roleIn: async () => (opts.role === undefined ? "admin" : opts.role),
    allowedRedirect: (url, field) => {
      if (typeof url !== "string" || !url.startsWith("https://app.socialpaint.ai/")) {
        throw new HttpError(400, `${field} must be a URL on this app's own domain.`);
      }
      return url;
    },
    db: {
      accountById: async (id) => accounts.get(id) ?? null,
      accountByOwner: async (u) =>
        [...accounts.values()].find((a) => a.owner_user_id === u) ?? null,
      createAccount: async (row) => {
        const a = account({ ...row, id: `acct_${row.owner_user_id}` });
        accounts.set(a.id, a);
        calls.push(`account ${a.id}`);
        return a;
      },
      companyLink: async () => ({ billingAccountId: opts.link ?? null }),
      coveredCompanyName: async () => "Acme Health",
      openCheckout: async () => opts.open ?? null,
      saveCheckout: async (r) => {
        calls.push(`save ${r.sessionId}`);
      },
    },
    stripe: {
      plans: async () => PRICES,
      clearPlans: () => calls.push("clear"),
      isPriceError: (e) => e instanceof Error && e.message === "No such price",
      createCustomer: async () => {
        calls.push("customer");
        return "cus_new";
      },
      createCheckout: async (req) => {
        if (priceFails) {
          priceFails = false;
          throw new Error("No such price");
        }
        checkoutReq = req;
        return {
          id: "cs_new",
          url: "https://checkout.stripe.com/c/cs_new",
          expiresAt: req.expiresAt,
        };
      },
      expireCheckout: async (id) => {
        calls.push(`expire ${id}`);
      },
      retrieveSubscription: async (id) => ({
        id,
        customer: "cus_cj",
        status: "active",
        livemode: false,
        cancel_at: null,
        cancel_at_period_end: false,
        metadata: {},
        latest_invoice: null,
        items: {
          data: [
            {
              id: "si_1",
              current_period_end: 0,
              price: {
                id: "c_m",
                unit_amount: 1299,
                currency: "usd",
                recurring: { interval: "month" },
                product: "prod",
              },
            },
          ],
        },
      }),
      createPortal: async (req) => {
        portalReq = req;
        return "https://billing.stripe.com/p/session";
      },
      keep: async (id, clear) => {
        calls.push(`keep ${id} ${clear}`);
      },
    },
    now: () => Date.parse("2026-10-06T12:00:00Z"),
  };
  return { deps, calls, accounts, checkout: () => checkoutReq, portal: () => portalReq };
}

const fails = async (p: Promise<unknown>, status: number, message?: string) => {
  const e = await p.then(
    () => null,
    (err: unknown) => err,
  );
  expect(e).toBeInstanceOf(HttpError);
  expect((e as HttpError).status).toBe(status);
  if (message) expect((e as HttpError).message).toBe(message);
};

const checkoutBody = {
  action: "checkout",
  companyId: CO,
  plan: "crew",
  interval: "year",
  returnUrl: APP,
};

describe("billing plans (§2, Q2, Q10)", () => {
  it("returns the prices with the catalog and the annual per-month figure", async () => {
    const { deps } = setup({});
    const res = await handleBilling({ action: "plans" }, deps);
    expect(res.body.configured).toBe(true);
    expect(res.body.plans).toEqual([
      {
        plan: "canvas",
        label: "Canvas",
        includedAdmins: 1,
        includedBrands: 1,
        month: { amount: 1299 },
        year: { amount: 15588, perMonth: 1299 },
      },
      {
        plan: "crew",
        label: "Crew",
        includedAdmins: 4,
        includedBrands: 3,
        month: { amount: 5999 },
        year: { amount: 71988, perMonth: 5999 },
      },
    ]);
  });

  it("says unconfigured (no key, or a test key for someone not on the list) and refuses the rest", async () => {
    const { deps } = setup({ configured: false });
    expect((await handleBilling({ action: "plans" }, deps)).body).toEqual({
      configured: false,
      plans: [],
    });
    await fails(
      handleBilling(checkoutBody, deps),
      400,
      "Billing isn't available for this workspace.",
    );
    await fails(handleBilling({ action: "keep", companyId: CO }, deps), 400);
  });
});

describe("billing checkout (§2, Q8, Q9, Q11, Q12)", () => {
  it("is admin only", async () => {
    await fails(handleBilling(checkoutBody, setup({ role: "member" }).deps), 403);
    await fails(handleBilling(checkoutBody, setup({ role: null }).deps), 403);
  });

  it("creates the owner's customer once, and opens Checkout with the workspace in the metadata", async () => {
    const s = setup({});
    const res = await handleBilling(checkoutBody, s.deps);
    expect(res.body).toEqual({ url: "https://checkout.stripe.com/c/cs_new" });
    expect(s.calls).toEqual(["customer", "account acct_cj", "save cs_new"]);
    expect(s.checkout()).toMatchObject({
      customerId: "cus_new",
      priceId: "w_y",
      successUrl: `${APP}?billing=done`,
      cancelUrl: APP,
      accountId: "acct_cj",
      companyId: CO,
      expiresAt: Date.parse("2026-10-06T12:30:00Z") / 1000,
    });
  });

  it("reuses the owner's customer", async () => {
    const s = setup({ accounts: [account()] });
    await handleBilling(checkoutBody, s.deps);
    expect(s.calls).not.toContain("customer");
  });

  it("redirects only to allowed origins", async () => {
    await fails(
      handleBilling({ ...checkoutBody, returnUrl: "https://evil.example/" }, setup({}).deps),
      400,
    );
  });

  it("refuses an owner whose plan hasn't ended, a pending cancel included (Q9)", async () => {
    const paying = account({
      stripe_subscription_id: "sub_1",
      status: "active",
      cancel_at_period_end: true,
    });
    await fails(
      handleBilling(checkoutBody, setup({ accounts: [paying] }).deps),
      409,
      "You already have a plan on Acme Health.",
    );
  });

  it("refuses a workspace already on a plan", async () => {
    const other = account({
      id: "acct_p",
      owner_user_id: "priya",
      stripe_subscription_id: "sub_p",
      status: "past_due",
    });
    await fails(
      handleBilling(checkoutBody, setup({ accounts: [other], link: "acct_p" }).deps),
      409,
    );
  });

  it("expires the workspace's older open session first (Q8)", async () => {
    const s = setup({ open: { sessionId: "cs_old", expiresAt: "2026-10-06T12:10:00Z" } });
    await handleBilling(checkoutBody, s.deps);
    expect(s.calls).toContain("expire cs_old");
  });

  it("reloads the prices and retries once when Stripe rejects a price (Q12)", async () => {
    const s = setup({ priceFailsOnce: true });
    await handleBilling(checkoutBody, s.deps);
    expect(s.calls).toContain("clear");
    expect(s.checkout()?.priceId).toBe("w_y");
  });

  it("refuses an unknown plan or interval", async () => {
    await fails(handleBilling({ ...checkoutBody, plan: "gold" }, setup({}).deps), 400);
    await fails(handleBilling({ ...checkoutBody, interval: "week" }, setup({}).deps), 400);
  });
});

describe("billing portal and keep (owner only)", () => {
  const paying = account({ stripe_subscription_id: "sub_1", status: "active", plan: "canvas" });

  it("refuses another admin of the workspace", async () => {
    const s = setup({ caller: "priya", accounts: [paying], link: "acct_cj" });
    await fails(
      handleBilling({ action: "portal", companyId: CO, flow: "cancel", returnUrl: APP }, s.deps),
      403,
      "Only the person who pays for this plan can change it.",
    );
    await fails(handleBilling({ action: "keep", companyId: CO }, s.deps), 403);
  });

  it("sends the owner to the switch confirm for one item and the new price", async () => {
    const s = setup({ accounts: [paying], link: "acct_cj" });
    const res = await handleBilling(
      {
        action: "portal",
        companyId: CO,
        flow: "switch",
        plan: "crew",
        interval: "year",
        returnUrl: APP,
      },
      s.deps,
    );
    expect(res.body.url).toBe("https://billing.stripe.com/p/session");
    expect(s.portal()).toEqual({
      customerId: "cus_cj",
      returnUrl: APP,
      doneUrl: `${APP}?billing=done`,
      flow: { type: "switch", subscriptionId: "sub_1", itemId: "si_1", priceId: "w_y" },
    });
  });

  it("opens the cancel page, the card page and the portal home", async () => {
    const s = setup({ accounts: [paying], link: "acct_cj" });
    for (const flow of ["cancel", "payment", "manage"]) {
      await handleBilling({ action: "portal", companyId: CO, flow, returnUrl: APP }, s.deps);
      expect(s.portal()?.flow.type).toBe(flow);
    }
  });

  it("keeps a plan with a pending cancel, clearing whichever is set", async () => {
    const pending = account({
      stripe_subscription_id: "sub_1",
      status: "active",
      cancel_at: "2026-11-01T00:00:00Z",
    });
    const s = setup({ accounts: [pending], link: "acct_cj" });
    expect((await handleBilling({ action: "keep", companyId: CO }, s.deps)).body).toEqual({
      ok: true,
    });
    expect(s.calls).toContain("keep sub_1 cancel_at");
    await fails(
      handleBilling(
        { action: "keep", companyId: CO },
        setup({ accounts: [paying], link: "acct_cj" }).deps,
      ),
      409,
    );
  });
});
