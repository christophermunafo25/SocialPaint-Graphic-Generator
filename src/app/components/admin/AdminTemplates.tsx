import React, { useEffect, useMemo, useRef, useState } from "react";
import { Copy, Eye, EyeOff, Pencil, Plus, Proportions, RotateCcw, Trash2 } from "lucide-react";
import type { TemplateSchema, UsageSummary } from "@/lib/types";
import { stores } from "@/lib/stores";
import { useAsync } from "@/lib/useAsync";
import { useAuth } from "@/lib/auth/AuthContext";
import { useBrand } from "@/lib/brand/BrandContext";
import { seedStarterTemplates } from "@/lib/templates/starters/seed";
import { consumeSeedNotice } from "@/lib/templates/starters/seedNotice";
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
import { SkeletonCard } from "../templates/TemplateSkeleton";
import { TemplateThumbnail } from "../TemplateThumbnail";
import { Button, IconButton, Modal, SegmentedControl, Select, Status, Toast } from "../primitives";

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

  const confirmDelete = async () => {
    if (!deleting) return;
    await stores.templates.delete(deleting.id);
    setDeleting(null);
    reload();
  };

  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  // Onboarding's seeding runs right before it navigates here; if any starter
  // failed to create, the notice it left behind surfaces as a toast.
  useEffect(() => {
    const notice = consumeSeedNotice();
    if (notice) {
      setToast(notice);
      toastTimer.current = window.setTimeout(() => setToast(null), 8000);
    }
  }, []);

  /** Restore starter templates: the same seeder onboarding ran. It skips
   * starterKeys that still exist, so it only recreates deleted ones and a
   * second click is a no-op. Re-coloring after a palette change is delete
   * then restore — the re-seed bakes the current palette. */
  const { kit, assets } = useBrand();
  const [confirmingRestore, setConfirmingRestore] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const restoreStarters = async () => {
    setConfirmingRestore(false);
    if (!company || !kit) return;
    setRestoring(true);
    const showToast = (message: string) => {
      setToast(message);
      toastTimer.current = window.setTimeout(() => setToast(null), 6000);
    };
    try {
      const logoAsset =
        assets.find((a) => a.id === kit.primaryLogoAssetId) ??
        assets.find((a) => a.kind === "logo");
      const result = await seedStarterTemplates(stores, {
        company: { id: company.id, name: company.name, website: company.website },
        kit,
        logoAssetRef: logoAsset?.url,
      });
      if (result.failed.length) {
        console.error("Starter restore failed for:", result.failed);
        showToast("Some starter templates could not be restored. Try again.");
      } else if (result.created.length) {
        showToast(
          `${result.created.length} starter template${result.created.length === 1 ? "" : "s"} restored.`,
        );
      } else {
        showToast("All starter templates are already in place.");
      }
      if (result.created.length) reload();
    } finally {
      setRestoring(false);
    }
  };

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
        // The fill page's toast position: centred at the foot of the page.
        <div className="sp-fill-toast" aria-live="polite">
          <Toast message={toast} />
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
      <Modal
        open={versionFor !== null}
        onOpenChange={(next) => !next && setVersionFor(null)}
        title="Create a version for…"
      >
        {versionFor && (
          <>
            <p className="tu-body-m sp-st-confirm__body">
              "{versionFor.name}" stays untouched. The version lands as a reflowed draft copy you
              review in the builder.
            </p>
            <CanvasSizePicker
              sizes={sizesState.status === "ready" ? sizesState.data : []}
              value={{ width: versionFor.canvasWidth, height: versionFor.canvasHeight }}
              onPick={(next) => void createVersion(versionFor, next)}
            />
          </>
        )}
      </Modal>
      <ConfirmDialog
        open={confirmingRestore}
        title="Restore starter templates?"
        description="Recreates any of the six starter templates that have been deleted, colored from the current brand kit. Templates that still exist are left untouched, so running this twice changes nothing. To recolor a starter after a palette change, delete it first, then restore."
        confirmLabel="Restore"
        tone="primary"
        onCancel={() => setConfirmingRestore(false)}
        onConfirm={() => void restoreStarters()}
      />
      <PageHeader
        title="Template Builder"
        actions={
          <div className="flex items-center" style={{ gap: "var(--space-2xs)" }}>
            <Button
              kind="neutral"
              icon={RotateCcw}
              onClick={() => setConfirmingRestore(true)}
              disabled={restoring || !kit}
              title="Recreate deleted starter templates"
            >
              {restoring ? "Restoring…" : "Restore starters"}
            </Button>
            <Button
              kind="primary"
              icon={Plus}
              onClick={() => navigate({ name: "builder", templateId: null })}
            >
              New template
            </Button>
          </div>
        }
      />

      {templatesState.status === "ready" && templates.length > 0 && (
        <div
          className="sp-admin-filterrow flex flex-wrap items-center mb-6"
          style={{ gap: "var(--space-xs)" }}
        >
          <TemplateSearchField value={query} onChange={setQuery} />
          <SegmentedControl
            aria-label="Filter by status"
            options={[
              { id: "all", label: `All ${templates.length}` },
              { id: "published", label: `Published ${publishedCount}` },
              { id: "draft", label: `Drafts ${draftCount}` },
            ]}
            selectedId={statusFilter}
            onSelect={(id) => setStatusFilter(id as StatusFilter)}
          />
          <div style={{ width: 200 }}>
            <Select<SortKey>
              ariaLabel="Sort templates"
              value={sort}
              options={[
                { value: "recent", label: "Recently edited" },
                { value: "name", label: "Name" },
                { value: "downloads", label: "Most downloaded" },
              ]}
              onSelect={setSort}
            />
          </div>
        </div>
      )}

      {templatesState.status === "loading" ? (
        <div className="sp-grid-media" aria-busy="true" aria-label="Loading templates">
          {Array.from({ length: 8 }, (_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
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
          <p className="tu-title-card" style={{ color: "var(--text-primary)", marginBottom: 6 }}>
            Create your first template
          </p>
          <p className="tu-body-s max-w-md mx-auto" style={{ color: "var(--text-secondary)" }}>
            Upload a PNG or import a Figma frame, map the editable fields, and publish it for your
            team.
          </p>
        </div>
      ) : visible.length === 0 ? (
        <p className="tu-body-m text-center py-20" style={{ color: "var(--text-secondary)" }}>
          {query.trim()
            ? "No templates match that search."
            : statusFilter === "draft"
              ? "No drafts."
              : "Nothing published yet."}
        </p>
      ) : (
        <div className="sp-grid-media">
          {visible.map((t) => {
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
                <div className="sp-template-card__meta sp-template-card__meta--stack">
                  {/* Line 1: the title, alone. Five 32px icons beside it left
                      the rename field ~18px wide at four columns; the name
                      and its input now own the whole line. */}
                  <InlineEdit
                    className="tu-label-m min-w-0"
                    value={t.name}
                    ariaLabel={`Rename ${t.name}`}
                    inputAriaLabel="Template name"
                    placeholder="Untitled template"
                    valueStyle={{ color: "var(--text-primary)" }}
                    onSave={(name) => renameTemplate(t, name)}
                  />
                  {/* Line 2: status (+ provenance when a model built the fields) */}
                  <Status tone={t.status === "published" ? "active" : "neutral"} size="sm">
                    {t.status === "published" ? "Published" : "Draft"}
                  </Status>
                  {/* Starter templates carry autobuildMeta for provenance
                      and idempotency but are seeded designs, not model
                      output — labeling them AI-built would be wrong. */}
                  {t.autobuildMeta && t.autobuildMeta.source !== "starter" && (
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
                    <p
                      className="tu-caption-s"
                      style={{ color: "var(--text-muted)", marginTop: 2 }}
                    >
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
                  {/* Line 4: the actions, on a row of their own. Five 32px
                      icons are 192px wide; at four columns the card offers 218,
                      so they share a line with nothing — not the title (which
                      they squeezed to ~18px) and not the status. */}
                  <div
                    className="flex items-center"
                    style={{ gap: "var(--space-2xs)", marginTop: "var(--space-2xs)" }}
                  >
                    <IconButton
                      variant="ghost"
                      size="sm"
                      icon={t.status === "published" ? EyeOff : Eye}
                      label={t.status === "published" ? "Unpublish" : "Publish"}
                      title={t.status === "published" ? "Unpublish" : "Publish"}
                      onClick={() => void toggleStatus(t)}
                    />
                    <IconButton
                      variant="ghost"
                      size="sm"
                      icon={Pencil}
                      label="Edit"
                      title="Edit"
                      onClick={() => navigate({ name: "builder", templateId: t.id })}
                    />
                    <IconButton
                      variant="ghost"
                      size="sm"
                      icon={Copy}
                      label="Duplicate"
                      title="Duplicate"
                      onClick={() => void duplicateTemplate(t)}
                    />
                    <IconButton
                      variant="ghost"
                      size="sm"
                      icon={Proportions}
                      label="Create a version for another size"
                      title="Create a version for another size"
                      onClick={() => setVersionFor(t)}
                    />
                    <IconButton
                      variant="ghost"
                      size="sm"
                      icon={Trash2}
                      label="Delete"
                      title="Delete"
                      onClick={() => setDeleting(t)}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Page>
  );
}
