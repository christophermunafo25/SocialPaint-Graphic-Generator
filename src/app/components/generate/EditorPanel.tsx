import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle } from "lucide-react";
import type { BrandKit, TemplateField } from "@/lib/types";
import type { ChatDraft, ChatPhoto } from "@/lib/generate/chat";
import { captionFor, draftName, previewValues, tooLongFields } from "@/lib/generate/draftView";
import { indefiniteArticle } from "@/lib/generate/tryNext";
import { blockedNote } from "@/lib/generate/editDetails";
import { createCanvasMeasurer } from "@/lib/render/autoFit";
import type { Rect } from "@/lib/render/layout";
import {
  EXPORT_ERROR_TITLE,
  exportErrorMessage,
  instrumentsUsage,
  missingFields,
} from "@/lib/generate/draftDownload";
import {
  buildLinkedFields,
  editsFor,
  findGroupForField,
  groupValue,
  inputField,
  photoTargetsFor,
  sizeNames,
  sizeTitle,
  type LinkedEdit,
  type LinkedEntry,
} from "@/lib/generate/linkedFields";
import { useBrand } from "@/lib/brand/BrandContext";
import { TOO_LONG_ERROR, requiredError } from "@/lib/templates/fieldCopy";
import { DetailField, DetailsPanel } from "../details/DetailsPanel";
import { Button, Toast } from "../primitives";
import { ErrorBoundary } from "../ErrorBoundary";
import { FieldInput } from "../FieldInput";
import { SchemaRenderer, type SchemaRendererHandle } from "../SchemaRenderer";
import { ChatButton } from "./ChatButton";
import { EditorField, fieldStatus } from "./EditorField";
import { TagPlusGlyph } from "./icons";
import { CloseButton } from "./IconButton";
import { useScrollFades } from "./ScrollFade";
import { SegmentSwitch, type SegmentOption } from "./SegmentSwitch";

/** Save to library, for a freestyle draft and an admin viewer (PROMPT
 * §8.5, §15 item 10). The page owns the store call and its state; the
 * panel draws it with the one-shot page's copy. */
export interface EditorSaveToLibrary {
  state: "idle" | "busy" | "saved" | "error";
  /** The save's own message, shown while `state` is "error". */
  error?: string;
  onSave(): void;
  onOpenBuilder(): void;
}

/** How long the export failure toast stays up (TemplateFill's error toast),
 * the panel's and the page's alike. */
export const EXPORT_TOAST_MS = 6000;

/** The footer hint (PROMPT §8.5): what an edit reaches, by how many sizes
 * the turn has. Nothing for one. */
function editsHint(sizes: number): string | null {
  if (sizes === 2) return "Edits update both sizes.";
  if (sizes >= 3) return "Edits update every size.";
  return null;
}

/** How far the fields list's edge fades reach, in px: the list keeps a
 * field it scrolls to (focus, a Try next chip) clear of them. The CSS's
 * --editor-fields-fade is the same length. */
const FIELDS_FADE = 32;

/** A control's id from an entry's (unique in the list, stable while the
 * drafts are), under the panel's own prefix so two panels never clash. */
const controlId = (prefix: string, entry: LinkedEntry) =>
  `${prefix}${entry.id.replace(/\s+/g, "_")}`;

/** The element a field's focus lands on. A text, multiline or select field
 * is its own control. An image slot's id is on react-dropzone's file input,
 * which is clipped to nothing (it can take focus, but shows no ring and is
 * out of the tab order), so the slot's first visible control does (the
 * upload well, its brand tab, or Replace image). */
function focusTarget(control: HTMLElement): HTMLElement | null {
  const fileInput = control instanceof HTMLInputElement && control.type === "file";
  if (!fileInput && control.getClientRects().length > 0) return control;
  return (
    control
      .closest(".sp-chat-field")
      ?.querySelector<HTMLElement>(
        'input:not([type="file"]), textarea, select, button, [tabindex="0"]',
      ) ?? null
  );
}

/** Scrolls `el`'s field into the fields list's view, `inset` in from its
 * edges (clear of the edge fades, or of the list's edge when it is too
 * short to draw them), and nothing else: the page and the panel stay where
 * they are (focus is moved with preventScroll). */
function reveal(scroller: HTMLElement, el: HTMLElement, inset: number) {
  const box = scroller.getBoundingClientRect();
  const rect = (el.closest(".sp-chat-field") ?? el).getBoundingClientRect();
  const top = box.top + inset;
  const bottom = box.bottom - inset;
  if (rect.top < top) scroller.scrollTop -= top - rect.top;
  else if (rect.bottom > bottom)
    scroller.scrollTop += Math.min(rect.bottom - bottom, rect.top - top);
}

