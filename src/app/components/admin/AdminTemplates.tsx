import React, { useEffect, useMemo, useRef, useState } from "react";
import { Copy, Eye, EyeOff, Frame, Pencil, Plus, Search, Trash2, Undo2 } from "lucide-react";
import type { TemplateSchema, UsageSummary } from "@/lib/types";
import { stores } from "@/lib/stores";
import { useAsync } from "@/lib/useAsync";
import { useAuth } from "@/lib/auth/AuthContext";
import { useBrand } from "@/lib/brand/BrandContext";
import { seedStarterTemplates } from "@/lib/templates/starters/seed";
import { consumeSeedNotice } from "@/lib/templates/starters/seedNotice";
import { useRouter } from "../../router";
import { Page } from "../layout/Page";
import { ConfirmDialog } from "../ConfirmDialog";
import { LibrarySearch } from "../templates/LibrarySearch";
import { toCatalogTemplate } from "@/lib/templates/catalog";
import { builderUsageLine } from "@/lib/templates/builderMeta";
import { buildSearchIndex, searchTemplates } from "@/lib/templates/searchIndex";
import { versionName } from "@/lib/templates/reflow";
import type { CanvasSize } from "@/lib/templates/platforms";
import { CanvasSizePicker } from "../builder/CanvasSizePicker";
import { ErrorState } from "../ErrorState";
import { BuilderTemplateCard, BuilderTemplateCardSkeleton } from "./BuilderTemplateCard";
import {
  Button,
  EmptyState,
  Modal,
  PageHeader,
  SegmentedControl,
  Select,
  Toast,
  type RowMenuGroup,
} from "../primitives";

type StatusFilter = "all" | "published" | "draft";
type SortKey = "recent" | "name" | "downloads";

/** The Template Builder list (new brand, 328:1944): drafts and published
 * templates under the status switch, the sort and the search, each card
 * with its usage line and its row menu (329:2206): Edit, Duplicate, Make
 * another size, then Publish or Unpublish, and Delete. */
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

  // The bar pins to the content's top edge as the grid scrolls, as the
  // library's does; the sentinel above it says when it has.
  const showBar = templatesState.status === "ready" && templates.length > 0;
  const sentinel = useRef<HTMLDivElement>(null);
  const [pinned, setPinned] = useState(false);
  useEffect(() => {
    const el = sentinel.current;
    if (!showBar || !el) return;
    const io = new IntersectionObserver(([entry]) => setPinned(!entry.isIntersecting), {
      threshold: 1,
    });
    io.observe(el);
    return () => io.disconnect();
  }, [showBar]);

  /** A card's row menu (329:2206). */
  const menuFor = (t: TemplateSchema): RowMenuGroup[] => [
    {
      items: [
        {
          label: "Edit",
          icon: Pencil,
          movesFocus: true,
          onSelect: () => navigate({ name: "builder", templateId: t.id }),
        },
        { label: "Duplicate", icon: Copy, onSelect: () => void duplicateTemplate(t) },
        {
          label: "Make another size",
          icon: Frame,
          movesFocus: true,
          onSelect: () => setVersionFor(t),
        },
      ],
    },
    {
      items: [
        t.status === "published"
          ? { label: "Unpublish", icon: EyeOff, onSelect: () => void toggleStatus(t) }
          : { label: "Publish", icon: Eye, onSelect: () => void toggleStatus(t) },
        { label: "Delete", icon: Trash2, movesFocus: true, onSelect: () => setDeleting(t) },
      ],
    },
  ];

  const header = (
    <PageHeader
      title="Template Builder"
      actions={
        <>
          <Button
            kind="neutral"
            icon={Undo2}
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
        </>
      }
    />
  );

  return (
    <Page header={header}>
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
        wide
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

      {showBar && (
        <>
          <div ref={sentinel} aria-hidden className="sp-tb-sentinel" />
          <div className="sp-tb-filterbar" data-pinned={pinned || undefined}>
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
            <div className="sp-tb-filterbar__end">
              <Select<SortKey>
                ariaLabel="Sort templates"
                hug
                value={sort}
                options={[
                  { value: "recent", label: "Recently edited" },
                  { value: "name", label: "Name" },
                  { value: "downloads", label: "Most downloaded" },
                ]}
                onSelect={setSort}
              />
              <LibrarySearch
                className="sp-tb-search"
                value={query}
                onChange={setQuery}
                label="Search templates"
                placeholder="Search templates, platforms, or sizes"
              />
            </div>
          </div>
        </>
      )}

      {templatesState.status === "loading" ? (
        <div className="sp-tb-grid" aria-busy="true" aria-label="Loading templates">
          {Array.from({ length: 8 }, (_, i) => (
            <BuilderTemplateCardSkeleton key={i} />
          ))}
        </div>
      ) : templatesState.status === "error" ? (
        <ErrorState
          title="We couldn't load your templates."
          detail="Check your connection and try again."
          onRetry={templatesState.retry}
        />
      ) : templates.length === 0 ? (
        <EmptyState icon={Frame} title="Create your first template" className="sp-tb-empty" />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={query.trim() ? Search : Frame}
          title={
            query.trim()
              ? "No templates match that search."
              : statusFilter === "draft"
                ? "No drafts."
                : "Nothing published yet."
          }
          className="sp-tb-empty"
        />
      ) : (
        <div className="sp-tb-grid">
          {visible.map((t) => (
            <BuilderTemplateCard
              key={t.id}
              template={t}
              usage={builderUsageLine(
                t,
                usageState.status === "ready" ? (usageByTemplate.get(t.id)?.downloads ?? 0) : null,
              )}
              menu={menuFor(t)}
              onOpen={() => navigate({ name: "builder", templateId: t.id })}
            />
          ))}
        </div>
      )}
    </Page>
  );
}
