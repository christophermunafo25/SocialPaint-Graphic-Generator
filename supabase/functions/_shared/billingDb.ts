// The billing tables through the service role (migration 0043): the one
// writer of billing_accounts and companies.billing_account_id. Imports
// supabase-js, so it stays out of the vitest-run modules.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import type { BillingAccountRow, PlanFields } from "./billing.ts";

const COLUMNS =
  "id, owner_user_id, stripe_customer_id, stripe_subscription_id, plan, interval, amount, currency, status, period_end, cancel_at_period_end, cancel_at, livemode";

/** Rows as the rules read them. */
const toRow = (r: Record<string, unknown> | null): BillingAccountRow | null =>
  r ? (r as unknown as BillingAccountRow) : null;

export function billingDb(db: SupabaseClient) {
  const one = async (column: string, value: string) => {
    const { data, error } = await db
      .from("billing_accounts")
      .select(COLUMNS)
      .eq(column, value)
      .maybeSingle();
    if (error) throw error;
    return toRow(data as Record<string, unknown> | null);
  };
  return {
    accountById: (id: string) => one("id", id),
    accountByCustomer: (customerId: string) => one("stripe_customer_id", customerId),
    accountByOwner: (userId: string) => one("owner_user_id", userId),

    async updateAccount(id: string, fields: PlanFields): Promise<void> {
      const { error } = await db
        .from("billing_accounts")
        .update({ ...fields, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },

    /** The owner's row, holding their customer: created once, at their
     * first checkout. A concurrent second insert loses to the first. */
    async createAccount(row: {
      owner_user_id: string;
      stripe_customer_id: string;
      livemode: boolean;
    }): Promise<BillingAccountRow> {
      const { error } = await db
        .from("billing_accounts")
        .upsert(row, { onConflict: "owner_user_id", ignoreDuplicates: true });
      if (error) throw error;
      return (await one("owner_user_id", row.owner_user_id))!;
    },

    async companyLink(companyId: string): Promise<{ billingAccountId: string | null } | null> {
      const { data, error } = await db
        .from("companies")
        .select("billing_account_id")
        .eq("id", companyId)
        .maybeSingle();
      if (error) throw error;
      return data
        ? { billingAccountId: (data as { billing_account_id: string | null }).billing_account_id }
        : null;
    },

    async linkCompany(companyId: string, accountId: string): Promise<void> {
      const { error } = await db
        .from("companies")
        .update({ billing_account_id: accountId })
        .eq("id", companyId);
      if (error) throw error;
    },

    async unlinkAccount(accountId: string): Promise<void> {
      const { error } = await db
        .from("companies")
        .update({ billing_account_id: null })
        .eq("billing_account_id", accountId);
      if (error) throw error;
    },

    async companyName(companyId: string): Promise<string | null> {
      const { data } = await db.from("companies").select("name").eq("id", companyId).maybeSingle();
      return (data as { name: string } | null)?.name ?? null;
    },

    /** The workspace a paying owner's plan covers (Q9's copy). */
    async coveredCompanyName(accountId: string): Promise<string | null> {
      const { data } = await db
        .from("companies")
        .select("name")
        .eq("billing_account_id", accountId)
        .order("name")
        .limit(1)
        .maybeSingle();
      return (data as { name: string } | null)?.name ?? null;
    },

    async user(userId: string): Promise<{ email: string; name: string | null } | null> {
      const { data } = await db.from("users").select("email, name").eq("id", userId).maybeSingle();
      return (data as { email: string; name: string | null } | null) ?? null;
    },

    async openCheckout(
      companyId: string,
    ): Promise<{ sessionId: string; expiresAt: string } | null> {
      const { data } = await db
        .from("billing_checkout_sessions")
        .select("session_id, expires_at")
        .eq("company_id", companyId)
        .maybeSingle();
      const r = data as { session_id: string; expires_at: string } | null;
      return r ? { sessionId: r.session_id, expiresAt: r.expires_at } : null;
    },

    async saveCheckout(row: {
      companyId: string;
      sessionId: string;
      accountId: string;
      expiresAt: string;
    }): Promise<void> {
      const { error } = await db.from("billing_checkout_sessions").upsert(
        {
          company_id: row.companyId,
          session_id: row.sessionId,
          billing_account_id: row.accountId,
          expires_at: row.expiresAt,
        },
        { onConflict: "company_id" },
      );
      if (error) throw error;
    },
  };
}

export type BillingDb = ReturnType<typeof billingDb>;