/** The fields list's ring room: its own padding, the focus ring's reach. */
const ringRoom = (list: HTMLElement) => parseFloat(getComputedStyle(list).paddingTop) || 0;

/** Whether the fields list is tall enough for its edge fades: both fades,
 * and its tallest field (an upload well, most often) with its ring's reach
 * between them. A shorter list, on a short window, draws no fades, so no
 * focused field is ever veiled by one. */
function hasFadeRoom(list: HTMLElement): boolean {
  let tallest = 0;
  for (const child of Array.from(list.children)) {
    tallest = Math.max(tallest, (child as HTMLElement).offsetHeight);
  }
  // 1px of slack for fractional layout.
  return list.clientHeight + 1 >= 2 * FIELDS_FADE + tallest + 2 * ringRoom(list);
}

/** reveal() inside the fields list, clear of its fades, or of its edges
 * when it is too short to draw them. */
function revealInList(list: HTMLElement | null, el: HTMLElement) {
  if (list) reveal(list, el, hasFadeRoom(list) ? FIELDS_FADE : ringRoom(list));
}

/** hasFadeRoom, kept current as the list or any field changes size, or
 * fields come and go. */
function useFadeRoom(list: HTMLElement | null): boolean {
  const [room, setRoom] = useState(true);
  useEffect(() => {
    if (!list) return;
    const check = () => setRoom(hasFadeRoom(list));
    const ro = new ResizeObserver(check);
    const observe = () => {
      ro.disconnect();
      ro.observe(list);
      for (const child of Array.from(list.children)) ro.observe(child);
    };
    const mo = new MutationObserver(() => {
      observe();
      check();
    });
    observe();
    mo.observe(list, { childList: true });
    check();
    return () => {
      ro.disconnect();
      mo.disconnect();
    };
  }, [list]);
  return room;
}

/** The member field an entry edits on one draft: a text group's member on
 * it, or an image slot of it. Undefined when the entry has none there. */
function fieldKeyOn(entry: LinkedEntry, draftId: string): string | undefined {
  if (entry.kind === "image") return entry.draftId === draftId ? entry.field.fieldKey : undefined;
  return entry.members.find((m) => m.draftId === draftId)?.fieldKey;
}

/** An empty input's placeholder (template-chat PROMPT §11.12): the field's
 * own, else "Add a location" from its label. */
function withPlaceholder(field: TemplateField): TemplateField {
  if (field.placeholder || field.type === "image" || field.type === "select") return field;
  const label = field.label.trim().toLowerCase();
  return label ? { ...field, placeholder: `Add ${indefiniteArticle(label)} ${label}` } : field;
}

/** The focusable elements inside `root`, in tab order, for the sheet's
 * focus trap (the panel itself, focusable only so a click on its body keeps
 * focus inside, is not one of them). */
function tabbables(root: HTMLElement): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((el) => el.tabIndex >= 0 && el.getClientRects().length > 0);
}

