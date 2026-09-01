import React, { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Copy, Eye, EyeOff, Pencil, Plus, Proportions, Trash2 } from "lucide-react";
import type { TemplateSchema, UsageSummary } from "@/lib/types";
import { stores } from "@/lib/stores";
import { useAsync } from "@/lib/useAsync";
import { useAuth } from "@/lib/auth/AuthContext";
import { useRouter } from "../../router";
import { Page, PageHeader } from "../layout/Page";
import { ConfirmDialog } from "../ConfirmDialog";
import { InlineEdit } from "../InlineEdit";
import { TemplateSearchField } from "../templates/TemplateSearchField";
import { toCatalogTemplate } from "@/lib/templates/catalog";
import { buildSearchIndex, searchTemplates } from "@/lib/templates/searchIndex";
import { versionName } from "@/lib/templates/reflow";
import type { CanvasSize } from "@/lib/templates/platforms";
import { CanvasSizePicker } from "../builder/CanvasSizePicker";
import { ErrorState } from "../ErrorState";
import { TemplateThumbnail } from "../TemplateThumbnail";

type StatusFilter = "all" | "published" | "draft";
type SortKey = "recent" | "name" | "downloads";

const lastUsed = (iso: string | null): string => {
  if (!iso) return "";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
};

/** Admin template list: drafts + published, search/filter/sort, usage on the
 * card, publish toggle, edit, duplicate, delete. */
