import React from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Download, Eye, Layers, Percent } from "lucide-react";
import type { DailyActivityPoint, UsageSummary } from "@/lib/types";
import { stores } from "@/lib/stores";
import { useAsync } from "@/lib/useAsync";
import { useAuth } from "@/lib/auth/AuthContext";
import { Page, PageHeader } from "../layout/Page";
import { ErrorState } from "../ErrorState";
import { useCountUp } from "@/lib/useCountUp";
import { BrandMark } from "../Sidebar";

const TREND_DAYS = 30;

const mono: React.CSSProperties = { fontFamily: "var(--font-mono)" };

const fmtDay = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });

const relativeDay = (iso: string | null): string => {
  if (!iso) return "—";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
};

const exportRate = (downloads: number, opens: number): string =>
  opens === 0 ? "—" : `${Math.round((downloads / opens) * 100)}%`;

interface KpiProps {
  label: string;
  /** A number counts up on load; a string ("—", "42%") renders as-is. */
  value: string | number;
  Icon: typeof Download;
  chip: string; // background token for the icon chip
  /** Icon color on the chip. Brand fills (Volt/Aqua) take ink in both themes;
   * neutral chips (--bg-hover) need the theme-following text color instead —
   * ink on a dark-mode --bg-hover chip disappears. */
  chipFg?: string;
}

/** Stat tile — a headline number needs no chart. Values are data → mono.
 * Numeric values count up once on load (useCountUp); strings render as-is. */
function Kpi({ label, value, Icon, chip, chipFg = "var(--text-on-accent)" }: KpiProps) {
  const numeric = typeof value === "number" ? value : 0;
  const counted = useCountUp(numeric);
  const shown = typeof value === "number" ? counted : value;
  return (
    <div className="sp-card sp-card--content flex items-center gap-4">
      <span
        className="flex items-center justify-center flex-shrink-0"
        style={{ width: 38, height: 38, borderRadius: "var(--radius-control)", background: chip }}
      >
        <Icon style={{ width: 16, height: 16, color: chipFg }} />
      </span>
      <span className="min-w-0">
        <span
          className="block truncate"
          style={{ ...mono, fontSize: 24, lineHeight: 1.1, color: "var(--text-primary)" }}
        >
          {shown}
        </span>
        <span className="sp-eyebrow block" style={{ marginTop: 3 }}>
          {label}
        </span>
      </span>
    </div>
  );
}

/** Legend chip: colored dot + label + mono total (identity never color-alone). */
function LegendChip({ color, label, total }: { color: string; label: string; total: number }) {
  return (
    <span
      className="flex items-center gap-1.5"
      style={{ fontSize: "var(--type-caption-size)", color: "var(--text-secondary)" }}
    >
      <span
        aria-hidden
        style={{ width: 8, height: 8, borderRadius: "var(--radius-pill)", background: color }}
      />
      {label}
      <span style={{ ...mono, fontSize: 11, color: "var(--text-muted)" }}>{total}</span>
    </span>
  );
}

/** Admin usage dashboard: KPI tiles, a 30-day activity trend, a most-used
 * leaderboard, and the full table. Events are recorded inside SchemaRenderer;
 * this page only reads. */
