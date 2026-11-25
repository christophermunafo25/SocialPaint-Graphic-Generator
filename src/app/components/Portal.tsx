import React, { useMemo } from "react";
import { stores } from "@/lib/stores";
import { useAsync } from "@/lib/useAsync";
import { useAuth } from "@/lib/auth/AuthContext";
import { toCatalogTemplate, type CatalogTemplate } from "@/lib/templates/catalog";
import {
  buildGroups,
  buildPlatformFacets,
  buildShelves,
  servesPlatform,
  type PlatformFacet,
  type TemplateGroup,
} from "@/lib/templates/groups";
import { PLATFORMS, type PlatformId } from "@/lib/templates/platforms";
import { buildSearchIndex, searchTemplates } from "@/lib/templates/searchIndex";
import { useRouter } from "../router";
import { Page } from "./layout/Page";
import { ErrorState } from "./ErrorState";
import { Button, PageHeader } from "./primitives";
import { LibrarySearch } from "./templates/LibrarySearch";
import { PlatformFilter } from "./templates/PlatformFilter";
import { PlatformShelf } from "./templates/PlatformShelf";
import { TemplateCard } from "./templates/TemplateCard";
import { LibraryShelfSkeleton } from "./templates/TemplateSkeleton";
import { AREA_ICON } from "./areas";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** Member-facing template library. Three views on one surface, all driven by
 * the URL: browse (a rail per section), filtered (one chip's grid), and
 * search (matches across every section).
 *
 * Two grains of grouping, on purpose. The FILTER CHIPS are one PLATFORM at
 * every shape ("Instagram") with inclusive membership, so a member filters by
 * just the platform they're posting to. The SECTIONS group down to the shape:
 * while browsing, one platform SET at one shape ("Instagram · Facebook ·
 * LinkedIn Portrait") so every template appears exactly once; under a chip,
 * one shape per section of the chosen platform. Grouping to the shape is what
 * lets every frame in a rail or grid share one ratio — nothing is letterboxed
 * to a common square, and rows sit even. Platform, shape and ratio all derive
 * from a template's canvas; see lib/templates/platforms.ts. */
export function Portal() {
  const { company } = useAuth();
  const { route, navigate } = useRouter();

  const templatesState = useAsync(
    () => (company ? stores.templates.listPublished(company.id) : Promise.resolve([])),
    [company],
  );
  const templates = useMemo(
    () => (templatesState.status === "ready" ? templatesState.data : []),
    [templatesState],
  );

  // ── URL is the source of truth ──────────────────────────────────────────
  const query = (route.name === "portal" && route.q) || "";
  const rawPlatform = route.name === "portal" ? route.platform : undefined;

  const setState = (next: { platform?: PlatformId | null; q?: string }, replace = false) =>
    navigate(
      {
        name: "portal",
        platform: (next.platform !== undefined ? next.platform : rawPlatform) ?? undefined,
        q: (next.q !== undefined ? next.q : query) || undefined,
      },
      { replace },
    );

  // ── Derive the catalogue ────────────────────────────────────────────────
  const catalog = useMemo<CatalogTemplate[]>(() => templates.map(toCatalogTemplate), [templates]);
  const index = useMemo(() => buildSearchIndex(catalog), [catalog]);
  /** The chip vocabulary: one platform, every shape, inclusive membership. */
  const allFacets = useMemo(() => buildPlatformFacets(catalog), [catalog]);
  /** The browse sections: one platform SET at one shape — every template
   *  exactly once, labelled with all the platforms it serves. */
  const allShelves = useMemo(() => buildShelves(catalog), [catalog]);

  /** Query applies first; the chip then narrows within it. */
  const searched = useMemo(
    () => (query ? searchTemplates(index, query) : catalog),
    [index, catalog, query],
  );

  /** Chips are faceted off the query, so every count on the page describes
   *  what's actually in front of the member. */
  const searchedFacets = useMemo(() => buildPlatformFacets(searched), [searched]);

  /** Resolved against the whole catalogue, not the search results: a chip
   *  the member picked stays picked even when the query excludes everything
   *  in it. That combination is a real empty state, not a reason to quietly
   *  widen the filter. A platform the catalogue never serves is no filter. */
  const platform = allFacets.find((f) => f.platform.id === rawPlatform)?.platform ?? null;

  // Membership is inclusive: a multi-platform template answers every one of
  // its platforms' chips.
  const results = useMemo(
    () => (platform ? searched.filter((t) => servesPlatform(t, platform.id)) : searched),
    [platform, searched],
  );

  /** The chip stays on the bar at zero rather than disappearing under the
   *  member's cursor — in its usual place, so the row never reorders. */
  const chipFacets = useMemo<PlatformFacet[]>(() => {
    if (!platform || searchedFacets.some((f) => f.platform.id === platform.id)) {
      return searchedFacets;
    }
    const rank = (id: PlatformId) => PLATFORMS.findIndex((p) => p.id === id);
    return [...searchedFacets, { platform, count: 0 }].sort(
      (a, b) => rank(a.platform.id) - rank(b.platform.id),
    );
  }, [searchedFacets, platform]);

  /** The grid renders a section per group so each one keeps its own frame
   *  ratio — a mixed search result never forces stories and banners into a
   *  single shared shape. Under a chip, that is the chosen platform's shelves,
   *  one per shape; un-chipped results use the SHELF grouping, so a
   *  multi-platform template appears once, not once per platform. */
  const resultGroups = useMemo(
    () =>
      platform
        ? buildGroups(results).filter((g) => g.platform.id === platform.id)
        : buildShelves(results),
    [platform, results],
  );

  const browsing = !query && !platform;

  /** A card opens the fill page (TemplateUsePage), which is form only: the
   *  template filled in by hand, then downloaded (new brand decision 9). */
  const openTemplate = (t: CatalogTemplate) => navigate({ name: "template", templateId: t.id });

  const announcement = browsing
    ? ""
    : query
      ? `${plural(results.length, "result")} for “${query}”${platform ? ` · ${platform.label}` : ""}`
      : `${plural(results.length, "template")}${platform ? ` · ${platform.label}` : ""}`;

  if (templatesState.status === "error") {
    return (
      <Page bleed header={<PageHeader icon={AREA_ICON.brandTemplates} title="Brand Templates" />}>
        <ErrorState
          title="We couldn't load your templates."
          detail="Check your connection and try again."
          onRetry={templatesState.retry}
        />
      </Page>
    );
  }

  return (
    <Page bleed header={<PageHeader icon={AREA_ICON.brandTemplates} title="Brand Templates" />}>
      <div className="sp-lib-filterbar">
        <LibrarySearch value={query} onChange={(q) => setState({ q }, true)} />
        {catalog.length > 0 && (
          <PlatformFilter
            allLabel="All templates"
            facets={chipFacets}
            selected={platform?.id ?? null}
            onSelect={(next) => setState({ platform: next })}
          />
        )}
      </div>

      <p className="sp-live" role="status" aria-live="polite">
        {announcement}
      </p>

      <div
        className="sp-lib-body"
        data-state={browsing ? "shelves" : query ? "search" : "platform"}
      >
        {templatesState.status === "loading" ? (
          <>
            <LibraryShelfSkeleton />
            <LibraryShelfSkeleton />
          </>
        ) : catalog.length === 0 ? (
          <div className="sp-lib-empty">
            <p className="t-title-card">Publish your first template</p>
            <p className="t-body-m sp-lib-empty__body">
              Published templates appear here for everyone on your team.
            </p>
          </div>
        ) : browsing ? (
          allShelves.map((g) => (
            <PlatformShelf
              key={g.id}
              group={g}
              onOpen={openTemplate}
              // A shelf isn't a filter target itself: "View all" selects its
              // PRIMARY platform's chip, which holds everything this shelf
              // holds (chip membership is inclusive) at every shape.
              onViewAll={() => setState({ platform: g.platform.id })}
            />
          ))
        ) : (
          <>
            <div className="sp-lib-resultline">
              <p className="t-mono-eyebrow sp-lib-eyebrow">{announcement}</p>
              <Button kind="neutral" size="sm" onClick={() => setState({ platform: null, q: "" })}>
                Clear
              </Button>
            </div>

            {results.length === 0 ? (
              <div className="sp-lib-empty">
                <p className="t-title-card">
                  {query ? `No templates match “${query}”.` : "That set is empty."}
                </p>
                <div className="sp-lib-empty__actions">
                  {query && (
                    <Button kind="primary" onClick={() => setState({ q: "" })}>
                      Clear search
                    </Button>
                  )}
                  {query && platform && (
                    <Button kind="neutral" onClick={() => setState({ platform: null })}>
                      Search all platforms
                    </Button>
                  )}
                  {!query && (
                    <Button kind="primary" onClick={() => setState({ platform: null })}>
                      Back to all templates
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              resultGroups.map((g) => <ResultGroup key={g.id} group={g} onOpen={openTemplate} />)
            )}
          </>
        )}
      </div>
    </Page>
  );
}

/** One group of the results (2308:538, 2308:739): its label and count over
 *  a three-column grid of cards, each group in its own frame ratio. */
function ResultGroup({
  group,
  onOpen,
}: {
  group: TemplateGroup;
  onOpen(template: CatalogTemplate): void;
}) {
  return (
    <section className="sp-lib-group" aria-labelledby={`group-${group.id}`}>
      <div className="sp-lib-group__header">
        <h2 className="t-title-group" id={`group-${group.id}`}>
          {group.label}
        </h2>
        <span className="t-label-xs sp-lib-group__count">
          {plural(group.templates.length, "template")}
        </span>
      </div>
      <div className="sp-lib-grid">
        {group.templates.map((t) => (
          <TemplateCard key={t.id} template={t} frame={group.frame} onOpen={onOpen} />
        ))}
      </div>
    </section>
  );
}
