import React from "react";
import type { MonthlyUsage } from "@/lib/types";
import type { Member } from "@/lib/stores/interfaces";
import { stores } from "@/lib/stores";
import { useAsync } from "@/lib/useAsync";
import { useAuth } from "@/lib/auth/AuthContext";
import { compactCount, exactMonthStartIso } from "@/lib/stores/monthlyUsage";
import { ErrorState } from "../../ErrorState";
import { Metric, SettingsCard, Stat } from "../../primitives";

const count = (n: number): string => n.toLocaleString("en");

/** This workspace's admins, for the Plan card. A viewer here is an admin,
 * so the count is never below one (the local backend lists nobody). */
export function adminCount(members: Member[]): number {
  return Math.max(1, members.filter((m) => m.role === "admin").length);
}

/** Settings › Plan & usage (13:15203): the Plan card, this month's figures
 * on one card titled with the month, then AI usage. The Plan card is the
 * no-plan state, "Early access", with real values only; plans, prices and
 * their buttons arrive with billing in Phase 7b (PHASE-7 §9 D1, D12). */
export function UsageSection() {
  const { company, role } = useAuth();
  const state = useAsync<MonthlyUsage | null>(
    () =>
      company ? stores.usage.getMonthlyUsage(company.id, company.timezone) : Promise.resolve(null),
    [company],
  );

  const monthName = new Date().toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: company?.timezone ?? undefined,
  });

  return (
    <div className="sp-st-section">
      {company && <PlanCard companyId={company.id} />}

      <SettingsCard title={monthName}>
        {state.status === "loading" ? (
          <div className="sp-st-metrics" aria-busy="true" aria-label="Loading usage">
            {Array.from({ length: 4 }, (_, i) => (
              <span key={i} className="sp-st-bone" style={{ width: 96, height: 74 }} />
            ))}
          </div>
        ) : state.status === "error" ? (
          <ErrorState
            title="We couldn't load this month's usage."
            detail="Check your connection and try again."
            onRetry={state.retry}
          />
        ) : (
          state.data && (
            <div className="sp-st-metrics">
              <Metric label="Exports" value={count(state.data.downloads)} />
              <Metric
                label="Opens"
                value={count(state.data.opens)}
                sub={
                  state.data.publicOpens > 0
                    ? `${count(state.data.publicOpens)} via public links`
                    : undefined
                }
              />
              <Metric label="Templates used" value={count(state.data.templatesUsed)} />
              <Metric label="Members active" value={count(state.data.membersActive)} />
            </div>
          )
        )}
      </SettingsCard>

      {role === "admin" && company && (
        <AiUsageCard companyId={company.id} timeZone={company.timezone} />
      )}
    </div>
  );
}

/** The Plan card (13:15331) with no plan: "Early access", this workspace's
 * admins (no limit) and Members "Unlimited". No Brands row and no buttons
 * until Phase 7b; the header's action slot is where they will go. */
function PlanCard({ companyId }: { companyId: string }) {
  const members = useAsync(() => stores.people.list(companyId), [companyId]);
  const admins = members.status === "ready" ? count(adminCount(members.data)) : "…";
  return (
    <SettingsCard title="Early access">
      <div className="sp-st-stats">
        <Stat label="Admins" value={admins} />
        <Stat label="Members" value="Unlimited" />
      </div>
    </SettingsCard>
  );
}

/** "AI usage" (template-chat PROMPT §14): this calendar month's model
 * requests and tokens, in the workspace timezone, from every model call the
 * Edge Functions metered (ai_usage_events). Admins only; left out where the
 * store has nothing to report (the localStorage backend). It measures and
 * nothing more: no quota, no limit. */
function AiUsageCard({ companyId, timeZone }: { companyId: string; timeZone?: string }) {
  const state = useAsync(
    () => stores.usage.getAiUsage(companyId, exactMonthStartIso(timeZone ?? "UTC")),
    [companyId, timeZone],
  );
  if (state.status === "ready" && state.data === null) return null;
  return (
    <SettingsCard title="AI usage">
      {state.status === "loading" ? (
        <span
          className="sp-st-bone"
          style={{ width: 280, height: 39 }}
          aria-busy="true"
          aria-label="Loading AI usage"
        />
      ) : state.status === "error" ? (
        <ErrorState
          title="We couldn't load AI usage."
          detail="Check your connection and try again."
          onRetry={state.retry}
        />
      ) : (
        state.data && (
          <div className="sp-st-stats">
            <Stat label="Requests" value={count(state.data.requests)} />
            <Stat label="Tokens in" value={compactCount(state.data.inputTokens)} />
            <Stat label="Tokens out" value={compactCount(state.data.outputTokens)} />
          </div>
        )
      )}
    </SettingsCard>
  );
}
