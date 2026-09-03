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
import { Download, Eye, Layers, Percent, Table2 } from "lucide-react";
import type { DailyActivityPoint, PublicLinkUsageRow, UsageSummary } from "@/lib/types";
import { stores } from "@/lib/stores";
import { useAsync } from "@/lib/useAsync";
import { useAuth } from "@/lib/auth/AuthContext";
import { Page, PageHeader } from "../layout/Page";
import { ErrorState } from "../ErrorState";
import { Kpi } from "./Kpi";
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

/** Numbers in a table are data: mono, caption size, secondary unless the
 * figure is the one being compared. */
const numCell = {
  fontFamily: "var(--font-mono)",
  fontSize: "var(--type-caption-size)",
  color: "var(--text-secondary)",
} as const;

const exportRate = (downloads: number, opens: number): string =>
  opens === 0 ? "—" : `${Math.round((downloads / opens) * 100)}%`;

/** Legend chip: colored swatch + label + mono total (identity never
 * color-alone). `dashed` draws a short dashed rule instead of a dot, so the
 * public-link overlay is decodable as the dashed line it actually is rather
 * than mistaken for a third filled band. */
function LegendChip({
  color,
  label,
  total,
  dashed,
}: {
  color: string;
  label: string;
  total: number;
  dashed?: boolean;
}) {
  return (
    <span
      className="flex items-center gap-1.5"
      style={{ fontSize: "var(--type-caption-size)", color: "var(--text-secondary)" }}
    >
      {dashed ? (
        <span
          aria-hidden
          style={{ width: 12, height: 0, borderTop: `2px dashed ${color}`, display: "block" }}
        />
      ) : (
        <span
          aria-hidden
          style={{ width: 8, height: 8, borderRadius: "var(--radius-pill)", background: color }}
        />
      )}
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
  const linkUsageState = useAsync<PublicLinkUsageRow[]>(
    () => (company ? stores.usage.getPublicLinkUsage(company.id) : Promise.resolve([])),
    [company],
  );
  // A failure here must not take the page down with it: the rest of Insights
  // is independent, and the card simply does not render.
  const linkRows = linkUsageState.status === "ready" ? linkUsageState.data : [];

  // Day buckets follow the WORKSPACE timezone (Settings → Workspace), not
  // the viewer's browser — two admins in different places read one chart.
  const trendState = useAsync<DailyActivityPoint[]>(
    () =>
      company
        ? stores.usage.getDailyActivity(company.id, TREND_DAYS, company.timezone)
        : Promise.resolve([]),
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
  // Public traffic is a SUBSET of the totals above, never added to them: one
  // fill through a link is one open and one export, the same as a member's.
  const publicOpens = summary.rows.reduce((n, r) => n + r.publicOpens, 0);
  const publicDownloads = summary.rows.reduce((n, r) => n + r.publicDownloads, 0);
  const totalShares = summary.rows.reduce((n, r) => n + r.shares, 0);
  // Bulk exports sit BESIDE downloads, never inside them: a bulk run has no
  // opens, so folding it in would break the export rate. The tile only
  // appears once a workspace has run one.
  const totalBulk = summary.rows.reduce((n, r) => n + r.bulkExports, 0);
  const viaLink = (n: number): string | undefined =>
    n === 0 ? undefined : `${n} via public link${n === 1 ? "" : "s"}`;
  const activeTemplates = summary.rows.filter(
    (r) => r.opens + r.downloads + r.bulkExports > 0,
  ).length;
  const trendOpens = (trend ?? []).reduce((n, p) => n + p.opens, 0);
  const trendDownloads = (trend ?? []).reduce((n, p) => n + p.downloads, 0);
  const trendPublicDownloads = (trend ?? []).reduce((n, p) => n + p.publicDownloads, 0);
  const top = summary.rows.slice(0, 8);
  const maxCount = Math.max(1, ...top.map((r) => Math.max(r.downloads, r.opens)));

  return (
    <Page>
      <PageHeader
        title="Insights"
        description="Which templates actually get used — by your team, and through public links."
      />

      {summary.rows.length === 0 ? (
        <div className="sp-card relative overflow-hidden text-center py-20 px-6">
          <span
            aria-hidden
            className="absolute"
            style={{ right: -40, bottom: -30, opacity: 0.07, color: "var(--text-primary)" }}
          >
            <BrandMark width={280} />
          </span>
          <p style={{ fontSize: 14, color: "var(--text-primary)" }}>No usage yet</p>
          <p
            style={{ fontSize: "var(--type-label-size)", color: "var(--text-muted)", marginTop: 6 }}
          >
            Opens and downloads appear here as soon as people start using published templates — your
            own team, and anyone filling one in through a public link.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* KPI row — same 24px gap as every other grid on the page */}
          <div
            className={`grid grid-cols-2 gap-6 ${totalBulk > 0 ? "lg:grid-cols-5" : "lg:grid-cols-4"}`}
          >
            <Kpi
              label="Total exports"
              value={summary.totalDownloads}
              Icon={Download}
              chip="var(--viz-series-1)"
              sub={viaLink(publicDownloads)}
            />
            {totalBulk > 0 && (
              <Kpi
                label="Bulk exports"
                value={totalBulk}
                Icon={Table2}
                chip="var(--bg-hover)"
                chipFg="var(--text-primary)"
                sub="Rendered by bulk fill, not counted in exports"
              />
            )}
            <Kpi
              label="Total opens"
              value={totalOpens}
              Icon={Eye}
              chip="var(--viz-series-2)"
              sub={viaLink(publicOpens)}
            />
            <Kpi
              label="Export rate"
              value={exportRate(summary.totalDownloads, totalOpens)}
              Icon={Percent}
              chip="var(--bg-hover)"
              chipFg="var(--text-primary)"
              sub={
                totalShares === 0
                  ? undefined
                  : `${totalShares} sent to LinkedIn${
                      summary.totalDownloads > 0
                        ? ` · ${Math.round((totalShares / summary.totalDownloads) * 100)}% of exports`
                        : ""
                    }`
              }
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
                {trendPublicDownloads > 0 && (
                  <LegendChip
                    color="var(--viz-series-3)"
                    label="of which via link"
                    total={trendPublicDownloads}
                    dashed
                  />
                )}
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
                    {/* Exports made through a public link. Deliberately
                        UNFILLED and dashed: this is a slice of the Downloads
                        area above it, not a third quantity stacked on top,
                        and a filled band would invite reading the chart as a
                        sum. Hidden entirely until a link has produced
                        something, so the common case keeps two series. */}
                    {trendPublicDownloads > 0 && (
                      <Area
                        type="monotone"
                        dataKey="publicDownloads"
                        name="of which via link"
                        stroke="var(--viz-series-3)"
                        strokeWidth={2}
                        strokeDasharray="4 3"
                        fill="none"
                        dot={false}
                        activeDot={{ r: 4, strokeWidth: 0 }}
                      />
                    )}
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
                <p className="mt-4" style={{ fontSize: 11, color: "var(--text-muted)" }}>
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
                {publicDownloads > 0 && (
                  <LegendChip
                    color="var(--viz-series-3)"
                    label="of which via link"
                    total={publicDownloads}
                    dashed
                  />
                )}
              </div>
            </div>

            {/* Full table */}
            <div className="sp-card overflow-hidden overflow-x-auto lg:col-span-3">
              <table
                className="w-full"
                style={{ fontSize: "var(--type-label-size)", minWidth: 800 }}
              >
                <thead>
                  <tr className="text-left" style={{ borderBottom: "1px solid var(--border)" }}>
                    {[
                      "Template",
                      "Opens",
                      "Downloads",
                      "Bulk",
                      "Posted",
                      "Via link",
                      "Export rate",
                      "Last used",
                    ].map((h) => (
                      <th key={h} className="sp-eyebrow px-4 py-3" style={{ fontWeight: 400 }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {summary.rows.map((r) => (
                    <tr key={r.templateId} style={{ borderTop: "1px solid var(--border)" }}>
                      <td className="px-4 py-3" style={{ color: "var(--text-primary)" }}>
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
                      {/* Rendered by bulk fill. Beside downloads, never added
                          to them; muted at zero like Posted. */}
                      <td
                        className="px-4 py-3"
                        style={{
                          ...numCell,
                          color: r.bulkExports > 0 ? "var(--text-primary)" : "var(--text-muted)",
                        }}
                      >
                        {r.bulkExports}
                      </td>
                      {/* Taken to LinkedIn. Muted at zero so the eye lands on
                          the templates that are actually being posted. */}
                      <td
                        className="px-4 py-3"
                        style={{
                          ...numCell,
                          color: r.shares > 0 ? "var(--text-primary)" : "var(--text-muted)",
                        }}
                      >
                        {r.shares}
                      </td>
                      {/* Exports through a public link. A dash rather than a
                          zero: nobody has shared this template publicly, which
                          is different from having shared it and got nothing. */}
                      <td
                        className="px-4 py-3"
                        title={
                          r.publicOpens + r.publicDownloads > 0
                            ? `${r.publicDownloads} export${r.publicDownloads === 1 ? "" : "s"} from ${r.publicOpens} open${r.publicOpens === 1 ? "" : "s"} through public links`
                            : undefined
                        }
                        style={{
                          ...mono,
                          fontSize: "var(--type-caption-size)",
                          color:
                            r.publicDownloads > 0 ? "var(--text-primary)" : "var(--text-muted)",
                        }}
                      >
                        {r.publicOpens + r.publicDownloads === 0 ? "—" : r.publicDownloads}
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

          {/* Per-link breakdown — only once a link exists. An admin running
              one link per template already has this answer from the table
              above; this card earns its place when there are several links
              to the same template and the question becomes which one is
              pulling. */}
          {linkRows.length > 0 && (
            <div className="sp-card overflow-hidden">
              <div className="px-4 pt-4 pb-3">
                <h2 className="sp-panel-title">Public links</h2>
                <p
                  style={{
                    fontSize: "var(--type-caption-size)",
                    color: "var(--text-muted)",
                    marginTop: 2,
                  }}
                >
                  Every link you've created, busiest first. A link with no opens has been created
                  but not yet used. "Posted" counts people who opened LinkedIn with their caption —
                  LinkedIn doesn't tell us whether they hit publish.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table
                  className="w-full"
                  style={{ fontSize: "var(--type-label-size)", minWidth: 720 }}
                >
                  <thead>
                    <tr className="text-left" style={{ borderBottom: "1px solid var(--border)" }}>
                      {[
                        "Link",
                        "Template",
                        "Opens",
                        "Exports",
                        "Posted",
                        "Export rate",
                        "Last used",
                      ].map((h) => (
                        <th key={h} className="sp-eyebrow px-4 py-3" style={{ fontWeight: 400 }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {linkRows.map((r) => (
                      <tr key={r.linkId} style={{ borderTop: "1px solid var(--border)" }}>
                        <td className="px-4 py-3">
                          <span
                            className="block"
                            style={{
                              color: r.revokedAt ? "var(--text-muted)" : "var(--text-primary)",
                            }}
                          >
                            {r.linkName || "Untitled link"}
                          </span>
                          {/* Revoked links keep their history and say why it
                              stopped, rather than vanishing and taking the
                              numbers with them. */}
                          {r.revokedAt && (
                            <span className="sp-eyebrow" style={{ color: "var(--text-muted)" }}>
                              Revoked {relativeDay(r.revokedAt)}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>
                          {r.templateName}
                        </td>
                        <td className="px-4 py-3" style={{ ...numCell }}>
                          {r.opens}
                        </td>
                        <td
                          className="px-4 py-3"
                          style={{ ...numCell, color: "var(--text-primary)" }}
                        >
                          {r.downloads}
                        </td>
                        <td
                          className="px-4 py-3"
                          style={{
                            ...numCell,
                            color: r.shares > 0 ? "var(--text-primary)" : "var(--text-muted)",
                          }}
                        >
                          {r.shares}
                        </td>
                        <td className="px-4 py-3" style={{ ...numCell }}>
                          {exportRate(r.downloads, r.opens)}
                        </td>
                        <td
                          className="px-4 py-3"
                          style={{ ...numCell, color: "var(--text-muted)" }}
                        >
                          {r.lastUsedAt ? relativeDay(r.lastUsedAt) : "Never"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </Page>
  );
}
