import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Circle,
  Image as ImageIcon,
  Minus,
  MousePointer2,
  Eye,
  Sparkles,
  Figma,
  Palette,
  PanelLeftClose,
  PanelRightClose,
  Pencil,
  Plus,
  RefreshCw,
  Redo2,
  Save,
  Send,
  Square,
  Type,
  Undo2,
  Upload,
  X,
} from "lucide-react";
import type {
  AutoBuildResult,
  DesignImportResult,
  FieldValues,
  ImportIssue,
  LayoutGroup,
  NewTemplateInput,
  TemplateField,
  TemplateLink,
  TemplateSchema,
} from "@/lib/types";
import { groupChildRef, isFreeGroup } from "@/lib/types";
import { stores } from "@/lib/stores";
import { useAsync } from "@/lib/useAsync";
import { useHistory } from "@/lib/useHistory";
import { useAuth } from "@/lib/auth/AuthContext";
import { useBrand } from "@/lib/brand/BrandContext";
import { ErrorBoundary } from "../ErrorBoundary";
import { ErrorState } from "../ErrorState";
import { newId } from "@/lib/stores/local/db";
import { retagCaption, suggestFieldKey } from "@/lib/caption";
import { useFileDrop } from "@/lib/useFileDrop";
import { useUnsavedChangesWarning } from "@/lib/useUnsavedChangesWarning";
import { useRouter } from "../../router";
import { ColorControl } from "../ColorControl";
import { useChrome, useFullViewport } from "../layout/ChromeContext";
import { InlineEdit } from "../InlineEdit";
import { SchemaRenderer, schemaBackgroundCss } from "../SchemaRenderer";
import { GradientEditor } from "./GradientEditor";
import { FieldOverlayEditor, type CanvasViewApi } from "./FieldOverlayEditor";
import { FieldInspector } from "./FieldInspector";
import { CaptionEditor } from "./CaptionEditor";
import { FigmaImportDialog } from "./FigmaImportDialog";
import { AutoBuildDialog } from "./AutoBuildDialog";
import { ElementPalette } from "./ElementPalette";
import { FieldListPanel } from "./FieldListPanel";
import { LayersPanel } from "./LayersPanel";
import { FieldContextMenu, type MenuAction } from "./FieldContextMenu";
import { inspectorGestureActive } from "./InspectorControls";
import { canvasGestureActive } from "./canvasGesture";
import { WIZARD_STEPS, WizardStepBar, type WizardStep } from "./WizardStepper";
import {
  BuilderRail,
  BuilderSlideOver,
  RailHeader,
  RailTabs,
  useRailCollapsed,
  useRailWidth,
} from "./BuilderShell";
import {
  LOGO_PALETTE_PREFIX,
  PALETTE_ITEMS,
  TOOL_KEYS,
  TOOL_LETTER,
  TOOL_PALETTE_ID,
  type BuilderTool,
  applyClipboardStyle,
  cascadePoint,
  clipboardHasFields,
  clipboardHasStyle,
  copyStyle,
  copyToClipboard,
  duplicateFields,
  fieldFromPalette,
  isSvgSource,
  isTypingTarget,
  logoFieldFromAsset,
  imageFieldFromUpload,
  pasteFromClipboard,
  applyPaintOrder,
  setLayerOrder,
  svgIntrinsicSize,
  textFieldFromPaste,
  worstCaseText,
} from "./fieldOps";
import { composeFigmaBackground } from "@/lib/figma/composeLayers";
import { assembleElementFields, mergeOverlayFields } from "@/lib/figma/overlayFields";
import { isFigmaNodeUrl } from "@/lib/figma/figmaUrl";
import { unavailableFamilies } from "@/lib/render/fonts";
import { lockedProperties } from "@/lib/brand/resolveStyle";
import { celebrate } from "@/lib/celebrate";
import { createCanvasMeasurer } from "@/lib/render/autoFit";
import { computeLayout, outermostGroupOf, parentGroupOf } from "@/lib/render/layout";
import {
  conversionShift,
  deriveFreeGroup,
  fieldIdsInGroups,
  groupIdsWithin,
  groupMoveTargets,
  renameKeyInGroups,
  selectedFieldIds,
  selectedGroupIds,
  stripFieldsFromGroups,
  toFreeGroup,
  toStackGroup,
  ungroup,
} from "./groupOps";
import { ConfirmDialog } from "../ConfirmDialog";
import { linkState } from "../admin/TemplateLinksDialog";
import type { CanvasSize } from "@/lib/templates/platforms";
import { rescaleTemplate, sameAspect, type RescaleWarning } from "@/lib/templates/rescale";
import { reflowTemplate, versionName } from "@/lib/templates/reflow";
import { CanvasSizePicker } from "./CanvasSizePicker";
import { SizeGallery } from "./SizeGallery";
import { BackgroundReflowDialog } from "./BackgroundReflowDialog";
import { ShortcutsPanel } from "./ShortcutsPanel";
import { AlignControls } from "./AlignControls";
import { SelectionToolbar } from "./SelectionToolbar";
import {
  alignDeltas,
  boundsOf,
  distributeDeltas,
  type AlignBox,
  type AlignEdge,
  type Axis,
} from "./alignOps";
import { GroupInspector } from "./GroupInspector";

/** The builder is a desktop tool: below this width the canvas + inspector
 * layout breaks, so we explain rather than attempt a responsive builder.
 * The member path (Portal / TemplateUsePage) stays fully responsive. */
const BUILDER_MIN_VIEWPORT_PX = 1024;

/** Rail bounds. The minimums are the narrowest width at which each rail's
 * own content still reads (the palette's two-across tiles; the inspector's
 * label + control row); the maximums stop a rail from eating the canvas. */
/** The tool strip, in the order every design tool puts it. Each one is
 * backed by an element the palette already offers. */
const TOOL_ORDER: Array<{
  key: BuilderTool;
  label: string;
  Icon: typeof MousePointer2;
}> = [
  { key: "move", label: "Move and select", Icon: MousePointer2 },
  { key: "text", label: "Text", Icon: Type },
  { key: "rect", label: "Rectangle", Icon: Square },
  { key: "ellipse", label: "Ellipse", Icon: Circle },
  { key: "line", label: "Line", Icon: Minus },
  { key: "image", label: "Image", Icon: ImageIcon },
];

const RAIL_LEFT_MIN = 200;
const RAIL_LEFT_MAX = 420;
const RAIL_RIGHT_MIN = 260;
const RAIL_RIGHT_MAX = 520;

const isMac = /Mac|iPhone|iPad/.test(navigator.platform);

/** Turn a save failure into something an admin can act on. The raw text is
 * kept — it is the only clue when the cause is novel — but the common
 * classes get a sentence that says what to DO about it. A rejected column
 * value in particular means the app is ahead of the database, which is a
 * deploy problem, not something to retry forever. */
export function saveErrorMessage(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  const lower = raw.toLowerCase();
  if (lower.includes("check constraint") || lower.includes("invalid input value for enum")) {
    return `The database rejected part of this template. It may be running behind the app (a migration is probably pending). Nothing was saved. Details: ${raw}`;
  }
  if (lower.includes("row-level security") || lower.includes("permission denied")) {
    return `You don't have permission to save this template. Details: ${raw}`;
  }
  if (lower.includes("failed to fetch") || lower.includes("networkerror")) {
    return "Couldn't reach the server. Check your connection; your work is still here and will save when the connection returns.";
  }
  return `Couldn't save this template. Details: ${raw}`;
}

/** "Saved just now" → "Saved N minutes ago". nowTick only forces re-renders. */
function savedAgo(savedAt: number, _nowTick: number): string {
  const mins = Math.floor((Date.now() - savedAt) / 60_000);
  if (mins < 1) return "Saved just now";
  if (mins === 1) return "Saved 1 minute ago";
  if (mins < 60) return `Saved ${mins} minutes ago`;
  return "Saved over an hour ago";
}

