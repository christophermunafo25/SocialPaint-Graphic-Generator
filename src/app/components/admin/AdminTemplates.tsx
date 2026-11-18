import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import type { AutoBuildResult, DesignImportResult } from "@/lib/types";
import { ErrorState } from "../ErrorState";
import { AutoBuildDialog } from "../builder/AutoBuildDialog";
import { CanvaImportDialog } from "../builder/CanvaImportDialog";
import { FigmaImportDialog } from "../builder/FigmaImportDialog";
import { NewTemplateDialog, type StartPath } from "../builder/NewTemplateDialog";
import { ChooseSizeDialog, type SizesState } from "../builder/SizeGallery";
import { handOffStart, takeNewTemplateRequest, type BuilderStart } from "../builder/startHandoff";
import { BUILDER_MIN_VIEWPORT_PX, useViewportAtLeast } from "../builder/useViewportAtLeast";
import { BuilderTemplateCard, BuilderTemplateCardSkeleton } from "./BuilderTemplateCard";
import {
  Button,
  EmptyState,
  PageHeader,
  SegmentedControl,
  Select,
  Toast,
  type RowMenuGroup,
} from "../primitives";
import { AREA_ICON } from "../areas";

type StatusFilter = "all" | "published" | "draft";
type SortKey = "recent" | "name" | "downloads";

/** Where New template has got to: its own dialog, then Choose a size or
 * one import's dialog. */
type StartStep = "new" | "size" | "figma" | "build" | "canva";