export function AdminTemplates() {
  const { company } = useAuth();
  const { navigate } = useRouter();
  /** Bumped after mutations so the list reloads through the same hook. */
  const [version, setVersion] = useState(0);
  const reload = () => setVersion((v) => v + 1);
  const templatesState = useAsync(
    () => (company ? stores.templates.listAll(company.id) : Promise.resolve([])),
    [company, version],
  );
  const templates = useMemo(
    () => (templatesState.status === "ready" ? templatesState.data : []),
    [templatesState],
  );

  // Usage rides along so revise-or-retire decisions don't need Insights.
  // If it's slow or fails, cards render without the usage line.
  const usageState = useAsync<UsageSummary | null>(
    () => (company ? stores.usage.getUsageSummary(company.id) : Promise.resolve(null)),
    [company, version],
  );
  const usageByTemplate = useMemo(() => {
    const rows = usageState.status === "ready" ? (usageState.data?.rows ?? []) : [];
    return new Map(rows.map((r) => [r.templateId, r]));
  }, [usageState]);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortKey>("recent");

  const publishedCount = templates.filter((t) => t.status === "published").length;
  const draftCount = templates.length - publishedCount;

  const visible = useMemo(() => {
    let list =
      statusFilter === "all" ? templates : templates.filter((t) => t.status === statusFilter);
    if (query.trim()) {
      // Same index the member gallery uses, so "1200x627", "li" or "4:5"
      // all work here too.
      const ranked = searchTemplates(buildSearchIndex(list.map(toCatalogTemplate)), query);
      const order = new Map(ranked.map((r, i) => [r.id, i]));
      list = list
        .filter((t) => order.has(t.id))
        .sort((a, b) => order.get(a.id)! - order.get(b.id)!);
    }
    const sorted = [...list];
    if (sort === "name") sorted.sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === "downloads")
      sorted.sort(
        (a, b) =>
          (usageByTemplate.get(b.id)?.downloads ?? 0) - (usageByTemplate.get(a.id)?.downloads ?? 0),
      );
    // "recent" keeps the store order (updatedAt desc on both backends).
    return sorted;
  }, [templates, statusFilter, query, sort, usageByTemplate]);

  const toggleStatus = async (t: TemplateSchema) => {
    await stores.templates.setStatus(t.id, t.status === "published" ? "draft" : "published");
    reload();
  };

  /** Template pending delete confirmation. */
  const [deleting, setDeleting] = useState<TemplateSchema | null>(null);
  /** Template whose name is open for inline rename. */
  const [renaming, setRenaming] = useState<string | null>(null);

  const confirmDelete = async () => {
    if (!deleting) return;
    await stores.templates.delete(deleting.id);
    setDeleting(null);
    reload();
  };

  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  /** Rename from the card. Throws on failure so the inline editor rolls the
   *  name back instead of showing a change that never landed. */
  const renameTemplate = async (t: TemplateSchema, name: string) => {
    try {
      await stores.templates.update(t.id, { name });
      reload();
    } catch (e) {
      setToast("Couldn't rename. Try again.");
      toastTimer.current = window.setTimeout(() => setToast(null), 4000);
      throw e;
    }
  };

  /** Template whose "Create a version for…" picker is open. */
  const [versionFor, setVersionFor] = useState<TemplateSchema | null>(null);
  // The workspace's enabled sizes, for the version picker.
  const sizesState = useAsync<CanvasSize[]>(
    () => (company ? stores.companies.listCanvasSizes(company.id) : Promise.resolve([])),
    [company],
  );

  /** Create a version for another platform: duplicate — the original is
   * never touched — then open the copy with the reflow handoff so the
   * builder reflows it for review. Named from what the size MEANS
   * ("Hiring announcement — Story"), deduped like plain duplicates. */
  const createVersion = async (t: TemplateSchema, target: { width: number; height: number }) => {
    setVersionFor(null);
    const names = new Set(templates.map((x) => x.name));
    const base = versionName(t.name, target);
    let name = base;
    for (let n = 2; names.has(name); n++) name = `${base} ${n}`;
    try {
      const copy = await stores.templates.duplicate(t.id, name);
      navigate({
        name: "builder",
        templateId: copy.id,
        reflow: `${target.width}x${target.height}`,
      });
    } catch (e) {
      console.error("Version create failed", e);
      setToast("Couldn't create the version. Try again.");
      toastTimer.current = window.setTimeout(() => setToast(null), 4000);
    }
  };

  const duplicateTemplate = async (t: TemplateSchema) => {
    // "<name> copy", then "<name> copy 2", 3, … on collision.
    const names = new Set(templates.map((x) => x.name));
    const base = `${t.name} copy`;
    let name = base;
    for (let n = 2; names.has(name); n++) name = `${base} ${n}`;
    try {
      const copy = await stores.templates.duplicate(t.id, name);
      setToast("Duplicated.");
      reload();
      // The person duplicating is about to edit it — the toast covers the hop.
      toastTimer.current = window.setTimeout(
        () => navigate({ name: "builder", templateId: copy.id }),
        600,
      );
    } catch (e) {
      console.error("Duplicate failed", e);
      setToast("Couldn't duplicate. Try again.");
      toastTimer.current = window.setTimeout(() => setToast(null), 4000);
    }
  };

  return (
    <Page>
      {toast && (
        <div className="sp-toast" role="status" aria-live="polite">
          <CheckCircle2
            style={{
              width: 16,
              height: 16,
              color: "var(--state-primary)",
              flexShrink: 0,
              marginTop: 1,
            }}
          />
          <span
            style={{
              fontSize: "var(--type-label-size)",
              fontWeight: 500,
              color: "var(--text-primary)",
            }}
          >
            {toast}
          </span>
        </div>
      )}
      <ConfirmDialog
        open={deleting !== null}
        title={`Delete template "${deleting?.name ?? ""}"?`}
        description="This cannot be undone."
        confirmLabel="Delete template"
        onCancel={() => setDeleting(null)}
        onConfirm={() => void confirmDelete()}
      />
      {versionFor && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Create a version of ${versionFor.name}`}
          style={{ background: "color-mix(in srgb, var(--text-on-accent) 55%, transparent)" }}
          onClick={() => setVersionFor(null)}
        >
          <div
            className="w-full max-w-sm p-4 space-y-3"
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-strong)",
              borderRadius: "var(--radius-card)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h2
                style={{
                  fontFamily: "var(--font-head)",
                  fontWeight: "var(--weight-head)",
                  fontSize: "var(--type-cardtitle-size)",
                  letterSpacing: "var(--track-head)",
                  color: "var(--text-primary)",
                }}
              >
                Create a version for…
              </h2>
              <p
                style={{
                  fontSize: "var(--type-caption-size)",
                  color: "var(--text-secondary)",
                  marginTop: 2,
                }}
              >
                "{versionFor.name}" stays untouched — the version lands as a reflowed draft copy
                you review in the builder.
              </p>
            </div>
            <CanvasSizePicker
              sizes={sizesState.status === "ready" ? sizesState.data : []}
              value={{ width: versionFor.canvasWidth, height: versionFor.canvasHeight }}
              onPick={(next) => void createVersion(versionFor, next)}
            />
          </div>
        </div>
      )}
      <PageHeader
        title="Template Builder"
        description="Create, edit, and publish — published templates appear in your team's Brand Templates."
        action={
          <button
            className="sp-btn sp-btn-primary"
            onClick={() => navigate({ name: "builder", templateId: null })}
          >
            <Plus style={{ width: 13, height: 13 }} />
            New template
          </button>
        }
      />

      {templatesState.status === "ready" && templates.length > 0 && (
        <div className="flex flex-wrap items-center mb-6" style={{ gap: "var(--space-xs)" }}>
          <TemplateSearchField value={query} onChange={setQuery} />
          <div
            className="flex overflow-hidden"
            data-radius-control
            role="group"
            aria-label="Filter by status"
            style={{ border: "1px solid var(--border-strong)", height: 40 }}
          >
            {(
              [
                ["all", `All ${templates.length}`],
                ["published", `Published ${publishedCount}`],
                ["draft", `Drafts ${draftCount}`],
              ] as [StatusFilter, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setStatusFilter(key)}
                aria-pressed={statusFilter === key}
                className="px-3 flex items-center"
                style={{
                  fontSize: "var(--type-caption-size)",
                  fontWeight: 500,
                  ...(statusFilter === key
                    ? { background: "var(--btn-primary-bg)", color: "var(--btn-primary-fg)" }
                    : { background: "var(--bg-surface)", color: "var(--text-secondary)" }),
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            aria-label="Sort templates"
            className="sp-input"
            style={{
              width: "auto",
              height: 40,
              padding: "0 10px",
              fontSize: "var(--type-caption-size)",
            }}
          >
            <option value="recent">Recently edited</option>
            <option value="name">Name</option>
            <option value="downloads">Most downloaded</option>
          </select>
        </div>
      )}

      {templatesState.status === "loading" ? (
        <p
          className="text-center py-20"
          style={{ fontSize: "var(--type-label-size)", color: "var(--text-muted)" }}
        >
          Loading…
        </p>
      ) : templatesState.status === "error" ? (
        <ErrorState
          title="We couldn't load your templates."
          detail="Check your connection and try again."
          onRetry={templatesState.retry}
        />
      ) : templates.length === 0 ? (
        <div
          className="text-center py-24"
          style={{
            border: "1.5px dashed var(--border-strong)",
            borderRadius: "var(--radius-card)",
          }}
        >
          <p
            style={{
              fontFamily: "var(--font-head)",
              fontWeight: "var(--weight-head)",
              fontSize: "var(--type-cardtitle-size)",
              letterSpacing: "var(--track-head)",
              color: "var(--text-primary)",
              marginBottom: 6,
            }}
          >
            Create your first template
          </p>
          <p
            className="max-w-md mx-auto"
            style={{ fontSize: "var(--type-label-size)", color: "var(--text-secondary)" }}
          >
            Upload a PNG or import a Figma frame, map the editable fields, and publish it for your
            team.
          </p>
        </div>
      ) : visible.length === 0 ? (
        <p className="text-center py-20" style={{ fontSize: 14, color: "var(--text-secondary)" }}>
          {query.trim()
            ? "No templates match that search."
            : statusFilter === "draft"
              ? "No drafts."
              : "Nothing published yet."}
        </p>
      ) : (
        <div className="sp-grid-media">
          {visible.map((t) => {
            const iconBtn: React.CSSProperties = {
              width: 32,
              height: 32,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            };
            return (
              <div key={t.id} className="sp-card sp-media-card flex flex-col">
                <button
                  onClick={() => navigate({ name: "builder", templateId: t.id })}
                  className="sp-media-card__preview"
                  aria-label={`Edit ${t.name}`}
                >
                  <div
                    style={{
                      aspectRatio: `${t.canvasWidth} / ${t.canvasHeight}`,
                      // Contain, unlike the member gallery: an admin needs to see
                      // the whole artwork, so pin the LONG axis and letterbox.
                      ...(t.canvasWidth / t.canvasHeight >= 1
                        ? { width: "100%" }
                        : { height: "100%" }),
                    }}
                  >
                    <TemplateThumbnail template={t} />
                  </div>
                </button>
                <div style={{ padding: "12px 2px 4px" }}>
                  {/* Line 1: title + icon action row on the same line */}
                  <div className="flex items-center" style={{ gap: "var(--space-2xs)" }}>
                    <InlineEdit
                      className="flex-1 min-w-0"
                      value={t.name}
                      ariaLabel={`Rename ${t.name}`}
                      inputAriaLabel="Template name"
                      placeholder="Untitled template"
                      valueStyle={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}
                      onSave={(name) => renameTemplate(t, name)}
                      onEditingChange={(on) => setRenaming(on ? t.id : null)}
                    />
                    {/* The rename input needs the whole line — four 32px icons
                      would squeeze it down to a couple of characters. */}
                    {renaming !== t.id && (
                      <>
                        <button
                          style={iconBtn}
                          onClick={() => void toggleStatus(t)}
                          title={t.status === "published" ? "Unpublish" : "Publish"}
                        >
                          {t.status === "published" ? (
                            <EyeOff style={{ width: 16, height: 16, color: "var(--text-muted)" }} />
                          ) : (
                            <Eye style={{ width: 16, height: 16, color: "var(--state-primary)" }} />
                          )}
                        </button>
                        <button
                          style={iconBtn}
                          onClick={() => navigate({ name: "builder", templateId: t.id })}
                          title="Edit"
                        >
                          <Pencil style={{ width: 16, height: 16, color: "var(--text-muted)" }} />
                        </button>
                        <button
                          style={iconBtn}
                          onClick={() => void duplicateTemplate(t)}
                          title="Duplicate"
                        >
                          <Copy style={{ width: 16, height: 16, color: "var(--text-muted)" }} />
                        </button>
                        <button
                          style={iconBtn}
                          onClick={() => setVersionFor(t)}
                          title="Create a version for another size"
                        >
                          <Proportions
                            style={{ width: 16, height: 16, color: "var(--text-muted)" }}
                          />
                        </button>
                        <button style={iconBtn} onClick={() => setDeleting(t)} title="Delete">
                          <Trash2 style={{ width: 16, height: 16, color: "var(--state-danger)" }} />
                        </button>
                      </>
                    )}
                  </div>
                  {/* Line 2: status (+ provenance when a model built the fields) */}
                  <span
                    className="sp-eyebrow inline-block"
                    style={t.status === "published" ? { color: "var(--state-primary)" } : undefined}
                  >
                    {t.status}
                  </span>
                  {t.autobuildMeta && (
                    <span
                      className="sp-eyebrow inline-block ml-2"
                      title={`Built by ${t.autobuildMeta.model} from ${t.autobuildMeta.sourceKind}`}
                      style={{ color: "var(--text-muted)" }}
                    >
                      · AI-built
                    </span>
                  )}
                  {/* Line 3: meta */}
                  {usageState.status === "ready" && (
                    <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                      {(() => {
                        const u = usageByTemplate.get(t.id);
                        if (!u || u.downloads === 0) return "Not used yet";
                        // An admin who sent a link out wants to know it is
                        // working, and that only shows if public traffic is
                        // counted apart from the team's own.
                        const viaLink =
                          u.publicDownloads > 0 ? ` · ${u.publicDownloads} via link` : "";
                        return `${u.downloads} download${u.downloads === 1 ? "" : "s"}${viaLink} · last used ${lastUsed(u.lastUsedAt)}`;
                      })()}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Page>
  );
}
