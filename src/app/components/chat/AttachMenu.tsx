import React, {
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
import { Calendar, ChevronLeft, ChevronRight, Link2, MapPin, Type } from "lucide-react";
import type { BrandAsset } from "@/lib/types";
import { useBrand } from "@/lib/brand/BrandContext";
import { DOCUMENT_ACCEPT } from "@/lib/generate/documentText";
import {
  GENERATE_DETAILS,
  MAX_FACT_VALUE,
  type DetailTagValue,
  type GenerateDetailKind,
} from "@/lib/generate/details";
import { ImageSourceDialog, pickableAssets } from "../ImageSourceChooser";
import { BrandStudioGlyph, FileGlyph, PhotoGlyph } from "../generate/icons";
import { AttachButton, Button, Input } from "../primitives";
import { Tooltip } from "../Tooltip";

/** The native picker's list for Photo: the three formats the upload
 * pipeline takes. The composer still checks the type and the size cap on
 * what comes back (a picker's "All files" option gets past an accept
 * list). */
const PICKER_ACCEPT = "image/png,image/jpeg,image/webp";

/** The panel sits 10 under the composer box (13:1746), its left edge on
 * the plus's, and keeps 8 off the viewport's edges; flipped, 10 above the
 * box. Its height is capped at the room it opens into less 16, and it
 * scrolls inside. */
const GAP = 10;
const VIEWPORT_GAP = 8;
const EDGE_ROOM = 16;
/** Below the box unless the room there is shorter than this; then above
 * the box when that has more room (the dock at the bottom of a thread). */
const MIN_ROOM = 200;

/** The plus's tooltip (PHASE-5 §9 D3): the menu holds details too. */
export const ATTACH_TOOLTIP = "Add";

/** A row's icon: a lucide icon or one of the chat's glyphs, drawn at 18. */
type RowIcon = React.ComponentType<{ size?: number; className?: string; "aria-hidden"?: boolean }>;

const DETAIL_ICONS: Record<GenerateDetailKind["fieldKey"], RowIcon> = {
  headline: Type,
  date: Calendar,
  place: MapPin,
  link: Link2,
};

/** The row the menu opens on: the first, the last (ArrowUp on the closed
 * plus), or a detail's row (Back from its panel). */
type Focus = "first" | "last" | { row: string };

type View =
  | { kind: "menu"; focus: Focus }
  | { kind: "detail"; detail: GenerateDetailKind; returnTo: HTMLElement | null };

const rowEls = (menu: HTMLElement): HTMLButtonElement[] =>
  Array.from(menu.querySelectorAll<HTMLButtonElement>("[role=menuitem]"));

const focusableIn = (panel: HTMLElement): HTMLElement[] =>
  Array.from(panel.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled)"));

/** What the attach menu edits when the chat has details (Generate). */
export interface AttachDetails {
  /** The tags waiting beside the plus, one per kind. */
  value: readonly DetailTagValue[];
  /** Adds the kind's tag, or replaces its value when it has one. */
  onSet(detail: GenerateDetailKind, value: string): void;
}

export interface AttachMenuHandle {
  /** Opens Add a detail for this kind, filled in from its tag; focus goes
   * back to `returnTo` (the tag) when it closes. */
  editDetail(fieldKey: string, returnTo?: HTMLElement | null): void;
}

/** The composer's Attach button and the menu it opens (new look, Figma
 * 13:1746; PHASE-5 §9 D3 to D5). UPLOAD: Photo (the native picker, into the
 * composer's photo pipeline), File (a PDF, TXT or MD, read in the browser)
 * and Brand Studio (the shared image dialog on the brand grid; left out
 * when there is nothing to pick). DETAILS, when the chat takes them
 * (Generate): Headline, Date & time, Location and Link, each opening Add a
 * detail (13:2285) in the menu's place: Back, the row's name, an Input and
 * Add. A kind that already has a tag opens filled in, and Add replaces it.
 *
 * Portaled to <body> and fixed-positioned off the composer box, so it is
 * never a card nested in the composer card; it follows the box on scroll
 * and resize.
 *
 * Keyboard: opening moves focus to the first row; ArrowUp and ArrowDown
 * (wrapping), Home and End move between rows, and the pointer moves focus
 * with it; Enter or Space chooses; Escape closes and returns focus to the
 * plus (to the tag, for a panel a tag opened); Tab off either end closes
 * and carries on from the plus; a pointer-down anywhere else closes it.
 * ArrowDown and ArrowUp on the closed plus open it on the first and last
 * row. In Add a detail, Enter adds (an empty value can't be added). */
export const AttachMenu = React.forwardRef<
  AttachMenuHandle,
  {
    /** The composer card. The panel opens under it, or above it when there
     * is no room below. */
    containerRef: React.RefObject<HTMLElement | null>;
    disabled?: boolean;
    /** A photo from the native picker (or from the dialog's "This
     * device"). */
    onPickFile(file: File): void;
    /** A document from the File row. */
    onPickDocument(file: File): void;
    /** A logo or image from Brand Studio. */
    onPickAsset(asset: BrandAsset): void;
    /** The DETAILS section and its panel; left out, the menu is UPLOAD
     * only (the template chat). */
    details?: AttachDetails;
    /** Whether the menu or Add a detail is showing (Start blurs Recent). */
    onOpenChange?(open: boolean): void;
  }
>(function AttachMenu(
  {
    containerRef,
    disabled = false,
    onPickFile,
    onPickDocument,
    onPickAsset,
    details,
    onOpenChange,
  },
  ref,
) {
  const { assets } = useBrand();
  const brandAssets = useMemo(() => pickableAssets(assets), [assets]);

  const [view, setView] = useState<View | null>(null);
  const open = view !== null;
  const [draft, setDraft] = useState("");
  const [brandOpen, setBrandOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const docRef = useRef<HTMLInputElement>(null);
  const buttonId = useId();
  const panelId = useId();
  const uploadLabelId = useId();
  const detailsLabelId = useId();
  const titleId = useId();

  const openChange = useRef(onOpenChange);
  openChange.current = onOpenChange;
  useEffect(() => {
    openChange.current?.(open);
  }, [open]);
  // A menu that leaves with its composer (Start to the thread) is closed.
  useEffect(() => () => openChange.current?.(false), []);

  const close = useCallback((returnFocus: HTMLElement | null | false) => {
    setView(null);
    if (returnFocus !== false) (returnFocus ?? buttonRef.current)?.focus();
  }, []);

  const openDetail = useCallback(
    (detail: GenerateDetailKind, returnTo: HTMLElement | null) => {
      setDraft(details?.value.find((t) => t.fieldKey === detail.fieldKey)?.value ?? "");
      setView({ kind: "detail", detail, returnTo });
    },
    [details],
  );

  useImperativeHandle(
    ref,
    () => ({
      editDetail(fieldKey, returnTo = null) {
        const detail = GENERATE_DETAILS.find((d) => d.fieldKey === fieldKey);
        if (detail && !disabled) openDetail(detail, returnTo);
      },
    }),
    [openDetail, disabled],
  );

  // Fixed coordinates off the composer box, measured against the real
  // panel box.
  const place = useCallback(() => {
    const panel = panelRef.current;
    const button = buttonRef.current;
    if (!panel || !button) return;
    const b = button.getBoundingClientRect();
    const c = containerRef.current?.getBoundingClientRect() ?? b;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const roomBelow = vh - (c.bottom + GAP) - EDGE_ROOM;
    const roomAbove = c.top - GAP - EDGE_ROOM;
    const below = roomBelow >= MIN_ROOM || roomBelow >= roomAbove;
    panel.style.maxHeight = `${Math.max(120, below ? roomBelow : roomAbove)}px`;
    const { offsetWidth: w, offsetHeight: h } = panel;
    panel.style.left = `${Math.max(VIEWPORT_GAP, Math.min(b.left, vw - w - VIEWPORT_GAP))}px`;
    panel.style.top = `${below ? c.bottom + GAP : Math.max(VIEWPORT_GAP, c.top - GAP - h)}px`;
  }, [containerRef]);

  // Position before paint, then focus the row the menu opened on, or the
  // detail's input.
  useLayoutEffect(() => {
    if (!view) return;
    place();
    const panel = panelRef.current;
    if (!panel) return;
    if (view.kind === "detail") {
      const input = inputRef.current;
      input?.focus();
      input?.setSelectionRange(input.value.length, input.value.length);
      return;
    }
    const items = rowEls(panel);
    const f = view.focus;
    const target =
      f === "first"
        ? items[0]
        : f === "last"
          ? items[items.length - 1]
          : (items.find((el) => el.dataset.key === f.row) ?? items[0]);
    target?.focus();
  }, [view, place]);

  // While open: follow the box through scrolls (any scroller, hence the
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

  // A composer that turns inert takes its open menu with it.
  useEffect(() => {
    if (disabled) setView(null);
  }, [disabled]);

  const chooseUpload = (key: "photo" | "file" | "brand") => {
    if (key === "brand") {
      close(null);
      setBrandOpen(true);
      return;
    }
    // Inside the click, so the picker opens on the member's gesture.
    (key === "photo" ? photoRef : docRef).current?.click();
    close(null);
  };

  // Radix hands focus back to its dialog's Trigger on close, and this
  // dialog has none (it opens from the menu), so focus would land on
  // <body>. It goes back to the plus instead, a frame later: until the
  // close has committed, the dialog's focus trap would pull it back in.
  const closeBrand = () => {
    setBrandOpen(false);
    requestAnimationFrame(() => buttonRef.current?.focus());
  };

  const toggle = () => (open ? close(false) : setView({ kind: "menu", focus: "first" }));

  const onButtonKeyDown = (e: React.KeyboardEvent) => {
    if (open || disabled) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setView({ kind: "menu", focus: e.key === "ArrowDown" ? "first" : "last" });
    }
  };

  const returnTarget = view?.kind === "detail" ? view.returnTo : null;

  const onPanelKeyDown = (e: React.KeyboardEvent) => {
    const panel = panelRef.current;
    if (!panel) return;
    if (e.key === "Escape") {
      // Stops here: a surface around the composer (the editor panel) may
      // listen for Escape too, and this one only closes what it opened.
      e.preventDefault();
      e.stopPropagation();
      close(returnTarget);
      return;
    }
    if (view?.kind === "detail") {
      if (e.key !== "Tab") return;
      // Tab moves inside the panel; off either end it closes and carries
      // on from the plus, as the menu does.
      const items = focusableIn(panel);
      const edge = e.shiftKey ? items[0] : items[items.length - 1];
      if (document.activeElement === edge) close(null);
      return;
    }
    if (e.key === "Tab") {
      // Focus moves to the plus and the Tab goes on from there, so the next
      // stop is the control after it, not the end of the page (where the
      // portaled menu sits in the document).
      close(null);
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
    Icon: RowIcon,
    onChoose: () => void,
    chevron = false,
  ) => (
    <button
      key={key}
      type="button"
      role="menuitem"
      tabIndex={-1}
      data-key={key}
      className="ui-reset ui-menu-item sp-attach__item"
      // A real move, not enter: a menu opening under a resting pointer
      // must not pull focus off the row the keyboard opened it on.
      onPointerMove={(e) => {
        if (document.activeElement !== e.currentTarget) e.currentTarget.focus();
      }}
      onClick={onChoose}
    >
      <Icon size={18} className="ui-icon" aria-hidden />
      <span className="ui-menu-item__label t-body-s t-trim">{label}</span>
      {chevron && <ChevronRight size={16} className="ui-icon ui-menu-item__chevron" aria-hidden />}
    </button>
  );

  const trimmed = draft.trim();
  const add = () => {
    if (view?.kind !== "detail" || !trimmed || !details) return;
    details.onSet(view.detail, trimmed);
    close(view.returnTo);
  };

  let panel: React.ReactNode = null;
  if (view?.kind === "menu") {
    panel = (
      <div
        ref={panelRef}
        id={panelId}
        role="menu"
        aria-labelledby={buttonId}
        className="ui-menu sp-attach"
        onKeyDown={onPanelKeyDown}
      >
        <div role="group" aria-labelledby={uploadLabelId} className="sp-attach__section">
          <div id={uploadLabelId} className="ui-menu-label t-label-xs t-trim sp-attach__label">
            Upload
          </div>
          {row("photo", "Photo", PhotoGlyph, () => chooseUpload("photo"))}
          {row("file", "File", FileGlyph, () => chooseUpload("file"))}
          {brandAssets.length > 0 &&
            row("brand", "Brand Studio", BrandStudioGlyph, () => chooseUpload("brand"))}
        </div>
        {details && (
          <>
            <div role="separator" className="ui-menu-divider" />
            <div role="group" aria-labelledby={detailsLabelId} className="sp-attach__section">
              <div id={detailsLabelId} className="ui-menu-label t-label-xs t-trim sp-attach__label">
                Details
              </div>
              {GENERATE_DETAILS.map((d) =>
                row(d.fieldKey, d.label, DETAIL_ICONS[d.fieldKey], () => openDetail(d, null), true),
              )}
            </div>
          </>
        )}
      </div>
    );
  } else if (view?.kind === "detail") {
    const { detail } = view;
    panel = (
      <div
        ref={panelRef}
        id={panelId}
        role="dialog"
        aria-labelledby={titleId}
        className="ui-menu sp-attach sp-attach--detail"
        onKeyDown={onPanelKeyDown}
      >
        <div className="sp-attach__head">
          <button
            type="button"
            aria-label="Back"
            className="ui-reset ui-ring sp-attach__back"
            onClick={() => setView({ kind: "menu", focus: { row: detail.fieldKey } })}
          >
            <ChevronLeft size={18} className="ui-icon" aria-hidden />
          </button>
          <h2 id={titleId} className="t-label-m t-trim sp-attach__title">
            {detail.label}
          </h2>
        </div>
        <form
          className="sp-attach__body"
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <Input
            ref={inputRef}
            aria-labelledby={titleId}
            value={draft}
            maxLength={MAX_FACT_VALUE}
            placeholder={detail.placeholder}
            onChange={(e) => setDraft(e.target.value)}
          />
          <div className="sp-attach__foot">
            <Button kind="primary" size="sm" type="submit" disabled={!trimmed}>
              Add
            </Button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <>
      <Tooltip content={ATTACH_TOOLTIP} placement="right" gap={4} suppressed={open}>
        <AttachButton
          ref={buttonRef}
          id={buttonId}
          label={ATTACH_TOOLTIP}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          disabled={disabled}
          onClick={toggle}
          onKeyDown={onButtonKeyDown}
        />
      </Tooltip>
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
      {panel && createPortal(panel, document.body)}
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
