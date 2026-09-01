import React from "react";
import { Download, Eye, Layers, Users } from "lucide-react";
import type { MonthlyUsage } from "@/lib/types";
import { stores } from "@/lib/stores";
import { useAsync } from "@/lib/useAsync";
import { useAuth } from "@/lib/auth/AuthContext";
import { ErrorState } from "../../ErrorState";
import { Kpi } from "../Kpi";
import { SettingsCard } from "./settingsShared";

/** Read-only current-month usage, plus the Plan card. The Plan card is a
 * deliberate placeholder: it establishes WHERE billing lands so adding it
 * later is a change to one card — it does not invent tiers, prices, or
 * quotas. */
export function UsageSection() {
  const { company } = useAuth();
  const state = useAsync<MonthlyUsage | null>(
    () =>
      company ? stores.usage.getMonthlyUsage(company.id, company.timezone) : Promise.resolve(null),
    [company],
  );

  const monthName = new Date().toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
    timeZone: company?.timezone ?? undefined,
  });

  return (
    <div className="space-y-6">
      {state.status === "loading" ? (
        <p style={{ fontSize: "var(--type-label-size)", color: "var(--text-muted)" }}>Loading…</p>
      ) : state.status === "error" ? (
        <ErrorState
          title="We couldn't load this month's usage."
          detail="Check your connection and try again."
          onRetry={state.retry}
        />
      ) : state.data ? (
        <>
          <p style={{ fontSize: "var(--type-caption-size)", color: "var(--text-muted)" }}>
            {monthName}, in the workspace timezone. The full history lives on Insights.
          </p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            <Kpi
              label="Exports"
              value={state.data.downloads}
              Icon={Download}
              chip="var(--viz-series-1)"
            />
            <Kpi
              label="Opens"
              value={state.data.opens}
              Icon={Eye}
              chip="var(--viz-series-2)"
              sub={
                state.data.publicOpens > 0
                  ? `${state.data.publicOpens} via public links`
                  : undefined
              }
            />
            <Kpi
              label="Templates used"
              value={state.data.templatesUsed}
              Icon={Layers}
              chip="var(--bg-hover)"
              chipFg="var(--text-primary)"
            />
            <Kpi
              label="Members active"
              value={state.data.membersActive}
              Icon={Users}
              chip="var(--bg-hover)"
              chipFg="var(--text-primary)"
            />
          </div>
        </>
      ) : null}

      <SettingsCard title="Plan">
        <p style={{ fontSize: "var(--type-label-size)", color: "var(--text-primary)" }}>
          Free — no limits enforced
        </p>
      </SettingsCard>
    </div>
  );
}