function useViewportAtLeast(px: number): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(`(min-width: ${px}px)`).matches);
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${px}px)`);
    const onChange = () => setMatches(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [px]);
  return matches;
}

/** Admin Template Builder. Pick the source (blank canvas, Figma import, or
 * auto-build), then the editor (element palette + canvas + field list +
 * inspector) is the home state, with three side panels opening over the
 * inspector: Caption (optional), Tags & details (optional), and Name, which
 * carries Publish. The top bar's primary button is the way forward — it
 * publishes, or first routes through naming, because publishing needs a real
 * name and the default "Untitled template" is refused. Naming last means the
 * admin names something they can see. Save draft is available throughout;
 * completed panels stay jumpable from the panel control in the bar. */
export function TemplateBuilder({
  templateId,
  reflowParam = null,
}: {
  templateId: string | null;
  /** Create-a-version handoff from the route ("1080x1920"): reflow the
   * loaded template to this size as an unsaved change for review. */
  reflowParam?: string | null;
}) {
  const { company } = useAuth();
  const { kit, assets: brandAssets } = useBrand();
  const { navigate } = useRouter();
  const viewportOk = useViewportAtLeast(BUILDER_MIN_VIEWPORT_PX);

  // Scoped to the company: sizes the workspace turned off in Settings do
  // not appear in the picker.
  const sizesState = useAsync<CanvasSize[]>(
    () => stores.companies.listCanvasSizes(company?.id),
    [company],
  );
  const sizes = sizesState.status === "ready" ? sizesState.data : [];
  const templateState = useAsync<TemplateSchema | null>(
    () => (templateId ? stores.templates.get(templateId) : Promise.resolve(null)),
    [templateId],
  );
  const [savedId, setSavedId] = useState<string | null>(templateId);
  // Draft state lives inside the history hook so EVERY mutation path —
  // setFields, patchField, deletes, background, name/caption/details — is
  // undoable. setDraft keeps the setState signature; the optional second
  // argument is a coalesce key for keystroke-stream sources.
  const {
    state: draft,
    set: setDraft,
    undo,
    redo,
    canUndo,
    canRedo,
    reset: resetHistory,
  } = useHistory<NewTemplateInput>(() => ({
    companyId: company?.id ?? "",
    // Marketers name things last — the default lets them reach the canvas
    // immediately; publish demands a real name.
    name: "Untitled template",
    description: "",
    category: "",
    tags: [],
    status: "draft",
    canvasWidth: 1440, // replaced by the selected preset on load — never trusted as a constant
    canvasHeight: 1440,
    backgroundUrl: "",
    fields: [],
    captionTemplate: "",
  }));
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  /** Undo/redo restore SELECTION along with geometry: after a history jump,
   * the fields the jump changed (or brought back) become the selection —
   * the same way a design tool re-selects what an undo affected. Set before
   * calling undo/redo; consumed by the diff effect below. */
  const histNavRef = useRef(false);
  const prevFieldsRef = useRef<TemplateField[]>([]);
  useEffect(() => {
    const prev = prevFieldsRef.current;
    prevFieldsRef.current = draft.fields;
    if (!histNavRef.current) return;
    histNavRef.current = false;
    if (prev === draft.fields) return;
    const prevById = new Map(prev.map((f) => [f.id, f]));
    const changed = draft.fields
      .filter((f) => {
        const p = prevById.get(f.id);
        return !p || (p !== f && JSON.stringify(p) !== JSON.stringify(f));
      })
      .map((f) => f.id);
    if (changed.length) setSelectedIds(changed);
    // A pure deletion-undo target: nothing changed among survivors — just
    // drop selection entries that no longer exist.
    else setSelectedIds((sel) => sel.filter((id) => draft.fields.some((f) => f.id === id)));
  }, [draft]);
  const doUndo = useCallback(() => {
    histNavRef.current = true;
    undo();
  }, [undo]);
  const doRedo = useCallback(() => {
    histNavRef.current = true;
    redo();
  }, [redo]);
  /** True once a creation path was chosen — "Start blank" needs no
   * background, so backgroundUrl alone can't gate the wizard anymore. */
  const [started, setStarted] = useState<boolean>(Boolean(templateId));
  const [step, setStep] = useState<WizardStep>("fields");
  const [visited, setVisited] = useState<Set<WizardStep>>(() => new Set(["fields"]));
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  /** The active canvas tool. Move marquee-selects; every other tool draws
   * its element. A plain letter arms a tool for ONE draw and then returns to
   * Move; SHIFT + the same letter locks it for repeated draws. One
   * convention, and the shortcuts panel states it. */
  const [tool, setTool] = useState<BuilderTool>("move");
  const [toolLocked, setToolLocked] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  /** Which list the left rail is showing. Two orderings, two tabs — the whole
   * point is that an admin can tell which one they are editing. */
  const [railTab, setRailTab] = useState<"layers" | "form">("layers");
  /** Lock and hide are EDITING AIDS, held for this session only. They never
   * reach the schema, the export, or the member form — so a template that
   * leaves this browser carries no trace of them. Persisting them would mean
   * new TemplateField properties, which is a schema decision, not this
   * work's to make. */
  const [lockedIds, setLockedIds] = useState<Set<string>>(new Set());
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const toggleIn = (set: Set<string>, id: string) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  };
  const toggleLocked = useCallback((id: string) => setLockedIds((prev) => toggleIn(prev, id)), []);
  const toggleHidden = useCallback((id: string) => setHiddenIds((prev) => toggleIn(prev, id)), []);
  // Chrome the admin owns, remembered per browser and never in the schema.
  const [leftWidth, setLeftWidth] = useRailWidth("rail-left", 260, RAIL_LEFT_MIN, RAIL_LEFT_MAX);
  const [rightWidth, setRightWidth] = useRailWidth(
    "rail-right",
    300,
    RAIL_RIGHT_MIN,
    RAIL_RIGHT_MAX,
  );
  const [leftCollapsed, setLeftCollapsed] = useRailCollapsed("rail-left-collapsed");
  const [rightCollapsed, setRightCollapsed] = useRailCollapsed("rail-right-collapsed");
  /** The step panels carry forms, not property rows — they get their own
   * comfortable width rather than inheriting the inspector's. */
  const stepPanelWidth = Math.max(380, Math.min(520, rightWidth));

  /** The canvas owns its own zoom and pan; the top bar only reads the scale
   * and calls the commands. Keeping the view state in the editor is what
   * lets the shortcuts and the menu run the same code. */
  const canvasViewRef = useRef<CanvasViewApi | null>(null);
  const [canvasScale, setCanvasScale] = useState(1);
  const onCanvasScale = useCallback((s: number) => setCanvasScale(s), []);
  /** Anchor for the zoom menu; separate from the canvas context menu, which
   * carries a field and a canvas point. */
  const [viewMenuAt, setViewMenuAt] = useState<{ x: number; y: number } | null>(null);

  // The builder owns the viewport: no document scroll, and the app rail out
  // of the way. Both are borrowed, and both are handed back on unmount.
  useFullViewport(viewportOk);
  const { overrideSidebarCollapsed } = useChrome();
  useEffect(() => {
    if (!viewportOk) return;
    overrideSidebarCollapsed(true);
    return () => overrideSidebarCollapsed(false);
  }, [viewportOk, overrideSidebarCollapsed]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [figmaOpen, setFigmaOpen] = useState(false);
  const [autoBuildOpen, setAutoBuildOpen] = useState(false);
  /** Which auto-build tab to open on. The Canva start card sets it. */
  const [autoBuildTab, setAutoBuildTab] = useState<"figma" | "canva" | "image" | undefined>();
  /** Canva is a start-screen path only once the workspace has connected it;
   * before that the card would open a dialog that points back at Settings. */
  const [canvaReady, setCanvaReady] = useState(false);
  useEffect(() => {
    if (!company || !stores.designImport.isConfigured()) return;
    let cancelled = false;
    stores.designImport
      .canvaStatus(company.id)
      .then((s) => {
        if (!cancelled) setCanvaReady(s.enabled && s.connected);
      })
      .catch(() => {
        if (!cancelled) setCanvaReady(false);
      });
    return () => {
      cancelled = true;
    };
  }, [company]);
  /** The blank path's size chooser. Imports never see it — a Figma or Canva
   * frame imposes its own size. */
  const [sizeDialogOpen, setSizeDialogOpen] = useState(false);
  useEffect(() => {
    if (!sizeDialogOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setSizeDialogOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sizeDialogOpen]);
  /** Snapshot of the last loaded/saved draft — anything else is unsaved. */
  const savedSnapshotRef = useRef<string>("");
  const [recomposing, setRecomposing] = useState(false);
  /** One-line import summary ("12 elements imported — all editable") so the
   * admin knows what they're looking at when the canvas opens full. */
  /** Transient confirmation toast (imports, grouping) — proof it worked. */
  const [notice, setNotice] = useState<string | null>(null);
  /** A just-created group, highlighted briefly so the admin sees it. */
  const [flashGroupId, setFlashGroupId] = useState<string | null>(null);
  const flashTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(flashTimer.current), []);
  const noticeTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(noticeTimer.current), []);
  const [publishState, setPublishState] = useState<"idle" | "publishing" | "success">("idle");
  const [error, setError] = useState<string | null>(null);
  /** Field whose label should open for naming (a just-added element);
   * cleared as soon as the selection moves elsewhere. */
  const [focusLabelFieldId, setFocusLabelFieldId] = useState<string | null>(null);
  const [menu, setMenu] = useState<{
    x: number;
    y: number;
    fieldId: string | null;
    canvasPoint: { x: number; y: number };
  } | null>(null);
  /** Anchor for the canvas-size popover (the footer's size eyebrow). */
  const [sizeMenuAt, setSizeMenuAt] = useState<{ x: number; y: number } | null>(null);
  /** A resize waiting on the live-link confirmation: a published template
   * with active share links never changes size silently. */
  const [pendingResize, setPendingResize] = useState<{
    next: { width: number; height: number };
    liveLinks: TemplateLink[];
  } | null>(null);
  /** The create-a-version reflow target, captured ONCE at mount (the builder
   * is keyed per template, so a mount is a load) and consumed by the load
   * effect below. A ref, not a dep: re-running the load effect after the
   * param is stripped from the URL would wipe the reflowed draft. */
  const pendingReflowRef = useRef<{ width: number; height: number } | null>(
    (() => {
      const m = /^(\d+)x(\d+)$/.exec(reflowParam ?? "");
      return m ? { width: Number(m[1]), height: Number(m[2]) } : null;
    })(),
  );
  /** Post-reflow review: every warning the reflow raised, each selectable so
   * the admin can jump to the field. Automatic reflow is a starting point,
   * not a finished layout — this panel is how the UI says that. */
  const [reflowWarnings, setReflowWarnings] = useState<RescaleWarning[] | null>(null);
  /** The 3.2 background decision, pending the admin's explicit choice. */
  const [bgReflow, setBgReflow] = useState<{
    backgroundUrl: string;
    source: { width: number; height: number };
    target: { width: number; height: number };
  } | null>(null);

  useEffect(() => {
    // A new template defaults to the company's first enabled size; the start
    // screen's picker changes it from there. Dimensions always flow
    // size → schema → renderer/export.
    if (sizesState.status !== "ready" || templateId) return;
    const first = sizesState.data[0];
    // Baseline, not an edit: establishing the canvas must not be undoable.
    if (first)
      resetHistory((d) => ({ ...d, canvasWidth: first.width, canvasHeight: first.height }));
  }, [sizesState, templateId, resetHistory]);

  /** Start-screen size pick. Same baseline rule as the default above —
   * establishing the canvas is not an undoable edit. */
  const pickCreationSize = useCallback(
    (next: { width: number; height: number }) =>
      resetHistory((d) => ({ ...d, canvasWidth: next.width, canvasHeight: next.height })),
    [resetHistory],
  );

  /** Rescale the open template in place — one history entry, so a single
   * undo restores the previous canvas. */
  const applyResize = (next: { width: number; height: number }) => {
    setSizeMenuAt(null);
    if (next.width === draft.canvasWidth && next.height === draft.canvasHeight) return;
    const { draft: rescaled, warnings } = rescaleTemplate(draft, next);
    setDraft(() => rescaled);
    setNotice(
      `Canvas resized to ${next.width}×${next.height}.` +
        (warnings.length ? ` ${warnings.map((w) => w.message).join(" ")}` : ""),
    );
    window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(null), warnings.length ? 15000 : 8000);
  };

  /** Resize entry point. A published template served through live share
   * links gets a confirmation naming them first — resizing changes what
   * every holder of those links receives, with no notice to them. */
  const requestResize = (next: { width: number; height: number }) => {
    if (next.width === draft.canvasWidth && next.height === draft.canvasHeight) {
      setSizeMenuAt(null);
      return;
    }
    if (draft.status === "published" && savedId && company && stores.publicLinks.isAvailable()) {
      void stores.publicLinks
        .list(company.id, savedId)
        .then((links) => {
          const live = links.filter((l) => linkState(l).live);
          if (live.length > 0) {
            setSizeMenuAt(null);
            setPendingResize({ next, liveLinks: live });
          } else {
            applyResize(next);
          }
        })
        .catch(() => {
          // Fail closed: without knowing who holds a live link, the resize
          // does not happen.
          setSizeMenuAt(null);
          setError("We couldn't check this template's share links, so the size wasn't changed.");
        });
      return;
    }
    applyResize(next);
  };

  useEffect(() => {
    if (templateState.status !== "ready" || !templateState.data) return;
    const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = templateState.data;
    resetHistory(rest); // loading installs a fresh baseline — no undo across it
    savedSnapshotRef.current = JSON.stringify(rest);
    // Editing an existing template: every step is already completed.
    setVisited(new Set<WizardStep>(["name", "fields", "caption", "details"]));
    setStep("fields");

    // Create-a-version handoff: the loaded template is a fresh duplicate and
    // this session reflows it to the target size as an UNSAVED change over
    // the baseline — one undo shows the copy before the reflow.
    const target = pendingReflowRef.current;
    if (!target) return;
    pendingReflowRef.current = null;
    // Strip the param so a refresh after saving can't reflow the
    // already-reflowed copy a second time.
    navigate({ name: "builder", templateId }, { replace: true });
    if (rest.canvasWidth === target.width && rest.canvasHeight === target.height) return;
    const aspectChanged = !sameAspect(
      { width: rest.canvasWidth, height: rest.canvasHeight },
      target,
    );
    const { draft: reflowed, warnings } = reflowTemplate(rest, target);
    setDraft(() => reflowed);
    setReflowWarnings(warnings);
    // An uploaded background image cannot follow an aspect change — the
    // admin picks what happens to it, never the code (3.2). Computed fills
    // (color, gradient) follow perfectly and need no decision.
    if (rest.backgroundUrl && aspectChanged) {
      setBgReflow({
        backgroundUrl: rest.backgroundUrl,
        source: { width: rest.canvasWidth, height: rest.canvasHeight },
        target,
      });
    }
    setNotice(
      `Version created at ${target.width}×${target.height} with automatic reflow applied. Review the layout, then publish.`,
    );
    window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(null), 10000);
    // pendingReflowRef is consumed here exactly once; navigate/setDraft are
    // stable for the life of this keyed mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateState, resetHistory]);

  const sourceChosen = started || Boolean(draft.backgroundUrl);
  /** Publishing needs a REAL name, not the placeholder default. */
  const hasRealName = Boolean(draft.name.trim()) && draft.name.trim() !== "Untitled template";
  const fieldsComplete = draft.fields.length > 0;
  /** Set when Publish was pressed while the name is still the default. */
  const [nameNeeded, setNameNeeded] = useState(false);
  useEffect(() => {
    if (hasRealName) setNameNeeded(false);
  }, [hasRealName]);

  const complete = useMemo(() => {
    const s = new Set<WizardStep>();
    // A real name, not just any name: the default "Untitled template" would
    // otherwise tick the final step green before it has been touched.
    if (hasRealName) s.add("name");
    if (fieldsComplete) s.add("fields");
    if (visited.has("caption")) s.add("caption");
    if (visited.has("details")) s.add("details");
    return s;
  }, [hasRealName, fieldsComplete, visited]);

  const canGo = useCallback(
    (target: WizardStep): boolean => {
      if (!sourceChosen) return false;
      if (target === "fields") return true;
      // Everything after Fields — including Name, now last — needs at least
      // one field on the canvas.
      return fieldsComplete;
    },
    [sourceChosen, fieldsComplete],
  );

  const goTo = useCallback((target: WizardStep) => {
    setStep(target);
    setVisited((v) => new Set(v).add(target));
    setMenu(null);
  }, []);

  const stepIndex = WIZARD_STEPS.findIndex((s) => s.key === step);
  const nextStep = WIZARD_STEPS[stepIndex + 1]?.key;
  const prevStep = WIZARD_STEPS[stepIndex - 1]?.key;

  // -------------------------------------------------------------------------
  // Field operations
  // -------------------------------------------------------------------------

  const setFields = useCallback(
    (fields: TemplateField[]) => setDraft((d) => ({ ...d, fields })),
    [setDraft],
  );

  const selectedFields = draft.fields.filter((f) => selectedIds.includes(f.id));
  const singleSelected = selectedFields.length === 1 ? selectedFields[0] : null;

  // -------------------------------------------------------------------------
  // Layout groups (plain groups and auto-layout stacks)
  // -------------------------------------------------------------------------

  // Builder-side layout pass over the draft (placeholder values, same as the
  // edit canvas paints): drives the overlay's group frames and computed child
  // rects, the inspector's computed geometry, and the overflow warnings. Re-
  // measures once webfonts land, like the member preview.
  const [fontsTick, setFontsTick] = useState(0);
  useEffect(() => {
    let mounted = true;
    void document.fonts?.ready.then(() => mounted && setFontsTick(1));
    return () => {
      mounted = false;
    };
  }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- fontsTick deliberately busts the cache
  const measurer = useMemo(() => createCanvasMeasurer(), [fontsTick]);

  // Worst-case preview: the inspector can fill ONE field with its longest
  // possible entry so the admin sees the sizing mode's consequence live —
  // the whole layout pass (rects, font sizes, warnings) runs on it.
  const [worstCaseFieldId, setWorstCaseFieldId] = useState<string | null>(null);
  const worstCaseValues = useMemo<FieldValues>(() => {
    const f = draft.fields.find((x) => x.id === worstCaseFieldId);
    return f && !f.static ? { [f.fieldKey]: worstCaseText(f) } : {};
  }, [worstCaseFieldId, draft.fields]);
  useEffect(() => setWorstCaseFieldId(null), [selectedIds]);

  const builderLayout = useMemo(
    () => computeLayout(draft, worstCaseValues, kit, measurer),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      draft.fields,
      draft.layoutGroups,
      draft.canvasWidth,
      draft.canvasHeight,
      worstCaseValues,
      kit,
      measurer,
    ],
  );

  const groups = useMemo(() => draft.layoutGroups ?? [], [draft.layoutGroups]);
  /** Authoring-time overflow visibility: the admin sees the worst case, not
   * the member. Overflow never clips or blocks — it warns. */
  const overflowGroupIds = useMemo(
    () => groups.filter((g) => builderLayout.groupRects.get(g.id)?.overflows).map((g) => g.id),
    [groups, builderLayout],
  );
  const layoutWarnings = useMemo(() => {
    const out = [...builderLayout.warnings];
    for (const g of groups) {
      if (builderLayout.groupRects.get(g.id)?.overflows) {
        out.push(
          `"${g.name}" extends beyond the canvas, so its content can crop on export. Shorten the content, tighten the gap, or enable "Shrink to fit".`,
        );
      }
    }
    return out;
  }, [builderLayout, groups]);
  const selGroupIds = selectedGroupIds(selectedIds);
  const selectedGroup =
    selGroupIds.length === 1 && selectedFields.length === 0
      ? (groups.find((g) => g.id === selGroupIds[0]) ?? null)
      : null;

  const patchGroup = useCallback(
    (id: string, patch: Partial<LayoutGroup>, stream = false) => {
      const gesture = inspectorGestureActive();
      setDraft(
        (d) => ({
          ...d,
          layoutGroups: (d.layoutGroups ?? []).map((g) => (g.id === id ? { ...g, ...patch } : g)),
        }),
        stream || gesture ? `patchGroup:${id}:${Object.keys(patch).sort().join(",")}` : undefined,
        gesture,
      );
    },
    [setDraft],
  );

  /** ⌘G: one history entry. Creates a PLAIN group — pure membership, nothing
   * moves — with auto layout available as a toggle in the inspector.
   * Selecting a group + fields nests the group as a child. */
  const groupSelection = useCallback(() => {
    const g = deriveFreeGroup({
      fields: draft.fields,
      groups,
      fieldIds: selectedFieldIds(selectedIds),
      groupIds: selGroupIds,
      layout: builderLayout,
      kit,
      measure: measurer,
    });
    if (!g) {
      // Silence is the worst answer to ⌘G. Say why nothing happened.
      const alreadyGrouped = draft.fields.some(
        (f) => selectedIds.includes(f.id) && outermostGroupOf(f.fieldKey, groups),
      );
      setNotice(
        alreadyGrouped
          ? "Those elements are already in a group. Ungroup them first."
          : "Select at least two elements to group them.",
      );
      window.clearTimeout(noticeTimer.current);
      noticeTimer.current = window.setTimeout(() => setNotice(null), 5000);
      return;
    }
    setDraft((d) => ({ ...d, layoutGroups: [...(d.layoutGroups ?? []), g] }));
    setSelectedIds([groupChildRef(g.id)]);
    // Three confirmations, because grouping is otherwise invisible: the
    // frame flashes on the canvas, the group is selected (so the inspector
    // shows it), and a toast names what just happened.
    setFlashGroupId(g.id);
    window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlashGroupId(null), 1600);
    setNotice(`Grouped ${g.children.length} elements as “${g.name}”`);
    window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(null), 5000);
  }, [draft.fields, groups, selectedIds, selGroupIds, builderLayout, kit, measurer, setDraft]);

  /** Commit a whole-group drag. A stack owns its children's positions, so
   * one anchor patch moves everything; a plain group's children own theirs,
   * so the delta writes through to everything that self-places — direct
   * fields of free groups get authored x/y deltas, nested stacks get their
   * anchors shifted (free frames sync their origin too). One setDraft — one
   * undo entry. */
  /** Commit a selection move: loose fields land at their new geometry and
   * every selected group is translated, in ONE draft write — a mixed
   * selection is a single undo entry, not one per element. A stack moves by
   * its anchor; a plain group moves by translating everything that
   * self-places inside it. */
  const moveSelection = useCallback(
    (
      move: {
        fields: Array<{ id: string } & Partial<TemplateField>>;
        groupIds: string[];
        dx: number;
        dy: number;
      },
      /** History key: successive nudges with the same key collapse into one
       * undo entry, the way a drag is one entry. */
      coalesceKey?: string,
    ) => {
      const { dx, dy } = move;
      setDraft((d) => {
        const all = d.layoutGroups ?? [];
        const shifted = (x: LayoutGroup) => ({
          ...x,
          x: Math.round(x.x + dx),
          y: Math.round(x.y + dy),
        });
        // Groups: the frames to translate and, for plain groups, the authored
        // fields that travel with them. Shared with alignment, so a group
        // moves the same way however it was asked to move.
        const { frameIds: subtree, fieldKeys: freeFieldKeys } = groupMoveTargets(
          move.groupIds,
          all,
        );
        const patches = new Map(move.fields.map((p) => [p.id, p]));
        return {
          ...d,
          fields: d.fields.map((f) => {
            const patch = patches.get(f.id);
            if (patch) {
              const merged = { ...f, ...patch };
              return {
                ...merged,
                x: Math.round(merged.x),
                y: Math.round(merged.y),
                width: Math.round(merged.width),
                height: Math.round(merged.height),
              };
            }
            return freeFieldKeys.has(f.fieldKey)
              ? { ...f, x: Math.round(f.x + dx), y: Math.round(f.y + dy) }
              : f;
          }),
          layoutGroups: subtree.size ? all.map((x) => (subtree.has(x.id) ? shifted(x) : x)) : all,
        };
      }, coalesceKey);
    },
    [setDraft],
  );

  /** Commit a multi-selection transform. Field geometry and any stack
   * anchors that travelled are written in ONE setDraft, so however mixed the
   * selection was the whole gesture is a single undo entry. Geometry rounds
   * to whole canvas px here and only here, exactly as commitOverrides does
   * for a single element — and fontSizePx is never in the patch, because a
   * resize changes the box and only the box. */
  const transformSelection = useCallback(
    (next: {
      fields: Array<{ id: string } & Partial<TemplateField>>;
      groups: Array<{ id: string } & Partial<LayoutGroup>>;
    }) => {
      const fieldPatches = new Map(next.fields.map((p) => [p.id, p]));
      const groupPatches = new Map(next.groups.map((p) => [p.id, p]));
      if (!fieldPatches.size && !groupPatches.size) return;
      setDraft((d) => ({
        ...d,
        fields: d.fields.map((f) => {
          const patch = fieldPatches.get(f.id);
          if (!patch) return f;
          const merged: TemplateField = { ...f, ...patch };
          merged.x = Math.round(merged.x);
          merged.y = Math.round(merged.y);
          merged.width = Math.round(merged.width);
          merged.height = Math.round(merged.height);
          if (merged.rotation !== undefined) {
            const deg = Math.round(merged.rotation) % 360;
            merged.rotation = deg === 0 ? undefined : deg;
          }
          return merged;
        }),
        layoutGroups: (d.layoutGroups ?? []).map((g) => {
          const patch = groupPatches.get(g.id);
          return patch
            ? { ...g, ...patch, x: Math.round(patch.x ?? g.x), y: Math.round(patch.y ?? g.y) }
            : g;
        }),
      }));
    },
    [setDraft],
  );

  // -------------------------------------------------------------------------
  // Align and distribute
  // -------------------------------------------------------------------------

  /** What the current selection aligns AS. A loose field is one entry at its
   * display rect; a top-level selected group is one entry at its frame, and
   * moving it writes through to exactly what a drag would move. Stack
   * children never appear — a stack owns their positions, so aligning one
   * would write a coordinate the layout pass then ignores. */
  const alignEntries = useMemo(() => {
    const entries: Array<{ box: AlignBox; fieldIds: string[]; groupIds: string[] }> = [];
    let droppedStackChildren = 0;
    for (const id of selectedFieldIds(selectedIds)) {
      const f = draft.fields.find((x) => x.id === id);
      if (!f) continue;
      const owner = groups.find((g) => g.children.includes(f.fieldKey));
      if (owner && !isFreeGroup(owner)) {
        droppedStackChildren += 1;
        continue;
      }
      const r = builderLayout.fieldRects.get(f.id);
      entries.push({
        box: {
          key: f.id,
          x: r?.x ?? f.x,
          y: r?.y ?? f.y,
          width: r?.width ?? f.width,
          height: r?.height ?? f.height,
        },
        fieldIds: [f.id],
        groupIds: [],
      });
    }
    for (const gid of selectedGroupIds(selectedIds)) {
      const g = groups.find((x) => x.id === gid);
      // Only top-level groups act under their own steam; a nested one is
      // carried by its parent.
      if (!g || parentGroupOf(g.id, groups)) continue;
      const rect = builderLayout.groupRects.get(g.id);
      if (!rect) continue;
      const { frameIds, fieldKeys } = groupMoveTargets([g.id], groups);
      entries.push({
        box: { key: groupChildRef(g.id), ...rect },
        fieldIds: draft.fields.filter((f) => fieldKeys.has(f.fieldKey)).map((f) => f.id),
        groupIds: [...frameIds],
      });
    }
    return { entries, droppedStackChildren };
  }, [selectedIds, draft.fields, groups, builderLayout]);

  /** Turn per-entry deltas into ONE draft write. It takes a pass per axis so
   * "centre on the canvas" — which moves on both — is still a single undo
   * entry. Real x/y values, through the same patch shape a move commits. */
  const applyAlignPasses = useCallback(
    (passes: Array<{ deltas: Map<string, number>; axis: Axis }>) => {
      const fieldPatch = new Map<string, { id: string } & Partial<TemplateField>>();
      const groupPatch = new Map<string, { id: string } & Partial<LayoutGroup>>();
      for (const { deltas, axis } of passes) {
        if (!deltas.size) continue;
        for (const entry of alignEntries.entries) {
          const d = deltas.get(entry.box.key);
          if (d === undefined || d === 0) continue;
          for (const id of entry.fieldIds) {
            const f = draft.fields.find((x) => x.id === id);
            if (!f) continue;
            const prev = fieldPatch.get(id) ?? { id };
            fieldPatch.set(id, {
              ...prev,
              ...(axis === "h" ? { x: (prev.x ?? f.x) + d } : { y: (prev.y ?? f.y) + d }),
            });
          }
          for (const gid of entry.groupIds) {
            const g = groups.find((x) => x.id === gid);
            if (!g) continue;
            const prev = groupPatch.get(gid) ?? { id: gid };
            groupPatch.set(gid, {
              ...prev,
              ...(axis === "h" ? { x: (prev.x ?? g.x) + d } : { y: (prev.y ?? g.y) + d }),
            });
          }
        }
      }
      if (!fieldPatch.size && !groupPatch.size) return;
      transformSelection({ fields: [...fieldPatch.values()], groups: [...groupPatch.values()] });
    },
    [alignEntries, draft.fields, groups, transformSelection],
  );

  /** Multi-selection: line up on the selection's own bounds. */
  const alignSelection = useCallback(
    (axis: Axis, edge: AlignEdge) => {
      const boxes = alignEntries.entries.map((e) => e.box);
      const bounds = boundsOf(boxes);
      if (!bounds || boxes.length < 2) return;
      applyAlignPasses([{ deltas: alignDeltas(boxes, axis, edge, bounds), axis }]);
    },
    [alignEntries, applyAlignPasses],
  );

  /** Line the selection up on the CANVAS instead — what the inspector's own
   * Align row does for one element, reachable from the context menu for any
   * selection. Both axes at once is ONE commit, not two. */
  const alignToCanvas = useCallback(
    (edges: Array<{ axis: Axis; edge: AlignEdge }>) => {
      const boxes = alignEntries.entries.map((e) => e.box);
      if (!boxes.length) return;
      const canvas = { x: 0, y: 0, width: draft.canvasWidth, height: draft.canvasHeight };
      applyAlignPasses(
        edges.map(({ axis, edge }) => ({ deltas: alignDeltas(boxes, axis, edge, canvas), axis })),
      );
    },
    [alignEntries, applyAlignPasses, draft.canvasWidth, draft.canvasHeight],
  );

  const distributeSelection = useCallback(
    (axis: Axis) => {
      const boxes = alignEntries.entries.map((e) => e.box);
      if (boxes.length < 3) return;
      applyAlignPasses([{ deltas: distributeDeltas(boxes, axis), axis }]);
    },
    [alignEntries, applyAlignPasses],
  );

  /** Everything on the canvas, as the marquee would pick it: top-level
   * entries only, so a grouped element selects its group. */
  const selectAll = useCallback(() => {
    const ids: string[] = [];
    const seen = new Set<string>();
    for (const f of draft.fields) {
      if (lockedIds.has(f.id) || hiddenIds.has(f.id)) continue;
      const outer = outermostGroupOf(f.fieldKey, groups);
      const key = outer ? groupChildRef(outer.id) : f.id;
      if (seen.has(key)) continue;
      seen.add(key);
      ids.push(key);
    }
    setSelectedIds(ids);
  }, [draft.fields, groups, lockedIds, hiddenIds]);

  /** Why the controls are off, in the admin's terms. A greyed control that
   * explains nothing is worse than no control at all. */
  const alignDisabledReason = useMemo(() => {
    const n = alignEntries.entries.length;
    if (n >= 2) return undefined;
    if (alignEntries.droppedStackChildren > 0) {
      return "Elements inside an auto-layout stack are placed by the stack. Move the stack, or turn auto layout off.";
    }
    return "Select at least two elements to align them to each other.";
  }, [alignEntries]);

  /** Aligning to the CANVAS needs only one thing to align — the ≥2 rule
   * belongs to aligning things to each other, not to the artboard. */
  const canvasAlignDisabledReason = useMemo(() => {
    if (alignEntries.entries.length >= 1) return undefined;
    if (alignEntries.droppedStackChildren > 0) {
      return "Elements inside an auto-layout stack are placed by the stack. Move the stack, or turn auto layout off.";
    }
    return "Select an element to align it to the canvas.";
  }, [alignEntries]);

  const distributeDisabledReason = useMemo(() => {
    if (alignEntries.entries.length >= 3) return undefined;
    if (alignEntries.droppedStackChildren > 0 && alignEntries.entries.length < 3) {
      return "Elements inside an auto-layout stack are spaced by the stack's gap. Change the gap to space them.";
    }
    return "Select at least three elements to space them evenly.";
  }, [alignEntries]);

  /** The inspector's Auto layout toggle. Stack → plain always applies (the
   * freeze is lossless); plain → stack simulates the conversion first and
   * asks before applying one that would visibly rearrange the composition. */
  const [pendingStack, setPendingStack] = useState<{ name: string; next: LayoutGroup } | null>(
    null,
  );
  const applyStackConversion = useCallback(
    (next: LayoutGroup) => {
      setDraft((d) => ({
        ...d,
        layoutGroups: (d.layoutGroups ?? []).map((g) => (g.id === next.id ? next : g)),
      }));
    },
    [setDraft],
  );
  const setGroupMode = useCallback(
    (id: string, nextMode: "free" | "stack") => {
      const g = groups.find((x) => x.id === id);
      if (!g || isFreeGroup(g) === (nextMode === "free")) return;
      if (nextMode === "free") {
        const res = toFreeGroup(g, draft.fields, groups, builderLayout);
        setDraft((d) => ({ ...d, fields: res.fields, layoutGroups: res.groups }));
        return;
      }
      const next = toStackGroup(g, draft.fields, groups, builderLayout, kit, measurer);
      const after = computeLayout(
        { ...draft, layoutGroups: groups.map((x) => (x.id === id ? next : x)) },
        {},
        kit,
        measurer,
      );
      // Exact simulation, not a heuristic: a roughly-stacked arrangement
      // converts within rounding; anything that would jump asks first.
      if (conversionShift(next, draft.fields, builderLayout, after, kit, measurer) > 2) {
        setPendingStack({ name: g.name, next });
      } else {
        applyStackConversion(next);
      }
    },
    [groups, draft, builderLayout, kit, measurer, setDraft, applyStackConversion],
  );

  /** ⇧⌘G: children freeze at their computed rects — also lossless. */
  const ungroupSelection = useCallback(() => {
    const targets = selGroupIds
      .map((id) => groups.find((g) => g.id === id))
      .filter((g): g is LayoutGroup => Boolean(g));
    if (!targets.length) return;
    let fields = draft.fields;
    let nextGroups = groups;
    for (const g of targets) {
      const res = ungroup(g, fields, nextGroups, builderLayout);
      fields = res.fields;
      nextGroups = res.groups;
    }
    // Fields and groups change together — exactly one undo entry.
    setDraft((d) => ({
      ...d,
      fields,
      layoutGroups: nextGroups.length ? nextGroups : undefined,
    }));
    const freedKeys = new Set(targets.flatMap((g) => g.children));
    setSelectedIds(draft.fields.filter((f) => freedKeys.has(f.fieldKey)).map((f) => f.id));
  }, [selGroupIds, groups, draft.fields, builderLayout, setDraft]);

  /** Patch one field; when the patch re-derives the merge tag, rewrite the
   * caption template so existing {old_key} references follow the rename.
   *
   * Coalescing is opt-in, not ambient: a keystroke STREAM (label input,
   * textarea — `stream` true) collapses by the time window, and a pointer
   * gesture (scrub, slider — gesture hold active) collapses for its whole
   * duration. A discrete commit — a numeric field's Enter/blur, a toggle —
   * passes no key and is exactly one undo entry, even two in quick
   * succession. */
  const patchField = useCallback(
    (id: string, patch: Partial<TemplateField>, stream = false) => {
      const gesture = inspectorGestureActive();
      setDraft(
        (d) => {
          const prev = d.fields.find((f) => f.id === id);
          const fields = d.fields.map((f) => (f.id === id ? { ...f, ...patch } : f));
          const renamed = prev && patch.fieldKey && patch.fieldKey !== prev.fieldKey;
          const captionTemplate = renamed
            ? retagCaption(d.captionTemplate, prev.fieldKey, patch.fieldKey!)
            : d.captionTemplate;
          // Group children reference fields by fieldKey — a rename follows
          // through them exactly as it does through the caption tags.
          const layoutGroups = renamed
            ? renameKeyInGroups(d.layoutGroups, prev.fieldKey, patch.fieldKey!)
            : d.layoutGroups;
          return { ...d, fields, captionTemplate, layoutGroups };
        },
        stream || gesture ? `patch:${id}:${Object.keys(patch).sort().join(",")}` : undefined,
        gesture,
      );
    },
    [setDraft],
  );

  const maxZ = (fields: TemplateField[]) => fields.reduce((m, f) => Math.max(m, f.zIndex ?? 0), 0);

  /** A drawn box becomes the ACTIVE TOOL's element. Text keeps the original
   * raw-box path; every other tool routes through the same palette factory
   * the palette itself uses and then takes the drawn rect — a tool is only
   * ever a way to place an element that already exists. */
  const addDrawnField = (
    rect: { x: number; y: number; width: number; height: number },
    drawTool: BuilderTool,
    fromClick: boolean,
  ) => {
    if (!toolLocked) setTool("move");
    if (drawTool !== "text" && drawTool !== "move") {
      const paletteId = TOOL_PALETTE_ID[drawTool];
      // A click places the element at its own size on the point; a drag
      // sizes it to the box that was drawn.
      if (fromClick) {
        addPaletteField(paletteId, { x: rect.x, y: rect.y });
        return;
      }
      const item = PALETTE_ITEMS.find((p) => p.id === paletteId);
      if (!item) return;
      const canvas = { width: draft.canvasWidth, height: draft.canvasHeight };
      const base = fieldFromPalette(
        item,
        { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 },
        draft.fields,
        kit,
        canvas,
      );
      const field: TemplateField = { ...base, ...rect };
      setFields([...draft.fields, field]);
      setSelectedIds([field.id]);
      if (item.type !== "shape") setFocusLabelFieldId(field.id);
      return;
    }
    if (fromClick) {
      addPaletteField("text", { x: rect.x, y: rect.y });
      return;
    }
    const label = `Field ${draft.fields.length + 1}`;
    const field: TemplateField = {
      id: newId(),
      label,
      fieldKey: suggestFieldKey(label, draft.fields),
      type: "text",
      ...rect,
      zIndex: maxZ(draft.fields) + 1,
      fontFamily: kit?.headingFont?.family,
      fontSizePx: Math.max(18, Math.min(90, Math.round(rect.height * 0.55))),
      colorHex: kit?.colors.find((c) => c.key === "text")?.hex ?? kit?.colors[0]?.hex,
      align: "left",
      textSizing: "shrink",
    };
    setFields([...draft.fields, field]);
    setSelectedIds([field.id]);
    setFocusLabelFieldId(field.id);
  };

  const logoAssets = useMemo(() => brandAssets.filter((a) => a.kind === "logo"), [brandAssets]);
  /** Natural pixel size per logo asset, warmed as soon as the logos are known
   * so a drop can size its box to the artwork synchronously. A drop that
   * beats the measurement lands in a square box and is re-fit the moment the
   * real dimensions arrive (below, in addPaletteField). */
  const logoDimsRef = useRef(new Map<string, { width: number; height: number }>());

  /** The artwork's true pixel size, or null when it can't be known. SVGs are
   * measured from their own markup — the browser reports the 300×150
   * replaced-element fallback for an SVG without width/height attributes,
   * which is not the artwork and must never size a box. Rasters measure via
   * Image, guarding the 0×0 error case. */
  const measureLogoAsset = useCallback(
    async (asset: {
      url: string;
      name: string;
    }): Promise<{ width: number; height: number } | null> => {
      try {
        if (isSvgSource(asset.name) || isSvgSource(asset.url)) {
          const text = await (await fetch(asset.url)).text();
          return svgIntrinsicSize(text);
        }
        return await new Promise((resolve) => {
          const img = new Image();
          img.onload = () =>
            resolve(
              img.naturalWidth > 0 && img.naturalHeight > 0
                ? { width: img.naturalWidth, height: img.naturalHeight }
                : null,
            );
          img.onerror = () => resolve(null);
          img.src = asset.url;
        });
      } catch {
        return null;
      }
    },
    [],
  );

  useEffect(() => {
    for (const asset of logoAssets) {
      if (logoDimsRef.current.has(asset.id)) continue;
      void measureLogoAsset(asset).then((dims) => {
        if (dims) logoDimsRef.current.set(asset.id, dims);
      });
    }
  }, [logoAssets, measureLogoAsset]);

  /** Primary path: a palette element dropped (or clicked) onto the canvas —
   * pre-sized, pre-typed; fields immediately open for naming (shapes don't
   * need a name — they're design-only, and neither do logos — the asset
   * name is already right). */
  const addPaletteField = (paletteId: string, at?: { x: number; y: number }) => {
    const canvas = { width: draft.canvasWidth, height: draft.canvasHeight };
    // A drop lands where it was released. A CLICK aims at the canvas center
    // every time, so it cascades off whatever is already sitting there.
    const item = PALETTE_ITEMS.find((p) => p.id === paletteId);
    const point = at
      ? at
      : cascadePoint(
          { x: canvas.width / 2, y: canvas.height / 2 },
          draft.fields,
          canvas,
          item ? { width: item.width, height: item.height } : undefined,
        );
    if (paletteId.startsWith(LOGO_PALETTE_PREFIX)) {
      const asset = logoAssets.find((a) => a.id === paletteId.slice(LOGO_PALETTE_PREFIX.length));
      if (!asset) return;
      const known = logoDimsRef.current.get(asset.id) ?? null;
      const field = logoFieldFromAsset(asset, known, point, draft.fields, canvas);
      setFields([...draft.fields, field]);
      setSelectedIds([field.id]);
      if (!known) {
        // The drop beat the measurement: the box landed square. Re-fit it to
        // the artwork when the true dimensions arrive — but only while the
        // admin hasn't touched its geometry; their own edit always wins.
        void measureLogoAsset(asset).then((dims) => {
          if (!dims) return;
          logoDimsRef.current.set(asset.id, dims);
          setDraft((d) => {
            const cur = d.fields.find((f) => f.id === field.id);
            if (
              !cur ||
              cur.x !== field.x ||
              cur.y !== field.y ||
              cur.width !== field.width ||
              cur.height !== field.height
            ) {
              return d;
            }
            const refit = logoFieldFromAsset(
              asset,
              dims,
              point,
              d.fields.filter((f) => f.id !== field.id),
              canvas,
            );
            return {
              ...d,
              fields: d.fields.map((f) =>
                f.id === field.id
                  ? {
                      ...cur,
                      x: refit.x,
                      y: refit.y,
                      width: refit.width,
                      height: refit.height,
                      aspectRatio: refit.aspectRatio,
                    }
                  : f,
              ),
            };
          });
        });
      }
      return;
    }
    if (!item) return;
    const field = fieldFromPalette(item, point, draft.fields, kit, canvas);
    setFields([...draft.fields, field]);
    setSelectedIds([field.id]);
    if (item.type !== "shape") setFocusLabelFieldId(field.id);
  };

  // -------------------------------------------------------------------------
  // Paste & drop onto the canvas: image files (paste or drag from disk),
  // Figma layer links (element-level import), and plain text. Everything
  // lands as a FIXED element — same philosophy as import.
  // -------------------------------------------------------------------------

  /** Fixed image elements from files: upload (Storage in prod, data URL in
   * dev), measure the natural size, land at the point — cascaded a little
   * when several arrive together. */
  const addImageFiles = async (files: File[], at: { x: number; y: number }) => {
    if (!company) return;
    const canvas = { width: draft.canvasWidth, height: draft.canvasHeight };
    const created: TemplateField[] = [];
    for (const [i, file] of files.entries()) {
      if (!file.type.startsWith("image/")) continue;
      try {
        const url = await stores.templates.uploadBackground(company.id, file, file.name);
        let natural: { width: number; height: number } | null = null;
        if (file.type === "image/svg+xml") {
          // createImageBitmap rejects SVG files in several browsers, and the
          // Image fallback reports 300×150 for dimensionless documents — the
          // markup itself is the only trustworthy source.
          try {
            natural = svgIntrinsicSize(await file.text());
          } catch {
            natural = null;
          }
        } else {
          try {
            const bmp = await createImageBitmap(file);
            natural = { width: bmp.width, height: bmp.height };
            bmp.close();
          } catch {
            natural = null;
          }
        }
        created.push(
          imageFieldFromUpload(
            url,
            file.name,
            natural,
            { x: at.x + i * 24, y: at.y + i * 24 },
            [...draft.fields, ...created],
            canvas,
          ),
        );
      } catch (e) {
        console.error("Image drop upload failed", e);
        setError("Couldn't add that image. Try again, or upload it from the inspector.");
      }
    }
    if (!created.length) return;
    // Append to whatever the draft is NOW, not to the array captured before
    // the upload: anything the admin moved or typed while it was in flight
    // would otherwise be silently reverted.
    setDraft((d) => ({ ...d, fields: [...d.fields, ...created] }));
    setSelectedIds(created.map((f) => f.id));
  };

  /** A pasted Figma layer link becomes live elements at the paste point —
   * text and images as fixed fields, everything else as rendered pieces,
   * in exact paint order. Needs the Supabase backend + Figma connection. */
  const importElementsAt = async (url: string, at: { x: number; y: number }) => {
    if (!company) return;
    if (!stores.designImport.isConfigured()) {
      setError("Pasting Figma layers needs the Supabase backend with Figma connected.");
      return;
    }
    setNotice("Importing that Figma layer…");
    try {
      const result = await stores.designImport.importElementsFromUrl(company.id, url);
      const fields = assembleElementFields(result, at, draft.fields, {
        width: draft.canvasWidth,
        height: draft.canvasHeight,
      });
      setFields([...draft.fields, ...fields]);
      setSelectedIds(fields.map((f) => f.id));
      const missingFonts = unavailableFamilies(
        fields,
        brandAssets.filter((a) => a.kind === "font"),
      );
      setNotice(
        `${fields.length} element${fields.length !== 1 ? "s" : ""} pasted from Figma, all fixed. Turn off Fixed on anything members should fill in.` +
          (missingFonts.length
            ? ` Fonts not available here: ${missingFonts.join(", ")}. Upload them in Brand Studio.`
            : ""),
      );
      window.clearTimeout(noticeTimer.current);
      noticeTimer.current = window.setTimeout(() => setNotice(null), 8000);
      if (result.warnings.length) setError(result.warnings.join(" "));
    } catch (e) {
      setNotice(null);
      setError(e instanceof Error ? e.message : "Couldn't import that Figma layer.");
    }
  };

  // System-clipboard paste. The internal field clipboard (copied canvas
  // elements) owns ⌘V when it has content — this handler covers what the
  // OS clipboard brings in from outside.
  useEffect(() => {
    if (!started || mode !== "edit") return;
    const onPaste = (e: ClipboardEvent) => {
      if (isTypingTarget(e as unknown as KeyboardEvent)) return;
      if (clipboardHasFields()) return;
      const dt = e.clipboardData;
      if (!dt) return;
      const center = { x: draft.canvasWidth / 2, y: draft.canvasHeight / 2 };
      const image = Array.from(dt.items)
        .find((i) => i.type.startsWith("image/"))
        ?.getAsFile();
      if (image) {
        e.preventDefault();
        void addImageFiles([image], center);
        return;
      }
      const text = dt.getData("text/plain").trim();
      if (!text) return;
      e.preventDefault();
      if (isFigmaNodeUrl(text)) {
        void importElementsAt(text, center);
        return;
      }
      const field = textFieldFromPaste(text, center, draft.fields, kit, {
        width: draft.canvasWidth,
        height: draft.canvasHeight,
      });
      setFields([...draft.fields, field]);
      setSelectedIds([field.id]);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  });

  // The naming focus applies only while the just-added field stays the sole
  // selection; any other selection clears it.
  useEffect(() => {
    if (!focusLabelFieldId) return;
    if (selectedIds.length !== 1 || selectedIds[0] !== focusLabelFieldId) {
      setFocusLabelFieldId(null);
    }
  }, [selectedIds, focusLabelFieldId]);

  /** Arrow-key nudge: 1 canvas px, shift ×10. A rapid streak of presses
   * coalesces into one undo entry (the time window); spaced, deliberate
   * nudges stay separate steps. */
  /** Arrow-key nudge. Routed through the same translation as a drag, so a
   * plain group moves its children (its frame is their bounding box, not an
   * authored coordinate) and a stack child is skipped rather than having a
   * coordinate written that the layout pass will ignore. Coalesced into one
   * history entry per burst of key presses. */
  const nudgeFields = useCallback(
    (ids: string[], dx: number, dy: number) => {
      const movableFieldIds = selectedFieldIds(ids).filter((id) => {
        const f = draftRef.current.fields.find((x) => x.id === id);
        if (!f) return false;
        const g = (draftRef.current.layoutGroups ?? []).find((grp) =>
          grp.children.includes(f.fieldKey),
        );
        return !g || isFreeGroup(g); // a stack owns its children's positions
      });
      const groupIds = selectedGroupIds(ids);
      if (!movableFieldIds.length && !groupIds.length) return;
      const fields = movableFieldIds.map((id) => {
        const f = draftRef.current.fields.find((x) => x.id === id)!;
        return { id, x: f.x + dx, y: f.y + dy };
      });
      moveSelection({ fields, groupIds, dx, dy }, `nudge:${ids.join(",")}`);
    },
    [moveSelection],
  );

  const deleteFields = useCallback(
    (ids: string[]) => {
      if (!ids.length) return;
      // A selected GROUP deletes with everything in it (nested included) —
      // Figma semantics; a selected field also leaves any group it was in.
      const allGroups = draftRef.current.layoutGroups ?? [];
      const gids = groupIdsWithin(selectedGroupIds(ids), allGroups);
      const idSet = new Set([
        ...selectedFieldIds(ids),
        ...fieldIdsInGroups(gids, draftRef.current.fields, allGroups),
      ]);
      setDraft((d) => {
        const deletedKeys = d.fields.filter((f) => idSet.has(f.id)).map((f) => f.fieldKey);
        return {
          ...d,
          fields: d.fields.filter((f) => !idSet.has(f.id)),
          layoutGroups: stripFieldsFromGroups(
            d.layoutGroups?.filter((g) => !gids.includes(g.id)),
            deletedKeys,
          ),
        };
      });
      const gidRefs = new Set(gids.map(groupChildRef));
      setSelectedIds((sel) => sel.filter((id) => !idSet.has(id) && !gidRefs.has(id)));
    },
    [setDraft],
  );

  const copyFields = useCallback(
    (ids: string[]) => copyToClipboard(draft.fields.filter((f) => ids.includes(f.id))),
    [draft.fields],
  );

  const cutFields = useCallback(
    (ids: string[]) => {
      copyFields(ids);
      deleteFields(ids);
    },
    [copyFields, deleteFields],
  );

  const pasteFields = useCallback(
    (at?: { x: number; y: number }) => {
      const pasted = pasteFromClipboard(draft.fields, at);
      if (!pasted.length) return;
      setFields([...draft.fields, ...pasted]);
      setSelectedIds(pasted.map((f) => f.id));
    },
    [draft.fields, setFields],
  );

  /** Copy style lifts the LOOK of one element (the first selected — style is
   * singular); paste style dresses every selected element in it. */
  const copyStyleFrom = useCallback(
    (ids: string[]) => {
      const source = draft.fields.find((f) => ids.includes(f.id));
      if (source) copyStyle(source);
    },
    [draft.fields],
  );

  const pasteStyleTo = useCallback(
    (ids: string[]) => {
      if (!clipboardHasStyle()) return;
      setFields(draft.fields.map((f) => (ids.includes(f.id) ? applyClipboardStyle(f) : f)));
    },
    [draft.fields, setFields],
  );

  const duplicateSelected = useCallback(
    (ids: string[]) => {
      const targets = draft.fields.filter((f) => ids.includes(f.id));
      const dups = duplicateFields(targets, draft.fields);
      if (!dups.length) return;
      setFields([...draft.fields, ...dups]);
      setSelectedIds(dups.map((f) => f.id));
    },
    [draft.fields, setFields],
  );

  /** The Layers panel's drag. Writes zIndex and only zIndex — the fields
   * array (form order) and every group's children (stack order) are left
   * exactly as they were. */
  const setPaintOrder = useCallback(
    (backToFront: string[]) => setFields(applyPaintOrder(draft.fields, backToFront)),
    [draft.fields, setFields],
  );

  /** Rename from the Layers panel. `label` and nothing else: fieldKey is the
   * merge tag the caption template references, and renaming what an admin
   * calls something must never silently re-point a caption. */
  const renameField = useCallback(
    (id: string, label: string) => patchField(id, { label }),
    [patchField],
  );

  const reorderLayer = useCallback(
    (ids: string[], where: "front" | "back") => setFields(setLayerOrder(draft.fields, ids, where)),
    [draft.fields, setFields],
  );

  /** Bulk Fixed toggle over a selection — the recovery move after an import
   * lands twenty elements. Shapes are excluded (always fixed by definition)
   * and dropdowns too (they exist only as member inputs); both match what the
   * inspector's own checkbox allows. Patches mirror the inspector exactly so
   * a bulk toggle and a one-at-a-time toggle produce identical fields. */
  const setFixed = useCallback(
    (ids: string[], fixed: boolean) => {
      const idSet = new Set(ids);
      const eligible = (f: TemplateField) =>
        idSet.has(f.id) && f.type !== "shape" && f.type !== "select";
      setFields(
        draft.fields.map((f) =>
          eligible(f)
            ? fixed
              ? {
                  ...f,
                  static: true,
                  required: undefined,
                  placeholder: undefined,
                  maxLength: undefined,
                }
              : { ...f, static: undefined, staticValue: undefined }
            : f,
        ),
      );
    },
    [draft.fields, setFields],
  );

  // Keyboard shortcuts on the Fields step: ⌘/Ctrl C, X, V, D, Delete, Escape.
  // Never fire while typing in an input.
  useEffect(() => {
    if (step !== "fields" || mode !== "edit") return;
    const handler = (e: KeyboardEvent) => {
      if (isTypingTarget(e)) return; // native text undo stays native
      // Mid-drag the canvas owns the pointer AND the keyboard: deleting or
      // undoing the element under an active gesture would strand it.
      // (Escape cancels the drag inside the gesture core and never lands here.)
      if (canvasGestureActive()) return;
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();
      if (mod && key === "z" && !e.shiftKey) {
        e.preventDefault();
        doUndo();
      } else if ((mod && key === "z" && e.shiftKey) || (mod && key === "y")) {
        e.preventDefault();
        doRedo();
      } else if (mod && e.altKey && e.code === "KeyC" && selectedIds.length) {
        // Style shortcuts match on e.code and run BEFORE plain copy/paste:
        // macOS ⌥C reports e.key "ç", and Windows Ctrl+Alt+C keeps e.key "c",
        // which would otherwise fall into the plain-copy branch.
        e.preventDefault();
        copyStyleFrom(selectedIds);
      } else if (
        mod &&
        e.altKey &&
        e.code === "KeyV" &&
        selectedIds.length &&
        clipboardHasStyle()
      ) {
        e.preventDefault();
        pasteStyleTo(selectedIds);
      } else if (mod && key === "c" && !e.altKey && selectedIds.length) {
        e.preventDefault();
        copyFields(selectedIds);
      } else if (mod && key === "x" && selectedIds.length) {
        e.preventDefault();
        cutFields(selectedIds);
      } else if (mod && key === "v" && !e.altKey && clipboardHasFields()) {
        e.preventDefault();
        pasteFields();
      } else if (mod && key === "a" && !e.altKey && draft.fields.length) {
        e.preventDefault();
        selectAll();
      } else if (mod && key === "d" && selectedIds.length) {
        e.preventDefault();
        duplicateSelected(selectedIds);
      } else if (mod && key === "g" && !e.shiftKey && selectedIds.length >= 2) {
        e.preventDefault();
        groupSelection();
      } else if (mod && key === "g" && e.shiftKey && selectedGroupIds(selectedIds).length) {
        e.preventDefault();
        ungroupSelection();
      } else if ((e.key === "Delete" || e.key === "Backspace") && selectedIds.length) {
        e.preventDefault();
        deleteFields(selectedIds);
      } else if (!mod && e.key.startsWith("Arrow") && selectedIds.length) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        if (dx || dy) nudgeFields(selectedIds, dx, dy);
      } else if (e.key === "Escape") {
        // A live tool is the first thing Escape puts down; only once Move is
        // active again does Escape mean "deselect".
        if (tool !== "move") {
          setTool("move");
          setToolLocked(false);
        } else {
          setSelectedIds([]);
        }
      } else if (!mod && e.key === "?") {
        e.preventDefault();
        setShortcutsOpen((open) => !open);
      } else if (!mod && !e.altKey && TOOL_KEYS[e.code]) {
        // Shift LOCKS the tool for repeated draws; plain is one draw and
        // back to Move. Every other modifier belongs to another shortcut.
        e.preventDefault();
        setTool(TOOL_KEYS[e.code]);
        setToolLocked(e.shiftKey && TOOL_KEYS[e.code] !== "move");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    step,
    mode,
    selectedIds,
    copyFields,
    cutFields,
    pasteFields,
    copyStyleFrom,
    pasteStyleTo,
    duplicateSelected,
    deleteFields,
    nudgeFields,
    doUndo,
    doRedo,
    groupSelection,
    ungroupSelection,
    selectAll,
    draft.fields.length,
    tool,
  ]);

  // -------------------------------------------------------------------------
  // Source, save, publish
  // -------------------------------------------------------------------------

  const onDropBackground = useCallback(
    async (accepted: File[]) => {
      const file = accepted[0];
      if (!file || !company) return;
      setUploading(true);
      setError(null);
      try {
        const url = await stores.templates.uploadBackground(company.id, file, file.name);
        setDraft((d) => ({ ...d, backgroundUrl: url }));
      } catch (e) {
        console.error("Background upload failed", e);
        setError("Background upload failed. Check your storage configuration.");
      } finally {
        setUploading(false);
      }
    },
    [company, setDraft],
  );

  /** Both background-upload labels double as drag targets (never visible at
   * the same time, so one hook serves both). */
  const bgDrop = useFileDrop((files) => void onDropBackground(files));

  /** Latest draft, readable from timer closures without staleness. */
  const draftRef = useRef(draft);
  draftRef.current = draft;
  /** One save at a time — also the guard against a double CREATE racing on a
   * brand-new template. */
  const saveInFlight = useRef(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  // Keeps "Saved N minutes ago" honest without any other state changing.
  const [nowTick, setNowTick] = useState(0);
  useEffect(() => {
    if (lastSavedAt === null) return;
    const iv = window.setInterval(() => setNowTick((t) => t + 1), 30_000);
    return () => window.clearInterval(iv);
  }, [lastSavedAt]);

  const doSave = async (status: "draft" | "published" | undefined, quiet: boolean) => {
    if (!company || saveInFlight.current) return null;
    saveInFlight.current = true;
    setSaving(true);
    if (!quiet) setError(null);
    const snapshot = draftRef.current;
    try {
      const payload: NewTemplateInput = {
        ...snapshot,
        companyId: company.id,
        status: status ?? snapshot.status,
        name: snapshot.name.trim() || "Untitled template",
      };
      const saved = savedId
        ? await stores.templates.update(savedId, payload)
        : await stores.templates.create(payload);
      setSavedId(saved.id);
      setLastSavedAt(Date.now());
      setSaveFailed(false);
      setError(null);
      if (quiet) {
        // Autosave: the store now matches what was sent; history stays —
        // undoing past an autosave is safe because the undone state simply
        // autosaves again (field rows are replaced wholesale on save).
        savedSnapshotRef.current = JSON.stringify({ ...snapshot, status: saved.status });
      } else {
        // A deliberate save/publish is a history boundary.
        resetHistory((d) => {
          const next = { ...d, status: saved.status };
          savedSnapshotRef.current = JSON.stringify(next);
          return next;
        });
      }
      return saved;
    } catch (e) {
      console.error("Save failed", e);
      // A silent autosave failure looks exactly like "the app isn't saving",
      // which is how the check-constraint bug hid. Say what happened, and
      // say it the same way whether the save was automatic or deliberate.
      setError(saveErrorMessage(e));
      if (quiet) setSaveFailed(true);
      return null;
    } finally {
      saveInFlight.current = false;
      setSaving(false);
    }
  };

  const save = (status?: "draft" | "published") => doSave(status, false);

  /** Create a version for another platform: save (so the copy carries the
   * latest edits), duplicate — the original is never touched — and open the
   * copy with the reflow handoff in the route. The reflow itself happens on
   * load, as an unsaved change the admin reviews. */
  const requestVersion = async (next: { width: number; height: number }) => {
    setSizeMenuAt(null);
    const saved = await save();
    if (!saved) return; // save() already surfaced the error
    try {
      const copy = await stores.templates.duplicate(saved.id, versionName(saved.name, next));
      navigate({
        name: "builder",
        templateId: copy.id,
        reflow: `${next.width}x${next.height}`,
      });
    } catch (e) {
      console.error("Version create failed", e);
      setError("We couldn't create the version. Try again.");
    }
  };

  // Warn on close/reload while the draft differs from what's saved. The
  // default name alone is not content — an untouched blank canvas should
  // neither warn nor autosave.
  const dirty =
    Boolean(draft.backgroundUrl || draft.fields.length || hasRealName) &&
    JSON.stringify(draft) !== savedSnapshotRef.current;
  useUnsavedChangesWarning(dirty);

  // Autosave drafts ~2s after the last change. Published templates NEVER
  // autosave — those keep the explicit save and the unsaved indicator.
  // Failures keep the work in state and retry on the next change.
  useEffect(() => {
    if (!sourceChosen || draft.status !== "draft" || !dirty) return;
    const timer = window.setTimeout(function fire() {
      if (saveInFlight.current) {
        // A save is mid-flight; try again shortly rather than dropping the
        // trailing edit.
        window.setTimeout(fire, 1000);
        return;
      }
      if (JSON.stringify(draftRef.current) === savedSnapshotRef.current) return;
      void doSave(undefined, true);
    }, 2000);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, dirty, sourceChosen]);

  /** Publish: processing indicator → success marker → back to Templates
   * page (create new / edit existing). */
  const publish = async () => {
    if (!hasRealName) {
      // Name at the end is fine — but published templates need a real one.
      setNameNeeded(true);
      goTo("name"); // the name input autofocuses on mount
      return;
    }
    setPublishState("publishing");
    const saved = await save("published");
    if (!saved) {
      setPublishState("idle"); // save() already surfaced the error
      return;
    }
    setPublishState("success");
    // Publishing sends work to the world — the one moment loud enough for
    // confetti (brand primitives; motion from the BYQ gem, styling ours).
    celebrate(document.activeElement instanceof Element ? document.activeElement : null);
    window.setTimeout(() => navigate({ name: "adminTemplates" }), 1400);
  };

  const previewSchema: TemplateSchema = useMemo(
    () => ({
      ...draft,
      id: savedId ?? "preview",
      createdAt: "",
      updatedAt: "",
    }),
    [draft, savedId],
  );

  // -------------------------------------------------------------------------
  // Figma import
  // -------------------------------------------------------------------------

  /** Shared landing for every import path: merge the incoming fields into the
   * draft with unique keys and stacked z-indexes, enter the wizard, announce
   * what happened, and lift the imported elements off the background.
   *
   * There is no pre-selection step: deciding what should be member-editable
   * before seeing the frame is a decision made with the least information
   * available. The proposal — human or model — lands as real fields and the
   * admin corrects in context. */
  const landImport = (opts: {
    backgroundUrl: string;
    canvasWidth: number;
    canvasHeight: number;
    sourceUrl?: string;
    /** The (pruned) node tree the import walked — forwarded to the layered
     * re-render so both passes decompose one consistent snapshot. */
    tree?: unknown;
    fields: TemplateField[];
    /** How to key each incoming field against what already exists. */
    fieldKeyFor(field: TemplateField, existing: TemplateField[]): string;
    /** Extra draft patch, computed AFTER keys are final (caption tags need
     * the surviving keys). */
    patch?(imported: TemplateField[]): Partial<NewTemplateInput>;
    summary(imported: TemplateField[]): string;
  }): TemplateField[] => {
    // Computed OUTSIDE the setDraft updater: updaters run at render time (and
    // twice under StrictMode), so pushing into `imported` there would leave it
    // empty for the recomposition below and duplicate every field in dev.
    const existing = [...draft.fields];
    let z = maxZ(existing);
    const imported = opts.fields.map((f) => {
      const next: TemplateField = { ...f, fieldKey: opts.fieldKeyFor(f, existing), zIndex: ++z };
      existing.push(next);
      return next;
    });
    const patch = opts.patch?.(imported) ?? {};
    setDraft((d) => ({
      ...d,
      ...patch,
      backgroundUrl: opts.backgroundUrl,
      canvasWidth: opts.canvasWidth,
      canvasHeight: opts.canvasHeight,
      fields: [...d.fields, ...imported],
    }));
    // A successful import IS a chosen source, even if the background render
    // came back empty — without this the wizard stays on the source screen
    // with the imported fields invisible behind it.
    setStarted(true);
    setMode("edit");
    // Fields is Step 1; Name comes last in the wizard.
    goTo("fields");

    // A designed template that silently falls back to system faces reads as
    // a broken import — name the missing families and the fix. Text in a
    // missing family also stays BAKED in the background plate (see
    // recomposeBackground): pixel-exact Figma glyphs beat a reflow into a
    // fallback face, and the field on top becomes right once the font lands.
    const missingFonts = unavailableFamilies(
      imported,
      brandAssets.filter((a) => a.kind === "font"),
    );
    const fontNote = missingFonts.length
      ? ` Fonts not available here: ${missingFonts.join(", ")}. That text shows its Figma render until you upload them in Brand Studio.`
      : "";

    // An import sizes the canvas from the frame, not from the picker — said
    // out loud rather than silently replacing the admin's choice.
    const sizeNote =
      opts.canvasWidth !== draft.canvasWidth || opts.canvasHeight !== draft.canvasHeight
        ? ` Canvas set to the frame's own size, ${opts.canvasWidth}×${opts.canvasHeight}.`
        : "";
    setNotice(opts.summary(imported) + sizeNote + fontNote);
    window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(null), 8000);

    recomposeBackground(opts.sourceUrl, imported, opts.tree, missingFonts);
    return imported;
  };

  /** The import report's degraded half: which layers survived only
   * approximately, named so the admin can fix them in Figma and re-import
   * instead of guessing. */
  const degradedReport = (details: ImportIssue[] | undefined): string | null => {
    const degraded = (details ?? []).filter((d) => d.severity === "degraded");
    if (!degraded.length) return null;
    if (degraded.length === 1) {
      return `"${degraded[0].layer}" couldn't import exactly: ${degraded[0].issue}`;
    }
    const names = [...new Set(degraded.map((d) => `"${d.layer}"`))];
    return `${degraded.length} things couldn't import exactly: ${names.slice(0, 6).join(", ")}${
      names.length > 6 ? ` and ${names.length - 6} more` : ""
    }. Fix them in Figma and re-import for an exact match.`;
  };

  /** Every detected element lands FIXED, exactly as designed — the admin
   * opts elements IN to being member fields by turning Fixed off. Counts
   * from the data, never hardcoded. */
  const applyImport = (result: DesignImportResult) => {
    landImport({
      backgroundUrl: result.backgroundUrl,
      canvasWidth: result.canvasWidth,
      canvasHeight: result.canvasHeight,
      sourceUrl: result.sourceUrl,
      tree: result.tree,
      fields: result.suggestedFields,
      fieldKeyFor: (f, existing) => suggestFieldKey(f.label, existing),
      summary: (imported) =>
        imported.length === 0
          ? "Nothing was detected, but the background imported. Draw fields on the canvas."
          : `${imported.length} element${imported.length !== 1 ? "s" : ""} imported, all fixed and exactly as designed. Select the elements members should fill in and turn off Fixed.`,
    });
    // The import report: the dialog closes on success, so anything that
    // degraded must surface here or the admin never learns what to fix.
    const report = degradedReport(result.warningDetails);
    if (report) setError(report);
  };

  /** Claude's proposal lands exactly like a manual import — fields with
   * label, type, Fixed marks, guardrails, and brand bindings already set —
   * plus the template metadata, pre-filling the wizard's later steps without
   * bypassing them. */
  const applyAutoBuild = (result: AutoBuildResult) => {
    setAutoBuildOpen(false);
    landImport({
      backgroundUrl: result.backgroundUrl,
      canvasWidth: result.canvasWidth,
      canvasHeight: result.canvasHeight,
      sourceUrl: result.sourceUrl,
      fields: result.fields,
      // Keep Claude's keys (the caption's merge tags reference them); only a
      // clash with fields already in the draft forces a re-key.
      fieldKeyFor: (f, existing) =>
        existing.some((e) => e.fieldKey === f.fieldKey)
          ? suggestFieldKey(f.label, existing)
          : f.fieldKey,
      patch: (imported) => {
        // Re-point caption tags at any re-keyed fields so they still resolve.
        let caption = result.template.captionTemplate;
        result.fields.forEach((f, i) => {
          const finalKey = imported[i]?.fieldKey;
          if (finalKey && finalKey !== f.fieldKey) {
            caption = caption.split(`{${f.fieldKey}}`).join(`{${finalKey}}`);
          }
        });
        const meta = { ...result.meta, rationale: result.rationale };
        // Fill, don't clobber: a mid-build auto-build must not overwrite the
        // name or caption the admin already wrote.
        return {
          name:
            draft.name.trim() && draft.name !== "Untitled template"
              ? draft.name
              : result.template.name,
          description: draft.description.trim() ? draft.description : result.template.description,
          category: draft.category.trim() ? draft.category : result.template.category,
          tags: draft.tags.length ? draft.tags : result.template.tags,
          captionTemplate: draft.captionTemplate.trim() ? draft.captionTemplate : caption,
          autobuildMeta: meta,
        };
      },
      summary: (imported) => {
        const editable = imported.filter((f) => !f.static).length;
        return `${imported.length} element${imported.length !== 1 ? "s" : ""} imported. Claude made ${editable} editable and marked ${imported.length - editable} fixed. Change anything in the inspector.`;
      },
    });
    if (result.warnings.length) setError(result.warnings.join(" "));
  };

  /** Lift the imported elements OFF the background: re-render the frame
   * without them and swap in the recomposed PNG. On any failure the flat
   * render stays (fields overlay their baked twins).
   *
   * Runs for every import path, auto-build included: excludeIds derives from
   * every imported field, Fixed ones too — a Fixed element is a live object
   * on the canvas, so leaving it in the plate would render it twice. */
  const recomposeBackground = (
    sourceUrl: string | undefined,
    imported: TemplateField[],
    tree?: unknown,
    missingFonts: string[] = [],
  ) => {
    //
    // The invariant that matters: every id excluded from the background must
    // belong to a field in the draft. An id lifted off the background with no
    // field behind it makes the element VANISH — worse than the old failure
    // mode, where a failed lift merely showed a duplicate. `excludeIds` is
    // therefore derived from `imported`, the exact array merged into the
    // draft above, never from `result.suggestedFields` — the two differ the
    // moment a merge drops or rewrites an entry.
    //
    // Text in a font this workspace can't render is the one deliberate
    // exception: it stays BAKED in the plate (not excluded), because lifting
    // it would re-typeset the design into a fallback face. The field still
    // exists on top for editing; once the font is uploaded a re-import
    // lands it live.
    //
    // This runs ONCE per import. Toggling Fixed later never re-renders the
    // background: a Fixed element stays a live object on the canvas, so the
    // plate underneath it has no reason to change.
    const missing = new Set(missingFonts);
    const lifted = imported.filter(
      (f) => Boolean(f.sourceNodeId) && !(f.fontFamily && missing.has(f.fontFamily)),
    );
    const excludeIds = lifted.map((f) => f.sourceNodeId).filter((id): id is string => Boolean(id));
    if (company && sourceUrl && excludeIds.length) {
      setRecomposing(true);
      void (async () => {
        try {
          const layers = await stores.designImport.renderLayers(
            company.id,
            sourceUrl,
            excludeIds,
            tree,
          );
          const blob = await composeFigmaBackground(layers);
          const bgUrl = await stores.templates.uploadBackground(
            company.id,
            blob,
            "figma-composed.png",
          );
          setDraft((d) => {
            // Undo guard: recomposition takes seconds (Figma render + upload),
            // and ⌘Z during that window reverts the whole import — fields AND
            // flat background. Swapping in the stripped plate then would leave
            // a background missing elements no field represents. Individual
            // deletions are different: deleting a live element means "remove
            // it from the design", which the stripped plate already reflects.
            const importSurvives = d.fields.some((f) => imported.some((i) => i.id === f.id));
            if (!importSurvives) return d;
            // Layers that painted ABOVE a lifted element (a fade gradient
            // over the photo, a badge across a headline) can't live in the
            // background plate — it sits under every field. They land as
            // static fields z-placed exactly where they painted.
            return {
              ...d,
              backgroundUrl: bgUrl,
              // Anchors index into the EXCLUDED fields in paint order —
              // `lifted`, not `imported` (baked missing-font text never
              // reached the decomposer).
              fields: mergeOverlayFields(layers.units, lifted, d.fields),
            };
          });
          const report = degradedReport(layers.warningDetails);
          if (report) setError(report);
          else if (layers.warnings.length) setError(layers.warnings.join(" "));
        } catch (e) {
          console.error("Background recomposition failed", e);
          setError(
            "Couldn't lift the imported elements off the background. The flat Figma render is in use, so fields may overlap their original artwork. " +
              (e instanceof Error ? e.message : ""),
          );
        } finally {
          setRecomposing(false);
        }
      })();
    }
  };

  // -------------------------------------------------------------------------
  // Context menu actions
  // -------------------------------------------------------------------------

  const menuActions: MenuAction[] = useMemo(() => {
    if (!menu) return [];
    if (menu.fieldId === null) {
      return [
        {
          label: "Paste",
          shortcut: isMac ? "⌘V" : "Ctrl+V",
          disabled: !clipboardHasFields(),
          onSelect: () => pasteFields(),
        },
        {
          label: "Paste here",
          disabled: !clipboardHasFields(),
          onSelect: () => pasteFields(menu.canvasPoint),
        },
        {
          label: "Select all",
          shortcut: isMac ? "⌘A" : "Ctrl+A",
          disabled: draft.fields.length === 0,
          separated: true,
          onSelect: selectAll,
        },
        { label: "Zoom to fit", shortcut: "⇧1", onSelect: () => canvasViewRef.current?.fit() },
      ];
    }
    // Right-click on a group frame: the overlay passes the group ref.
    if (selectedGroupIds([menu.fieldId]).length) {
      return [
        { label: "Ungroup", shortcut: isMac ? "⇧⌘G" : "Ctrl+Shift+G", onSelect: ungroupSelection },
        {
          label: "Center on canvas",
          separated: true,
          onSelect: () =>
            alignToCanvas([
              { axis: "h", edge: "center" },
              { axis: "v", edge: "center" },
            ]),
        },
        {
          label: "Delete group",
          shortcut: "⌫",
          destructive: true,
          separated: true,
          onSelect: () => deleteFields([menu.fieldId!]),
        },
      ];
    }
    const ids = selectedIds.includes(menu.fieldId) ? selectedIds : [menu.fieldId];
    // Align and distribute, spelled out. The floating toolbar is the fast
    // path; this is the discoverable one, and disabled entries carry the
    // same reason the controls do.
    const alignOff = Boolean(alignDisabledReason);
    const canvasAlignOff = Boolean(canvasAlignDisabledReason);
    const distOff = Boolean(distributeDisabledReason);
    const centerOnCanvas = (edges: Array<{ axis: Axis; edge: AlignEdge }>) => () =>
      alignToCanvas(edges);
    const alignItems: MenuAction[] =
      ids.length >= 2
        ? [
            {
              label: "Align left",
              separated: true,
              disabled: alignOff,
              onSelect: () => alignSelection("h", "start"),
            },
            {
              label: "Align horizontal centers",
              disabled: alignOff,
              onSelect: () => alignSelection("h", "center"),
            },
            {
              label: "Align right",
              disabled: alignOff,
              onSelect: () => alignSelection("h", "end"),
            },
            {
              label: "Align top",
              disabled: alignOff,
              onSelect: () => alignSelection("v", "start"),
            },
            {
              label: "Align vertical centers",
              disabled: alignOff,
              onSelect: () => alignSelection("v", "center"),
            },
            {
              label: "Align bottom",
              disabled: alignOff,
              onSelect: () => alignSelection("v", "end"),
            },
            {
              label: "Distribute horizontally",
              disabled: distOff,
              onSelect: () => distributeSelection("h"),
            },
            {
              label: "Distribute vertically",
              disabled: distOff,
              onSelect: () => distributeSelection("v"),
            },
          ]
        : [
            {
              label: "Center on canvas",
              separated: true,
              disabled: canvasAlignOff,
              onSelect: centerOnCanvas([
                { axis: "h", edge: "center" },
                { axis: "v", edge: "center" },
              ]),
            },
            {
              label: "Center horizontally on canvas",
              disabled: canvasAlignOff,
              onSelect: centerOnCanvas([{ axis: "h", edge: "center" }]),
            },
            {
              label: "Center vertically on canvas",
              disabled: canvasAlignOff,
              onSelect: centerOnCanvas([{ axis: "v", edge: "center" }]),
            },
          ];
    const groupable =
      ids.length >= 2 &&
      draft.fields
        .filter((f) => ids.includes(f.id))
        .every((f) => !groups.some((g) => g.children.includes(f.fieldKey)));
    // The Fixed toggle drives toward ONE uniform end state: a mixed selection
    // becomes all fixed, and only an all-fixed selection offers the reverse —
    // so the label always says exactly what the action will do. Shapes and
    // dropdowns don't count (the inspector's checkbox excludes them too).
    const toggleable = draft.fields.filter(
      (f) => ids.includes(f.id) && f.type !== "shape" && f.type !== "select",
    );
    const allFixed = toggleable.length > 0 && toggleable.every((f) => f.static);
    return [
      { label: "Copy", shortcut: "⌘C", onSelect: () => copyFields(ids) },
      { label: "Cut", shortcut: "⌘X", onSelect: () => cutFields(ids) },
      {
        label: "Paste",
        shortcut: "⌘V",
        disabled: !clipboardHasFields(),
        onSelect: () => pasteFields(),
      },
      { label: "Duplicate", shortcut: "⌘D", onSelect: () => duplicateSelected(ids) },
      ...(groupable
        ? [
            {
              label: "Group selection",
              shortcut: isMac ? "⌘G" : "Ctrl+G",
              onSelect: groupSelection,
            },
          ]
        : []),
      {
        label: "Copy style",
        shortcut: isMac ? "⌥⌘C" : "Ctrl+Alt+C",
        onSelect: () => copyStyleFrom(ids),
      },
      {
        label: "Paste style",
        shortcut: isMac ? "⌥⌘V" : "Ctrl+Alt+V",
        disabled: !clipboardHasStyle(),
        onSelect: () => pasteStyleTo(ids),
      },
      ...(toggleable.length > 0
        ? [
            allFixed
              ? {
                  label: toggleable.length > 1 ? "Make editable" : "Make field editable",
                  onSelect: () => setFixed(ids, false),
                }
              : {
                  label: toggleable.length > 1 ? "Mark as fixed" : "Mark field as fixed",
                  onSelect: () => setFixed(ids, true),
                },
          ]
        : []),
      ...alignItems,
      { label: "Bring to front", separated: true, onSelect: () => reorderLayer(ids, "front") },
      { label: "Send to back", onSelect: () => reorderLayer(ids, "back") },
      {
        label: "Delete",
        shortcut: "⌫",
        destructive: true,
        separated: true,
        onSelect: () => deleteFields(ids),
      },
    ];
  }, [
    menu,
    selectedIds,
    draft.fields,
    groups,
    copyFields,
    cutFields,
    pasteFields,
    copyStyleFrom,
    pasteStyleTo,
    duplicateSelected,
    setFixed,
    reorderLayer,
    deleteFields,
    groupSelection,
    ungroupSelection,
    selectAll,
    alignSelection,
    alignToCanvas,
    distributeSelection,
    alignDisabledReason,
    canvasAlignDisabledReason,
    distributeDisabledReason,
  ]);

  /** Properties the lone selection's bound brand type style owns. The
   * floating toolbar greys those out for the same reason the inspector
   * does: the rules engine overrides them at render. */
  const singleLockedProps = useMemo(
    () =>
      lockedProperties(
        singleSelected?.typeStyleKey
          ? kit?.typeStyles?.find((t) => t.key === singleSelected.typeStyleKey)
          : undefined,
        kit,
      ),
    [singleSelected, kit],
  );

  /** The view commands, in one place, so the menu and the shortcut hints
   * can never disagree about what a key does. */
  const viewMenuActions: MenuAction[] = useMemo(
    () => [
      {
        label: "Zoom in",
        shortcut: isMac ? "⌘+" : "Ctrl++",
        onSelect: () => canvasViewRef.current?.zoomIn(),
      },
      {
        label: "Zoom out",
        shortcut: isMac ? "⌘−" : "Ctrl+−",
        onSelect: () => canvasViewRef.current?.zoomOut(),
      },
      {
        label: "Zoom to 100%",
        shortcut: isMac ? "⌘0" : "Ctrl+0",
        onSelect: () => canvasViewRef.current?.zoomActual(),
      },
      { label: "Zoom to fit", shortcut: "⇧1", onSelect: () => canvasViewRef.current?.fit() },
      {
        label: "Zoom to selection",
        shortcut: "⇧2",
        disabled: selectedIds.length === 0,
        onSelect: () => canvasViewRef.current?.zoomToSelection(),
      },
      {
        label: "Keyboard shortcuts",
        shortcut: "?",
        separated: true,
        onSelect: () => setShortcutsOpen(true),
      },
    ],
    [selectedIds.length],
  );

  if (!viewportOk) {
    return (
      <div className="max-w-md mx-auto text-center py-24 px-6 space-y-4">
        <p
          style={{
            fontFamily: "var(--font-head)",
            fontWeight: "var(--weight-head)",
            fontSize: 22,
            letterSpacing: "var(--track-head)",
            color: "var(--text-primary)",
          }}
        >
          The builder needs a bigger screen
        </p>
        <p
          style={{
            fontSize: "var(--type-label-size)",
            lineHeight: 1.6,
            color: "var(--text-secondary)",
          }}
        >
          Building templates takes a canvas, palette, and inspector side by side, so it works on
          laptop and desktop screens. Your team can still browse and fill in templates right here on
          this device.
        </p>
        <button
          className="sp-btn sp-btn-primary"
          onClick={() => navigate({ name: "adminTemplates" })}
        >
          Back to Templates
        </button>
      </div>
    );
  }
  if (templateId && templateState.status === "loading") {
    return (
      <div
        className="flex items-center justify-center"
        style={{ height: "100dvh", background: "var(--bg-canvas)" }}
      >
        <p style={{ fontSize: "var(--type-label-size)", color: "var(--text-muted)" }}>
          Loading this template…
        </p>
      </div>
    );
  }
  if (templateId && templateState.status === "error") {
    return (
      <ErrorState
        title="We couldn't load this template."
        detail="Check your connection and try again."
        onRetry={templateState.retry}
      />
    );
  }
  // A new template needs the canvas sizes before the source picker makes
  // sense; when editing, dimensions come from the loaded template instead.
  if (!templateId && sizesState.status === "error") {
    return (
      <ErrorState
        title="We couldn't load the canvas sizes."
        detail="Check your connection and try again."
        onRetry={sizesState.retry}
      />
    );
  }

  return (
    <div className="sp-builder">
      {publishState !== "idle" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{
            background: "color-mix(in srgb, var(--text-on-accent) 55%, transparent)",
            backdropFilter: "blur(2px)",
          }}
          role="status"
          aria-live="polite"
        >
          <div
            className="w-full max-w-xs p-7 text-center space-y-3"
            style={{ background: "var(--bg-surface)", borderRadius: "var(--radius-card)" }}
          >
            {publishState === "publishing" ? (
              <>
                <RefreshCw
                  className="animate-spin mx-auto"
                  style={{ width: 28, height: 28, color: "var(--state-primary)" }}
                />
                <p
                  style={{
                    fontFamily: "var(--font-head)",
                    fontWeight: "var(--weight-head)",
                    fontSize: 21,
                    letterSpacing: "var(--track-head)",
                    color: "var(--text-primary)",
                  }}
                >
                  Publishing…
                </p>
                <p style={{ fontSize: "var(--type-caption-size)", color: "var(--text-muted)" }}>
                  Saving "{draft.name.trim() || "Untitled template"}" and making it live for your
                  team.
                </p>
              </>
            ) : (
              <>
                <span
                  className="mx-auto flex items-center justify-center"
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: "var(--radius-pill)",
                    background: "var(--fill-action)",
                  }}
                >
                  <Check style={{ width: 22, height: 22, color: "var(--text-on-action)" }} />
                </span>
                <p
                  style={{
                    fontFamily: "var(--font-head)",
                    fontWeight: "var(--weight-head)",
                    fontSize: 21,
                    letterSpacing: "var(--track-head)",
                    color: "var(--text-primary)",
                  }}
                >
                  Template published
                </p>
                <p style={{ fontSize: "var(--type-caption-size)", color: "var(--text-muted)" }}>
                  "{draft.name.trim() || "Untitled template"}" is live. Taking you back to
                  Templates…
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {autoBuildOpen && (
        <AutoBuildDialog
          initialTab={autoBuildTab}
          onClose={() => {
            setAutoBuildOpen(false);
            setAutoBuildTab(undefined);
          }}
          onBuilt={applyAutoBuild}
        />
      )}

      {figmaOpen && (
        <FigmaImportDialog
          onClose={() => setFigmaOpen(false)}
          onImported={(result) => {
            setFigmaOpen(false);
            // No pre-selection step: everything lands on the canvas, and the
            // admin marks chrome as Fixed in the inspector, in context.
            applyImport(result);
          }}
        />
      )}

      {menu && (
        <FieldContextMenu
          x={menu.x}
          y={menu.y}
          actions={menuActions}
          onClose={() => setMenu(null)}
        />
      )}

      {shortcutsOpen && <ShortcutsPanel isMac={isMac} onClose={() => setShortcutsOpen(false)} />}

      {viewMenuAt && (
        <FieldContextMenu
          x={viewMenuAt.x}
          y={viewMenuAt.y}
          actions={viewMenuActions}
          onClose={() => setViewMenuAt(null)}
        />
      )}

      {sizeMenuAt && (
        <>
          {/* Click-away backdrop; the popover itself sits above it. */}
          <div className="fixed inset-0 z-40" onClick={() => setSizeMenuAt(null)} />
          <div
            role="dialog"
            aria-label="Canvas size"
            className="fixed z-50 p-3 overflow-y-auto"
            style={{
              left: Math.max(8, Math.min(sizeMenuAt.x, window.innerWidth - 336)),
              bottom: Math.max(8, window.innerHeight - sizeMenuAt.y + 6),
              width: 328,
              maxHeight: Math.round(window.innerHeight * 0.7),
              background: "var(--bg-surface)",
              border: "1px solid var(--border-strong)",
              borderRadius: "var(--radius-card)",
            }}
          >
            <CanvasSizePicker
              sizes={sizes}
              value={{ width: draft.canvasWidth, height: draft.canvasHeight }}
              onPick={requestResize}
              aspectLock={
                draft.backgroundUrl
                  ? {
                      reason:
                        "This template has a background image, so only sizes with the same aspect ratio can apply in place. A different shape becomes a new version: a draft copy, reflowed for review. This template stays untouched.",
                    }
                  : undefined
              }
              onPickVersion={(next) => void requestVersion(next)}
            />
          </div>
        </>
      )}

      {bgReflow && (
        <BackgroundReflowDialog
          backgroundUrl={bgReflow.backgroundUrl}
          source={bgReflow.source}
          target={bgReflow.target}
          hasFigmaProvenance={draft.fields.some((f) => f.sourceNodeId)}
          onKeep={() => setBgReflow(null)}
          onRemove={() => {
            // The choice is an ordinary edit: undoable, and the canvas
            // inspector's background upload is right there for the retake.
            setDraft((d) => ({ ...d, backgroundUrl: "" }));
            setBgReflow(null);
          }}
          onSolid={(hex) => {
            if (hex) {
              setDraft((d) => ({ ...d, backgroundUrl: "", backgroundColor: hex }));
            } else {
              // Sampling failed (unreadable image) — keep the image and say
              // so instead of guessing a color.
              setError("We couldn't read the image's colors, so the background image was kept.");
            }
            setBgReflow(null);
          }}
        />
      )}

      <ConfirmDialog
        open={pendingResize !== null}
        title="Resize a live template?"
        description={
          pendingResize
            ? `This template is live through ${pendingResize.liveLinks.length} share link${
                pendingResize.liveLinks.length === 1 ? "" : "s"
              } (${pendingResize.liveLinks
                .map((l) => (l.name.trim() ? `"${l.name}"` : "unnamed"))
                .join(", ")}). Everyone holding ${
                pendingResize.liveLinks.length === 1 ? "it" : "them"
              } will start receiving the new ${pendingResize.next.width}×${
                pendingResize.next.height
              } size.`
            : undefined
        }
        confirmLabel="Resize"
        tone="primary"
        onCancel={() => setPendingResize(null)}
        onConfirm={() => {
          if (pendingResize) applyResize(pendingResize.next);
          setPendingResize(null);
        }}
      />

      <ConfirmDialog
        open={pendingStack !== null}
        title="Turn on auto layout?"
        description={`The elements in "${pendingStack?.name ?? ""}" aren't arranged as a stack yet, so auto layout will move them into one. Undo brings the current arrangement back.`}
        confirmLabel="Turn on auto layout"
        tone="primary"
        onCancel={() => setPendingStack(null)}
        onConfirm={() => {
          if (pendingStack) applyStackConversion(pendingStack.next);
          setPendingStack(null);
        }}
      />

      {notice && (
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
            {notice}
          </span>
        </div>
      )}

      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      {/* The bar exists for the EDITOR — save state, steps, publish, a name
          worth showing. Before a path is chosen there is nothing to save and
          nothing named, so the start screen renders without it and carries
          its own quiet way back instead of a near-empty 52px strip. */}
      {sourceChosen && (
        <div className="sp-builder__bar">
          {/* This row must NEVER scroll or clip at any viewport ≥ 1024px, with
            the app sidebar expanded or collapsed. That budget is already
            spent: before adding a control here, move something out (the
            tools, zoom, and canvas info live with the canvas for exactly
            this reason). The name is the only child allowed to shrink. */}
          <div
            className="flex items-center gap-2 min-w-0 flex-nowrap"
            style={{ height: 52, padding: "0 var(--space-xs)" }}
          >
            <button
              onClick={() => navigate({ name: "adminTemplates" })}
              className="flex items-center gap-1.5 flex-shrink-0"
              style={{ fontSize: "var(--type-caption-size)", color: "var(--text-secondary)" }}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Templates
            </button>
            <span
              aria-hidden
              style={{ width: 1, height: 20, background: "var(--border)", flexShrink: 0 }}
            />
            <InlineEdit
              className="min-w-0"
              // The name is the only shrinkable item in a crowded bar; it
              // already truncates, so the floor is just enough to stay
              // clickable, and a cap stops a long name from pushing the
              // step control off the end.
              style={{ flex: "0 1 auto", minWidth: 72, maxWidth: 320 }}
              value={draft.name}
              ariaLabel="Rename this template"
              inputAriaLabel="Template name"
              placeholder="Untitled template"
              valueStyle={{
                fontFamily: "var(--font-ui)",
                fontWeight: 500,
                fontSize: "var(--type-label-size)",
                color: "var(--text-primary)",
              }}
              onSave={(name) => setDraft((d) => ({ ...d, name }), "text:name")}
            />
            {sourceChosen && (
              <>
                {/* Save state, compressed to a dot and a word so its width is
                  stable. The full sentence lives in the tooltip — and, for a
                  failure, in the error region below the bar, which doSave
                  always fills. The dot goes destructive on failure so the
                  short word still reads as trouble at a glance. */}
                <span
                  role="status"
                  className="flex items-center gap-1.5 flex-shrink-0 whitespace-nowrap"
                  title={
                    saveFailed
                      ? "Not saved. See the message below the bar"
                      : lastSavedAt && !dirty && !saving
                        ? savedAgo(lastSavedAt, nowTick)
                        : undefined
                  }
                  style={{
                    width: 78,
                    fontSize: "var(--type-caption-size)",
                    color: saveFailed ? "var(--destructive)" : "var(--text-muted)",
                    fontWeight: saveFailed ? 500 : undefined,
                  }}
                >
                  {(saving || saveFailed || dirty || lastSavedAt) && (
                    <span
                      aria-hidden
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: "currentColor",
                        flexShrink: 0,
                      }}
                    />
                  )}
                  {saving
                    ? "Saving…"
                    : saveFailed
                      ? "Not saved"
                      : dirty
                        ? "Unsaved"
                        : lastSavedAt
                          ? "Saved"
                          : null}
                </span>
                {/* Retry stands in for Save draft while a save has failed —
                  same operation, and the loud red state stays a real button
                  rather than moving into a menu. */}
                {saveFailed && !saving ? (
                  <button
                    onClick={() => void doSave(undefined, true)}
                    className="sp-btn sp-btn-ghost flex-shrink-0"
                    style={{ minHeight: 30, padding: "4px 10px" }}
                  >
                    Retry
                  </button>
                ) : (
                  <button
                    onClick={() => void save()}
                    disabled={saving}
                    className="sp-btn sp-btn-ghost flex-shrink-0"
                    style={{ minHeight: 30, padding: "4px 10px" }}
                  >
                    <Save className="w-3.5 h-3.5" />
                    Save draft
                  </button>
                )}
              </>
            )}

            <span className="flex-1" style={{ minWidth: "var(--space-2xs)" }} />

            {sourceChosen && (
              <>
                <div
                  className="flex overflow-hidden flex-shrink-0"
                  data-radius-control
                  style={{ border: "1px solid var(--border-strong)" }}
                >
                  {(["edit", "preview"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setMode(m)}
                      title={m === "edit" ? "Edit" : "Preview"}
                      aria-label={m === "edit" ? "Edit" : "Preview"}
                      aria-pressed={mode === m}
                      className="flex items-center px-2.5 py-1.5"
                      style={{
                        borderLeft: m === "preview" ? "1px solid var(--border)" : undefined,
                        ...(mode === m
                          ? { background: "var(--fill-action)", color: "var(--text-on-action)" }
                          : { background: "var(--bg-surface)", color: "var(--text-secondary)" }),
                      }}
                    >
                      {m === "edit" ? (
                        <Pencil className="w-3.5 h-3.5" />
                      ) : (
                        <Eye className="w-3.5 h-3.5" />
                      )}
                    </button>
                  ))}
                </div>
                {fieldsComplete ? (
                  <WizardStepBar current={step} complete={complete} canGo={canGo} onGo={goTo} />
                ) : (
                  /* Until a field exists nothing past the editor is reachable,
                   so three dimmed panel buttons would only restate the
                   dimmed Publish. Say what is missing instead. */
                  <span
                    className="flex-shrink-0 whitespace-nowrap"
                    style={{ fontSize: "var(--type-caption-size)", color: "var(--text-muted)" }}
                  >
                    Add a field to continue
                  </span>
                )}
                {step === "fields" && (
                  /* The editor's one primary control: the answer to "what
                   now". With the default name still in place, publish()
                   opens the Name panel with the field focused and the
                   name-needed note showing — the same guard the panel's own
                   Publish runs. */
                  <button
                    onClick={() => void publish()}
                    disabled={!fieldsComplete || saving || publishState !== "idle"}
                    title={
                      !fieldsComplete
                        ? "Add a field to continue"
                        : hasRealName
                          ? draft.status === "published"
                            ? "Publish these changes to your team"
                            : "Publish this template to your team"
                          : "Name the template, then publish"
                    }
                    className="sp-btn sp-btn-primary flex-shrink-0"
                    style={{ minHeight: 32, padding: "6px 12px" }}
                  >
                    {hasRealName ? (
                      <Send className="w-3.5 h-3.5" />
                    ) : (
                      <ArrowRight className="w-3.5 h-3.5" />
                    )}
                    Publish
                  </button>
                )}
              </>
            )}
          </div>

          {error && (
            <p
              role="alert"
              className="px-4 py-2"
              style={{
                fontSize: "var(--type-caption-size)",
                background: "var(--danger-wash)",
                color: "var(--destructive)",
                borderTop: "1px solid var(--border)",
              }}
            >
              {error}
            </p>
          )}
        </div>
      )}

      {!sourceChosen ? (
        /* Source pick: two co-equal creation paths. Spans BOTH grid rows —
           with no bar above it, staying in the auto row would collapse the
           region to content height inside the overflow-hidden builder. */
        <div style={{ gridColumn: "1 / -1", gridRow: "1 / -1", minHeight: 0, overflowY: "auto" }}>
          {/* The quiet way back, in place of the bar's back button. */}
          <div style={{ padding: "var(--space-sm) var(--space-md) 0" }}>
            <button
              onClick={() => navigate({ name: "adminTemplates" })}
              className="flex items-center gap-1.5"
              style={{ fontSize: "var(--type-caption-size)", color: "var(--text-secondary)" }}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Templates
            </button>
          </div>
          <div className="max-w-3xl mx-auto py-10 px-6 space-y-5">
            {error && (
              <p
                role="alert"
                className="px-4 py-3 text-center"
                data-radius-card
                style={{
                  fontSize: "var(--type-caption-size)",
                  background: "var(--danger-wash)",
                  color: "var(--destructive)",
                }}
              >
                {error}
              </p>
            )}
            <div className="text-center space-y-1 mb-2">
              <h2
                style={{
                  fontFamily: "var(--font-head)",
                  fontWeight: "var(--weight-head)",
                  fontSize: 22,
                  letterSpacing: "var(--track-head)",
                  color: "var(--text-primary)",
                }}
              >
                Start your template
              </h2>
              <p style={{ fontSize: "var(--type-label-size)", color: "var(--text-secondary)" }}>
                Build from scratch, or import a designed frame. Both end at the same place: locked
                design, editable fields.
              </p>
            </div>
            <div
              className={
                canvaReady
                  ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch"
                  : "grid grid-cols-1 sm:grid-cols-3 gap-4 items-stretch"
              }
            >
              {/* Path A — blank canvas. The size gallery gates this path: it
                  opens as a dialog and picking a size goes straight to the
                  canvas. Imports skip it — the frame imposes its own size. */}
              <button
                onClick={() => setSizeDialogOpen(true)}
                className="p-8 text-center transition-all flex flex-col items-center justify-center gap-3"
                style={{
                  border: "1.5px dashed var(--border-strong)",
                  borderRadius: "var(--radius-card)",
                  background: "var(--bg-surface)",
                  minHeight: 220,
                  cursor: "pointer",
                }}
              >
                <Plus className="w-6 h-6" style={{ color: "var(--state-primary)" }} />
                <p style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>
                  Start blank
                </p>
                <p
                  style={{
                    fontSize: "var(--type-caption-size)",
                    color: "var(--text-secondary)",
                    maxWidth: 240,
                  }}
                >
                  Build the design from scratch on an empty canvas. Drag on text, images, and fixed
                  elements.
                </p>
              </button>
              {/* Path B — Figma link */}
              <button
                onClick={() => stores.designImport.isConfigured() && setFigmaOpen(true)}
                disabled={!stores.designImport.isConfigured()}
                className="p-8 text-center transition-all flex flex-col items-center justify-center gap-3"
                style={{
                  border: "1.5px dashed var(--border-strong)",
                  borderRadius: "var(--radius-card)",
                  background: "var(--bg-surface)",
                  minHeight: 220,
                  cursor: stores.designImport.isConfigured() ? "pointer" : "default",
                  opacity: stores.designImport.isConfigured() ? 1 : 0.55,
                }}
              >
                <Figma className="w-6 h-6" style={{ color: "var(--state-primary)" }} />
                <p style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>
                  Import from Figma
                </p>
                <p
                  style={{
                    fontSize: "var(--type-caption-size)",
                    color: "var(--text-secondary)",
                    maxWidth: 240,
                  }}
                >
                  {stores.designImport.isConfigured()
                    ? "Paste a frame link. Every element lands on the canvas as an editable field. Mark anything that shouldn't be as fixed."
                    : "Requires the Supabase backend with the Figma connection configured (see docs/ARCHITECTURE.md)."}
                </p>
              </button>
              {/* Path B2 — Canva link. Only once the workspace has connected
                  Canva; it goes through auto-build, opened on the Canva tab,
                  since Canva hands over a flat export rather than layers. */}
              {canvaReady && (
                <button
                  onClick={() => {
                    setAutoBuildTab("canva");
                    setAutoBuildOpen(true);
                  }}
                  className="p-8 text-center transition-all flex flex-col items-center justify-center gap-3"
                  style={{
                    border: "1.5px dashed var(--border-strong)",
                    borderRadius: "var(--radius-card)",
                    background: "var(--bg-surface)",
                    minHeight: 220,
                    cursor: "pointer",
                  }}
                >
                  <Palette className="w-6 h-6" style={{ color: "var(--state-primary)" }} />
                  <p style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>
                    Import from Canva
                  </p>
                  <p
                    style={{
                      fontSize: "var(--type-caption-size)",
                      color: "var(--text-secondary)",
                      maxWidth: 240,
                    }}
                  >
                    Paste a design link. Claude reads the exported design, proposes the fields, and
                    writes the caption. You correct in the inspector.
                  </p>
                </button>
              )}
              {/* Path C — auto-build with Claude */}
              <button
                onClick={() => stores.designImport.isConfigured() && setAutoBuildOpen(true)}
                disabled={!stores.designImport.isConfigured()}
                className="p-8 text-center transition-all flex flex-col items-center justify-center gap-3"
                style={{
                  border: "1.5px dashed var(--border-strong)",
                  borderRadius: "var(--radius-card)",
                  background: "var(--bg-surface)",
                  minHeight: 220,
                  cursor: stores.designImport.isConfigured() ? "pointer" : "default",
                  opacity: stores.designImport.isConfigured() ? 1 : 0.55,
                }}
              >
                <Sparkles className="w-6 h-6" style={{ color: "var(--state-primary)" }} />
                <p style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>
                  Auto-build with Claude
                </p>
                <p
                  style={{
                    fontSize: "var(--type-caption-size)",
                    color: "var(--text-secondary)",
                    maxWidth: 240,
                  }}
                >
                  {stores.designImport.isConfigured()
                    ? `Paste a Figma${canvaReady ? " or Canva" : ""} link or upload an image. Claude decides what's editable, names every field, and writes the caption. You correct in the inspector.`
                    : "Requires the Supabase backend with auto-build configured (see docs/ARCHITECTURE.md)."}
                </p>
              </button>
            </div>
          </div>

          {sizeDialogOpen && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center p-6"
              role="dialog"
              aria-modal="true"
              aria-label="Choose a canvas size"
              style={{ background: "color-mix(in srgb, var(--text-on-accent) 45%, transparent)" }}
              onClick={() => setSizeDialogOpen(false)}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className="w-full overflow-y-auto"
                style={{
                  maxWidth: 1040,
                  maxHeight: "85dvh",
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-card)",
                  // The headline-card padding token, not the default — this
                  // is a full-screen decision surface, not a dense card.
                  padding: "var(--space-lg)",
                }}
              >
                <header
                  className="flex items-start justify-between gap-4"
                  style={{ marginBottom: "var(--space-md)" }}
                >
                  <div>
                    <h2
                      style={{
                        fontFamily: "var(--font-head)",
                        fontWeight: "var(--weight-head)",
                        fontSize: 21,
                        letterSpacing: "var(--track-head)",
                        color: "var(--text-primary)",
                      }}
                    >
                      Choose a canvas size
                    </h2>
                    <p
                      style={{
                        fontSize: "var(--type-label-size)",
                        color: "var(--text-secondary)",
                        marginTop: "var(--space-3xs)",
                      }}
                    >
                      Your blank canvas opens at this size. You can resize it later from the
                      toolbar.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="sp-icon-btn flex-shrink-0"
                    onClick={() => setSizeDialogOpen(false)}
                    aria-label="Close"
                  >
                    <X style={{ width: 16, height: 16 }} />
                  </button>
                </header>
                <SizeGallery
                  sizes={sizes}
                  value={{ width: draft.canvasWidth, height: draft.canvasHeight }}
                  onPick={(next) => {
                    // Picking IS starting: baseline the canvas, then straight
                    // to Fields — Step 1, same as the old Start blank click.
                    pickCreationSize(next);
                    setSizeDialogOpen(false);
                    setStarted(true);
                    goTo("fields");
                  }}
                />
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* ── Left rail ─────────────────────────────────────────────── */}
          <BuilderRail
            side="left"
            label="Elements and fields"
            width={leftWidth}
            onWidth={setLeftWidth}
            minWidth={RAIL_LEFT_MIN}
            maxWidth={RAIL_LEFT_MAX}
            collapsed={leftCollapsed}
            onCollapsed={setLeftCollapsed}
          >
            <RailHeader title="Elements">
              <button
                onClick={() => setLeftCollapsed(true)}
                className="sp-icon-btn"
                title="Hide this rail"
                aria-label="Hide the elements rail"
              >
                <PanelLeftClose style={{ width: 15, height: 15 }} />
              </button>
            </RailHeader>
            {/* Two orderings, two tabs. The titles spell out the difference
                because it is the one thing about this rail that is not
                self-evident, and getting it wrong quietly reorders either the
                graphic or the member form. */}
            <RailTabs
              tabs={[
                {
                  key: "layers",
                  label: "Layers",
                  title: "Layers: what paints on top of what",
                },
                {
                  key: "form",
                  label: "Form",
                  title: "Form: what your team fills in, in order",
                },
              ]}
              active={railTab}
              onSelect={(key) => setRailTab(key)}
            />
            <div
              className="sp-builder__rail-body space-y-3"
              style={{ padding: "var(--space-2xs)" }}
            >
              {mode === "edit" && (
                <ElementPalette
                  onAdd={(id) => addPaletteField(id)}
                  logos={logoAssets}
                  activeTool={tool}
                />
              )}
              {railTab === "layers" ? (
                <LayersPanel
                  fields={draft.fields}
                  groups={groups}
                  selectedIds={selectedIds}
                  onSelect={setSelectedIds}
                  onPaintOrder={setPaintOrder}
                  onRename={renameField}
                  lockedIds={lockedIds}
                  hiddenIds={hiddenIds}
                  onToggleLocked={toggleLocked}
                  onToggleHidden={toggleHidden}
                  onContextMenu={(e, fieldId) => {
                    e.preventDefault();
                    if (!selectedIds.includes(fieldId)) setSelectedIds([fieldId]);
                    setMenu({ x: e.clientX, y: e.clientY, fieldId, canvasPoint: { x: 0, y: 0 } });
                  }}
                />
              ) : (
                <FieldListPanel
                  fields={draft.fields}
                  groups={groups}
                  selectedIds={selectedIds}
                  onSelect={setSelectedIds}
                  onReorder={setFields}
                  onReorderChildren={(id, children) => patchGroup(id, { children })}
                  onContextMenu={(e, fieldId) => {
                    e.preventDefault();
                    if (!selectedIds.includes(fieldId)) setSelectedIds([fieldId]);
                    setMenu({ x: e.clientX, y: e.clientY, fieldId, canvasPoint: { x: 0, y: 0 } });
                  }}
                />
              )}
            </div>
          </BuilderRail>

          {/* ── Canvas viewport ───────────────────────────────────────── */}
          <div className="sp-builder__canvas">
            {/* The tool strip floats on the canvas edge, next to the work it
                acts on — moving it out of the top bar is what keeps the bar
                from scrolling. Same tools, same letters, same shift-to-lock;
                only the orientation changed. */}
            {mode === "edit" && (
              <div className="sp-builder__tools" data-radius-control>
                <div role="radiogroup" aria-label="Canvas tool" className="flex flex-col">
                  {TOOL_ORDER.map(({ key, label, Icon }, i) => {
                    const on = tool === key;
                    return (
                      <button
                        key={key}
                        role="radio"
                        aria-checked={on}
                        aria-label={`${label} (${TOOL_LETTER[key]})`}
                        title={`${label}: ${TOOL_LETTER[key]}${
                          key === "move" ? "" : `, ⇧${TOOL_LETTER[key]} to keep it active`
                        }`}
                        onClick={() => {
                          setTool(key);
                          setToolLocked(false);
                        }}
                        className="px-2 py-2"
                        style={{
                          borderTop: i > 0 ? "1px solid var(--border)" : undefined,
                          background: on ? "var(--fill-action)" : "var(--bg-surface)",
                          color: on ? "var(--text-on-action)" : "var(--text-secondary)",
                        }}
                      >
                        <Icon style={{ width: 14, height: 14 }} />
                      </button>
                    );
                  })}
                </div>
                {/* Undo and redo ride below the tools: same strip, own
                    group. The keyboard shortcuts are unchanged. */}
                <button
                  onClick={doUndo}
                  disabled={!canUndo}
                  title={`Undo (${isMac ? "⌘" : "Ctrl+"}Z)`}
                  aria-label="Undo"
                  className="px-2 py-2"
                  style={{
                    borderTop: "1px solid var(--border-strong)",
                    background: "var(--bg-surface)",
                    color: canUndo ? "var(--text-secondary)" : "var(--text-disabled)",
                    cursor: canUndo ? "pointer" : "default",
                  }}
                >
                  <Undo2 style={{ width: 14, height: 14 }} />
                </button>
                <button
                  onClick={doRedo}
                  disabled={!canRedo}
                  title={`Redo (${isMac ? "⇧⌘" : "Ctrl+Shift+"}Z)`}
                  aria-label="Redo"
                  className="px-2 py-2"
                  style={{
                    borderTop: "1px solid var(--border)",
                    background: "var(--bg-surface)",
                    color: canRedo ? "var(--text-secondary)" : "var(--text-disabled)",
                    cursor: canRedo ? "pointer" : "default",
                  }}
                >
                  <Redo2 style={{ width: 14, height: 14 }} />
                </button>
              </div>
            )}
            <div
              className={`flex-1 min-h-0 flex justify-center ${
                mode === "edit" ? "items-stretch" : "items-center"
              }`}
              style={{ padding: "var(--space-sm)" }}
            >
              {/* Canvas boundary: a crash on the design surface leaves the
                  top bar, rails, and inspector standing; the draft is
                  autosaved up to the last change. Mode switches and edits
                  reset a crashed boundary. */}
              <ErrorBoundary
                level="canvas"
                context={{ templateId: savedId ?? undefined }}
                resetKeys={[mode, draft.fields]}
                fallback={(retry) => (
                  <ErrorState
                    title="The canvas ran into a problem."
                    detail="Everything up to your last save is safe. Try again. If it keeps happening, undo your last change."
                    onRetry={retry}
                  />
                )}
              >
                {mode === "edit" ? (
                  <FieldOverlayEditor
                    canvasWidth={draft.canvasWidth}
                    canvasHeight={draft.canvasHeight}
                    backgroundUrl={draft.backgroundUrl}
                    backgroundCss={schemaBackgroundCss(draft)}
                    fields={draft.fields}
                    groups={groups}
                    layout={builderLayout}
                    values={worstCaseValues}
                    overflowGroupIds={overflowGroupIds}
                    selectedIds={selectedIds}
                    onSelect={setSelectedIds}
                    onChange={setFields}
                    onMoveSelection={moveSelection}
                    flashGroupId={flashGroupId}
                    onReorderChildren={(id, children) => patchGroup(id, { children })}
                    tool={tool}
                    lockedIds={lockedIds}
                    hiddenIds={hiddenIds}
                    emptyHint={
                      draft.fields.length === 0
                        ? stores.designImport.isConfigured()
                          ? "Drag an element from the palette onto the canvas, or import a designed frame from Figma."
                          : "Drag an element from the palette onto the canvas. You can also paste an image or a Figma layer straight in."
                        : undefined
                    }
                    onDraw={addDrawnField}
                    onTransformSelection={transformSelection}
                    onDropElement={(id, at) => addPaletteField(id, at)}
                    onDropFiles={(files, at) => void addImageFiles(files, at)}
                    onContextMenu={(pos, fieldId, canvasPoint) =>
                      setMenu({ x: pos.x, y: pos.y, fieldId, canvasPoint })
                    }
                    onRequestLabelFocus={setFocusLabelFieldId}
                    selectionToolbar={
                      selectedIds.length > 0 ? (
                        <SelectionToolbar
                          count={selectedIds.length}
                          single={singleSelected}
                          isGroup={Boolean(selectedGroup)}
                          groupable={
                            selectedFields.length >= 2 &&
                            selectedFields.every(
                              (f) => !groups.some((g) => g.children.includes(f.fieldKey)),
                            )
                          }
                          onAlign={alignSelection}
                          onDistribute={distributeSelection}
                          alignDisabledReason={alignDisabledReason}
                          distributeDisabledReason={distributeDisabledReason}
                          onGroup={groupSelection}
                          onUngroup={ungroupSelection}
                          onBringForward={() => reorderLayer(selectedIds, "front")}
                          onDelete={() => deleteFields(selectedIds)}
                          onPatchSingle={(patch) =>
                            singleSelected && patchField(singleSelected.id, patch)
                          }
                          singleLocked={singleLockedProps}
                        />
                      ) : null
                    }
                    apiRef={canvasViewRef}
                    onScaleChange={onCanvasScale}
                    viewKey={savedId ?? "new"}
                  />
                ) : (
                  /* Preview letterboxes inside the region: full height, width
                     from the canvas ratio, never wider than the region. */
                  <div
                    style={{
                      height: "100%",
                      maxWidth: "100%",
                      aspectRatio: `${draft.canvasWidth} / ${draft.canvasHeight}`,
                    }}
                  >
                    <SchemaRenderer
                      schema={previewSchema}
                      values={worstCaseValues}
                      brandKit={kit}
                      instrument={false}
                    />
                  </div>
                )}
              </ErrorBoundary>
            </div>

            {/* Canvas footer: the hint line, the import paths, and any layout
                warnings — everything that describes the canvas without
                sitting on top of it. */}
            <div
              className="flex-shrink-0"
              style={{ borderTop: "1px solid var(--border)", background: "var(--bg-surface)" }}
            >
              {mode === "edit" && reflowWarnings && reflowWarnings.length > 0 && (
                <div
                  role="status"
                  className="px-3 py-2 space-y-1"
                  style={{ borderBottom: "1px solid var(--border)" }}
                >
                  <div className="flex items-center gap-3">
                    <p className="sp-eyebrow flex-1" style={{ color: "var(--text-primary)" }}>
                      Reflow review: the automatic layout is a starting point. Adjust it before you
                      publish.
                    </p>
                    <button
                      onClick={() => setReflowWarnings(null)}
                      className="flex-shrink-0"
                      style={{
                        fontSize: "var(--type-caption-size)",
                        color: "var(--text-secondary)",
                      }}
                    >
                      Done reviewing
                    </button>
                  </div>
                  {reflowWarnings.map((w) => (
                    <button
                      key={w.fieldId}
                      onClick={() => setSelectedIds([w.fieldId])}
                      className="block text-left"
                      style={{
                        fontSize: "var(--type-caption-size)",
                        color: "var(--text-secondary)",
                        textDecoration: "underline",
                        textDecorationColor: "var(--border-strong)",
                        textUnderlineOffset: 2,
                      }}
                      title="Select this field on the canvas"
                    >
                      {w.message}
                    </button>
                  ))}
                </div>
              )}
              {mode === "edit" && layoutWarnings.length > 0 && (
                <div
                  role="status"
                  className="px-3 py-2 space-y-1"
                  style={{ borderBottom: "1px solid var(--border)" }}
                >
                  {layoutWarnings.map((w, i) => (
                    <p
                      key={i}
                      style={{
                        fontSize: "var(--type-caption-size)",
                        color: "var(--text-secondary)",
                      }}
                    >
                      {w}
                    </p>
                  ))}
                </div>
              )}
              <div
                className="flex items-center gap-4 px-3 flex-wrap"
                style={{ minHeight: 34, paddingBlock: 6 }}
              >
                <p
                  style={{
                    fontSize: "var(--type-caption-size)",
                    color: "var(--text-muted)",
                    flex: "1 1 260px",
                    minWidth: 0,
                  }}
                >
                  {mode === "edit"
                    ? "Drag elements from the palette onto the canvas, then move them by dragging; handles resize and the top handle rotates. Right-click for copy/paste."
                    : "Member preview: placeholder content, locked styling."}
                </p>
                {stores.designImport.isConfigured() && mode === "edit" && (
                  <>
                    <button
                      onClick={() => setFigmaOpen(true)}
                      className="flex items-center gap-1.5 flex-shrink-0"
                      style={{
                        fontSize: "var(--type-caption-size)",
                        color: "var(--text-secondary)",
                      }}
                    >
                      <Figma className="w-3.5 h-3.5" />
                      Import more fields from Figma
                    </button>
                    <button
                      onClick={() => setAutoBuildOpen(true)}
                      className="flex items-center gap-1.5 flex-shrink-0"
                      style={{
                        fontSize: "var(--type-caption-size)",
                        color: "var(--text-secondary)",
                      }}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Auto-build with Claude
                    </button>
                  </>
                )}
                {/* Canvas facts live with the canvas: size, status, and the
                    view controls all describe this region, not the document
                    chrome above it. In edit mode the size is a control — it
                    opens the same picker creation uses, for rescaling in
                    place. */}
                {mode === "edit" ? (
                  <button
                    onClick={(e) => {
                      const r = e.currentTarget.getBoundingClientRect();
                      setSizeMenuAt({ x: r.left, y: r.top });
                    }}
                    title="Change the canvas size"
                    aria-haspopup="dialog"
                    className="sp-eyebrow flex-shrink-0 whitespace-nowrap flex items-center gap-1"
                    style={{ cursor: "pointer" }}
                  >
                    {draft.canvasWidth}×{draft.canvasHeight} · {draft.status}
                    {recomposing ? " · lifting elements off background…" : ""}
                    <ChevronDown style={{ width: 11, height: 11 }} />
                  </button>
                ) : (
                  <span className="sp-eyebrow flex-shrink-0 whitespace-nowrap">
                    {draft.canvasWidth}×{draft.canvasHeight} · {draft.status}
                  </span>
                )}
                {mode === "edit" && (
                  <button
                    onClick={(e) => {
                      const r = e.currentTarget.getBoundingClientRect();
                      setViewMenuAt({ x: r.left, y: r.top });
                    }}
                    title="View commands"
                    aria-label={`Zoom ${Math.round(canvasScale * 100)} percent, view commands`}
                    aria-haspopup="menu"
                    className="flex items-center gap-1 px-2 py-1 flex-shrink-0"
                    data-radius-control
                    style={{
                      border: "1px solid var(--border-strong)",
                      background: "var(--bg-surface)",
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      color: "var(--text-secondary)",
                      minWidth: 62,
                      justifyContent: "center",
                    }}
                  >
                    {Math.round(canvasScale * 100)}%
                    <ChevronDown style={{ width: 11, height: 11 }} />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ── Right inspector ───────────────────────────────────────── */}
          <BuilderRail
            side="right"
            label="Inspector"
            width={rightWidth}
            onWidth={setRightWidth}
            minWidth={RAIL_RIGHT_MIN}
            maxWidth={RAIL_RIGHT_MAX}
            collapsed={rightCollapsed}
            onCollapsed={setRightCollapsed}
          >
            <RailHeader
              title={
                selectedGroup
                  ? "Group"
                  : singleSelected
                    ? "Element"
                    : selectedFields.length > 1
                      ? `${selectedFields.length} selected`
                      : "Canvas"
              }
            >
              <button
                onClick={() => setRightCollapsed(true)}
                className="sp-icon-btn"
                title="Hide the inspector"
                aria-label="Hide the inspector"
              >
                <PanelRightClose style={{ width: 15, height: 15 }} />
              </button>
            </RailHeader>
            <div
              className="sp-builder__rail-body"
              style={{ padding: "var(--space-2xs) var(--space-xs) var(--space-md)" }}
            >
              {selectedGroup ? (
                <GroupInspector
                  group={selectedGroup}
                  computedRect={builderLayout.groupRects.get(selectedGroup.id)}
                  onChange={(patch, stream) => patchGroup(selectedGroup.id, patch, stream)}
                  onModeChange={(m) => setGroupMode(selectedGroup.id, m)}
                  onUngroup={ungroupSelection}
                  onDelete={() => deleteFields([groupChildRef(selectedGroup.id)])}
                />
              ) : singleSelected ? (
                <FieldInspector
                  field={singleSelected}
                  allFields={draft.fields}
                  canvasWidth={draft.canvasWidth}
                  canvasHeight={draft.canvasHeight}
                  focusLabelFieldId={focusLabelFieldId}
                  containingGroup={groups.find((g) => g.children.includes(singleSelected.fieldKey))}
                  computedRect={builderLayout.fieldRects.get(singleSelected.id)}
                  computedFontSize={builderLayout.fontSizes.get(singleSelected.id)}
                  worstCasePreview={worstCaseFieldId === singleSelected.id}
                  onWorstCasePreview={(on) => setWorstCaseFieldId(on ? singleSelected.id : null)}
                  onChange={(patch, stream) => patchField(singleSelected.id, patch, stream)}
                  onDelete={() => deleteFields([singleSelected.id])}
                  onBringToFront={() => reorderLayer([singleSelected.id], "front")}
                  onSendToBack={() => reorderLayer([singleSelected.id], "back")}
                />
              ) : selectedFields.length > 1 ? (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="sp-eyebrow block">Align to selection</label>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <AlignControls
                        scope="selection"
                        onAlign={alignSelection}
                        onDistribute={distributeSelection}
                        alignDisabledReason={alignDisabledReason}
                        distributeDisabledReason={distributeDisabledReason}
                      />
                    </div>
                  </div>
                  <button className="sp-btn sp-btn-primary w-full" onClick={groupSelection}>
                    Group selection {isMac ? "⌘G" : "Ctrl+G"}
                  </button>
                  <div className="grid grid-cols-2 gap-2">
                    <button className="sp-btn sp-btn-ghost" onClick={() => copyFields(selectedIds)}>
                      Copy
                    </button>
                    <button
                      className="sp-btn sp-btn-ghost"
                      onClick={() => duplicateSelected(selectedIds)}
                    >
                      Duplicate
                    </button>
                    <button
                      className="sp-btn sp-btn-ghost"
                      onClick={() => reorderLayer(selectedIds, "front")}
                    >
                      To front
                    </button>
                    <button
                      className="sp-btn sp-btn-ghost"
                      onClick={() => reorderLayer(selectedIds, "back")}
                    >
                      To back
                    </button>
                  </div>
                  <button
                    className="sp-btn sp-btn-ghost w-full"
                    style={{ color: "var(--destructive)" }}
                    onClick={() => deleteFields(selectedIds)}
                  >
                    Delete {selectedFields.length} fields
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <p style={{ fontSize: "var(--type-caption-size)", color: "var(--text-muted)" }}>
                    {draft.fields.length === 0
                      ? "Drag your first element from the palette onto the canvas. Style the template background below."
                      : "Select a field to edit it, or style the template background here."}
                  </p>
                  <div className="space-y-2">
                    <label className="sp-eyebrow block">Background color</label>
                    <ColorControl
                      ariaLabel="Template background color"
                      value={draft.backgroundColor ?? "#ffffff"}
                      onChange={(hex) =>
                        setDraft((d) => ({ ...d, backgroundColor: hex }), "bg:color")
                      }
                    />
                  </div>
                  <GradientEditor
                    label="Gradient background"
                    gradient={draft.backgroundGradient}
                    defaultStops={[
                      { position: 0, color: kit?.colors[0]?.hex ?? "#8FFF6C" },
                      { position: 1, color: kit?.colors[1]?.hex ?? "#272727" },
                    ]}
                    onChange={(backgroundGradient) =>
                      setDraft((d) => ({ ...d, backgroundGradient }), "bg:gradient")
                    }
                  />
                  <div className="space-y-2">
                    <label className="sp-eyebrow block">Background image</label>
                    <label
                      {...bgDrop.bind}
                      data-active={bgDrop.active}
                      className="sp-dropzone flex items-center justify-center gap-2 cursor-pointer py-2.5"
                      style={{
                        border: "1.5px dashed var(--border-strong)",
                        borderRadius: "var(--radius-control)",
                        fontSize: "var(--type-caption-size)",
                        color: "var(--text-secondary)",
                      }}
                    >
                      {uploading ? (
                        <RefreshCw
                          className="w-3.5 h-3.5 animate-spin"
                          style={{ color: "var(--state-primary)" }}
                        />
                      ) : (
                        <Upload
                          className="sp-dropzone__icon w-3.5 h-3.5"
                          style={{ color: "var(--state-primary)" }}
                        />
                      )}
                      {uploading
                        ? "Uploading…"
                        : draft.backgroundUrl
                          ? "Replace image"
                          : "Upload image"}
                      <input
                        type="file"
                        accept="image/png,image/jpeg"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) void onDropBackground([f]);
                        }}
                      />
                    </label>
                    {draft.backgroundUrl && (
                      <button
                        onClick={() => setDraft((d) => ({ ...d, backgroundUrl: "" }))}
                        style={{ fontSize: 11, color: "var(--destructive)" }}
                      >
                        Remove image
                      </button>
                    )}
                    <p style={{ fontSize: 10.5, color: "var(--text-muted)" }}>
                      An image covers the gradient, which covers the color.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </BuilderRail>

          {/* ── Step panels: Caption, Tags & details, Name ─────────────── */}
          {step !== "fields" && (
            <BuilderSlideOver
              title={WIZARD_STEPS.find((s) => s.key === step)?.title ?? ""}
              width={stepPanelWidth}
              onClose={() => goTo("fields")}
              footer={
                <>
                  {prevStep ? (
                    <button
                      onClick={() => goTo(prevStep)}
                      className="sp-btn sp-btn-ghost"
                      style={{ minHeight: 32 }}
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      Back
                    </button>
                  ) : (
                    <span />
                  )}
                  {nextStep ? (
                    <button
                      onClick={() => goTo(nextStep)}
                      disabled={!canGo(nextStep)}
                      className="sp-btn sp-btn-primary"
                      style={{ minHeight: 32 }}
                    >
                      Next
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <span />
                  )}
                </>
              }
            >
              {step === "name" && (
                <div className="space-y-4">
                  <p
                    style={{ fontSize: "var(--type-caption-size)", color: "var(--text-secondary)" }}
                  >
                    Members see this name in their template gallery. This is the last step: name it
                    and publish.
                  </p>
                  <input
                    autoFocus
                    value={draft.name}
                    onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }), "text:name")}
                    onFocus={(e) => {
                      // The default is a placeholder, not a choice — typing
                      // should replace it, not append to it.
                      if (e.target.value.trim() === "Untitled template") e.target.select();
                    }}
                    placeholder="e.g. Employee anniversary post"
                    className="sp-input"
                  />
                  {nameNeeded && (
                    <p
                      role="alert"
                      style={{
                        fontSize: "var(--type-caption-size)",
                        color: "var(--state-primary)",
                      }}
                    >
                      Name the template before publishing. Members find it by this name in their
                      gallery.
                    </p>
                  )}
                  <p style={{ fontSize: "var(--type-caption-size)", color: "var(--text-muted)" }}>
                    "{draft.name.trim() || "Untitled template"}" · {draft.fields.length} field
                    {draft.fields.length !== 1 ? "s" : ""} ·{" "}
                    {draft.captionTemplate ? "caption set" : "no caption"}
                  </p>
                  <button
                    onClick={() => void publish()}
                    disabled={saving || publishState !== "idle" || draft.fields.length === 0}
                    className="sp-btn sp-btn-primary w-full"
                    style={{ padding: "11px 14px" }}
                  >
                    <Send className="w-3.5 h-3.5" />
                    {draft.status === "published" ? "Publish changes" : "Publish template"}
                  </button>
                </div>
              )}

              {step === "caption" && (
                <div className="space-y-4">
                  <p
                    style={{ fontSize: "var(--type-caption-size)", color: "var(--text-secondary)" }}
                  >
                    Members get this caption next to the finished graphic, with the tags filled from
                    what they typed. Click a tag chip to insert it. Optional.
                  </p>
                  <CaptionEditor
                    value={draft.captionTemplate}
                    fields={draft.fields}
                    onChange={(captionTemplate) =>
                      setDraft((d) => ({ ...d, captionTemplate }), "text:caption")
                    }
                  />
                </div>
              )}

              {step === "details" && (
                <div className="space-y-3">
                  <p
                    style={{ fontSize: "var(--type-caption-size)", color: "var(--text-secondary)" }}
                  >
                    Shown on the template's card in the members' gallery. Optional.
                  </p>
                  <input
                    value={draft.description}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, description: e.target.value }), "text:description")
                    }
                    placeholder="Short description shown on the portal card"
                    className="sp-input"
                  />
                  <input
                    value={draft.category}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, category: e.target.value }), "text:category")
                    }
                    placeholder="Category"
                    className="sp-input"
                  />
                  <input
                    value={draft.tags.join(", ")}
                    onChange={(e) =>
                      setDraft(
                        (d) => ({
                          ...d,
                          tags: e.target.value
                            .split(",")
                            .map((t) => t.trim())
                            .filter(Boolean),
                        }),
                        "text:tags",
                      )
                    }
                    placeholder="Tags (comma-separated)"
                    className="sp-input"
                  />
                  <label
                    {...bgDrop.bind}
                    data-active={bgDrop.active}
                    className="sp-dropzone flex items-center gap-2 cursor-pointer"
                    data-radius-control
                    style={{
                      fontSize: "var(--type-caption-size)",
                      color: "var(--text-secondary)",
                      padding: "4px 6px",
                      margin: "-4px -6px",
                    }}
                  >
                    {uploading ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Upload className="sp-dropzone__icon w-3.5 h-3.5" />
                    )}
                    {uploading
                      ? "Uploading…"
                      : draft.backgroundUrl
                        ? "Replace background PNG"
                        : "Add a background PNG (optional)"}
                    <input
                      type="file"
                      accept="image/png,image/jpeg"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void onDropBackground([f]);
                      }}
                    />
                  </label>
                </div>
              )}
            </BuilderSlideOver>
          )}
        </>
      )}
    </div>
  );
}
