import React, { useEffect, useMemo, useState } from "react";
import { ChartColumn } from "lucide-react";
import type { InsightEvent, PublicLinkUsageRow, TemplateSchema } from "@/lib/types";
import type { Member } from "@/lib/stores/interfaces";
import { stores } from "@/lib/stores";
import { useAsync } from "@/lib/useAsync";
import { useAuth } from "@/lib/auth/AuthContext";
import {
  buildInsights,
  hasFilters,
  insightWindowStartIso,
  INSIGHTS_RANGES,
  platformsInUse,
  PUBLIC_MEMBER,
  RANGE_LABEL,
  type InsightsFilters,
  type InsightsMetric,
  type InsightsRange,
} from "@/lib/insights/buildInsights";
import { digestHeading, digestSentence, windowDates } from "@/lib/insights/digest";
import { PLATFORMS, type PlatformId } from "@/lib/templates/platforms";
import { routeToUrl, useRouter, type Route } from "../../router";
import { Page, PageHeader } from "../layout/Page";
import { ErrorState } from "../ErrorState";
import { Button } from "../primitives";
import { useLinkClick } from "./brand/useLinkClick";
import { changeCopy, InsightKpi } from "./insights/InsightKpi";
import { TrendCard } from "./insights/TrendCard";
import { TopTemplatesCard } from "./insights/TopTemplatesCard";
import { PublicLinksCard } from "./insights/PublicLinksCard";
import { FilterMenu, type FilterOption } from "./insights/FilterMenu";
import { downloadInsightsCsv } from "./insights/exportCsv";

const RANGE_OPTION: Record<InsightsRange, string> = {
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  "12m": "Last 12 months",
};

const METRIC_NAME: Record<InsightsMetric, string> = {
  exports: "Exports",
  opens: "Opens",
  posted: "Posts to LinkedIn",
};

type DashboardRoute = Extract<Route, { name: "dashboard" }>;

/** Insights & Analytics (Figma 13:832; PHASE-8.md): the filters, the
 * digest, the four headline numbers, the trend beside Top templates, and
 * Public links. The range and the filters live in the URL; every number
 * compares with the previous window of the same length. Events are
 * recorded in SchemaRenderer and the public link functions; this page
 * only reads. */