/**
 * The Generate chat's editor (Figma "Generate · Chat", frame 06, "Editor
 * panel"; PROMPT §8.5, §9.5). Opened from a draft card's preview, or by the
 * Try next row's fill chip on one field; it edits every draft of the turn
 * at once and exports the one it shows.
 *
 * A card on the surface recipe, 380 wide, a column 16 apart:
 *
 *  1. "Edit details" and Close.
 *  2. With two or more drafts, the size switch (SegmentSwitch's editor
 *     look), "Instagram · 4:5", or "Instagram 1" and "Instagram 2" for
 *     drafts of one size (linkedFields' sizeNames), each segment's tooltip
 *     the design's name and size (sizeTitle): which draft the preview shows
 *     and Download PNG exports. Edits reach every draft whichever is
 *     picked.
 *  3. The preview stage, 290 tall on the --gen-well: the picked draft
 *     rendered live by the one renderer (SchemaRenderer), with the turn's
 *     photo in its slot, contained 10 inside the well (the frame's 216 ×
 *     270 for 4:5). Its first layout warning shows under it, as on the fill
 *     page. On a short window the stage gives up a little height (down to
 *     180) so the fields keep room.
 *  4. The fields (linkedFields.ts): one input per linked group (a field the
 *     drafts share is edited once and written to each), then the image
 *     slots the photo does not fill, each FieldInput in the chat look. An
 *     input reads the value of the draft on the stage. The list scrolls
 *     inside the panel when it runs taller than the room, its edges fading
 *     where more lies past them.
 *  5. A spacer, then the footer: the hint when there is more than one size,
 *     Save to library when the page offers it (freestyle, admin), and
 *     Download PNG, which exports the preview's own canvas through
 *     exportPng(), the fill page's path, so it is the same PNG. Like the
 *     fill page's Download it waits for every required field of the draft
 *     on the stage (missingFields): until then it says which ("Fill
 *     required: …", TemplateFill's line) and takes the member to the first.
 *
 * Usage is recorded where it always is, inside SchemaRenderer: a published
 * library draft previews with `instrument` on, so opening it here records
 * the fill page's `open` and Download PNG its `download`; a freestyle
 * design has no template row and records nothing (instrumentsUsage). One
 * open is one visit, as on the fill page: each draft the switch has shown
 * keeps its renderer mounted (out of sight) until the panel closes, so
 * switching back to a size records nothing new.
 *
 * Focus lands on the first field when the panel opens, or on the field a
 * `focusRequest` names (a new nonce asks again while it is open). Escape
 * closes it (onClose), from anywhere in it (a click on its body keeps focus
 * there), unless a dialog inside it (the image cropper) is the one being
 * dismissed; the page returns focus to the preview that opened it.
 *
 * `presentation` "inline" is the frame's: the page lays the panel beside
 * the narrowed chat and it fills the row's height. "sheet" (below 1180px)
 * lays the same panel over the chat on the right, full height, over a
 * --media-overlay scrim that closes it on click; the sheet is modal, so
 * Tab stays inside it. Both wrap the panel the same way, so crossing
 * 1180px while it is open (a tablet turning) moves it without remounting:
 * the field being typed in keeps focus, and nothing is opened again.
 *
 * An export that fails says so in TemplateFill's toast: an ExportAssetError
 * names the image that did not load, anything else gets the generic line.
 * `exportError` is the page's own export failure (a card download) to show
 * the same way while the panel is open: each new message shows once.
 */
