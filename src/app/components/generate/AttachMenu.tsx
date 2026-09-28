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
import { Folder, Image as ImageIcon } from "lucide-react";
import type { BrandAsset } from "@/lib/types";
import { useBrand } from "@/lib/brand/BrandContext";
import { ImageSourceDialog, pickableAssets } from "../ImageSourceChooser";
import { AttachButton } from "./IconButton";

/** The native picker's list: the three formats the upload pipeline takes,
 * the same list FieldInput's replace dialog offers. The composer still
 * checks the type and the size cap on what comes back (a picker's "All
 * files" option gets past an accept list). */
const PICKER_ACCEPT = "image/png,image/jpeg,image/webp";

/** Frame 02 (310:535): the menu's top edge sits 8 below the Attach button,
 * its left edge on the button's. The same 8 keeps it off the viewport's
 * edges and, when it flips, off the composer's top edge. */
const GAP = 8;

/** The row glyphs are lucide's image and folder (PROMPT §6), in a 16px
 * box. The Figma draws both at about 10.4 × 8.8 inside that box, where a
 * lucide glyph at 16 fills most of it, so each renders at the size that
 * puts its ink on the Figma's (the image is square in lucide, so 13 splits
 * the difference; the folder lands exactly at 12.5), with the stroke kept
 * at 1.5 screen px. The CardGlyph approach, for the menu. */
const ROWS = [
  { key: "upload", label: "Upload a photo", Icon: ImageIcon, glyph: 13 },
  { key: "brand", label: "Choose from Brand Studio", Icon: Folder, glyph: 12.5 },
] as const;

type RowKey = (typeof ROWS)[number]["key"];

const rowEls = (menu: HTMLElement): HTMLButtonElement[] =>
  Array.from(menu.querySelectorAll<HTMLButtonElement>("[role=menuitem]"));

/** The composer's Attach button and the menu it opens (Figma "Generate ·
 * Chat", sp-attach-menu 329:1056; frame 02). Two rows: "Upload a photo"
 * opens the native file picker, and "Choose from Brand Studio" opens the
 * shared image dialog straight on the brand grid (the Brand Studio logos
 * and images a member can pick, pickableAssets). That row is left out when
 * there is nothing to pick. What comes back is handed on as it is, a File
 * or a BrandAsset: the composer owns the one photo pipeline (checks,
 * downscale, aspect, the upload chip), so a photo arrives the same way
 * whichever road it took.
 *
 * The menu is portaled to <body> and fixed-positioned off the button's
 * rect, like RowMenu. That keeps it out of the composer card: as a card
 * nested in a card, the surface recipe would take its shadow away, and the
 * frame draws it lifted (the hover elevation). It opens 8 below the button
 * and, where the viewport has no room for it there (the composer docked at
 * the bottom of a chat), 8 above the composer (`containerRef`), so it never
 * covers the text being written. It follows the button on scroll and
 * resize.
 *
 * Menu-button semantics throughout: the button reports expanded and
 * controls the menu; opening moves focus to the first row; ArrowUp and
 * ArrowDown (wrapping), Home and End move between rows, and the pointer
 * moves focus with it, so the focused row is always the one drawn active;
 * Enter or Space chooses; Escape closes and returns focus to the button;
 * Tab closes and carries on from the button; a pointer-down anywhere else
 * closes it. ArrowDown and ArrowUp on the closed button open it on the
 * first and last row. */
