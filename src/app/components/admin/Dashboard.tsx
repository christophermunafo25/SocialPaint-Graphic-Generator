import React, { useEffect, useMemo, useState } from "react";
import type { InsightEvent, PublicLinkUsageRow, TemplateSchema } from "@/lib/types";
import type { Member } from "@/lib/stores/interfaces";
import { stores } from "@/lib/stores";
import { useAsync } from "@/lib/useAsync";
import { useAuth } from "@/lib/auth/AuthContext";
import {
  buildInsights,
  insightWindowStartIso,
  INSIGHTS_RANGES,
  RANGE_LABEL,
  type InsightsMetric,
  type InsightsRange,
} from "@/lib/insights/buildInsights";
import { routeToUrl, useRouter } from "../../router";
import { Page, PageHeader } from "../layout/Page";
import { ErrorState } from "../ErrorState";
import { Bone, SkeletonLines } from "../Skeleton";
import { useLinkClick } from "./brand/useLinkClick";
import { BrandMark } from "../Sidebar";
import { changeCopy, InsightKpi } from "./insights/InsightKpi";
import { TrendCard } from "./insights/TrendCard";
import { TopTemplatesCard } from "./insights/TopTemplatesCard";
import { WeekdayCard } from "./insights/WeekdayCard";
import { SizeCard } from "./insights/SizeCard";
import { FindingsCard, type PageFinding } from "./insights/FindingsCard";
import { downloadInsightsCsv } from "./insights/exportCsv";

/** The one-screen Insights page (2026-09-15, Figma "UX-UI Designs" 106:2):
 * KPI row, trend beside Top templates, weekday beside sizes, findings.
 * One date range drives every card (D2); every comparison is against the
 * previous window of the same length (D3). Events are recorded inside
 * SchemaRenderer; this page only reads. */