export function EditorPanel({
  drafts,
  photo,
  selectedDraftId,
  onSelectDraft,
  onEdit,
  onClose,
  focusRequest = null,
  presentation,
  saveToLibrary = null,
  exportError = null,
  stageTarget = null,
  looks = null,
  caption = null,
  openDrafts = null,
  onDiscard,
  canDiscard = false,
  details = false,
}: {
  /** The turn's drafts. A draft whose template is gone (schema null)
   * cannot be edited or shown, and is left out of the switch and the
   * fields. */
  drafts: ChatDraft[];
  /** The turn's photo, shown and exported in each draft's target slot. */
  photo: ChatPhoto | null;
  selectedDraftId: string;
  onSelectDraft(id: string): void;
  onEdit(edits: LinkedEdit[]): void;
  onClose(): void;
  /** Focus this field's input (Try next's fill chip, or a card's Download
   * that found a field to fill). A new nonce asks again; without one the
   * first field takes focus on open. */
  focusRequest?: { draftId: string; fieldKey: string; nonce: number } | null;
  presentation: "inline" | "sheet";
  saveToLibrary?: EditorSaveToLibrary | null;
  exportError?: string | null;
  /** Edit details' stage (template-chat PROMPT §12.7): the page's large
   * well. The draft is rendered there instead of in the panel, with the
   * Missing markers over it, and the panel has no preview of its own. */
  stageTarget?: HTMLElement | null;
  /** The look switch, for a template with more than one look. */
  looks?: { options: SegmentOption[]; selectedId: string; onSelect(id: string): void } | null;
  /** The Caption field: the caption shown, and the member's own. */
  caption?: { value: string; onChange(next: string): void } | null;
  /** The drafts as they were when the panel opened: a field that differs
   * from them says "Edited". */
  openDrafts?: ChatDraft[] | null;
  /** Discard puts the fields, the look and the caption back. */
  onDiscard?(): void;
  /** Something has changed since the panel opened. */
  canDiscard?: boolean;
  /** The template chat's Edit details (PHASE-4 §9 D4): drawn as the
   * Details panel from its first render (its stage arrives a commit later,
   * and a panel that changed form then would remount and drop focus). */
  details?: boolean;
}) {
  const { kit } = useBrand();
  const stageMode = stageTarget !== null;
  const captionId = useId();
  const prefix = useId();
  const titleId = useId();
  const blockedId = useId();

  const usable = useMemo(() => drafts.filter((d) => d.schema !== null), [drafts]);
  const selected = usable.find((d) => d.id === selectedDraftId) ?? usable[0] ?? null;
  const values = useMemo(() => (selected ? previewValues(selected, photo) : {}), [selected, photo]);
  const options = useMemo((): SegmentOption[] => {
    const names = sizeNames(usable, { ratio: "always" });
    return usable.map((d, i) => ({ id: d.id, label: names[i], title: sizeTitle(d) }));
  }, [usable]);

  const entries = useMemo(
    () => buildLinkedFields(usable, { kit, photoTargets: photoTargetsFor(usable, photo) }),
    [usable, kit, photo],
  );

  // Every draft the stage has shown in this open keeps its renderer, so a
  // size seen once records no second open (the list only grows; a draft
  // that leaves the turn leaves the stage with it).
  const [shownIds, setShownIds] = useState<readonly string[]>([]);
  if (selected && !shownIds.includes(selected.id)) setShownIds([...shownIds, selected.id]);
  const shown = usable.filter((d) => d.id === selected?.id || shownIds.includes(d.id));

  // Download PNG waits for the stage's draft to be complete, as the fill
  // page's does: the entries that fill its gaps, in the panel's order,
  // name them, and the first is where the button takes the member.
  // A value too long for its line at its floor blocks it too (§9.4),
  // measured against the draft's look as the stage paints it.
  const measure = useMemo(() => createCanvasMeasurer(), []);
  const tooLong = useMemo(
    () => new Set(selected ? tooLongFields(selected, values, kit, measure) : []),
    [selected, values, kit, measure],
  );
  const missingKeys = useMemo(
    () => new Set(selected ? missingFields(selected, values).map((f) => f.fieldKey) : []),
    [selected, values],
  );
  const blocked = useMemo(() => {
    if (!selected) return null;
    const missing = missingFields(selected, values);
    if (missing.length === 0 && tooLong.size === 0) return null;
    const hits = new Set(missing.map((f) => findGroupForField(entries, selected.id, f.fieldKey)));
    const listed = entries.filter((e) => hits.has(e));
    const unlisted = missing
      .filter((f) => !findGroupForField(entries, selected.id, f.fieldKey))
      .map((f) => f.label);
    const long = entries.filter((e) => {
      const key = fieldKeyOn(e, selected.id);
      return key !== undefined && tooLong.has(key);
    });
    return {
      first: listed[0] ?? long[0],
      note: blockedNote(
        [...listed.map((e) => e.label), ...unlisted],
        long.map((e) => e.label),
      ),
    };
  }, [selected, values, entries, tooLong]);

  // Each field's status (§11.11): Missing, Too long, Edited.
  const statusOf = useCallback(
    (entry: LinkedEntry) => {
      if (!selected) return null;
      const key = fieldKeyOn(entry, selected.id);
      if (key === undefined) return null;
      const opened = openDrafts?.find((d) => d.id === selected.id);
      const was = opened ? (opened.values[key] ?? "") : undefined;
      return fieldStatus({
        missing: missingKeys.has(key),
        tooLong: tooLong.has(key),
        edited: was !== undefined && was !== (selected.values[key] ?? ""),
      });
    },
    [selected, openDrafts, missingKeys, tooLong],
  );

  // ── Focus ───────────────────────────────────────────────────────────────
  const hostRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const fieldsRef = useRef<HTMLElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const fades = useScrollFades(fieldsRef);
  // The list mounts with its first field, so it is held as state too.
  const [fieldsEl, setFieldsEl] = useState<HTMLElement | null>(null);
  const setFields = useCallback((el: HTMLElement | null) => {
    fieldsRef.current = el;
    setFieldsEl(el);
  }, []);
  const fadeRoom = useFadeRoom(fieldsEl);

  const focusEntry = useCallback(
    (entry: LinkedEntry | undefined): boolean => {
      if (!entry) return false;
      const control = document.getElementById(controlId(prefix, entry));
      const target = control && focusTarget(control);
      if (!target) return false;
      target.focus({ preventScroll: true });
      revealInList(fieldsRef.current, target);
      return true;
    },
    [prefix],
  );

  // On open, the requested field or the first; after that, only a new
  // request moves focus (typing never re-runs it).
  const focusedOnce = useRef(false);
  const handledNonce = useRef<number | null>(null);
  useEffect(() => {
    const fresh = focusRequest !== null && focusRequest.nonce !== handledNonce.current;
    if (focusedOnce.current && !fresh) return;
    focusedOnce.current = true;
    if (focusRequest) handledNonce.current = focusRequest.nonce;
    const asked = focusRequest
      ? findGroupForField(entries, focusRequest.draftId, focusRequest.fieldKey)
      : undefined;
    if (!focusEntry(asked ?? entries[0])) closeRef.current?.focus({ preventScroll: true });
  }, [focusRequest, entries, focusEntry]);

  /** A Missing marker on the stage: focus its field's input. */
  const focusField = useCallback(
    (fieldKey: string) => {
      if (selected) focusEntry(findGroupForField(entries, selected.id, fieldKey));
    },
    [selected, entries, focusEntry],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      if (e.defaultPrevented) return;
      const target = e.target as Element;
      // Portaled content (the brand image dialog, the cropper) bubbles here
      // through the React tree, and a dialog inside the panel owns its own
      // Escape: neither closes the panel.
      if (!panelRef.current?.contains(target)) return;
      const dialog = target.closest('[role="dialog"]');
      if (dialog && dialog !== hostRef.current) return;
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key === "Tab" && presentation === "sheet" && panelRef.current) {
      const list = tabbables(panelRef.current);
      if (list.length === 0) return;
      const first = list[0];
      const last = list[list.length - 1];
      const active = document.activeElement;
      // On the panel itself (a click on its body put focus there), Tab
      // goes to the first stop and Shift+Tab to the last.
      if (active === panelRef.current) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  // The sheet is modal: Escape closes it even when focus has fallen out of
  // it to the page (the control it was on went away), since nothing else
  // on the page can take the key while the sheet is up. A key meant for a
  // dialog opened from it never reaches here: focus is in that dialog.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    if (presentation !== "sheet") return;
    const onDocumentKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      if (e.target !== document.body && e.target !== document.documentElement) return;
      e.preventDefault();
      onCloseRef.current();
    };
    document.addEventListener("keydown", onDocumentKey);
    return () => document.removeEventListener("keydown", onDocumentKey);
  }, [presentation]);

  // ── Preview and export ──────────────────────────────────────────────────
  const rendererRef = useRef<SchemaRendererHandle>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState<{ detail: string; at: number } | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  const showError = useCallback((detail: string) => {
    window.clearTimeout(toastTimer.current);
    setToast({ detail, at: Date.now() });
    toastTimer.current = window.setTimeout(() => setToast(null), EXPORT_TOAST_MS);
  }, []);

  // The page's own export failure, once per message.
  useEffect(() => {
    if (exportError) showError(exportError);
  }, [exportError, showError]);

  const download = async () => {
    if (exporting || !rendererRef.current) return;
    setExporting(true);
    try {
      await rendererRef.current.exportPng();
    } catch (e) {
      console.error("Export failed", e);
      showError(exportErrorMessage(e));
    } finally {
      setExporting(false);
    }
  };

  const hint = editsHint(usable.length);

  const stage =
    shown.length > 0
      ? shown.map((d) => (
          <StageGraphic
            key={d.id}
            draft={d}
            photo={photo}
            kit={kit}
            visible={d.id === selected?.id}
            rendererRef={rendererRef}
            onWarnings={setWarnings}
            onMarker={stageMode ? focusField : undefined}
          />
        ))
      : drafts[0] && (
          <p className="sp-chat-editor__gone">{draftName(drafts[0])} is no longer available.</p>
        );

  // Edit details (the template chat, 13:8148; PHASE-4 §9 D4): the same
  // logic on the Details panel. Missing and Too long show on each field's
  // error line, Edited on its label row; Discard and Download PNG close it.
  const editedOf = (entry: LinkedEntry): boolean => {
    if (!selected) return false;
    const key = fieldKeyOn(entry, selected.id);
    const opened = openDrafts?.find((d) => d.id === selected.id);
    if (key === undefined || !opened) return false;
    return (opened.values[key] ?? "") !== (selected.values[key] ?? "");
  };
  const errorOf = (entry: LinkedEntry): string | undefined => {
    if (!selected) return undefined;
    const key = fieldKeyOn(entry, selected.id);
    if (key === undefined) return undefined;
    if (missingKeys.has(key)) {
      return requiredError({ label: entry.label, type: entry.kind === "image" ? "image" : "text" });
    }
    return tooLong.has(key) ? TOO_LONG_ERROR : undefined;
  };
  const openedCaption = useMemo(() => {
    const opened = selected && openDrafts?.find((d) => d.id === selected.id);
    return opened ? captionFor(opened, { templateFallback: false }) : null;
  }, [selected, openDrafts]);
  const detailsPanel = details ? (
    <DetailsPanel
      title="Edit details"
      onClose={onClose}
      closeRef={closeRef}
      panelRef={panelRef}
      panelProps={
        {
          role: "complementary",
          "aria-label": "Edit details",
          tabIndex: -1,
          onKeyDown,
          "data-presentation": presentation,
        } as React.HTMLAttributes<HTMLElement>
      }
      className="sp-tchat-details"
      formRef={setFields as React.Ref<HTMLFormElement>}
      look={looks}
      fieldRows={entries.map((entry) => (
        <DetailField
          key={entry.id}
          controlId={controlId(prefix, entry)}
          field={withPlaceholder(inputField(entry, usable))}
          value={groupValue(entry, usable, selected?.id)}
          onChange={(next) => onEdit(editsFor(entry, next))}
          optional={entry.kind === "text" ? !entry.required : undefined}
          error={errorOf(entry)}
          edited={editedOf(entry)}
        />
      ))}
      caption={
        caption
          ? {
              value: caption.value,
              onChange: caption.onChange,
              edited: openedCaption !== null && openedCaption !== caption.value,
            }
          : null
      }
      footer={
        <>
          {onDiscard && (
            <Button kind="neutral" size="lg" disabled={!canDiscard} onClick={onDiscard}>
              Discard
            </Button>
          )}
          <Button
            kind="primary"
            size="lg"
            className="sp-details__grow"
            aria-busy={exporting || undefined}
            onClick={() => {
              if (blocked) focusEntry(blocked.first);
              else if (selected && !exporting) void download();
            }}
          >
            Download PNG
          </Button>
        </>
      }
    />
  ) : null;

  const panel = (
    <aside
      ref={panelRef}
      className="sp-card sp-chat-editor"
      data-presentation={presentation}
      data-stage={stageMode || undefined}
      role="complementary"
      aria-label="Edit details"
      // Focusable, never a tab stop: a click on the panel's body (the
      // stage, the header) keeps focus in it, so Escape and the sheet's
      // Tab trap still work.
      tabIndex={-1}
      onKeyDown={onKeyDown}
    >
      <div className="sp-chat-editor__header">
        <h2 id={titleId} className="sp-chat-editor__title">
          Edit details
        </h2>
        <CloseButton ref={closeRef} onClick={onClose} />
      </div>

      {!stageMode && options.length > 1 && selected && (
        <SegmentSwitch
          variant="editor"
          options={options}
          selectedId={selected.id}
          onSelect={onSelectDraft}
          aria-label="Size"
        />
      )}

      {!stageMode && <div className="sp-chat-editor__stage">{stage}</div>}
      {stageMode && stageTarget && createPortal(stage, stageTarget)}
      {selected && warnings.length > 0 && (
        <p role="status" className="sp-chat-editor__warning">
          {warnings[0]}
        </p>
      )}

      {(entries.length > 0 || looks || caption) && (
        <div
          ref={setFields}
          className="sp-chat-editor__fields"
          data-short={!fadeRoom || undefined}
          data-fade-top={(fadeRoom && fades.top) || undefined}
          data-fade-bottom={(fadeRoom && fades.bottom) || undefined}
          // Every focus in the list shows its whole field: the browser
          // leaves a control that is partly in view where it is, which on
          // a short list can cut its lower edge (and its focus border).
          // Focus inside a portaled dialog bubbles here too; it is not the
          // list's to scroll.
          onFocus={(e) => {
            const list = fieldsRef.current;
            if (list?.contains(e.target)) revealInList(list, e.target);
          }}
        >
          {looks && looks.options.length > 1 && (
            <div className="sp-chat-field">
              <div className="sp-chat-field__labelrow">
                <span className="sp-chat-field__label" id={`${prefix}look`}>
                  Look
                </span>
              </div>
              <SegmentSwitch
                variant="editor"
                options={looks.options}
                selectedId={looks.selectedId}
                onSelect={looks.onSelect}
                aria-labelledby={`${prefix}look`}
              />
            </div>
          )}
          {entries.map((entry) => {
            const id = controlId(prefix, entry);
            return (
              <EditorField
                key={entry.id}
                label={entry.label}
                htmlFor={id}
                optional={entry.kind === "text" && !entry.required}
                status={statusOf(entry)}
              >
                <FieldInput
                  variant="chat"
                  field={withPlaceholder(inputField(entry, usable))}
                  value={groupValue(entry, usable, selected?.id)}
                  onChange={(next) => onEdit(editsFor(entry, next))}
                  inputId={id}
                />
              </EditorField>
            );
          })}
          {caption && (
            <EditorField label="Caption" htmlFor={captionId}>
              <textarea
                id={captionId}
                className="sp-chat-input"
                rows={3}
                value={caption.value}
                placeholder="Add a caption"
                onChange={(e) => caption.onChange(e.target.value)}
              />
            </EditorField>
          )}
        </div>
      )}

      <div className="sp-chat-editor__spacer" aria-hidden />

      <div className="sp-chat-editor__footer">
        {hint && <p className="sp-chat-editor__hint">{hint}</p>}
        {saveToLibrary && <SaveToLibrary {...saveToLibrary} />}
        <div className="sp-chat-editor__actions">
          {onDiscard && (
            <ChatButton
              kind="tertiary"
              className="sp-chat-editor__discard"
              disabled={!canDiscard}
              onClick={onDiscard}
            >
              Discard
            </ChatButton>
          )}
          <ChatButton
            kind="primary"
            className="sp-chat-editor__action"
            aria-disabled={exporting || blocked !== null || !selected || undefined}
            aria-busy={exporting || undefined}
            aria-describedby={blocked ? blockedId : undefined}
            onClick={() => {
              if (blocked) focusEntry(blocked.first);
              else if (selected) void download();
            }}
          >
            Download PNG
          </ChatButton>
        </div>
        {blocked && (
          <p id={blockedId} className="sp-chat-editor__note" role="status" aria-live="polite">
            {blocked.note}
          </p>
        )}
      </div>

      {toast && <ExportErrorToast key={toast.at} detail={toast.detail} />}
    </aside>
  );

  // One wrapper in both presentations, the scrim's slot held by a hole
  // inline, so the panel keeps its place in the tree (and its renderer,
  // focus and state) when the window crosses 1180px. Inline, the wrapper
  // is display: contents, and the panel is the row's flex item.
  const sheet = presentation === "sheet";
  return (
    <div
      ref={hostRef}
      className={sheet ? "sp-chat-editor-sheet" : "sp-chat-editor-host"}
      role={sheet ? "dialog" : undefined}
      aria-modal={sheet || undefined}
      aria-labelledby={sheet ? titleId : undefined}
    >
      {sheet && <div className="sp-chat-editor-sheet__scrim" aria-hidden onClick={onClose} />}
      {detailsPanel ?? panel}
      {detailsPanel && (
        <>
          {stageTarget && createPortal(stage, stageTarget)}
          {toast && (
            <div key={toast.at} className="sp-fill-toast" aria-live="assertive">
              <Toast message={`${EXPORT_ERROR_TITLE}. ${toast.detail}`} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** One draft on the stage: its values with the turn's photo in its slot,
 * rendered live and contained in the stage at its own aspect. Out of sight
 * (hidden) while another size is picked, but mounted: its renderer is the
 * fill page's one visit for that draft. Only the visible one lends the
 * panel its export handle and its layout warnings. A template that cannot
 * render shows the fill page's line with Try again in its place. */
function StageGraphic({
  draft,
  photo,
  kit,
  visible,
  rendererRef,
  onWarnings,
  onMarker,
}: {
  draft: ChatDraft;
  photo: ChatPhoto | null;
  kit: BrandKit | null;
  visible: boolean;
  rendererRef: React.RefObject<SchemaRendererHandle | null>;
  onWarnings(warnings: string[]): void;
  /** Edit details' stage: every empty required field gets a Missing
   * marker, which focuses its field (§11.13). */
  onMarker?(fieldKey: string): void;
}) {
  const values = useMemo(() => previewValues(draft, photo), [draft, photo]);
  const missing = useMemo(
    () => (onMarker ? missingFields(draft, values) : []),
    [onMarker, draft, values],
  );
  const overlay = useCallback(
    ({ rects, scale }: { rects: ReadonlyMap<string, Rect>; scale: number }) =>
      missing.map((f) => {
        const rect = rects.get(f.id);
        return rect ? (
          <MissingMarker
            key={f.id}
            field={f}
            rect={rect}
            scale={scale}
            onClick={() => onMarker?.(f.fieldKey)}
          />
        ) : null;
      }),
    [missing, onMarker],
  );
  const schema = draft.schema;
  if (!schema) return null;
  return (
    <ErrorBoundary
      level="canvas"
      context={{ templateId: schema.id }}
      resetKeys={[schema, values]}
      fallback={(retry) => (
        <div className="sp-chat-editor__fallback" hidden={!visible}>
          <p>We couldn't display this template.</p>
          <ChatButton kind="tertiary" size="small" onClick={retry}>
            Try again
          </ChatButton>
        </div>
      )}
    >
      <div
        className="sp-chat-editor__graphic"
        hidden={!visible}
        style={
          {
            "--fit-ratio": `${schema.canvasWidth} / ${schema.canvasHeight}`,
          } as React.CSSProperties
        }
      >
        <div className="sp-chat-editor__art">
          <SchemaRenderer
            ref={visible ? rendererRef : undefined}
            schema={schema}
            values={values}
            brandKit={kit}
            instrument={instrumentsUsage(draft)}
            onWarnings={visible ? onWarnings : undefined}
            variantId={draft.variantId}
            emptyFields="chat"
            overlay={missing.length > 0 ? overlay : undefined}
          />
        </div>
      </div>
    </ErrorBoundary>
  );
}

/** A Missing marker on the edit stage (template-chat PROMPT §11.13): the
 * Missing tag in the marker colours (a dark scrim, a white dashed edge,
 * white ink), which read on every look. A text field's sits in its reserved
 * slot, vertically centred and aligned as the field aligns its text; an
 * image field's rect is outlined, the tag centred in it. It is counter-
 * scaled so it draws at its 28px on screen whatever the stage's scale, and
 * turns with the field. It lives in the renderer's overlay, so it never
 * reaches an export; clicking it focuses the field. */
function MissingMarker({
  field,
  rect,
  scale,
  onClick,
}: {
  field: TemplateField;
  rect: Rect;
  scale: number;
  onClick(): void;
}) {
  const image = field.type === "image";
  const justify = image
    ? "center"
    : field.align === "center"
      ? "center"
      : field.align === "right"
        ? "flex-end"
        : "flex-start";
  const origin = justify === "center" ? "center" : justify === "flex-end" ? "right" : "left";
  return (
    <div
      className="sp-chat-marker"
      data-kind={image ? "image" : "text"}
      style={
        {
          left: rect.x,
          top: rect.y,
          width: rect.width,
          height: rect.height,
          justifyContent: justify,
          transform: field.rotation ? `rotate(${field.rotation}deg)` : undefined,
          "--marker-edge": `${1 / Math.max(scale, 0.01)}px`,
        } as React.CSSProperties
      }
    >
      <button
        type="button"
        className="sp-chat-marker__tag"
        aria-label={`Add ${field.label}`}
        style={{ transform: `scale(${1 / Math.max(scale, 0.01)})`, transformOrigin: origin }}
        onClick={onClick}
      >
        <TagPlusGlyph aria-hidden />
        <span>{field.label}</span>
      </button>
    </div>
  );
}

/** An export that failed, in TemplateFill's error toast: the danger tone,
 * "Couldn't export the graphic", and `detail` under it (an ExportAssetError
 * names the image that did not load; anything else gets the generic line).
 * The panel shows it for Download PNG, and the page for a card download
 * while the panel is closed; the caller takes it down. */
export function ExportErrorToast({ detail }: { detail: string }) {
  return (
    <div className="sp-toast" data-tone="danger" role="alert" aria-live="assertive">
      <AlertTriangle className="sp-chat-editor__toast-icon" aria-hidden />
      <span className="sp-chat-editor__toast-text">
        <span className="sp-chat-editor__toast-title">{EXPORT_ERROR_TITLE}</span>
        <span className="sp-chat-editor__toast-detail">{detail}</span>
      </span>
    </div>
  );
}

/** Save to library in the footer (PROMPT §8.5; the one-shot page's copy).
 * Busy keeps the button (and focus on it) but refuses clicks; once saved,
 * the button gives way to "Saved to Brand Templates." and Open in the
 * builder, and focus follows to it when it was on Save. A failed save shows
 * its message over the button, which stays to try again. */
function SaveToLibrary({ state, error, onSave, onOpenBuilder }: EditorSaveToLibrary) {
  const saveRef = useRef<HTMLButtonElement | null>(null);
  const builderRef = useRef<HTMLButtonElement | null>(null);
  const hadFocus = useRef(false);

  // Save's focus is remembered across the busy state (the button stays,
  // refusing clicks) and handed to Open in the builder once it lands.
  useEffect(() => {
    if (state === "busy") return;
    if (state === "saved" && hadFocus.current) builderRef.current?.focus();
    hadFocus.current = false;
  }, [state]);

  if (state === "saved") {
    return (
      <>
        <p className="sp-chat-editor__note" role="status">
          Saved to Brand Templates.
        </p>
        <ChatButton
          ref={builderRef}
          kind="tertiary"
          className="sp-chat-editor__action"
          onClick={onOpenBuilder}
        >
          Open in the builder
        </ChatButton>
      </>
    );
  }

  const busy = state === "busy";
  return (
    <>
      {state === "error" && error && (
        <p className="sp-chat-editor__note" role="alert">
          {error}
        </p>
      )}
      <ChatButton
        ref={saveRef}
        kind="tertiary"
        className="sp-chat-editor__action"
        aria-disabled={busy || undefined}
        aria-busy={busy || undefined}
        onClick={() => {
          if (busy) return;
          hadFocus.current = document.activeElement === saveRef.current;
          onSave();
        }}
      >
        {busy ? "Saving…" : "Save to library"}
      </ChatButton>
    </>
  );
}
