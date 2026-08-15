import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleCheck,
  Eye,
  Sparkles,
  Pencil,
  Plus,
  LoaderCircle,
  Redo2,
  Save,
  Send,
  Undo2,
  Upload,
} from "lucide-react";
import { Figma } from "../icons/BrandGlyphs";
import type {
  AutoBuildResult,
  CanvasPreset,
  DesignImportResult,
  FieldValues,
  LayoutGroup,
  NewTemplateInput,
  TemplateField,
  TemplateSchema,
} from "@/lib/types";
import { groupChildRef, isFreeGroup, parseGroupChildRef } from "@/lib/types";
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
import { Page } from "../layout/Page";
import { InlineEdit, InlineEditGroup } from "../InlineEdit";
import { SchemaRenderer, schemaBackgroundCss } from "../SchemaRenderer";
import { GradientEditor } from "./GradientEditor";
import { FieldOverlayEditor } from "./FieldOverlayEditor";
import { FieldInspector } from "./FieldInspector";
import { CaptionEditor } from "./CaptionEditor";
import { FigmaImportDialog } from "./FigmaImportDialog";
import { AutoBuildDialog } from "./AutoBuildDialog";
import { ElementPalette } from "./ElementPalette";
import { FieldListPanel } from "./FieldListPanel";
import { FieldContextMenu, type MenuAction } from "./FieldContextMenu";
import { inspectorGestureActive } from "./InspectorControls";
import { canvasGestureActive } from "./canvasGesture";
import { WIZARD_STEPS, WizardStepper, type WizardStep } from "./WizardStepper";
import {
  LOGO_PALETTE_PREFIX,
  PALETTE_ITEMS,
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
  setLayerOrder,
  svgIntrinsicSize,
  textFieldFromPaste,
  worstCaseText,
} from "./fieldOps";
import { composeFigmaBackground } from "@/lib/figma/composeLayers";
import { assembleElementFields, mergeOverlayFields } from "@/lib/figma/overlayFields";
import { isFigmaNodeUrl } from "@/lib/figma/figmaUrl";
import { unavailableFamilies } from "@/lib/render/fonts";
import { celebrate } from "@/lib/celebrate";
import { createCanvasMeasurer } from "@/lib/render/autoFit";
import { computeLayout, outermostGroupOf } from "@/lib/render/layout";
import {
  conversionShift,
  deriveFreeGroup,
  fieldIdsInGroups,
  groupIdsWithin,
  renameKeyInGroups,
  selectedFieldIds,
  selectedGroupIds,
  stripFieldsFromGroups,
  toFreeGroup,
  toStackGroup,
  ungroup,
} from "./groupOps";
import { ConfirmDialog } from "../ConfirmDialog";
import { GroupInspector } from "./GroupInspector";

/** The builder is a desktop tool: below this width the canvas + inspector
 * layout breaks, so we explain rather than attempt a responsive builder.
 * The member path (Portal / TemplateUsePage) stays fully responsive. */