export function Dashboard({ range, metric }: { range?: InsightsRange; metric?: InsightsMetric }) {
  const { company } = useAuth();
  const { navigate } = useRouter();
  const linkTo = useLinkClick();
  const activeRange = range ?? "30d";
  const activeMetric = metric ?? "exports";

  // Three independent loads (one failed card never blanks the page). The
  // events fetch covers the previous window too, so the comparisons and the
  // dashed line come from the same read.
  const eventsState = useAsync<InsightEvent[] | null>(
    () =>
      company
        ? stores.usage.getInsightEvents(
            company.id,
            insightWindowStartIso(activeRange, company.timezone),
          )
        : Promise.resolve(null),
    [company, activeRange],
  );
  const templatesState = useAsync<TemplateSchema[]>(
    () => (company ? stores.templates.listAll(company.id) : Promise.resolve([])),
    [company],
  );
  const peopleState = useAsync<Member[]>(
    () => (company ? stores.people.list(company.id) : Promise.resolve([])),
    [company],
  );
  // Feeds only the unopened-public-link finding; a failure just leaves
  // that finding out, the way the old page dropped its links card.
  const linkUsageState = useAsync<PublicLinkUsageRow[]>(
    () => (company ? stores.usage.getPublicLinkUsage(company.id) : Promise.resolve([])),
    [company],
  );

  // A range change keeps the CURRENT numbers visible (dimmed, under the
  // 2px bar) until the new window lands — the page never blanks after its
  // first load. The events are kept WITH the range that fetched them so
  // the stale render stays internally consistent.
  const [loaded, setLoaded] = useState<{ events: InsightEvent[]; range: InsightsRange } | null>(
    null,
  );
  useEffect(() => {
    if (eventsState.status === "ready" && eventsState.data) {
      setLoaded({ events: eventsState.data, range: activeRange });
    }
  }, [eventsState, activeRange]);
  const refreshing = eventsState.status === "loading" && loaded !== null;

  // Aggregation degrades per input: a failed templates or people load
  // zeroes only what needs it, and the cards that need the missing input
  // show their own inline retry row instead of these partial numbers.
  const templates = useMemo(
    () => (templatesState.status === "ready" ? templatesState.data : []),
    [templatesState],
  );
  const members = useMemo(
    () => (peopleState.status === "ready" ? peopleState.data : []),
    [peopleState],
  );
  const insights = useMemo(
    () =>
      loaded && company
        ? buildInsights({
            events: loaded.events,
            templates,
            members,
            range: loaded.range,
            timeZone: company.timezone,
          })
        : null,
    [loaded, templates, members, company],
  );
  // Findings, in the aggregator's priority order (rules 1–4), keeping the
  // first four that apply; the unopened-link rule joins only when a slot
  // is free (Phase 8 rule 5).
  const findings = useMemo<PageFinding[]>(() => {
    const list: PageFinding[] = insights ? [...insights.findings] : [];
    if (list.length < 4 && linkUsageState.status === "ready") {
      const unopened = linkUsageState.data.filter((l) => l.opens === 0 && !l.revokedAt).length;
      if (unopened > 0) list.push({ kind: "unopenedLinks", count: unopened });
    }
    return list.slice(0, 4);
  }, [insights, linkUsageState]);

  // Both header controls, --space-xs apart: the range radiogroup (a
  // navigation — changing it REPLACES the history entry, so Back leaves
  // Insights rather than replaying ranges) and Export CSV.
  const headerAction = (
    <div className="flex items-center flex-wrap" style={{ gap: "var(--space-xs)" }}>
      <div className="sp-segmented" role="radiogroup" aria-label="Date range">
        {INSIGHTS_RANGES.map((r) => (
          <button
            key={r}
            type="button"
            role="radio"
            aria-checked={activeRange === r}
            className="sp-segmented__option"
            onClick={() =>
              navigate(
                // The default stays out of the URL, like brandStudio's
                // surface param.
                { name: "dashboard", range: r === "30d" ? undefined : r, metric },
                { replace: true },
              )
            }
          >
            {RANGE_LABEL[r]}
          </button>
        ))}
      </div>
      <button
        className="sp-btn sp-btn-ghost"
        disabled={!insights}
        onClick={() => {
          if (insights && loaded && company) {
            downloadInsightsCsv(insights.templateRows, loaded.range, company.timezone);
          }
        }}
      >
        Export CSV
      </button>
    </div>
  );

  if (eventsState.status === "error") {
    return (
      <ErrorState
        title="We couldn't load your usage data."
        detail="Check your connection and try again."
        onRetry={eventsState.retry}
      />
    );
  }

  if (!loaded) {
    // First load: each card's skeleton has the geometry of the card that
    // is coming, so nothing jumps when the data lands.
    return (
      <Page>
        <PageHeader title="Insights & Analytics" />
        <div className="flex flex-col" style={{ gap: "var(--space-xs)" }}>
          <div className="sp-insights-kpis">
            {[0, 1, 2, 3].map((i) => (
              <SkeletonInsightKpi key={i} />
            ))}
          </div>
          <div className="sp-insights-row">
            <div
              className="sp-card sp-card--content"
              aria-busy="true"
              aria-label="Loading activity trend"
            >
              <Bone w="40%" h={16} />
              <Bone w="100%" h={180} r="var(--radius-media-inner)" style={{ marginTop: 16 }} />
            </div>
            <div
              className="sp-card sp-card--content"
              aria-busy="true"
              aria-label="Loading top templates"
            >
              <SkeletonLines lines={5} label="Loading top templates" />
            </div>
          </div>
          <div className="sp-insights-row sp-insights-row--halves">
            <div
              className="sp-card sp-card--content"
              aria-busy="true"
              aria-label="Loading weekday activity"
            >
              <Bone w="50%" h={16} />
              <Bone w="100%" h={148} r="var(--radius-media-inner)" style={{ marginTop: 16 }} />
            </div>
            <div
              className="sp-card sp-card--content"
              aria-busy="true"
              aria-label="Loading exports by size"
            >
              <Bone w="50%" h={16} />
              <Bone w={148} h={148} r="var(--radius-pill)" style={{ marginTop: 16 }} />
            </div>
          </div>
          <div className="sp-card sp-card--content" aria-busy="true" aria-label="Loading findings">
            <SkeletonLines lines={2} label="Loading findings" />
          </div>
        </div>
      </Page>
    );
  }

  // The fetched span covers both windows — empty means the workspace has
  // nothing to show for this range at all, and zero-filled KPI cards would
  // read as activity that measured zero rather than none recorded.
  if (loaded.events.length === 0 && !refreshing) {
    return (
      <Page>
        <PageHeader title="Insights & Analytics" />
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
            style={{
              fontSize: "var(--type-label-size)",
              color: "var(--text-muted)",
              marginTop: 6,
            }}
          >
            Opens and downloads appear here as soon as people start using published templates: your
            own team, and anyone filling one in through a public link.
          </p>
          <a
            className="sp-btn sp-btn-primary"
            style={{ marginTop: "var(--space-sm)" }}
            href={routeToUrl({ name: "portal" })}
            onClick={linkTo({ name: "portal" })}
          >
            Open Brand Templates
          </a>
        </div>
      </Page>
    );
  }

  const rangeLabel = RANGE_LABEL[loaded.range];

  return (
    <Page>
      <PageHeader title="Insights & Analytics" action={headerAction} />
      <div className="relative">
        {/* Overlaid, not in-flow: the bar appearing must not shift the
            rows it is updating. */}
        <div
          className="sp-refresh-bar absolute"
          style={{
            insetInline: 0,
            top: -8,
            visibility: refreshing ? "visible" : "hidden",
          }}
          role="progressbar"
          aria-label="Loading the new date range"
          aria-hidden={!refreshing}
        />
        <div
          className="flex flex-col"
          style={{ gap: "var(--space-xs)", ...(refreshing ? { opacity: 0.56 } : {}) }}
          aria-busy={refreshing || undefined}
        >
          {insights && (
            <div className="sp-insights-kpis">
              <InsightKpi
                label="Exports"
                value={insights.kpis.exports.current}
                accent="var(--viz-series-1)"
                change={insights.kpis.exports.change}
                series={insights.series.exports}
                rangeLabel={rangeLabel}
              />
              <InsightKpi
                label="Opens"
                value={insights.kpis.opens.current}
                accent="var(--viz-series-2)"
                change={insights.kpis.opens.change}
                series={insights.series.opens}
                rangeLabel={rangeLabel}
              />
              <InsightKpi
                label="Posted to LinkedIn"
                value={insights.kpis.posted.current}
                accent="var(--viz-series-5)"
                change={insights.kpis.posted.change}
                series={insights.series.posted}
                rangeLabel={rangeLabel}
              />
              <InsightKpi
                label="Active members"
                value={insights.kpis.activeMembers.current}
                accent="var(--viz-series-4)"
                change={insights.kpis.activeMembers.change}
                series={insights.series.members}
                rangeLabel={rangeLabel}
              />
            </div>
          )}
          {insights && (
            <div className="sp-insights-row">
              <TrendCard
                metric={activeMetric}
                onMetricChange={(m) =>
                  navigate(
                    { name: "dashboard", range, metric: m === "exports" ? undefined : m },
                    { replace: true },
                  )
                }
                series={insights.series[activeMetric]}
                range={loaded.range}
                rangeLabel={rangeLabel}
                summary={`${activeMetric === "posted" ? "Posts to LinkedIn" : activeMetric === "opens" ? "Opens" : "Exports"} over the last ${rangeLabel}: ${insights.kpis[activeMetric].current.toLocaleString()}, ${changeCopy(insights.kpis[activeMetric].change).toLowerCase()}`}
              />
              <TopTemplatesCard
                templates={insights.topTemplates}
                error={
                  templatesState.status === "error" ? { retry: templatesState.retry } : undefined
                }
              />
            </div>
          )}
          {insights && (
            <div className="sp-insights-row sp-insights-row--halves">
              <WeekdayCard weekday={insights.weekday} />
              <SizeCard
                sizes={insights.sizes}
                error={
                  templatesState.status === "error" ? { retry: templatesState.retry } : undefined
                }
              />
            </div>
          )}
          {insights && (
            <FindingsCard
              findings={findings}
              rangeLabel={rangeLabel}
              range={range}
              error={
                templatesState.status === "error"
                  ? { retry: templatesState.retry }
                  : peopleState.status === "error"
                    ? { retry: peopleState.retry }
                    : undefined
              }
            />
          )}
        </div>
      </div>
    </Page>
  );
}

/** The InsightKpi card's shape: label line, headline value, sparkline. */
function SkeletonInsightKpi() {
  return (
    <div
      className="sp-card sp-card--content"
      aria-busy="true"
      aria-label="Loading key number"
      style={{ paddingBlock: "var(--space-md)" }}
    >
      <Bone w={96} h={10} />
      <div className="flex items-end justify-between gap-3" style={{ marginTop: 14 }}>
        <Bone w={72} h={30} />
        <div className="flex flex-col items-end" style={{ gap: 6 }}>
          <Bone w={72} h={22} />
          <Bone w={48} h={9} />
        </div>
      </div>
    </div>
  );
}
