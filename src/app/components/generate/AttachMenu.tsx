import React, {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import type { BrandAsset } from "@/lib/types";
import { useBrand } from "@/lib/brand/BrandContext";
import { DOCUMENT_ACCEPT } from "@/lib/generate/documentText";
import type { DetailField, DetailKind, DetailTagValue } from "@/lib/generate/details";
import { ImageSourceDialog, pickableAssets } from "../ImageSourceChooser";
import {
  BackGlyph,
  BrandStudioGlyph,
  CalendarGlyph,
  ChevronRightGlyph,
  FileGlyph,
  HeadlineGlyph,
  LinkGlyph,
  LocationGlyph,
  PhotoGlyph,
} from "./icons";
import { PlusButton } from "./PlusButton";

/** The native picker's list for Photo: the three formats the upload
 * pipeline takes, the same list FieldInput's replace dialog offers. The
 * composer still checks the type and the size cap on what comes back (a
 * picker's "All files" option gets past an accept list). */
const PICKER_ACCEPT = "image/png,image/jpeg,image/webp";

/** The menu sits 8 below the plus, its left edge on the plus's, and keeps
 * 8 off the viewport's edges; flipped, 8 above the chat box. Its height is
 * capped at the room it opens into less 16, and it scrolls inside. */
const GAP = 8;
const EDGE_ROOM = 16;
/** Below the plus unless the room there is shorter than this; then above
 * the chat box when that has more room (a chat box docked at the bottom). */
const MIN_ROOM = 200;

const DETAIL_GLYPHS: Record<DetailKind, typeof HeadlineGlyph> = {
  link: LinkGlyph,
  date: CalendarGlyph,
  place: LocationGlyph,
  text: HeadlineGlyph,
};

/** The glyph for a Details row (PROMPT §11.4): a link, a date or time, a
 * place, or a headline for anything else. */
export function detailGlyphFor(field: Pick<DetailField, "kind">): typeof HeadlineGlyph {
  return DETAIL_GLYPHS[field.kind];
}

/** The Details section a template chat passes (PROMPT §11.4, §11.5). */
export interface AttachMenuDetails {
  /** The template's member text, multiline and select fields in the
   * current look, in form order (detailFieldsFor). */
  fields: DetailField[];
  /** The tags already added, so a row opens its popover pre-filled. */
  tags: DetailTagValue[];
  /** Enter or Add in a popover: the field and its trimmed, non-empty value. */
  onAdd(field: DetailField, value: string): void;
}

export interface AttachMenuHandle {
  /** Opens the detail popover for a field (a tag was clicked). */
  openDetail(fieldKey: string): void;
}

type View = { kind: "menu"; focus: "first" | "last" | string } | { kind: "detail"; key: string };

const rowEls = (menu: HTMLElement): HTMLButtonElement[] =>
  Array.from(menu.querySelectorAll<HTMLButtonElement>("[role=menuitem]"));

/** The chat box's plus and the menu it opens (Figma sp-attach-menu
 * 329:1056, v1: Upload and Details; Context comes later).
 *
 *  - UPLOAD: Photo (the native picker, into the composer's photo
 *    pipeline), File (a PDF, TXT or MD, read in the browser), and Brand
 *    Studio (the shared image dialog on the brand grid; left out when there
 *    is nothing to pick).
 *  - DETAILS, only when `details` is given (a template chat): one row per
 *    field, with its glyph, "Optional" meta and a chevron. A row opens the
 *    detail popover in the menu's place: a back button and the field's
 *    label, the input (a select for a select field), and Add. Enter or Add
 *    makes the entry a tag; back returns to the menu; Escape closes the
 *    popover and the menu in one press, adds nothing, and returns focus to
 *    the plus. An empty entry cannot be added.
 *
 * What comes back is handed on as it is, a File or a BrandAsset: the
 * composer owns the pipelines, so a photo or a document arrives the same
 * way whichever road it took.
 *
 * The menu is portaled to <body> and fixed-positioned off the plus, so it
 * is never a card nested in the chat box card (which would drop its
 * shadow). It follows the plus on scroll and resize.
 *
 * Menu-button semantics: opening moves focus to the first row; ArrowUp and
 * ArrowDown (wrapping), Home and End move between rows, and the pointer
 * moves focus with it; Enter or Space chooses; Escape closes and returns
 * focus to the plus; Tab closes and carries on from the plus; a
 * pointer-down anywhere else closes it. ArrowDown and ArrowUp on the
 * closed plus open it on the first and last row. */
export const AttachMenu = forwardRef<
  AttachMenuHandle,
  {
    /** The chat box card. A menu with no room below opens above this box
     * rather than over it. Without it, the plus's own box is used. */
    containerRef?: React.RefObject<HTMLElement | null>;
    disabled?: boolean;
    /** The first-run glow on the plus. */
    hint?: boolean;
    /** The menu opened (by pointer or keyboard). */
    onOpened?(): void;
    /** A photo from the native picker (or from the dialog's "This device"). */
    onPickFile(file: File): void;
    /** A document from the File row. */
    onPickDocument(file: File): void;
    /** A logo or image from Brand Studio. */
    onPickAsset(asset: BrandAsset): void;
    details?: AttachMenuDetails;
    /** The field whose popover is open, or null: the chat box draws that
     * tag's editing edge. */
    onEditingChange?(fieldKey: string | null): void;
  }
>(function AttachMenu(
  {
    containerRef,
    disabled = false,
    hint = false,
    onOpened,
    onPickFile,
    onPickDocument,
    onPickAsset,
    details,
    onEditingChange,
  },
  ref,
) {
  const { assets } = useBrand();
  const brandAssets = useMemo(() => pickableAssets(assets), [assets]);
  const fieldsGiven = details?.fields;
  const detailFields = useMemo(() => fieldsGiven ?? [], [fieldsGiven]);

  const [view, setView] = useState<View | null>(null);
  const open = view !== null;
  const [brandOpen, setBrandOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const docRef = useRef<HTMLInputElement>(null);
  const buttonId = useId();
  const panelId = useId();
  const uploadLabelId = useId();
  const detailsLabelId = useId();

  const onOpenedRef = useRef(onOpened);
  onOpenedRef.current = onOpened;
  const onEditingRef = useRef(onEditingChange);
  onEditingRef.current = onEditingChange;

  const editingKey = view?.kind === "detail" ? view.key : null;
  useEffect(() => {
    onEditingRef.current?.(editingKey);
  }, [editingKey]);

  const openMenu = useCallback((focus: "first" | "last") => {
    setView({ kind: "menu", focus });
    onOpenedRef.current?.();
  }, []);

  const close = useCallback((returnFocus: boolean) => {
    setView(null);
    if (returnFocus) buttonRef.current?.focus();
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      openDetail: (fieldKey: string) => {
        if (disabled || !detailFields.some((f) => f.fieldKey === fieldKey)) return;
        setView({ kind: "detail", key: fieldKey });
      },
    }),
    [disabled, detailFields],
  );

  // Fixed coordinates off the plus, measured against the real panel box.
  const place = useCallback(() => {
    const panel = panelRef.current;
    const button = buttonRef.current;
    if (!panel || !button) return;
    const b = button.getBoundingClientRect();
    const c = containerRef?.current?.getBoundingClientRect() ?? b;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const roomBelow = vh - (b.bottom + GAP) - EDGE_ROOM;
    const roomAbove = c.top - GAP - EDGE_ROOM;
    const below = roomBelow >= MIN_ROOM || roomBelow >= roomAbove;
    panel.style.maxHeight = `${Math.max(120, below ? roomBelow : roomAbove)}px`;
    const { offsetWidth: w, offsetHeight: h } = panel;
    panel.style.left = `${Math.max(GAP, Math.min(b.left, vw - w - GAP))}px`;
    panel.style.top = `${below ? b.bottom + GAP : Math.max(GAP, c.top - GAP - h)}px`;
  }, [containerRef]);

  // Position before paint, then focus what the view asks for.
  useLayoutEffect(() => {
    if (!view) return;
    place();
    const panel = panelRef.current;
    if (!panel) return;
    if (view.kind === "detail") {
      panel.querySelector<HTMLElement>("[data-detail-input]")?.focus();
      return;
    }
    const items = rowEls(panel);
    const target =
      view.focus === "first"
        ? items[0]
        : view.focus === "last"
          ? items[items.length - 1]
          : (items.find((el) => el.dataset.key === view.focus) ?? items[0]);
    target?.focus();
  }, [view, place]);

  // While open: follow the plus through scrolls (any scroller, hence the
  // capture) and resizes; close on a pointer-down outside the plus and the
  // panel, without taking focus back (the pointer has put it somewhere).
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      close(false);
    };
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, close, place]);

  // A chat box that turns inert takes its open menu with it.
  useEffect(() => {
    if (disabled) setView(null);
  }, [disabled]);

  const choose = (key: string) => {
    if (key === "photo" || key === "file") {
      // Inside the click, so the picker opens on the member's gesture.
      (key === "photo" ? photoRef : docRef).current?.click();
      close(true);
      return;
    }
    if (key === "brand") {
      close(true);
      setBrandOpen(true);
      return;
    }
    setView({ kind: "detail", key });
  };

  // Radix hands focus back to its dialog's Trigger on close, and this
  // dialog has none (it opens from the menu), so focus would land on
  // <body>. It goes back to the plus instead, a frame later: until the
  // close has committed, the dialog's focus trap would pull it back in.
  const closeBrand = () => {
    setBrandOpen(false);
    requestAnimationFrame(() => buttonRef.current?.focus());
  };

  const onButtonKeyDown = (e: React.KeyboardEvent) => {
    if (open || disabled) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      openMenu(e.key === "ArrowDown" ? "first" : "last");
    }
  };

  const onPanelKeyDown = (e: React.KeyboardEvent) => {
    const panel = panelRef.current;
    if (!panel) return;
    if (e.key === "Escape") {
      // Stops here: a surface around the chat box (the editor panel) may
      // listen for Escape too, and this one only closes what it opened.
      e.preventDefault();
      e.stopPropagation();
      close(true);
      return;
    }
    if (view?.kind !== "menu") return;
    if (e.key === "Tab") {
      // Focus moves to the plus and the Tab goes on from there, so the next
      // stop is the control after it, not the end of the page (where the
      // portaled menu sits in the document).
      close(true);
      return;
    }
    const items = rowEls(panel);
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    const to =
      e.key === "ArrowDown"
        ? (i + 1) % items.length
        : e.key === "ArrowUp"
          ? (i - 1 + items.length) % items.length
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? items.length - 1
              : null;
    if (to === null) return;
    e.preventDefault();
    items[to]?.focus();
  };

  const row = (
    key: string,
    label: string,
    Glyph: typeof HeadlineGlyph,
    extra?: { meta?: string; chevron?: boolean },
  ) => (
    <button
      key={key}
      type="button"
      role="menuitem"
      tabIndex={-1}
      data-key={key}
      className="sp-attach-menu__item"
      aria-haspopup={extra?.chevron ? "dialog" : undefined}
      // A real move, not enter: a menu opening under a resting pointer
      // must not pull focus off the row the keyboard opened it on.
      onPointerMove={(e) => {
        if (document.activeElement !== e.currentTarget) e.currentTarget.focus();
      }}
      onClick={() => choose(key)}
    >
      <Glyph className="sp-attach-menu__glyph" aria-hidden />
      <span className="sp-attach-menu__label">{label}</span>
      {extra?.meta && <span className="sp-attach-menu__meta">{extra.meta}</span>}
      {extra?.chevron && <ChevronRightGlyph className="sp-attach-menu__chevron" aria-hidden />}
    </button>
  );

  const detailField =
    view?.kind === "detail" ? detailFields.find((f) => f.fieldKey === view.key) : undefined;

  return (
    <>
      <PlusButton
        ref={buttonRef}
        id={buttonId}
        expanded={open}
        hint={hint}
        aria-controls={open ? panelId : undefined}
        disabled={disabled}
        onClick={() => (open ? close(false) : openMenu("first"))}
        onKeyDown={onButtonKeyDown}
      />
      <input
        ref={photoRef}
        type="file"
        accept={PICKER_ACCEPT}
        hidden
        tabIndex={-1}
        onChange={(e) => {
          const file = e.target.files?.[0];
          // Cleared, so choosing the same file again still fires a change.
          e.target.value = "";
          if (file) onPickFile(file);
        }}
      />
      <input
        ref={docRef}
        type="file"
        accept={DOCUMENT_ACCEPT}
        hidden
        tabIndex={-1}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) onPickDocument(file);
        }}
      />
      {view &&
        createPortal(
          view.kind === "menu" || !detailField ? (
            <div
              ref={panelRef}
              id={panelId}
              role="menu"
              aria-labelledby={buttonId}
              className="sp-card sp-attach-menu"
              onKeyDown={onPanelKeyDown}
            >
              <div role="group" aria-labelledby={uploadLabelId} className="sp-attach-menu__section">
                <div id={uploadLabelId} className="sp-attach-menu__section-label">
                  Upload
                </div>
                {row("photo", "Photo", PhotoGlyph)}
                {row("file", "File", FileGlyph)}
                {brandAssets.length > 0 && row("brand", "Brand Studio", BrandStudioGlyph)}
              </div>
              {detailFields.length > 0 && (
                <>
                  <div role="separator" className="sp-attach-menu__divider" />
                  <div
                    role="group"
                    aria-labelledby={detailsLabelId}
                    className="sp-attach-menu__section"
                  >
                    <div id={detailsLabelId} className="sp-attach-menu__section-label">
                      Details
                    </div>
                    {detailFields.map((f) =>
                      row(f.fieldKey, f.label, detailGlyphFor(f), {
                        meta: f.optional ? "Optional" : undefined,
                        chevron: true,
                      }),
                    )}
                  </div>
                </>
              )}
            </div>
          ) : (
            <DetailPopover
              key={detailField.fieldKey}
              ref={panelRef}
              id={panelId}
              field={detailField}
              initial={details?.tags.find((t) => t.fieldKey === detailField.fieldKey)?.value ?? ""}
              onKeyDown={onPanelKeyDown}
              onBack={() => setView({ kind: "menu", focus: detailField.fieldKey })}
              onAdd={(value) => {
                details?.onAdd(detailField, value);
                close(true);
              }}
            />
          ),
          document.body,
        )}
      <ImageSourceDialog
        open={brandOpen}
        onClose={closeBrand}
        assets={brandAssets}
        onPickAsset={onPickAsset}
        onPickFile={onPickFile}
        accept={PICKER_ACCEPT}
        title="Choose from Brand Studio"
        initialView="brand"
      />
    </>
  );
});