/** The Template Builder list (new brand, 328:1944): drafts and published
 * templates under the status switch, the sort and the search, each card
 * with its usage line and its row menu (329:2206): Edit, Duplicate, Make
 * another size, then Publish or Unpublish, and Delete. New template starts
 * here (329:2660 and the dialogs after it) and hands its result to the
 * builder (startHandoff). */
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

  // The Toast owns its time (PROMPT.md section 7.2); each message keeps its
  // own length, and n restarts it for a repeat.
  const [toast, setToast] = useState<{ message: string; ms: number; n: number } | null>(null);
  const showToast = useCallback((message: string, ms: number) => {
    setToast((prev) => ({ message, ms, n: (prev?.n ?? 0) + 1 }));
  }, []);
  const lastToastMs = useRef(4000);
  if (toast) lastToastMs.current = toast.ms;
  // Duplicate hands over to the editor a moment after its toast.
  const hopTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(hopTimer.current), []);

  // Onboarding's seeding runs right before it navigates here; if any starter
  // failed to create, the notice it left behind surfaces as a toast.
  useEffect(() => {
    const notice = consumeSeedNotice();
    if (notice) showToast(notice, 8000);
  }, [showToast]);

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
    const showRestoreToast = (message: string) => showToast(message, 6000);
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
        showRestoreToast("Some starter templates could not be restored. Try again.");
      } else if (result.created.length) {
        showRestoreToast(
          `${result.created.length} starter template${result.created.length === 1 ? "" : "s"} restored.`,
        );
      } else {
        showRestoreToast("All starter templates are already in place.");
      }
      if (result.created.length) reload();
    } finally {
      setRestoring(false);
    }
  };

  /** Template whose Make another size is open (Choose a size). */
  const [versionFor, setVersionFor] = useState<TemplateSchema | null>(null);
  // The workspace's enabled sizes, for Choose a size.
  const sizesState = useAsync<CanvasSize[]>(
    () => (company ? stores.companies.listCanvasSizes(company.id) : Promise.resolve([])),
    [company],
  );
  const sizes: SizesState =
    sizesState.status === "ready"
      ? { status: "ready", sizes: sizesState.data }
      : sizesState.status === "error"
        ? { status: "error", retry: sizesState.retry }
        : { status: "loading" };

  // New template (329:2660). The builder works from 1024 wide; narrower,
  // New template goes straight to it, which says so, rather than through
  // dialogs whose result it couldn't open.
  const viewportOk = useViewportAtLeast(BUILDER_MIN_VIEWPORT_PX);
  const [startStep, setStartStep] = useState<StartStep | null>(null);
  const newButton = useRef<HTMLButtonElement>(null);
  const openNewTemplate = () =>
    viewportOk ? setStartStep("new") : navigate({ name: "builder", templateId: null });
  // The builder, opened on /template-builder/new with nothing to start
  // from, sends New template back here.
  useEffect(() => {
    if (takeNewTemplateRequest()) setStartStep("new");
  }, []);
  // The imports need the Supabase backend. Import from Canva shows once
  // the workspace has Canva; whether it's connected is its dialog's to say.
  const importReady = stores.designImport.isConfigured();
  const [canvaEnabled, setCanvaEnabled] = useState(false);
  useEffect(() => {
    if (!company || !importReady) return;
    let cancelled = false;
    stores.designImport
      .canvaStatus(company.id)
      .then((s) => !cancelled && setCanvaEnabled(s.enabled))
      .catch(() => !cancelled && setCanvaEnabled(false));
    return () => {
      cancelled = true;
    };
  }, [company, importReady]);
  /** Where Choose a size and Delete hand focus back as they close: New
   * template, or the row menu they came from (its item is gone by then). */
  const dialogReturn = useRef<HTMLElement | null>(null);
  const fromOpenRowMenu = () => {
    dialogReturn.current = document.querySelector<HTMLElement>(
      '.sp-tbcard .ui-rowmenu[aria-expanded="true"]',
    );
  };
  const choosePath = (path: StartPath) => {
    dialogReturn.current = newButton.current;
    setStartStep(path === "blank" ? "size" : path);
  };
  /** Hand the start to the builder and open it. */
  const startWith = (start: BuilderStart) => {
    handOffStart(start);
    navigate({ name: "builder", templateId: null });
  };
  const closeStart = () => setStartStep(null);

  const confirmDelete = async () => {
    if (!deleting) return;
    await stores.templates.delete(deleting.id);
    // The card's menu goes with the card, so focus goes to New template.
    dialogReturn.current = newButton.current;
    setDeleting(null);
    reload();
  };

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
      showToast("Couldn't create the version. Try again.", 4000);
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
      showToast("Duplicated.", 4000);
      reload();
      // The person duplicating is about to edit it: the toast covers the hop.
      window.clearTimeout(hopTimer.current);
      hopTimer.current = window.setTimeout(
        () => navigate({ name: "builder", templateId: copy.id }),
        600,
      );
    } catch (e) {
      console.error("Duplicate failed", e);
      showToast("Couldn't duplicate. Try again.", 4000);
    }
  };

  const showBar = templatesState.status === "ready" && templates.length > 0;

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
          onSelect: () => {
            fromOpenRowMenu();
            setVersionFor(t);
          },
        },
      ],
    },
    {
      items: [
        t.status === "published"
          ? { label: "Unpublish", icon: EyeOff, onSelect: () => void toggleStatus(t) }
          : { label: "Publish", icon: Eye, onSelect: () => void toggleStatus(t) },
        {
          label: "Delete",
          icon: Trash2,
          movesFocus: true,
          onSelect: () => {
            fromOpenRowMenu();
            setDeleting(t);
          },
        },
      ],
    },
  ];

  const header = (
    <PageHeader
      icon={AREA_ICON.templateBuilder}
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
          <Button ref={newButton} kind="primary" icon={Plus} onClick={openNewTemplate}>
            New template
          </Button>
        </>
      }
    />
  );

  return (
    <Page header={header}>
      {/* The fill page's toast position: centred at the foot of the page. */}
      <div className="sp-fill-toast" aria-live="polite">
        <Toast
          open={toast !== null}
          message={toast?.message}
          messageKey={toast?.n}
          duration={toast?.ms ?? lastToastMs.current}
          onTimeout={() => setToast(null)}
        />
      </div>
      <ConfirmDialog
        open={deleting !== null}
        title={`Delete template "${deleting?.name ?? ""}"?`}
        description="This cannot be undone."
        confirmLabel="Delete template"
        returnFocus={dialogReturn}
        onCancel={() => setDeleting(null)}
        onConfirm={() => void confirmDelete()}
      />
      <NewTemplateDialog
        open={startStep === "new"}
        onOpenChange={(next) => !next && closeStart()}
        importReady={importReady}
        canvaEnabled={canvaEnabled}
        onChoose={choosePath}
      />
      {/* Choose a size: a blank template's size, or a template's other
          size (Make another size), which marks its own. */}
      <ChooseSizeDialog
        open={startStep === "size" || versionFor !== null}
        onOpenChange={(next) => {
          if (next) return;
          closeStart();
          setVersionFor(null);
        }}
        state={sizes}
        current={
          versionFor ? { width: versionFor.canvasWidth, height: versionFor.canvasHeight } : null
        }
        onPick={(size) =>
          versionFor ? void createVersion(versionFor, size) : startWith({ kind: "blank", size })
        }
        returnFocus={dialogReturn}
      />
      {startStep === "figma" && (
        <FigmaImportDialog
          onClose={closeStart}
          onImported={(result: DesignImportResult) => startWith({ kind: "import", result })}
          returnFocus={newButton}
        />
      )}
      {startStep === "build" && (
        <AutoBuildDialog
          onClose={closeStart}
          onBuilt={(result: AutoBuildResult | DesignImportResult) =>
            startWith({ kind: "build", result })
          }
          returnFocus={newButton}
        />
      )}
      {startStep === "canva" && (
        <CanvaImportDialog
          onClose={closeStart}
          onBuilt={(result) => startWith({ kind: "build", result })}
          returnFocus={newButton}
        />
      )}
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
          <div className="sp-tb-filterbar">
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
                size="md"
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
