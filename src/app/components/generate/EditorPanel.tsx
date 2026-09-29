import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import type { BrandKit } from "@/lib/types";
import type { ChatDraft, ChatPhoto } from "@/lib/generate/chat";
import { draftName, previewValues } from "@/lib/generate/draftView";
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
import { ErrorBoundary } from "../ErrorBoundary";
import { FieldInput } from "../FieldInput";
import { SchemaRenderer, type SchemaRendererHandle } from "../SchemaRenderer";
import { ChatButton } from "./ChatButton";
import { EditorField } from "./EditorField";
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
}) {
  const { kit } = useBrand();
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
  const blocked = useMemo(() => {
    if (!selected) return null;
    const missing = missingFields(selected, values);
    if (missing.length === 0) return null;
    const hits = new Set(missing.map((f) => findGroupForField(entries, selected.id, f.fieldKey)));
    const listed = entries.filter((e) => hits.has(e));
    const unlisted = missing
      .filter((f) => !findGroupForField(entries, selected.id, f.fieldKey))
      .map((f) => f.label);
    return { first: listed[0], labels: [...listed.map((e) => e.label), ...unlisted] };
  }, [selected, values, entries]);

  // ── Focus ───────────────────────────────────────────────────────────────
  const hostRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const fieldsRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const fades = useScrollFades(fieldsRef);
  // The list mounts with its first field, so it is held as state too.
  const [fieldsEl, setFieldsEl] = useState<HTMLDivElement | null>(null);
  const setFields = useCallback((el: HTMLDivElement | null) => {
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

  const panel = (
    <aside
      ref={panelRef}
      className="sp-card sp-chat-editor"
      data-presentation={presentation}
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

      {options.length > 1 && selected && (
        <SegmentSwitch
          variant="editor"
          options={options}
          selectedId={selected.id}
          onSelect={onSelectDraft}
          aria-label="Size"
        />
      )}

      <div className="sp-chat-editor__stage">
        {shown.length > 0
          ? shown.map((d) => (
              <StageGraphic
                key={d.id}
                draft={d}
                photo={photo}
                kit={kit}
                visible={d.id === selected?.id}
                rendererRef={rendererRef}
                onWarnings={setWarnings}
              />
            ))
          : drafts[0] && (
              <p className="sp-chat-editor__gone">{draftName(drafts[0])} is no longer available.</p>
            )}
      </div>
      {selected && warnings.length > 0 && (
        <p role="status" className="sp-chat-editor__warning">
          {warnings[0]}
        </p>
      )}

      {entries.length > 0 && (
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
          {entries.map((entry) => {
            const id = controlId(prefix, entry);
            return (
              <EditorField
                key={entry.id}
                label={entry.label}
                htmlFor={id}
                optional={entry.kind === "text" && !entry.required}
              >
                <FieldInput
                  variant="chat"
                  field={inputField(entry, usable)}
                  value={groupValue(entry, usable, selected?.id)}
                  onChange={(next) => onEdit(editsFor(entry, next))}
                  inputId={id}
                />
              </EditorField>
            );
          })}
        </div>
      )}

      <div className="sp-chat-editor__spacer" aria-hidden />

      <div className="sp-chat-editor__footer">
        {hint && <p className="sp-chat-editor__hint">{hint}</p>}
        {saveToLibrary && <SaveToLibrary {...saveToLibrary} />}
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
        {blocked && (
          <p id={blockedId} className="sp-chat-editor__note" role="status" aria-live="polite">
            Fill required: {blocked.labels.join(", ")}
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
      {panel}
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
}: {
  draft: ChatDraft;
  photo: ChatPhoto | null;
  kit: BrandKit | null;
  visible: boolean;
  rendererRef: React.RefObject<SchemaRendererHandle | null>;
  onWarnings(warnings: string[]): void;
}) {
  const values = useMemo(() => previewValues(draft, photo), [draft, photo]);
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
          />
        </div>
      </div>
    </ErrorBoundary>
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
