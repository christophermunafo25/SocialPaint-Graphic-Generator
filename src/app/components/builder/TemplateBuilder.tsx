import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  Figma,
  Pencil,
  Plus,
  RefreshCw,
  Redo2,
  Save,
  Send,
  Undo2,
  Upload,
} from "lucide-react";
import type {
  CanvasPreset,
  DesignImportResult,
  NewTemplateInput,
  TemplateField,
  TemplateSchema,
} from "@/lib/types";
import { stores } from "@/lib/stores";
import { useAsync } from "@/lib/useAsync";
import { useHistory } from "@/lib/useHistory";
import { useAuth } from "@/lib/auth/AuthContext";
import { useBrand } from "@/lib/brand/BrandContext";
import { ErrorState } from "../ErrorState";
import { newId } from "@/lib/stores/local/db";
import { retagCaption, suggestFieldKey } from "@/lib/caption";
import { useFileDrop } from "@/lib/useFileDrop";
import { useUnsavedChangesWarning } from "@/lib/useUnsavedChangesWarning";
import { useRouter } from "../../router";
import { ColorControl } from "../ColorControl";
import { InlineEdit } from "../InlineEdit";
import { SchemaRenderer, schemaBackgroundCss } from "../SchemaRenderer";
import { GradientEditor } from "./GradientEditor";
import { FieldOverlayEditor } from "./FieldOverlayEditor";
import { FieldInspector } from "./FieldInspector";
import { CaptionEditor } from "./CaptionEditor";
import { FigmaImportDialog } from "./FigmaImportDialog";
import { FigmaFieldPicker } from "./FigmaFieldPicker";
import { ElementPalette } from "./ElementPalette";
import { FieldListPanel } from "./FieldListPanel";
import { FieldContextMenu, type MenuAction } from "./FieldContextMenu";
import { WIZARD_STEPS, WizardStepper, type WizardStep } from "./WizardStepper";
import {
  PALETTE_ITEMS,
  clipboardHasFields,
  copyToClipboard,
  duplicateFields,
  fieldFromPalette,
  isTypingTarget,
  pasteFromClipboard,
  setLayerOrder,
} from "./fieldOps";
import { composeFigmaBackground } from "@/lib/figma/composeLayers";

/** The builder is a desktop tool: below this width the canvas + inspector
 * layout breaks, so we explain rather than attempt a responsive builder.
 * The member path (Portal / TemplateUsePage) stays fully responsive. */
const BUILDER_MIN_VIEWPORT_PX = 1024;

const isMac = /Mac|iPhone|iPad/.test(navigator.platform);

/** "Saved just now" → "Saved N minutes ago". nowTick only forces re-renders. */
function savedAgo(savedAt: number, _nowTick: number): string {
  const mins = Math.floor((Date.now() - savedAt) / 60_000);
  if (mins < 1) return "Saved just now";
  if (mins === 1) return "Saved 1 minute ago";
  if (mins < 60) return `Saved ${mins} minutes ago`;
  return "Saved over an hour ago";
}