export function Dashboard(route: Omit<DashboardRoute, "name">) {
  const { company } = useAuth();
  const { navigate } = useRouter();
  const linkTo = useLinkClick();
  const activeRange = route.range ?? "30d";
  const activeMetric = route.metric ?? "exports";

  // Four independent loads (one failed card never blanks the page). The
  // events cover the previous window too, so the comparisons come from the
  // same read.
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
  const linkUsageState = useAsync<PublicLinkUsageRow[]>(
    () => (company ? stores.usage.getPublicLinkUsage(company.id) : Promise.resolve([])),
    [company],
  );

  // A range change keeps the current numbers visible (dimmed) until the new
  // window lands: the page never blanks after its first load. The events
  // are kept with the range that fetched them, so a stale render stays
  // consistent.
  const [loaded, setLoaded] = useState<{ events: InsightEvent[]; range: InsightsRange } | null>(
    null,
  );
  useEffect(() => {
    if (eventsState.status === "ready" && eventsState.data) {
      setLoaded({ events: eventsState.data, range: activeRange });
    }
  }, [eventsState, activeRange]);
  const refreshing = eventsState.status === "loading" && loaded !== null;

  const templates = useMemo(
    () => (templatesState.status === "ready" ? templatesState.data : []),
    [templatesState],
  );
  const members = useMemo(
    () => (peopleState.status === "ready" ? peopleState.data : []),
    [peopleState],
  );

  // An id the workspace doesn't have reads as "all" (the route keeps it
  // until the next choice).
  const filters: InsightsFilters = {
    templateId: templates.some((t) => t.id === route.template) ? route.template : null,
    member:
      route.member === PUBLIC_MEMBER || members.some((m) => m.userId === route.member)
        ? route.member
        : null,
    platform: route.platform ?? null,
  };

  const insights = useMemo(
    () =>
      loaded && company
        ? buildInsights({
            events: loaded.events,
            templates,
            range: loaded.range,
            timeZone: company.timezone,
            filters,
          })
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loaded, templates, company, filters.templateId, filters.member, filters.platform],
  );

  const go = (patch: Partial<Omit<DashboardRoute, "name">>) =>
    // A filter is a view of the page, not a place: changes replace the
    // history entry, so Back leaves Insights. Defaults stay off the URL.
    navigate(
      {
        name: "dashboard",
        range: route.range,
        metric: route.metric,
        template: route.template,
        member: route.member,
        platform: route.platform,
        ...patch,
      },
      { replace: true },
    );

  const templateOptions: FilterOption[] = [
    { value: null, label: "All templates" },
    ...[...templates]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((t) => ({ value: t.id, label: t.name })),
  ];
  const memberOptions: FilterOption[] = [
    { value: null, label: "All members" },
    ...[...members]
      .sort((a, b) => (a.name ?? a.email).localeCompare(b.name ?? b.email))
      .map((m) => ({ value: m.userId, label: m.name ?? m.email })),
    { value: PUBLIC_MEMBER, label: "Public links" },
  ];
  const platformOptions: FilterOption[] = [
    { value: null, label: "All platforms" },
    ...platformsInUse(templates).map((id) => ({
      value: id,
      label: PLATFORMS.find((p) => p.id === id)?.label ?? id,
    })),
  ];
  const labelOf = (options: FilterOption[], value: string | null | undefined) =>
    options.find((o) => o.value === value)?.label;

  const filterRow = (
    <div className="sp-in-filters">
      <FilterMenu
        name="Date range"
        value={activeRange}
        options={INSIGHTS_RANGES.map((r) => ({ value: r, label: RANGE_OPTION[r] }))}
        onChange={(v) => go({ range: v === "30d" || !v ? undefined : (v as InsightsRange) })}
      />
      <FilterMenu
        name="Template"
        value={filters.templateId ?? null}
        options={templateOptions}
        onChange={(v) => go({ template: v ?? undefined })}
      />
      <FilterMenu
        name="Member"
        value={filters.member ?? null}
        options={memberOptions}
        onChange={(v) => go({ member: v ?? undefined })}
      />
      <FilterMenu
        name="Platform"
        value={filters.platform ?? null}
        options={platformOptions}
        onChange={(v) => go({ platform: (v as PlatformId | null) ?? undefined })}
      />
    </div>
  );

  const exportCsv = (
    <Button
      kind="neutralOnPage"
      disabled={!insights}
      onClick={() => {
        if (!insights || !loaded || !company) return;
        const active = [
          labelOf(templateOptions, filters.templateId),
          filters.member ? labelOf(memberOptions, filters.member) : undefined,
          filters.platform ? labelOf(platformOptions, filters.platform) : undefined,
        ].filter((x): x is string => !!x && !x.startsWith("All "));
        downloadInsightsCsv(insights.templateRows, loaded.range, company.timezone, active);
      }}
    >
      Export CSV
    </Button>
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

  if (!loaded) return <InsightsSkeleton />;

  // Nothing recorded at all in the fetched span: the whole-page empty state
  // (D12), unless a filter is narrowing it (then the cards read zero).
  if (loaded.events.length === 0 && !refreshing && !hasFilters(filters)) {
    return (
      <Page layout={{ className: "sp-in-page" }}>
        <PageHeader title="Insights & Analytics" />
        <section className="sp-in-card sp-in-empty" aria-labelledby="sp-in-empty-title">
          <h2 id="sp-in-empty-title" className="t-title-panel">
            No usage yet
          </h2>
          <a
            className="ui-reset ui-tint ui-ring ui-btn"
            data-kind="primary"
            data-size="default"
            href={routeToUrl({ name: "portal" })}
            onClick={linkTo({ name: "portal" })}
          >
            <span className="t-button-m">Open Brand Templates</span>
          </a>
        </section>
      </Page>
    );
  }

  const rangeLabel = RANGE_LABEL[loaded.range];
  const filtered = hasFilters(filters);
  const scopedTemplateIds = new Set(insights?.templateRows.map((r) => r.templateId));
  const activeLinks =
    linkUsageState.status === "ready"
      ? linkUsageState.data.filter(
          (l) => !l.revokedAt && (!filtered || scopedTemplateIds.has(l.templateId)),
        )
      : [];

  return (
    <Page layout={{ className: "sp-in-page" }}>
      <PageHeader title="Insights & Analytics" actions={exportCsv} />
      {filterRow}
      {insights && (
        <div className="sp-in-content" aria-busy={refreshing || undefined}>
          <section className="sp-in-card sp-in-digest" aria-labelledby="sp-in-digest-title">
            <div className="sp-in-digest__head">
              <span className="sp-in-digest__tile" aria-hidden>
                <ChartColumn size={24} className="ui-icon" />
              </span>
              <span className="sp-in-digest__titles">
                <h2 id="sp-in-digest-title" className="t-title-panel">
                  {digestHeading(loaded.range)}
                </h2>
                <span className="t-caption-m sp-in-muted">
                  {windowDates(insights.window, loaded.range)}
                </span>
              </span>
            </div>
            <p className="sp-in-digest__sentence">
              {digestSentence(
                insights,
                loaded.range,
                filters,
                filters.member ? labelOf(memberOptions, filters.member) : undefined,
              )}
            </p>
          </section>

          <div className="sp-in-kpis">
            <InsightKpi
              label="Exports"
              value={insights.kpis.exports.current}
              change={insights.kpis.exports.change}
              family="green"
              rangeLabel={rangeLabel}
            />
            <InsightKpi
              label="Opens"
              value={insights.kpis.opens.current}
              change={insights.kpis.opens.change}
              family="blue"
              rangeLabel={rangeLabel}
            />
            <InsightKpi
              label="Posted to LinkedIn"
              value={insights.kpis.posted.current}
              change={insights.kpis.posted.change}
              family="purple"
              rangeLabel={rangeLabel}
            />
            <InsightKpi
              label="Active members"
              value={insights.kpis.activeMembers.current}
              change={insights.kpis.activeMembers.change}
              family="pink"
              rangeLabel={rangeLabel}
            />
          </div>

          <div className="sp-in-row">
            <TrendCard
              metric={activeMetric}
              onMetricChange={(m) => go({ metric: m === "exports" ? undefined : m })}
              series={insights.series[activeMetric]}
              range={loaded.range}
              rangeNote={`${loaded.range === "12m" ? "Monthly" : "Daily"}, ${windowDates(insights.window, loaded.range)}`}
              summary={`${METRIC_NAME[activeMetric]} over the last ${rangeLabel}: ${insights.kpis[activeMetric].current.toLocaleString("en-US")}, ${changeCopy(insights.kpis[activeMetric].change).toLowerCase()}`}
            />
            <TopTemplatesCard
              templates={insights.topTemplates}
              error={
                templatesState.status === "error" ? { retry: templatesState.retry } : undefined
              }
            />
          </div>

          {activeLinks.length > 0 && (
            <PublicLinksCard links={activeLinks} counts={insights.linkCounts} />
          )}
        </div>
      )}
    </Page>
  );
}

/** The first load: each part's shape, so nothing jumps when data lands. */
function InsightsSkeleton() {
  const bone = (w: number | string, h: number) => (
    <span className="sp-st-bone" style={{ width: w, height: h }} />
  );
  return (
    <Page layout={{ className: "sp-in-page" }}>
      <PageHeader title="Insights & Analytics" />
      <div className="sp-in-content" aria-busy="true" aria-label="Loading Insights">
        <div className="sp-in-card sp-in-digest">
          {bone(220, 20)}
          {bone("70%", 26)}
        </div>
        <div className="sp-in-kpis">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="sp-in-card sp-in-kpi">
              {bone(96, 14)}
              {bone(88, 40)}
              {bone(140, 18)}
            </div>
          ))}
        </div>
        <div className="sp-in-row">
          <div className="sp-in-card sp-in-trend">{bone("100%", 230)}</div>
          <div className="sp-in-card sp-in-top">{bone("100%", 230)}</div>
        </div>
      </div>
    </Page>
  );
}
