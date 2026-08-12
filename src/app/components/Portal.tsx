import React, { useEffect, useMemo, useRef, useState } from "react";
import { stores } from "@/lib/stores";
import { useAsync } from "@/lib/useAsync";
import { useAuth } from "@/lib/auth/AuthContext";
import { toCatalogTemplate, type CatalogTemplate } from "@/lib/templates/catalog";
import { buildGroups, groupIdOf, type TemplateGroup } from "@/lib/templates/groups";
import { buildSearchIndex, searchTemplates } from "@/lib/templates/searchIndex";
import { useRouter } from "../router";
import { Page, PageHeader } from "./layout/Page";
import { ErrorState } from "./ErrorState";
import { GroupChips } from "./templates/GroupChips";
import { PlatformShelf } from "./templates/PlatformShelf";
import { TemplateCard } from "./templates/TemplateCard";
import { TemplateSearchField } from "./templates/TemplateSearchField";
import { TemplateShelfSkeleton } from "./templates/TemplateSkeleton";
import { revealIndex, useReveal } from "./templates/useReveal";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** Member-facing template library. Three views on one surface, all driven by
 * the URL: browse (a rail per group), filtered (one group's grid), and search
 * (matches across every group).
 *
 * The unit throughout is a GROUP — one platform at one shape, e.g. "Facebook
 * Landscape". Grouping this far down is what lets every frame in a rail or a
 * grid share one ratio, so nothing is letterboxed to a common square and
 * rows sit even. Platform, shape and ratio are all derived from a template's
 * canvas; see lib/templates/platforms.ts. */
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
  const rawGroup = route.name === "portal" ? route.group : undefined;

  const setState = (next: { group?: string | null; q?: string }, replace = false) =>
    navigate(
      {
        name: "portal",
        group: (next.group !== undefined ? next.group : rawGroup) ?? undefined,
        q: (next.q !== undefined ? next.q : query) || undefined,
      },
      { replace },
    );

  // ── Derive the catalogue ────────────────────────────────────────────────
  const catalog = useMemo<CatalogTemplate[]>(() => templates.map(toCatalogTemplate), [templates]);
  const index = useMemo(() => buildSearchIndex(catalog), [catalog]);
  const allGroups = useMemo(() => buildGroups(catalog), [catalog]);

  /** Query applies first; the chip then narrows within it. */
  const searched = useMemo(
    () => (query ? searchTemplates(index, query) : catalog),
    [index, catalog, query],
  );

  /** Chips are faceted off the query, so every count on the page describes
   *  what's actually in front of the member. */
  const searchedGroups = useMemo(() => buildGroups(searched), [searched]);

  /** Resolved against the whole catalogue, not the search results: a chip
   *  the member picked stays picked even when the query excludes everything
   *  in it. That combination is a real empty state, not a reason to quietly
   *  widen the filter. */
  const group = allGroups.find((g) => g.id === rawGroup) ?? null;

  const results = useMemo(
    () => (group ? searched.filter((t) => groupIdOf(t) === group.id) : searched),
    [group, searched],
  );

  /** The chip stays on the bar at zero rather than disappearing under the
   *  member's cursor. */
  const chipGroups = useMemo(
    () =>
      group && !searchedGroups.some((g) => g.id === group.id)
        ? [...searchedGroups, { ...group, templates: [] }]
        : searchedGroups,
    [searchedGroups, group],
  );

  /** The grid renders a section per group so each one keeps its own frame
   *  ratio — a mixed search result never forces stories and banners into a
   *  single shared shape. */
  const resultGroups = useMemo(
    () => (group ? [{ ...group, templates: results }] : buildGroups(results)),
    [group, results],
  );

  const browsing = !query && !rawGroup;

  /** The generation entry point: TemplateUsePage fills the template in and
   *  downloads the graphic. */
  const openTemplate = (t: CatalogTemplate) => navigate({ name: "template", templateId: t.id });

  // ── Sticky pin ──────────────────────────────────────────────────────────
  const sentinel = useRef<HTMLDivElement>(null);
  const [pinned, setPinned] = useState(false);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setPinned(!entry.isIntersecting), {
      threshold: 1,
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const announcement = browsing
    ? ""
    : query
      ? `${plural(results.length, "result")} for “${query}”${group ? ` · ${group.label}` : ""}`
      : `${plural(results.length, "template")}${group ? ` · ${group.label}` : ""}`;

  if (templatesState.status === "error") {
    return (
      <Page>
        <PageHeader eyebrow={company?.name} title="Brand templates" />
        <ErrorState
          title="We couldn't load your templates."
          detail="Check your connection and try again."
          onRetry={templatesState.retry}
        />
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader
        eyebrow={company?.name}
        title="Brand templates"
        description="Starting points sized for every surface. Each one fills with your brand when you generate."
      />

      <div ref={sentinel} aria-hidden style={{ height: 1 }} />
      <div className="sp-filterbar" data-pinned={pinned || undefined}>
        <TemplateSearchField value={query} onChange={(q) => setState({ q }, true)} />
        {catalog.length > 0 && (
          <GroupChips
            groups={chipGroups}
            total={searched.length}
            selected={group?.id ?? null}
            onSelect={(next) => setState({ group: next })}
          />
        )}
      </div>

      <p className="sp-live" role="status" aria-live="polite">
        {announcement}
      </p>

      {templatesState.status === "loading" ? (
        <>
          <TemplateShelfSkeleton />
          <TemplateShelfSkeleton />
        </>
      ) : catalog.length === 0 ? (
        <div className="sp-emptystate">
          <p className="sp-emptystate__title">Publish your first template</p>
          <p className="sp-emptystate__body">
            Published templates appear here for everyone on your team.
          </p>
        </div>
      ) : browsing ? (
        allGroups.map((g) => (
          <PlatformShelf
            key={g.id}
            group={g}
            onOpen={openTemplate}
            onViewAll={() => setState({ group: g.id })}
          />
        ))
      ) : (
        <>
          <div className="sp-resultline">
            <p className="sp-eyebrow">{announcement}</p>
            <button
              type="button"
              className="sp-resultline__clear"
              onClick={() => setState({ group: null, q: "" })}
            >
              Clear
            </button>
          </div>

          {results.length === 0 ? (
            <div className="sp-emptystate">
              <p className="sp-emptystate__title">
                {query ? `No templates match “${query}”.` : "That set is empty."}
              </p>
              <div className="sp-emptystate__actions">
                {query && (
                  <button
                    type="button"
                    className="sp-btn sp-btn-primary"
                    onClick={() => setState({ q: "" })}
                  >
                    Clear search
                  </button>
                )}
                {query && group && (
                  <button
                    type="button"
                    className="sp-btn sp-btn-ghost"
                    onClick={() => setState({ group: null })}
                  >
                    Search all platforms
                  </button>
                )}
                {!query && (
                  <button
                    type="button"
                    className="sp-btn sp-btn-primary"
                    onClick={() => setState({ group: null })}
                  >
                    Back to all templates
                  </button>
                )}
              </div>
            </div>
          ) : (
            resultGroups.map((g) => (
              <ResultGroup key={g.id} group={g} showHeading={!group} onOpen={openTemplate} />
            ))
          )}
        </>
      )}
    </Page>
  );
}

/** One group's grid within the results. Split out so each section owns its
 *  own scroll-in reveal rather than the whole page animating as one block. */
function ResultGroup({
  group,
  showHeading,
  onOpen,
}: {
  group: TemplateGroup;
  showHeading: boolean;
  onOpen(template: CatalogTemplate): void;
}) {
  const revealRef = useReveal<HTMLElement>();
  return (
    <section ref={revealRef} className="sp-resultgroup sp-reveal">
      {showHeading && (
        <h2 className="sp-resultgroup__title">
          {group.label}
          <span className="sp-eyebrow">{plural(group.templates.length, "template")}</span>
        </h2>
      )}
      <div className="sp-grid-media">
        {group.templates.map((t, i) => (
          <div key={t.id} className="sp-reveal__item" style={revealIndex(i)}>
            <TemplateCard template={t} frame={group.frame} showTags onOpen={onOpen} />
          </div>
        ))}
      </div>
    </section>
  );
}