const BUILDER_MIN_VIEWPORT_PX = 1024;

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
    return `The database rejected part of this template — it may be running behind the app (a migration is probably pending). Nothing was saved. Details: ${raw}`;
  }
  if (lower.includes("row-level security") || lower.includes("permission denied")) {
    return `You don't have permission to save this template. Details: ${raw}`;
  }
  if (lower.includes("failed to fetch") || lower.includes("networkerror")) {
    return "Couldn't reach the server — check your connection. Your work is still here and will save when the connection returns.";
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

/** Admin Template Builder: a guided wizard. Pick the source (PNG upload or
 * Figma import), then Step 1 Fields (element palette + canvas + field list +
 * inspector) → Step 2 Caption (optional) → Step 3 Tags & details (optional)
 * → Step 4 Name, which carries Publish. Naming last means the admin names
 * something they can see; the default "Untitled template" keeps the wizard
 * unblocked until then, and Publish refuses it. Save draft is available at
 * every step; completed steps are jumpable from the progress indicator. */
export function TemplateBuilder({ templateId }: { templateId: string | null }) {
  const { company } = useAuth();
  const { kit, assets: brandAssets } = useBrand();
  const { navigate } = useRouter();
  const viewportOk = useViewportAtLeast(BUILDER_MIN_VIEWPORT_PX);

  const presetsState = useAsync<CanvasPreset[]>(() => stores.companies.listCanvasPresets(), []);
  const presets = presetsState.status === "ready" ? presetsState.data : [];
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
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [figmaOpen, setFigmaOpen] = useState(false);
  const [autoBuildOpen, setAutoBuildOpen] = useState(false);
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

  useEffect(() => {
    // v1: the creation picker is locked to the single enabled preset, but
    // dimensions always flow preset → schema → renderer/export.
    if (presetsState.status !== "ready" || templateId) return;
    const first = presetsState.data[0];
    // Baseline, not an edit: applying the preset dims must not be undoable.
    if (first)
      resetHistory((d) => ({ ...d, canvasWidth: first.width, canvasHeight: first.height }));
  }, [presetsState, templateId, resetHistory]);

  useEffect(() => {
    if (templateState.status !== "ready" || !templateState.data) return;
    const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = templateState.data;
    resetHistory(rest); // loading installs a fresh baseline — no undo across it
    savedSnapshotRef.current = JSON.stringify(rest);
    // Editing an existing template: every step is already completed.
    setVisited(new Set<WizardStep>(["name", "fields", "caption", "details"]));
    setStep("fields");
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
          `"${g.name}" extends beyond the canvas — its content can crop on export. Shorten the content, tighten the gap, or enable "Shrink to fit".`,
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
          ? "Those elements are already in a group — ungroup them first."
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
    setNotice(`Grouped ${g.children.length} elements — “${g.name}”`);
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
        // Groups: collect the frames to translate and, for plain groups, the
        // authored fields that travel with them.
        const freeFieldKeys = new Set<string>();
        const subtree = new Set<string>();
        const visit = (grp: LayoutGroup) => {
          if (subtree.has(grp.id)) return;
          subtree.add(grp.id);
          for (const ref of grp.children) {
            const nid = parseGroupChildRef(ref);
            if (nid) {
              const nested = all.find((x) => x.id === nid);
              if (nested) visit(nested);
            } else if (isFreeGroup(grp)) {
              freeFieldKeys.add(ref);
            }
          }
        };
        for (const id of move.groupIds) {
          const g = all.find((x) => x.id === id);
          if (!g) continue;
          if (isFreeGroup(g)) visit(g);
          else subtree.add(g.id); // a stack re-places its children from its anchor
        }
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

  /** Secondary path: a raw drawn box becomes a text field. */
  const addDrawnField = (rect: { x: number; y: number; width: number; height: number }) => {
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
        setError("Couldn't add that image — try again, or upload it from the inspector.");
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
        `${fields.length} element${fields.length !== 1 ? "s" : ""} pasted from Figma — all fixed. Turn off Fixed on anything members should fill in.` +
          (missingFonts.length
            ? ` Fonts not available here: ${missingFonts.join(", ")} — upload them in Brand Studio.`
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
        setSelectedIds([]);
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
        setError("Background upload failed — check your storage configuration.");
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
    // a broken import — name the missing families and the fix.
    const missingFonts = unavailableFamilies(
      imported,
      brandAssets.filter((a) => a.kind === "font"),
    );
    const fontNote = missingFonts.length
      ? ` Fonts not available here: ${missingFonts.join(", ")} — upload them in Brand Studio so text renders as designed.`
      : "";

    setNotice(opts.summary(imported) + fontNote);
    window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(null), 8000);

    recomposeBackground(opts.sourceUrl, imported);
    return imported;
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
      fields: result.suggestedFields,
      fieldKeyFor: (f, existing) => suggestFieldKey(f.label, existing),
      summary: (imported) =>
        imported.length === 0
          ? "Nothing was detected — the background imported. Draw fields on the canvas."
          : `${imported.length} element${imported.length !== 1 ? "s" : ""} imported — all fixed, exactly as designed. Select the elements members should fill in and turn off Fixed.`,
    });
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
  const recomposeBackground = (sourceUrl: string | undefined, imported: TemplateField[]) => {
    //
    // The invariant that matters: every id excluded from the background must
    // belong to a field in the draft. An id lifted off the background with no
    // field behind it makes the element VANISH — worse than the old failure
    // mode, where a failed lift merely showed a duplicate. `excludeIds` is
    // therefore derived from `imported`, the exact array merged into the
    // draft above, never from `result.suggestedFields` — the two differ the
    // moment a merge drops or rewrites an entry.
    //
    // This runs ONCE per import. Toggling Fixed later never re-renders the
    // background: a Fixed element stays a live object on the canvas, so the
    // plate underneath it has no reason to change.
    const excludeIds = imported
      .map((f) => f.sourceNodeId)
      .filter((id): id is string => Boolean(id));
    if (company && sourceUrl && excludeIds.length) {
      setRecomposing(true);
      void (async () => {
        try {
          const layers = await stores.designImport.renderLayers(company.id, sourceUrl, excludeIds);
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
              fields: mergeOverlayFields(layers.units, imported, d.fields),
            };
          });
          if (layers.warnings.length) {
            setError(layers.warnings.join(" "));
          }
        } catch (e) {
          console.error("Background recomposition failed", e);
          setError(
            "Couldn't lift the imported elements off the background — the flat Figma render is in use, so fields may overlap their original artwork. " +
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
          label: "Paste here",
          shortcut: "⌘V",
          disabled: !clipboardHasFields(),
          onSelect: () => pasteFields(menu.canvasPoint),
        },
      ];
    }
    // Right-click on a group frame: the overlay passes the group ref.
    if (selectedGroupIds([menu.fieldId]).length) {
      return [
        { label: "Ungroup", shortcut: isMac ? "⇧⌘G" : "Ctrl+Shift+G", onSelect: ungroupSelection },
        {
          label: "Delete group",
          shortcut: "⌫",
          destructive: true,
          onSelect: () => deleteFields([menu.fieldId!]),
        },
      ];
    }
    const ids = selectedIds.includes(menu.fieldId) ? selectedIds : [menu.fieldId];
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
      { label: "Bring to front", onSelect: () => reorderLayer(ids, "front") },
      { label: "Send to back", onSelect: () => reorderLayer(ids, "back") },
      { label: "Delete", shortcut: "⌫", destructive: true, onSelect: () => deleteFields(ids) },
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
  ]);

  if (!viewportOk) {
    return (
      <div className="max-w-md mx-auto text-center py-24 px-6 space-y-4">
        <p
          style={{
            fontFamily: "var(--font-head)",
            fontWeight: "var(--weight-head)",
            fontSize: 22,
            letterSpacing: "-0.01em",
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
      <p className="text-center py-24 text-sm" style={{ color: "var(--muted-foreground)" }}>
        Loading…
      </p>
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
  // A new template needs the canvas presets before the source picker makes
  // sense; when editing, dimensions come from the loaded template instead.
  if (!templateId && presetsState.status === "error") {
    return (
      <ErrorState
        title="We couldn't load the canvas sizes."
        detail="Check your connection and try again."
        onRetry={presetsState.retry}
      />
    );
  }

  return (
    <Page>
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
                <LoaderCircle
                  className="animate-spin mx-auto"
                  style={{ width: 28, height: 28, color: "var(--state-primary)" }}
                />
                <p
                  style={{
                    fontFamily: "var(--font-head)",
                    fontWeight: "var(--weight-head)",
                    fontSize: 21,
                    letterSpacing: "-0.01em",
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
                    letterSpacing: "-0.01em",
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
        <AutoBuildDialog onClose={() => setAutoBuildOpen(false)} onBuilt={applyAutoBuild} />
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

      <ConfirmDialog
        open={pendingStack !== null}
        title="Turn on auto layout?"
        description={`The elements in "${pendingStack?.name ?? ""}" aren't arranged as a stack yet — auto layout will move them into one. Undo brings the current arrangement back.`}
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
          <CircleCheck
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

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <button
          onClick={() => navigate({ name: "adminTemplates" })}
          style={{
            fontSize: "var(--type-label-size)",
            color: "var(--text-secondary)",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Templates
        </button>
        <InlineEdit
          className="flex-1 min-w-[200px]"
          value={draft.name}
          ariaLabel="Rename this template"
          inputAriaLabel="Template name"
          placeholder="Untitled template"
          valueStyle={{
            fontFamily: "var(--font-ui)",
            fontWeight: 500,
            fontSize: "var(--type-cardtitle-size)",
            letterSpacing: "-0.01em",
            color: "var(--text-primary)",
          }}
          onSave={(name) => setDraft((d) => ({ ...d, name }), "text:name")}
        />
        <span
          className="sp-eyebrow px-2 py-1"
          style={{ background: "var(--bg-hover)", borderRadius: "var(--radius-control)" }}
        >
          {draft.canvasWidth}×{draft.canvasHeight} · {draft.status}
          {recomposing ? " · lifting elements off background…" : ""}
        </span>
        {sourceChosen && (
          <>
            <span
              role="status"
              style={{
                fontSize: "var(--type-caption-size)",
                color: saveFailed ? "var(--destructive)" : "var(--text-muted)",
                fontWeight: saveFailed ? 500 : undefined,
              }}
            >
              {saving
                ? "Saving…"
                : saveFailed
                  ? "Not saved — see the message below"
                  : dirty
                    ? "Unsaved changes"
                    : lastSavedAt
                      ? savedAgo(lastSavedAt, nowTick)
                      : null}
            </span>
            {saveFailed && !saving && (
              <button onClick={() => void doSave(undefined, true)} className="sp-btn sp-btn-ghost">
                Retry
              </button>
            )}
            <button onClick={() => void save()} disabled={saving} className="sp-btn sp-btn-ghost">
              <Save className="w-3.5 h-3.5" />
              Save draft
            </button>
          </>
        )}
      </div>

      {error && (
        <p
          className="mb-4 text-sm px-4 py-3"
          data-radius-card
          style={{ background: "var(--danger-wash)", color: "var(--destructive)" }}
        >
          {error}
        </p>
      )}

      {!sourceChosen ? (
        /* Source pick: two co-equal creation paths */
        <div className="max-w-3xl mx-auto py-10 space-y-5">
          <div className="text-center space-y-1 mb-2">
            <h2
              style={{
                fontFamily: "var(--font-head)",
                fontWeight: "var(--weight-head)",
                fontSize: 22,
                letterSpacing: "-0.01em",
                color: "var(--text-primary)",
              }}
            >
              Start your template
            </h2>
            <p style={{ fontSize: "var(--type-label-size)", color: "var(--text-secondary)" }}>
              Build from scratch, or import a designed frame — both end at the same place: locked
              design, editable fields.
              {presets[0] && ` Canvas: ${presets[0].label}.`}
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-stretch">
            {/* Path A — blank canvas */}
            <button
              onClick={() => {
                setStarted(true);
                // Straight to the canvas: Fields is Step 1.
                goTo("fields");
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
                Build the design from scratch on an empty canvas — drag on text, images, and fixed
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
                  ? "Paste a frame link — every element lands on the canvas as an editable field. Mark anything that shouldn't be as fixed."
                  : "Requires the Supabase backend with the Figma connection configured (see docs/ARCHITECTURE.md)."}
              </p>
            </button>
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
                  ? "Paste a Figma link or upload an image — Claude decides what's editable, names every field, and writes the caption. You correct in the inspector."
                  : "Requires the Supabase backend with auto-build configured (see docs/ARCHITECTURE.md)."}
              </p>
            </button>
          </div>
        </div>
      ) : (
        <>
          <WizardStepper current={step} complete={complete} canGo={canGo} onGo={goTo} />

          {step === "name" && (
            <div className="max-w-xl mx-auto py-8">
              <div className="sp-card p-6 space-y-4">
                <div className="space-y-1">
                  <h2
                    style={{
                      fontFamily: "var(--font-head)",
                      fontWeight: "var(--weight-head)",
                      fontSize: 22,
                      letterSpacing: "-0.01em",
                      color: "var(--text-primary)",
                    }}
                  >
                    What should this template be called?
                  </h2>
                  <p style={{ fontSize: "var(--type-label-size)", color: "var(--text-secondary)" }}>
                    Members see this name in their template gallery. This is the last step — name it
                    and publish.
                  </p>
                </div>
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
                  style={{ fontSize: "var(--type-cardtitle-size)", padding: "12px 14px" }}
                />
                {nameNeeded && (
                  <p
                    role="alert"
                    style={{ fontSize: "var(--type-caption-size)", color: "var(--state-primary)" }}
                  >
                    Name the template before publishing — members find it by this name in their
                    gallery.
                  </p>
                )}
              </div>
              <div className="sp-card p-6 space-y-3">
                <p style={{ fontSize: "var(--type-label-size)", color: "var(--text-secondary)" }}>
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
            </div>
          )}

          {step === "fields" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
              <div className="lg:col-span-3 space-y-4 w-full max-w-xl mx-auto lg:max-w-none">
                {mode === "edit" && (
                  <ElementPalette onAdd={(id) => addPaletteField(id)} logos={logoAssets} />
                )}
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
                  onRenameField={(fieldId, label) =>
                    patchField(fieldId, {
                      label,
                      fieldKey: suggestFieldKey(
                        label,
                        draft.fields.filter((f) => f.id !== fieldId),
                      ),
                    })
                  }
                />
              </div>

              {/* The canvas column stretches to the full row height (its
                  siblings stay items-start) so the sticky card inside it has
                  room to travel; it releases naturally at the region's end. */}
              <div className="lg:col-span-5 w-full max-w-xl mx-auto lg:max-w-none lg:self-stretch">
                <div className="lg:sticky space-y-3" style={{ top: "var(--space-lg)" }}>
                  <div className="sp-card p-4">
                    <div className="flex items-center justify-between gap-3 flex-wrap-reverse mb-3">
                      <p
                        style={{
                          fontSize: "var(--type-caption-size)",
                          color: "var(--text-muted)",
                          flex: "1 1 260px",
                          minWidth: 0,
                        }}
                      >
                        {mode === "edit"
                          ? "Drag elements from the palette onto the canvas. Drag to move, handles resize, top handle rotates. Right-click for copy/paste."
                          : "Member preview — placeholder content, locked styling."}
                      </p>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {mode === "edit" && (
                          <div
                            className="flex overflow-hidden"
                            data-radius-control
                            style={{ border: "1px solid var(--border-strong)" }}
                          >
                            <button
                              onClick={doUndo}
                              disabled={!canUndo}
                              title={`Undo (${isMac ? "⌘" : "Ctrl+"}Z)`}
                              aria-label="Undo"
                              className="px-2.5 py-1.5"
                              style={{
                                background: "var(--bg-surface)",
                                color: canUndo ? "var(--text-secondary)" : "var(--text-disabled)",
                                cursor: canUndo ? "pointer" : "default",
                              }}
                            >
                              <Undo2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={doRedo}
                              disabled={!canRedo}
                              title={`Redo (${isMac ? "⇧⌘" : "Ctrl+Shift+"}Z)`}
                              aria-label="Redo"
                              className="px-2.5 py-1.5"
                              style={{
                                background: "var(--bg-surface)",
                                color: canRedo ? "var(--text-secondary)" : "var(--text-disabled)",
                                cursor: canRedo ? "pointer" : "default",
                                borderLeft: "1px solid var(--border)",
                              }}
                            >
                              <Redo2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                        <div
                          className="flex overflow-hidden"
                          data-radius-control
                          style={{ border: "1px solid var(--border-strong)" }}
                        >
                          {(["edit", "preview"] as const).map((m) => (
                            <button
                              key={m}
                              onClick={() => setMode(m)}
                              className="flex items-center gap-1.5 px-3 py-1.5 capitalize"
                              style={{
                                fontSize: "var(--type-caption-size)",
                                ...(mode === m
                                  ? {
                                      background: "var(--fill-action)",
                                      color: "var(--text-on-action)",
                                    }
                                  : {
                                      background: "var(--bg-surface)",
                                      color: "var(--text-secondary)",
                                    }),
                              }}
                            >
                              {m === "edit" ? (
                                <Pencil className="w-3 h-3" />
                              ) : (
                                <Eye className="w-3 h-3" />
                              )}
                              {m}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    {/* The canvas sizes from its width (aspect-ratio +
                      ResizeObserver), so capping the height means capping the
                      width: never wider than what fits the viewport minus the
                      pinned chrome around it. Keeps the stuck card fully in
                      view instead of clipping. */}
                    <div
                      style={{
                        maxWidth: `min(100%, calc((100dvh - (var(--space-2xl) + var(--space-3xl))) * ${
                          draft.canvasWidth / draft.canvasHeight
                        }))`,
                        marginInline: "auto",
                      }}
                    >
                      {/* Canvas boundary: a crash on the design surface leaves
                      the wizard, toolbar, and inspector standing; the draft
                      is autosaved up to the last change. Mode switches and
                      edits reset a crashed boundary. */}
                      <ErrorBoundary
                        level="canvas"
                        context={{ templateId: savedId ?? undefined }}
                        resetKeys={[mode, draft.fields]}
                        fallback={(retry) => (
                          <ErrorState
                            title="The canvas ran into a problem."
                            detail="Everything up to your last save is safe. Try again — if it keeps happening, undo your last change."
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
                            onDraw={addDrawnField}
                            onDropElement={(id, at) => addPaletteField(id, at)}
                            onDropFiles={(files, at) => void addImageFiles(files, at)}
                            onContextMenu={(pos, fieldId, canvasPoint) =>
                              setMenu({ x: pos.x, y: pos.y, fieldId, canvasPoint })
                            }
                            onRequestLabelFocus={setFocusLabelFieldId}
                          />
                        ) : (
                          <SchemaRenderer
                            schema={previewSchema}
                            values={worstCaseValues}
                            brandKit={kit}
                            instrument={false}
                          />
                        )}
                      </ErrorBoundary>
                    </div>
                    {mode === "edit" && layoutWarnings.length > 0 && (
                      <div
                        role="status"
                        className="mt-3 px-3 py-2 space-y-1"
                        style={{
                          borderRadius: "var(--radius-control)",
                          border: "1px solid var(--border-strong)",
                          background: "var(--bg-raised)",
                        }}
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
                  </div>
                  {stores.designImport.isConfigured() && mode === "edit" && (
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => setFigmaOpen(true)}
                        style={{
                          fontSize: "var(--type-caption-size)",
                          color: "var(--text-secondary)",
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <Figma className="w-3.5 h-3.5" />
                        Import more fields from Figma
                      </button>
                      <button
                        onClick={() => setAutoBuildOpen(true)}
                        style={{
                          fontSize: "var(--type-caption-size)",
                          color: "var(--text-secondary)",
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        Auto-build with Claude
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="lg:col-span-4 space-y-4 w-full max-w-xl mx-auto lg:max-w-none">
                {selectedGroup ? (
                  <div className="sp-card p-4">
                    <GroupInspector
                      group={selectedGroup}
                      computedRect={builderLayout.groupRects.get(selectedGroup.id)}
                      onChange={(patch, stream) => patchGroup(selectedGroup.id, patch, stream)}
                      onModeChange={(m) => setGroupMode(selectedGroup.id, m)}
                      onUngroup={ungroupSelection}
                      onDelete={() => deleteFields([groupChildRef(selectedGroup.id)])}
                    />
                  </div>
                ) : singleSelected ? (
                  <div className="sp-card p-4">
                    <FieldInspector
                      field={singleSelected}
                      allFields={draft.fields}
                      canvasWidth={draft.canvasWidth}
                      canvasHeight={draft.canvasHeight}
                      focusLabelFieldId={focusLabelFieldId}
                      containingGroup={groups.find((g) =>
                        g.children.includes(singleSelected.fieldKey),
                      )}
                      computedRect={builderLayout.fieldRects.get(singleSelected.id)}
                      computedFontSize={builderLayout.fontSizes.get(singleSelected.id)}
                      worstCasePreview={worstCaseFieldId === singleSelected.id}
                      onWorstCasePreview={(on) =>
                        setWorstCaseFieldId(on ? singleSelected.id : null)
                      }
                      onChange={(patch, stream) => patchField(singleSelected.id, patch, stream)}
                      onDelete={() => deleteFields([singleSelected.id])}
                      onBringToFront={() => reorderLayer([singleSelected.id], "front")}
                      onSendToBack={() => reorderLayer([singleSelected.id], "back")}
                    />
                  </div>
                ) : selectedFields.length > 1 ? (
                  <div className="sp-card p-4 space-y-3">
                    <h3 className="sp-panel-title">{selectedFields.length} fields selected</h3>
                    <button className="sp-btn sp-btn-primary w-full" onClick={groupSelection}>
                      Group selection {isMac ? "⌘G" : "Ctrl+G"}
                    </button>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        className="sp-btn sp-btn-ghost"
                        onClick={() => copyFields(selectedIds)}
                      >
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
                  <div className="sp-card p-4 space-y-4">
                    <h3 className="sp-panel-title">Canvas</h3>
                    <p style={{ fontSize: "var(--type-caption-size)", color: "var(--text-muted)" }}>
                      {draft.fields.length === 0
                        ? "Drag your first element from the palette onto the canvas. Style the template background below."
                        : "Select a field to edit it — or style the template background here."}
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
                          <LoaderCircle
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
            </div>
          )}

          {step === "caption" && (
            <div className="max-w-2xl mx-auto py-8">
              <div className="sp-card p-6 space-y-4">
                <div className="space-y-1">
                  <h2
                    style={{
                      fontFamily: "var(--font-head)",
                      fontWeight: "var(--weight-head)",
                      fontSize: 22,
                      letterSpacing: "-0.01em",
                      color: "var(--text-primary)",
                    }}
                  >
                    Suggested caption
                    <span
                      style={{
                        fontSize: "var(--type-caption-size)",
                        color: "var(--text-muted)",
                        fontWeight: 400,
                      }}
                    >
                      {" "}
                      · optional
                    </span>
                  </h2>
                  <p style={{ fontSize: "var(--type-label-size)", color: "var(--text-secondary)" }}>
                    Members get this caption next to the finished graphic, with the tags filled from
                    what they typed. Click a tag chip to insert it.
                  </p>
                </div>
                <CaptionEditor
                  value={draft.captionTemplate}
                  fields={draft.fields}
                  onChange={(captionTemplate) =>
                    setDraft((d) => ({ ...d, captionTemplate }), "text:caption")
                  }
                />
              </div>
            </div>
          )}

          {step === "details" && (
            <div className="max-w-2xl mx-auto py-8 space-y-4">
              <div className="sp-card p-6 space-y-4">
                <div className="space-y-1">
                  <h2
                    style={{
                      fontFamily: "var(--font-head)",
                      fontWeight: "var(--weight-head)",
                      fontSize: 22,
                      letterSpacing: "-0.01em",
                      color: "var(--text-primary)",
                    }}
                  >
                    Tags & details
                    <span
                      style={{
                        fontSize: "var(--type-caption-size)",
                        color: "var(--text-muted)",
                        fontWeight: 400,
                      }}
                    >
                      {" "}
                      · optional
                    </span>
                  </h2>
                  <p style={{ fontSize: "var(--type-label-size)", color: "var(--text-secondary)" }}>
                    Shown on the template's card in the members' gallery.
                  </p>
                </div>
                {/* Labelled rows rather than placeholder-only inputs: the
                    label survives being filled in, so a stale category is
                    still readable as one. */}
                <InlineEditGroup>
                  <InlineEdit
                    label="Description"
                    value={draft.description}
                    onSave={(description) =>
                      setDraft((d) => ({ ...d, description }), "text:description")
                    }
                    ariaLabel="Edit the description"
                    inputAriaLabel="Description"
                    placeholder="Shown on the portal card"
                  />
                  <InlineEdit
                    label="Category"
                    value={draft.category}
                    onSave={(category) => setDraft((d) => ({ ...d, category }), "text:category")}
                    ariaLabel="Edit the category"
                    inputAriaLabel="Category"
                    placeholder="Uncategorised"
                  />
                  <InlineEdit
                    label="Tags"
                    value={draft.tags.join(", ")}
                    onSave={(next) =>
                      setDraft(
                        (d) => ({
                          ...d,
                          tags: next
                            .split(",")
                            .map((t) => t.trim())
                            .filter(Boolean),
                        }),
                        "text:tags",
                      )
                    }
                    ariaLabel="Edit the tags"
                    inputAriaLabel="Tags, comma-separated"
                    placeholder="Comma-separated"
                  />
                </InlineEditGroup>
                <label
                  {...bgDrop.bind}
                  data-active={bgDrop.active}
                  className="sp-dropzone flex items-center gap-2 cursor-pointer "
                  data-radius-control
                  style={{
                    fontSize: "var(--type-caption-size)",
                    color: "var(--text-secondary)",
                    padding: "4px 6px",
                    margin: "-4px -6px",
                  }}
                >
                  {uploading ? (
                    <LoaderCircle className="w-3.5 h-3.5 animate-spin" />
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
            </div>
          )}

          {/* Back / Next */}
          <div className="flex items-center justify-between mt-6">
            {prevStep ? (
              <button onClick={() => goTo(prevStep)} className="sp-btn sp-btn-ghost">
                <ArrowLeft className="w-3.5 h-3.5" />
                Back
              </button>
            ) : (
              <span />
            )}
            {nextStep && (
              <button
                onClick={() => goTo(nextStep)}
                disabled={!canGo(nextStep)}
                className="sp-btn sp-btn-primary"
              >
                Next
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </>
      )}
    </Page>
  );
}
