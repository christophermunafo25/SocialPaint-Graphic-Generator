import React, {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import type { BrandAsset } from "@/lib/types";
import { useBrand } from "@/lib/brand/BrandContext";
import { DOCUMENT_ACCEPT } from "@/lib/generate/documentText";
import { ImageSourceDialog, pickableAssets } from "../ImageSourceChooser";
import { BrandStudioGlyph, FileGlyph, PhotoGlyph } from "./icons";
import { AttachButton } from "../primitives";
import { Tooltip } from "../Tooltip";
import { PLUS_TOOLTIP, PlusButton } from "./PlusButton";

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

/** The row the menu opens on: the first, or the last (ArrowUp on the
 * closed plus). */
type Focus = "first" | "last";

type RowKey = "photo" | "file" | "brand";

const rowEls = (menu: HTMLElement): HTMLButtonElement[] =>
  Array.from(menu.querySelectorAll<HTMLButtonElement>("[role=menuitem]"));

/** The chat box's plus and the menu it opens (Figma sp-attach-menu
 * 329:1056): one UPLOAD section. Photo (the native picker, into the
 * composer's photo pipeline), File (a PDF, TXT or MD, read in the
 * browser), and Brand Studio (the shared image dialog on the brand grid;
 * left out when there is nothing to pick).
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
export function AttachMenu({
  containerRef,
  disabled = false,
  onPickFile,
  onPickDocument,
  onPickAsset,
  trigger = "plus",
}: {
  /** The plus that opens it: the legacy chat box's (PlusButton), or the
   * Attach button primitive (102:569) on the new look's Composer (the
   * template chat, PHASE-4 §9 D1). Phase 5 moves Generate over. */
  trigger?: "plus" | "attach";
  /** The chat box card. A menu with no room below opens above this box
   * rather than over it. Without it, the plus's own box is used. */
  containerRef?: React.RefObject<HTMLElement | null>;
  disabled?: boolean;
  /** A photo from the native picker (or from the dialog's "This device"). */
  onPickFile(file: File): void;
  /** A document from the File row. */
  onPickDocument(file: File): void;
  /** A logo or image from Brand Studio. */
  onPickAsset(asset: BrandAsset): void;
}) {
  const { assets } = useBrand();
  const brandAssets = useMemo(() => pickableAssets(assets), [assets]);

  const [openOn, setOpenOn] = useState<Focus | null>(null);
  const open = openOn !== null;
  const [brandOpen, setBrandOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const docRef = useRef<HTMLInputElement>(null);
  const buttonId = useId();
  const panelId = useId();
  const uploadLabelId = useId();

  const close = useCallback((returnFocus: boolean) => {
    setOpenOn(null);
    if (returnFocus) buttonRef.current?.focus();
  }, []);

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

  // Position before paint, then focus the row the menu opened on.
  useLayoutEffect(() => {
    if (!openOn) return;
    place();
    const panel = panelRef.current;
    if (!panel) return;
    const items = rowEls(panel);
    (openOn === "first" ? items[0] : items[items.length - 1])?.focus();
  }, [openOn, place]);

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
    if (disabled) setOpenOn(null);
  }, [disabled]);

  const choose = (key: RowKey) => {
    if (key === "brand") {
      close(true);
      setBrandOpen(true);
      return;
    }
    // Inside the click, so the picker opens on the member's gesture.
    (key === "photo" ? photoRef : docRef).current?.click();
    close(true);
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
      setOpenOn(e.key === "ArrowDown" ? "first" : "last");
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

  const row = (key: RowKey, label: string, Glyph: typeof PhotoGlyph) => (
    <button
      key={key}
      type="button"
      role="menuitem"
      tabIndex={-1}
      data-key={key}
      className="sp-attach-menu__item"
      // A real move, not enter: a menu opening under a resting pointer
      // must not pull focus off the row the keyboard opened it on.
      onPointerMove={(e) => {
        if (document.activeElement !== e.currentTarget) e.currentTarget.focus();
      }}
      onClick={() => choose(key)}
    >
      <Glyph className="sp-attach-menu__glyph" aria-hidden />
      <span className="sp-attach-menu__label">{label}</span>
    </button>
  );

  return (
    <>
      {trigger === "attach" ? (
        <Tooltip content={PLUS_TOOLTIP} placement="right" gap={4} suppressed={open}>
          <AttachButton
            ref={buttonRef}
            id={buttonId}
            label="Add"
            aria-haspopup="menu"
            aria-expanded={open}
            aria-controls={open ? panelId : undefined}
            disabled={disabled}
            onClick={() => (open ? close(false) : setOpenOn("first"))}
            onKeyDown={onButtonKeyDown}
          />
        </Tooltip>
      ) : (
        <PlusButton
          ref={buttonRef}
          id={buttonId}
          expanded={open}
          aria-controls={open ? panelId : undefined}
          disabled={disabled}
          onClick={() => (open ? close(false) : setOpenOn("first"))}
          onKeyDown={onButtonKeyDown}
        />
      )}
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
      {openOn &&
        createPortal(
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
          </div>,
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
}