export function Dashboard() {
  const { company } = useAuth();
  const summaryState = useAsync<UsageSummary | null>(
    () => (company ? stores.usage.getUsageSummary(company.id) : Promise.resolve(null)),
    [company],
  );
  const trendState = useAsync<DailyActivityPoint[]>(
    () => (company ? stores.usage.getDailyActivity(company.id, TREND_DAYS) : Promise.resolve([])),
    [company],
  );

  if (summaryState.status === "loading") {
    return (
      <p
        className="text-center py-24"
        style={{ fontSize: "var(--type-label-size)", color: "var(--text-muted)" }}
      >
        Loading usage…
      </p>
    );
  }
  if (summaryState.status === "error") {
    return (
      <ErrorState
        title="We couldn't load your usage data."
        detail="Check your connection and try again."
        onRetry={summaryState.retry}
      />
    );
  }
  const summary = summaryState.data;
  if (!summary) {
    return (
      <p
        className="text-center py-24"
        style={{ fontSize: "var(--type-label-size)", color: "var(--text-muted)" }}
      >
        Loading usage…
      </p>
    );
  }
  const trend = trendState.status === "ready" ? trendState.data : null;

  const totalOpens = summary.rows.reduce((n, r) => n + r.opens, 0);
  const activeTemplates = summary.rows.filter((r) => r.opens + r.downloads > 0).length;
  const trendOpens = (trend ?? []).reduce((n, p) => n + p.opens, 0);
  const trendDownloads = (trend ?? []).reduce((n, p) => n + p.downloads, 0);
  const top = summary.rows.slice(0, 8);
  const maxCount = Math.max(1, ...top.map((r) => Math.max(r.downloads, r.opens)));

  return (
    <Page>
      <PageHeader title="Insights" description="Which templates your team actually uses." />

      {summary.rows.length === 0 ? (
        <div className="sp-card relative overflow-hidden text-center py-20 px-6">
          <span
            aria-hidden
            className="absolute"
            style={{ right: -40, bottom: -30, opacity: 0.07, color: "var(--text-primary)" }}
          >
            <BrandMark width={280} />
          </span>
          <p style={{ fontSize: 14, color: "var(--text-primary)", fontWeight: 500 }}>
            No usage yet
          </p>
          <p
            style={{ fontSize: "var(--type-label-size)", color: "var(--text-muted)", marginTop: 6 }}
          >
            Opens and downloads appear here as soon as members start using published templates.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* KPI row — same 24px gap as every other grid on the page */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            <Kpi
              label="Total exports"
              value={summary.totalDownloads}
              Icon={Download}
              chip="var(--viz-series-1)"
            />
            <Kpi
              label="Total opens"
              value={totalOpens}
              Icon={Eye}
              chip="var(--viz-series-2)"
            />
            <Kpi
              label="Export rate"
              value={exportRate(summary.totalDownloads, totalOpens)}
              Icon={Percent}
              chip="var(--bg-hover)"
              chipFg="var(--text-primary)"
            />
            <Kpi
              label="Templates in use"
              value={activeTemplates}
              Icon={Layers}
              chip="var(--bg-hover)"
              chipFg="var(--text-primary)"
            />
          </div>

          {/* 30-day trend */}
          <div className="sp-card sp-card--content">
            <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
              <h2 className="sp-panel-title">Activity — last 30 days</h2>
              <div className="flex items-center gap-4">
                <LegendChip color="var(--viz-series-1)" label="Downloads" total={trendDownloads} />
                <LegendChip color="var(--viz-series-2)" label="Opens" total={trendOpens} />
              </div>
            </div>
            {trendState.status === "error" ? (
              <div
                className="flex flex-col items-center justify-center gap-3"
                style={{ height: 220 }}
              >
                <p style={{ fontSize: "var(--type-label-size)", color: "var(--text-muted)" }}>
                  We couldn't load the activity trend.
                </p>
                <button className="sp-btn sp-btn-ghost" onClick={trendState.retry}>
                  Try again
                </button>
              </div>
            ) : (
              <div style={{ width: "100%", height: 220 }}>
                <ResponsiveContainer>
                  <AreaChart data={trend ?? []} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
                    <CartesianGrid
                      vertical={false}
                      stroke="var(--viz-grid)"
                      strokeDasharray="3 3"
                    />
                    <XAxis
                      dataKey="date"
                      tickFormatter={fmtDay}
                      tick={{
                        fontSize: 10,
                        fontFamily: "var(--font-mono)",
                        fill: "var(--text-muted)",
                      }}
                      tickLine={false}
                      axisLine={false}
                      minTickGap={28}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{
                        fontSize: 10,
                        fontFamily: "var(--font-mono)",
                        fill: "var(--text-muted)",
                      }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      cursor={{ stroke: "var(--border-strong)", strokeDasharray: "3 3" }}
                      labelFormatter={(v) => fmtDay(String(v))}
                      contentStyle={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "var(--type-caption-size)",
                        background: "var(--bg-surface)",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius-card)",
                        color: "var(--text-primary)",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="downloads"
                      name="Downloads"
                      stroke="var(--viz-series-1)"
                      strokeWidth={2}
                      fill="var(--viz-series-1)"
                      fillOpacity={0.14}
                      dot={false}
                      activeDot={{ r: 4, strokeWidth: 0 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="opens"
                      name="Opens"
                      stroke="var(--viz-series-2)"
                      strokeWidth={2}
                      fill="var(--viz-series-2)"
                      fillOpacity={0.14}
                      dot={false}
                      activeDot={{ r: 4, strokeWidth: 0 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="grid lg:grid-cols-5 gap-6 items-stretch">
            {/* Most-used leaderboard */}
            <div className="sp-card sp-card--content lg:col-span-2">
              <h2 className="sp-panel-title mb-4">Most used</h2>
              <div className="space-y-4">
                {top.map((r, i) => (
                  <div key={r.templateId}>
                    <div className="flex items-baseline justify-between gap-3 mb-1.5">
                      <span className="flex items-baseline gap-2 min-w-0">
                        <span style={{ ...mono, fontSize: 10, color: "var(--text-muted)" }}>
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span
                          className="truncate"
                          style={{
                            fontSize: "var(--type-label-size)",
                            fontWeight: 500,
                            color: "var(--text-primary)",
                          }}
                        >
                          {r.templateName}
                        </span>
                      </span>
                      <span
                        className="flex-shrink-0"
                        style={{ ...mono, fontSize: 11, color: "var(--text-muted)" }}
                      >
                        {r.downloads} · {r.opens}
                      </span>
                    </div>
                    {/* thin rounded data bars, 2px apart — downloads then opens */}
                    <div
                      aria-hidden
                      style={{
                        height: 6,
                        borderRadius: "var(--radius-pill)",
                        background: "var(--viz-series-1)",
                        width: `${Math.max(2, (r.downloads / maxCount) * 100)}%`,
                      }}
                    />
                    <div
                      aria-hidden
                      style={{
                        height: 6,
                        borderRadius: "var(--radius-pill)",
                        background: "var(--viz-series-2)",
                        width: `${Math.max(2, (r.opens / maxCount) * 100)}%`,
                        marginTop: 2,
                      }}
                    />
                  </div>
                ))}
              </div>
              {summary.rows.length > top.length && (
                <p className="mt-4" style={{ fontSize: 11, color: "var(--text-disabled)" }}>
                  +{summary.rows.length - top.length} more in the table
                </p>
              )}
              <div
                className="flex items-center gap-4 mt-5 pt-4"
                style={{ borderTop: "1px solid var(--border)" }}
              >
                <LegendChip
                  color="var(--viz-series-1)"
                  label="Downloads"
                  total={summary.totalDownloads}
                />
                <LegendChip color="var(--viz-series-2)" label="Opens" total={totalOpens} />
              </div>
            </div>

            {/* Full table */}
            <div className="sp-card overflow-hidden overflow-x-auto lg:col-span-3">
              <table
                className="w-full"
                style={{ fontSize: "var(--type-label-size)", minWidth: 520 }}
              >
                <thead>
                  <tr className="text-left" style={{ borderBottom: "1px solid var(--border)" }}>
                    {["Template", "Opens", "Downloads", "Export rate", "Last used"].map((h) => (
                      <th key={h} className="sp-eyebrow px-4 py-3" style={{ fontWeight: 400 }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {summary.rows.map((r) => (
                    <tr key={r.templateId} style={{ borderTop: "1px solid var(--border)" }}>
                      <td
                        className="px-4 py-3"
                        style={{ color: "var(--text-primary)", fontWeight: 500 }}
                      >
                        {r.templateName}
                      </td>
                      <td
                        className="px-4 py-3"
                        style={{
                          ...mono,
                          fontSize: "var(--type-caption-size)",
                          color: "var(--text-secondary)",
                        }}
                      >
                        {r.opens}
                      </td>
                      <td
                        className="px-4 py-3"
                        style={{
                          ...mono,
                          fontSize: "var(--type-caption-size)",
                          color: "var(--text-primary)",
                        }}
                      >
                        {r.downloads}
                      </td>
                      <td
                        className="px-4 py-3"
                        style={{
                          ...mono,
                          fontSize: "var(--type-caption-size)",
                          color: "var(--text-secondary)",
                        }}
                      >
                        {exportRate(r.downloads, r.opens)}
                      </td>
                      <td
                        className="px-4 py-3"
                        style={{
                          ...mono,
                          fontSize: "var(--type-caption-size)",
                          color: "var(--text-muted)",
                        }}
                      >
                        {relativeDay(r.lastUsedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </Page>
  );
}