/** The detail popover (Figma "Add · Date & time" in 490:1541): a back
 * button and the field's label, the input, and Add. It takes the menu's
 * place and anchor. The input enforces the field's maxLength; a select
 * field offers its options. */
const DetailPopover = forwardRef<
  HTMLDivElement,
  {
    id: string;
    field: DetailField;
    initial: string;
    onKeyDown(e: React.KeyboardEvent): void;
    onBack(): void;
    onAdd(value: string): void;
  }
>(function DetailPopover({ id, field, initial, onKeyDown, onBack, onAdd }, ref) {
  const [value, setValue] = useState(initial);
  const titleId = useId();
  const inputId = useId();
  const ready = value.trim().length > 0;
  const add = () => {
    if (ready) onAdd(value.trim());
  };
  return (
    <div
      ref={ref}
      id={id}
      role="dialog"
      aria-labelledby={titleId}
      className="sp-card sp-attach-menu sp-detail-popover"
      onKeyDown={onKeyDown}
    >
      <div className="sp-detail-popover__head">
        <button
          type="button"
          className="sp-detail-popover__back"
          aria-label="Back to the menu"
          onClick={onBack}
        >
          <BackGlyph aria-hidden />
        </button>
        <span id={titleId} className="sp-detail-popover__title">
          {field.label}
        </span>
      </div>
      <form
        className="sp-detail-popover__body"
        onSubmit={(e) => {
          e.preventDefault();
          // The chat box is a form too; this one never submits it.
          e.stopPropagation();
          add();
        }}
      >
        <label htmlFor={inputId} className="sr-only">
          {field.label}
        </label>
        {field.type === "select" ? (
          <select
            id={inputId}
            data-detail-input
            className="sp-chat-input sp-detail-popover__input"
            data-empty={!value || undefined}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          >
            <option value="" disabled>
              Choose one
            </option>
            {(field.options ?? []).map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        ) : (
          <input
            id={inputId}
            data-detail-input
            className="sp-chat-input sp-detail-popover__input"
            // Text, not url: "socialpaint.ai/careers" has no scheme and is
            // still the link the member means. The keyboard is the url one.
            type="text"
            inputMode={field.kind === "link" ? "url" : undefined}
            value={value}
            maxLength={field.maxLength}
            placeholder={field.placeholder}
            autoComplete="off"
            onChange={(e) => setValue(e.target.value)}
          />
        )}
        <div className="sp-detail-popover__foot">
          <button
            type="submit"
            className="sp-chat-btn sp-detail-popover__add"
            aria-disabled={!ready || undefined}
          >
            Add
          </button>
        </div>
      </form>
    </div>
  );
});