function useViewportAtLeast(px: number): boolean {
  const [matches, setMatches] = useState(
    () => window.matchMedia(`(min-width: ${px}px)`).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${px}px)`);
    const onChange = () => setMatches(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [px]);
  return matches;
}

/** Admin Template Builder: a guided wizard. Pick the source (PNG upload or
 * Figma import), then Step 1 Name → Step 2 Fields (element palette + canvas +
 * field list + inspector) → Step 3 Caption (optional) → Step 4 Tags & details
 * (optional) → Publish. Save draft is available at every step; completed
 * steps are jumpable from the persistent progress indicator. */
export function TemplateBuilder({ templateId }: { templateId: string | null }) {
  const { company } = useAuth();
  const { kit } = useBrand();
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
  /** True once a creation path was chosen — "Start blank" needs no
   * background, so backgroundUrl alone can't gate the wizard anymore. */
  const [started, setStarted] = useState<boolean>(Boolean(templateId));
  const [step, setStep] = useState<WizardStep>("name");
  const [visited, setVisited] = useState<Set<WizardStep>>(() => new Set(["name"]));
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [figmaOpen, setFigmaOpen] = useState(false);
  /** Snapshot of the last loaded/saved draft — anything else is unsaved. */
  const savedSnapshotRef = useRef<string>("");
  const [pendingImport, setPendingImport] = useState<DesignImportResult | null>(null);
  const [recomposing, setRecomposing] = useState(false);
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
    if (first) resetHistory((d) => ({ ...d, canvasWidth: first.width, canvasHeight: first.height }));
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
  const nameComplete = Boolean(draft.name.trim());
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
    if (nameComplete) s.add("name");
    if (fieldsComplete) s.add("fields");
    if (visited.has("caption")) s.add("caption");
    if (visited.has("details")) s.add("details");
    return s;
  }, [nameComplete, fieldsComplete, visited]);

  const canGo = useCallback(
    (target: WizardStep): boolean => {
      if (!sourceChosen) return false;
      if (target === "name") return true;
      if (!nameComplete) return false;
      if (target === "fields") return true;
      return fieldsComplete;
    },
    [sourceChosen, nameComplete, fieldsComplete],
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
    [],
  );

  const selectedFields = draft.fields.filter((f) => selectedIds.includes(f.id));
  const singleSelected = selectedFields.length === 1 ? selectedFields[0] : null;

  /** Patch one field; when the patch re-derives the merge tag, rewrite the
   * caption template so existing {old_key} references follow the rename. */
  const patchField = useCallback((id: string, patch: Partial<TemplateField>) => {
    setDraft(
      (d) => {
        const prev = d.fields.find((f) => f.id === id);
        const fields = d.fields.map((f) => (f.id === id ? { ...f, ...patch } : f));
        const captionTemplate =
          prev && patch.fieldKey && patch.fieldKey !== prev.fieldKey
            ? retagCaption(d.captionTemplate, prev.fieldKey, patch.fieldKey)
            : d.captionTemplate;
        return { ...d, fields, captionTemplate };
      },
      // Same field + same properties inside the window = one undo entry, so a
      // keystroke stream in the label input or a color scrub isn't forty
      // steps. Distinct properties (or a pause) still push separately.
      `patch:${id}:${Object.keys(patch).sort().join(",")}`,
    );
  }, [setDraft]);

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
      colorKey: kit?.colors.find((c) => c.key === "text")?.key ?? kit?.colors[0]?.key,
      align: "left",
      autoFit: true,
    };
    setFields([...draft.fields, field]);
    setSelectedIds([field.id]);
    setFocusLabelFieldId(field.id);
  };

  /** Primary path: a palette element dropped (or clicked) onto the canvas —
   * pre-sized, pre-typed; fields immediately open for naming (shapes don't
   * need a name — they're design-only). */
  const addPaletteField = (paletteId: string, at?: { x: number; y: number }) => {
    const item = PALETTE_ITEMS.find((p) => p.id === paletteId);
    if (!item) return;
    const point = at ?? { x: draft.canvasWidth / 2, y: draft.canvasHeight / 2 };
    const field = fieldFromPalette(item, point, draft.fields, kit, {
      width: draft.canvasWidth,
      height: draft.canvasHeight,
    });
    setFields([...draft.fields, field]);
    setSelectedIds([field.id]);
    if (item.type !== "shape") setFocusLabelFieldId(field.id);
  };

  // The naming focus applies only while the just-added field stays the sole
  // selection; any other selection clears it.
  useEffect(() => {
    if (!focusLabelFieldId) return;
    if (selectedIds.length !== 1 || selectedIds[0] !== focusLabelFieldId) {
      setFocusLabelFieldId(null);
    }
  }, [selectedIds, focusLabelFieldId]);

  const deleteFields = useCallback(
    (ids: string[]) => {
      if (!ids.length) return;
      const idSet = new Set(ids);
      setDraft((d) => ({ ...d, fields: d.fields.filter((f) => !idSet.has(f.id)) }));
      setSelectedIds((sel) => sel.filter((id) => !idSet.has(id)));
    },
    [],
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

  // Keyboard shortcuts on the Fields step: ⌘/Ctrl C, X, V, D, Delete, Escape.
  // Never fire while typing in an input.
  useEffect(() => {
    if (step !== "fields" || mode !== "edit") return;
    const handler = (e: KeyboardEvent) => {
      if (isTypingTarget(e)) return; // native text undo stays native
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();
      if (mod && key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((mod && key === "z" && e.shiftKey) || (mod && key === "y")) {
        e.preventDefault();
        redo();
      } else if (mod && key === "c" && selectedIds.length) {
        e.preventDefault();
        copyFields(selectedIds);
      } else if (mod && key === "x" && selectedIds.length) {
        e.preventDefault();
        cutFields(selectedIds);
      } else if (mod && key === "v" && clipboardHasFields()) {
        e.preventDefault();
        pasteFields();
      } else if (mod && key === "d" && selectedIds.length) {
        e.preventDefault();
        duplicateSelected(selectedIds);
      } else if ((e.key === "Delete" || e.key === "Backspace") && selectedIds.length) {
        e.preventDefault();
        deleteFields(selectedIds);
      } else if (e.key === "Escape") {
        setSelectedIds([]);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [step, mode, selectedIds, copyFields, cutFields, pasteFields, duplicateSelected, deleteFields, undo, redo]);

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
    [company],
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
      if (quiet) setSaveFailed(true);
      else setError(e instanceof Error ? e.message : "Save failed.");
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
    const ids = selectedIds.includes(menu.fieldId) ? selectedIds : [menu.fieldId];
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
      { label: "Bring to front", onSelect: () => reorderLayer(ids, "front") },
      { label: "Send to back", onSelect: () => reorderLayer(ids, "back") },
      { label: "Delete", shortcut: "⌫", destructive: true, onSelect: () => deleteFields(ids) },
    ];
  }, [menu, selectedIds, copyFields, cutFields, pasteFields, duplicateSelected, reorderLayer, deleteFields]);

  if (!viewportOk) {
    return (
      <div className="max-w-md mx-auto text-center py-24 px-6 space-y-4">
        <p
          style={{
            fontFamily: "var(--font-head-sm)",
            fontWeight: 700,
                        fontSize: 18,
            color: "var(--text-primary)",
          }}
        >
          The builder needs a bigger screen
        </p>
        <p style={{ fontSize: 13, lineHeight: 1.6, color: "var(--text-secondary)" }}>
          Building templates takes a canvas, palette, and inspector side by side, so it
          works on laptop and desktop screens. Your team can still browse and fill in
          templates right here on this device.
        </p>
        <button className="sp-btn sp-btn-primary" onClick={() => navigate({ name: "adminTemplates" })}>
          Back to Templates
        </button>
      </div>
    );
  }
  if (templateId && templateState.status === "loading") {
    return <p className="text-center py-24 text-sm" style={{ color: "var(--muted-foreground)" }}>Loading…</p>;
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
    <div className="max-w-7xl mx-auto px-4 py-8">
      {publishState !== "idle" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(26,23,26,0.55)", backdropFilter: "blur(2px)" }}
          role="status"
          aria-live="polite"
        >
          <div
            className="w-full max-w-xs p-7 text-center space-y-3"
            style={{ background: "var(--bg-surface)", borderRadius: "var(--radius-card)", boxShadow: "var(--shadow-md)" }}
          >
            {publishState === "publishing" ? (
              <>
                <RefreshCw
                  className="animate-spin mx-auto"
                  style={{ width: 28, height: 28, color: "var(--state-primary)" }}
                />
                <p style={{ fontFamily: "var(--font-head-sm)", fontWeight: 700, fontSize: 17, color: "var(--text-primary)" }}>
                  Publishing…
                </p>
                <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  Saving "{draft.name.trim() || "Untitled template"}" and making it live for your team.
                </p>
              </>
            ) : (
              <>
                <span
                  className="mx-auto flex items-center justify-center"
                  style={{ width: 44, height: 44, borderRadius: 999, background: "var(--volt)" }}
                >
                  <Check style={{ width: 22, height: 22, color: "var(--text-primary)" }} />
                </span>
                <p style={{ fontFamily: "var(--font-head-sm)", fontWeight: 700, fontSize: 17, color: "var(--text-primary)" }}>
                  Template published
                </p>
                <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  "{draft.name.trim() || "Untitled template"}" is live. Taking you back to
                  Templates…
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {figmaOpen && (
        <FigmaImportDialog
          onClose={() => setFigmaOpen(false)}
          onImported={(result) => {
            setFigmaOpen(false);
            setPendingImport(result); // admin picks which elements become fields
          }}
        />
      )}

      {menu && (
        <FieldContextMenu x={menu.x} y={menu.y} actions={menuActions} onClose={() => setMenu(null)} />
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <button
          onClick={() => navigate({ name: "adminTemplates" })}
          style={{ fontSize: 13, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 6 }}
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
          valueStyle={{ fontFamily: "var(--font-head-sm)", fontWeight: 700, fontSize: 18, letterSpacing: "-0.3px", color: "var(--text-primary)" }}
          onSave={(name) => setDraft((d) => ({ ...d, name }), "text:name")}
        />
        <span
          className="sp-eyebrow px-2 py-1 rounded-md" style={{ background: "rgba(35,31,35,0.04)" }}
        >
          {draft.canvasWidth}×{draft.canvasHeight} · {draft.status}
          {recomposing ? " · lifting elements off background…" : ""}
        </span>
        {sourceChosen && (
          <>
            <span role="status" style={{ fontSize: 12, color: saveFailed ? "var(--state-primary)" : "var(--text-muted)" }}>
              {saving
                ? "Saving…"
                : saveFailed
                  ? "Couldn't save — retrying"
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
        <p className="mb-4 text-sm rounded-xl px-4 py-3" style={{ background: "var(--danger-wash)", color: "var(--destructive)" }}>
          {error}
        </p>
      )}

      {pendingImport ? (
        <FigmaFieldPicker
          result={pendingImport}
          kit={kit}
          onBack={() => setPendingImport(null)}
          onConfirm={(fields) => {
            const importResult = pendingImport;
            setDraft((d) => {
              const existing = [...d.fields];
              let z = maxZ(existing);
              const merged = fields.map((f) => {
                const fieldKey = suggestFieldKey(f.label, existing);
                const next = { ...f, fieldKey, zIndex: ++z };
                existing.push(next);
                return next;
              });
              return {
                ...d,
                backgroundUrl: importResult.backgroundUrl,
                canvasWidth: importResult.canvasWidth,
                canvasHeight: importResult.canvasHeight,
                fields: [...d.fields, ...merged],
              };
            });
            setPendingImport(null);
            setMode("edit");
            // A brand-new import starts at Step 1 (Name); an existing
            // template that pulled in more fields goes straight to Fields.
            goTo(draft.name.trim() ? "fields" : "name");
            // Lift the chosen elements OFF the background: re-render the frame
            // without them and swap in the recomposed PNG. On any failure the
            // flat render stays (fields overlay their baked twins).
            const excludeIds = fields
              .map((f) => f.sourceNodeId)
              .filter((id): id is string => Boolean(id));
            if (company && importResult.sourceUrl && excludeIds.length) {
              setRecomposing(true);
              void (async () => {
                try {
                  const layers = await stores.designImport.renderLayers(
                    company.id,
                    importResult.sourceUrl!,
                    excludeIds,
                  );
                  const blob = await composeFigmaBackground(layers);
                  const bgUrl = await stores.templates.uploadBackground(
                    company.id,
                    blob,
                    "figma-composed.png",
                  );
                  setDraft((d) => ({ ...d, backgroundUrl: bgUrl }));
                  if (layers.warnings.length) {
                    setError(layers.warnings.join(" "));
                  }
                } catch (e) {
                  console.error("Background recomposition failed", e);
                  setError(
                    "Couldn't lift the selected elements off the background — the flat Figma render is in use, so fields may overlap their original artwork. " +
                      (e instanceof Error ? e.message : ""),
                  );
                } finally {
                  setRecomposing(false);
                }
              })();
            }
          }}
        />
      ) : !sourceChosen ? (
        /* Source pick: two co-equal creation paths */
        <div className="max-w-3xl mx-auto py-10 space-y-5">
          <div className="text-center space-y-1 mb-2">
            <h2 style={{ fontFamily: "var(--font-head-sm)", fontWeight: 700, fontSize: 18, letterSpacing: "-0.3px", color: "var(--text-primary)" }}>
              Start your template
            </h2>
            <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
              Build from scratch, or import a designed frame — both end at the
              same place: locked design, editable fields.
              {presets[0] && ` Canvas: ${presets[0].label}.`}
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-stretch">
            {/* Path A — blank canvas */}
            <button
              onClick={() => {
                setStarted(true);
                // Straight to the canvas — the default name unblocks the
                // wizard, and publish asks for a real one.
                goTo("fields");
              }}
              className="p-8 text-center transition-all flex flex-col items-center justify-center gap-3"
              style={{
                border: "1.5px dashed var(--border-strong)",
                borderRadius: "var(--radius-card-sm)",
                background: "var(--bg-surface)",
                minHeight: 220,
                cursor: "pointer",
              }}
            >
              <Plus className="w-6 h-6" style={{ color: "var(--state-primary)" }} />
              <p style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>Start blank</p>
              <p style={{ fontSize: 12, color: "var(--text-secondary)", maxWidth: 240 }}>
                Build the design from scratch on an empty canvas — drag on
                text, images, and fixed elements.
              </p>
            </button>
            {/* Path B — Figma link */}
            <button
              onClick={() => stores.designImport.isConfigured() && setFigmaOpen(true)}
              disabled={!stores.designImport.isConfigured()}
              className="p-8 text-center transition-all flex flex-col items-center justify-center gap-3"
              style={{
                border: "1.5px dashed var(--border-strong)",
                borderRadius: "var(--radius-card-sm)",
                background: "var(--bg-surface)",
                minHeight: 220,
                cursor: stores.designImport.isConfigured() ? "pointer" : "default",
                opacity: stores.designImport.isConfigured() ? 1 : 0.55,
              }}
            >
              <Figma className="w-6 h-6" style={{ color: "var(--state-primary)" }} />
              <p style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>Import from Figma</p>
              <p style={{ fontSize: 12, color: "var(--text-secondary)", maxWidth: 240 }}>
                {stores.designImport.isConfigured()
                  ? "Paste a frame link — pick which elements become editable fields; the rest is baked into the locked design."
                  : "Requires the Supabase backend with the Figma connection configured (see docs/ARCHITECTURE.md)."}
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
                  <h2 style={{ fontFamily: "var(--font-head-sm)", fontWeight: 700, fontSize: 18, letterSpacing: "-0.3px", color: "var(--text-primary)" }}>
                    What should this template be called?
                  </h2>
                  <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                    Members see this name in their template gallery. You'll name
                    each editable field next — field names become the caption's
                    merge tags.
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
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && nameComplete) goTo("fields");
                  }}
                  placeholder="e.g. Employee anniversary post"
                  className="sp-input"
                  style={{ fontSize: 16, padding: "12px 14px" }}
                />
                {nameNeeded && (
                  <p role="alert" style={{ fontSize: 12, color: "var(--state-primary)" }}>
                    Name the template before publishing — members find it by
                    this name in their gallery.
                  </p>
                )}
              </div>
            </div>
          )}

          {step === "fields" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
              <div className="lg:col-span-3 space-y-4 w-full max-w-xl mx-auto lg:max-w-none">
                {mode === "edit" && <ElementPalette onAdd={(id) => addPaletteField(id)} />}
                <FieldListPanel
                  fields={draft.fields}
                  selectedIds={selectedIds}
                  onSelect={setSelectedIds}
                  onReorder={setFields}
                  onContextMenu={(e, fieldId) => {
                    e.preventDefault();
                    if (!selectedIds.includes(fieldId)) setSelectedIds([fieldId]);
                    setMenu({ x: e.clientX, y: e.clientY, fieldId, canvasPoint: { x: 0, y: 0 } });
                  }}
                />
              </div>

              <div className="lg:col-span-5 space-y-3 w-full max-w-xl mx-auto lg:max-w-none">
                <div className="sp-card p-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap-reverse mb-3">
                    <p style={{ fontSize: 12, color: "var(--text-muted)", flex: "1 1 260px", minWidth: 0 }}>
                      {mode === "edit"
                        ? "Drag elements from the palette onto the canvas. Drag to move, handles resize, top handle rotates. Right-click for copy/paste."
                        : "Member preview — placeholder content, locked styling."}
                    </p>
                    <div className="flex items-center gap-2 flex-shrink-0">
                    {mode === "edit" && (
                      <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid var(--border-strong)" }}>
                        <button
                          onClick={undo}
                          disabled={!canUndo}
                          title={`Undo (${isMac ? "⌘" : "Ctrl+"}Z)`}
                          aria-label="Undo"
                          className="px-2.5 py-1.5"
                          style={{ background: "var(--bg-surface)", color: canUndo ? "var(--text-secondary)" : "var(--text-disabled)", cursor: canUndo ? "pointer" : "default" }}
                        >
                          <Undo2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={redo}
                          disabled={!canRedo}
                          title={`Redo (${isMac ? "⇧⌘" : "Ctrl+Shift+"}Z)`}
                          aria-label="Redo"
                          className="px-2.5 py-1.5"
                          style={{ background: "var(--bg-surface)", color: canRedo ? "var(--text-secondary)" : "var(--text-disabled)", cursor: canRedo ? "pointer" : "default", borderLeft: "1px solid var(--border)" }}
                        >
                          <Redo2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                    <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid var(--border-strong)" }}>
                      {(["edit", "preview"] as const).map((m) => (
                        <button
                          key={m}
                          onClick={() => setMode(m)}
                          className="flex items-center gap-1.5 px-3 py-1.5 capitalize"
                          style={{
                            fontSize: 12,
                            ...(mode === m
                              ? { background: "var(--text-primary)", color: "var(--text-on-accent)" }
                              : { background: "var(--bg-surface)", color: "var(--text-secondary)" }),
                          }}
                        >
                          {m === "edit" ? <Pencil className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                          {m}
                        </button>
                      ))}
                    </div>
                    </div>
                  </div>
                  {mode === "edit" ? (
                    <FieldOverlayEditor
                      canvasWidth={draft.canvasWidth}
                      canvasHeight={draft.canvasHeight}
                      backgroundUrl={draft.backgroundUrl}
                      backgroundCss={schemaBackgroundCss(draft)}
                      fields={draft.fields}
                      selectedIds={selectedIds}
                      onSelect={setSelectedIds}
                      onChange={setFields}
                      onDraw={addDrawnField}
                      onDropElement={(id, at) => addPaletteField(id, at)}
                      onContextMenu={(pos, fieldId, canvasPoint) =>
                        setMenu({ x: pos.x, y: pos.y, fieldId, canvasPoint })
                      }
                    />
                  ) : (
                    <SchemaRenderer
                      schema={previewSchema}
                      values={{}}
                      brandKit={kit}
                      instrument={false}
                    />
                  )}
                </div>
                {stores.designImport.isConfigured() && mode === "edit" && (
                  <button
                    onClick={() => setFigmaOpen(true)}
                    style={{ fontSize: 12, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <Figma className="w-3.5 h-3.5" />
                    Import more fields from Figma
                  </button>
                )}
              </div>

              <div className="lg:col-span-4 space-y-4 w-full max-w-xl mx-auto lg:max-w-none">
                {singleSelected ? (
                  <div className="sp-card p-4">
                    <FieldInspector
                      field={singleSelected}
                      allFields={draft.fields}
                      canvasWidth={draft.canvasWidth}
                      canvasHeight={draft.canvasHeight}
                      focusLabelFieldId={focusLabelFieldId}
                      onChange={(patch) => patchField(singleSelected.id, patch)}
                      onDelete={() => deleteFields([singleSelected.id])}
                      onBringToFront={() => reorderLayer([singleSelected.id], "front")}
                      onSendToBack={() => reorderLayer([singleSelected.id], "back")}
                    />
                  </div>
                ) : selectedFields.length > 1 ? (
                  <div className="sp-card p-4 space-y-3">
                    <h3 className="sp-panel-title">{selectedFields.length} fields selected</h3>
                    <div className="grid grid-cols-2 gap-2">
                      <button className="sp-btn sp-btn-ghost" onClick={() => copyFields(selectedIds)}>Copy</button>
                      <button className="sp-btn sp-btn-ghost" onClick={() => duplicateSelected(selectedIds)}>Duplicate</button>
                      <button className="sp-btn sp-btn-ghost" onClick={() => reorderLayer(selectedIds, "front")}>To front</button>
                      <button className="sp-btn sp-btn-ghost" onClick={() => reorderLayer(selectedIds, "back")}>To back</button>
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
                    <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      {draft.fields.length === 0
                        ? "Drag your first element from the palette onto the canvas. Style the template background below."
                        : "Select a field to edit it — or style the template background here."}
                    </p>
                    <div className="space-y-2">
                      <label className="sp-eyebrow block">Background color</label>
                      <ColorControl
                        ariaLabel="Template background color"
                        value={draft.backgroundColor ?? "#ffffff"}
                        onChange={(hex) => setDraft((d) => ({ ...d, backgroundColor: hex }), "bg:color")}
                      />
                    </div>
                    <GradientEditor
                      label="Gradient background"
                      gradient={draft.backgroundGradient}
                      defaultStops={[
                        { position: 0, color: kit?.colors[0]?.hex ?? "#BCFF78" },
                        { position: 1, color: kit?.colors[1]?.hex ?? "#083B27" },
                      ]}
                      onChange={(backgroundGradient) => setDraft((d) => ({ ...d, backgroundGradient }), "bg:gradient")}
                    />
                    <div className="space-y-2">
                      <label className="sp-eyebrow block">Background image</label>
                      <label
                        {...bgDrop.bind}
                        data-active={bgDrop.active}
                        className="sp-dropzone flex items-center justify-center gap-2 cursor-pointer py-2.5"
                        style={{
                          border: "1.5px dashed var(--border-strong)",
                          borderRadius: 8,
                          fontSize: 12,
                          color: "var(--text-secondary)",
                        }}
                      >
                        {uploading ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" style={{ color: "var(--state-primary)" }} />
                        ) : (
                          <Upload className="sp-dropzone__icon w-3.5 h-3.5" style={{ color: "var(--state-primary)" }} />
                        )}
                        {uploading ? "Uploading…" : draft.backgroundUrl ? "Replace image" : "Upload image"}
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
                      <p style={{ fontSize: 10.5, color: "var(--text-disabled)" }}>
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
                  <h2 style={{ fontFamily: "var(--font-head-sm)", fontWeight: 700, fontSize: 18, letterSpacing: "-0.3px", color: "var(--text-primary)" }}>
                    Suggested caption
                    <span style={{ fontSize: 12, color: "var(--text-disabled)", fontWeight: 400 }}> · optional</span>
                  </h2>
                  <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                    Members get this caption next to the finished graphic, with
                    the tags filled from what they typed. Click a tag chip to
                    insert it.
                  </p>
                </div>
                <CaptionEditor
                  value={draft.captionTemplate}
                  fields={draft.fields}
                  onChange={(captionTemplate) => setDraft((d) => ({ ...d, captionTemplate }), "text:caption")}
                />
              </div>
            </div>
          )}

          {step === "details" && (
            <div className="max-w-2xl mx-auto py-8 space-y-4">
              <div className="sp-card p-6 space-y-4">
                <div className="space-y-1">
                  <h2 style={{ fontFamily: "var(--font-head-sm)", fontWeight: 700, fontSize: 18, letterSpacing: "-0.3px", color: "var(--text-primary)" }}>
                    Tags & details
                    <span style={{ fontSize: 12, color: "var(--text-disabled)", fontWeight: 400 }}> · optional</span>
                  </h2>
                  <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                    Shown on the template's card in the members' gallery.
                  </p>
                </div>
                <input
                  value={draft.description}
                  onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }), "text:description")}
                  placeholder="Short description shown on the portal card"
                  className="sp-input"
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    value={draft.category}
                    onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }), "text:category")}
                    placeholder="Category"
                    className="sp-input"
                  />
                  <input
                    value={draft.tags.join(", ")}
                    onChange={(e) =>
                      setDraft(
                        (d) => ({
                          ...d,
                          tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean),
                        }),
                        "text:tags",
                      )
                    }
                    placeholder="Tags (comma-separated)"
                    className="sp-input"
                  />
                </div>
                <label
                  {...bgDrop.bind}
                  data-active={bgDrop.active}
                  className="sp-dropzone flex items-center gap-2 cursor-pointer rounded-md" style={{ fontSize: 12, color: "var(--text-secondary)", padding: "4px 6px", margin: "-4px -6px" }}
                >
                  {uploading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="sp-dropzone__icon w-3.5 h-3.5" />}
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
              <div className="sp-card p-6 space-y-3">
                <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
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
    </div>
  );
}