export function AttachMenu({
  containerRef,
  disabled = false,
  onPickFile,
  onPickAsset,
}: {
  /** The composer card. A menu with no room below opens above this box
   * rather than over it. Without it, the button's own box is used. */
  containerRef?: React.RefObject<HTMLElement | null>;
  disabled?: boolean;
  /** A file from the native picker (or from the dialog's "This device"). */
  onPickFile(file: File): void;
  /** A logo or image from Brand Studio. */
  onPickAsset(asset: BrandAsset): void;
}) {
  const { assets } = useBrand();
  const brandAssets = useMemo(() => pickableAssets(assets), [assets]);
  const rows = useMemo(
    () => ROWS.filter((r) => r.key !== "brand" || brandAssets.length > 0),
    [brandAssets],
  );

  // Null when closed; otherwise the row that takes focus when it opens.
  const [openOn, setOpenOn] = useState<"first" | "last" | null>(null);
  const open = openOn !== null;
  const [brandOpen, setBrandOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const buttonId = useId();
  const menuId = useId();

  const close = useCallback((returnFocus: boolean) => {
    setOpenOn(null);
    if (returnFocus) buttonRef.current?.focus();
  }, []);

  // Fixed coordinates off the button, measured against the real menu box.
  const place = useCallback(() => {
    const menu = menuRef.current;
    const button = buttonRef.current;
    if (!menu || !button) return;
    const b = button.getBoundingClientRect();
    const c = containerRef?.current?.getBoundingClientRect() ?? b;
    const { offsetWidth: w, offsetHeight: h } = menu;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const left = Math.max(GAP, Math.min(b.left, vw - w - GAP));
    const below = b.bottom + GAP;
    const above = c.top - GAP - h;
    // Below when it fits; else above the composer when that fits; on a
    // viewport too short for either, as close to below as stays on screen.
    const top =
      below + h <= vh - GAP
        ? below
        : above >= GAP
          ? above
          : Math.max(GAP, Math.min(below, vh - GAP - h));
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
  }, [containerRef]);

  // Position before paint, then focus the row the opening asked for.
  useLayoutEffect(() => {
    if (!openOn) return;
    place();
    const items = menuRef.current ? rowEls(menuRef.current) : [];
    (openOn === "last" ? items[items.length - 1] : items[0])?.focus();
  }, [openOn, place]);

  // While open: follow the button through scrolls (any scroller, hence the
  // capture) and resizes; close on a pointer-down outside the button and
  // the menu, without taking focus back (the pointer has put it somewhere).
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (menuRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
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
    if (disabled) setOpenOn(null);
  }, [disabled]);

  const choose = (key: RowKey) => {
    if (key === "upload") {
      // Inside the click, so the picker opens on the member's gesture.
      fileRef.current?.click();
      close(true);
      return;
    }
    close(true);
    setBrandOpen(true);
  };

  // Radix hands focus back to its dialog's Trigger on close, and this
  // dialog has none (it opens from the menu), so focus would land on
  // <body>. It goes back to the Attach button instead, a frame later: until
  // the close has committed, the dialog's focus trap would pull it back in.
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

  const onMenuKeyDown = (e: React.KeyboardEvent) => {
    const menu = menuRef.current;
    if (!menu) return;
    if (e.key === "Escape") {
      // Stops here: a surface around the composer (the editor panel) may
      // listen for Escape too, and this one only closes the menu.
      e.preventDefault();
      e.stopPropagation();
      close(true);
      return;
    }
    if (e.key === "Tab") {
      // Focus moves to the button and the Tab goes on from there, so the
      // next stop is the control after it, not the end of the page (where
      // the portaled menu sits in the document).
      close(true);
      return;
    }
    const items = rowEls(menu);
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

  return (
    <>
      <AttachButton
        ref={buttonRef}
        id={buttonId}
        expanded={open}
        aria-controls={open ? menuId : undefined}
        disabled={disabled}
        onClick={() => (open ? close(false) : setOpenOn("first"))}
        onKeyDown={onButtonKeyDown}
      />
      <input
        ref={fileRef}
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
      {open &&
        createPortal(
          <div
            ref={menuRef}
            id={menuId}
            role="menu"
            aria-labelledby={buttonId}
            className="sp-card sp-chat-attach-menu"
            onKeyDown={onMenuKeyDown}
          >
            {rows.map(({ key, label, Icon, glyph }) => (
              <button
                key={key}
                type="button"
                role="menuitem"
                tabIndex={-1}
                className="sp-chat-attach-menu__item"
                // A real move, not enter: a menu opening under a resting
                // pointer must not pull focus off the row the keyboard
                // opened it on.
                onPointerMove={(e) => {
                  if (document.activeElement !== e.currentTarget) e.currentTarget.focus();
                }}
                onClick={() => choose(key)}
              >
                <span className="sp-chat-attach-menu__glyph" aria-hidden>
                  <Icon size={glyph} strokeWidth={1.5} absoluteStrokeWidth />
                </span>
                {label}
              </button>
            ))}
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
