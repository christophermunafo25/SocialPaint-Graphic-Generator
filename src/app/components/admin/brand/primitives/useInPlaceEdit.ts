import { useCallback, useRef, useState } from "react";
import type { BrandDraft, KitShape } from "../kitPlumbing";

export interface InPlaceEdit {
  /** The one item currently editing in place, or null. */
  editingId: string | null;
  /** Open an item for editing. Starting a second item finishes the first
   * (its committed changes stay — `done` semantics, not `cancel`). */
  start(id: string): void;
  /** Close, keeping every commit made while editing. */
  done(): void;
  /** Close and restore the draft to where `start` found it — no toast. */
  cancel(): void;
}

/** In-place editing for the detail pages (one card at a time). `start`
 * records the draft snapshot; `cancel` restores it through `brand.undo`
 * (which shows no toast); `done` keeps the committed changes. On exit,
 * focus returns to the item — pages mark each resting card with
 * `data-edit-item={id}` so the hook can find it after the swap back.
 * Asset-store edits (a logo's name) are outside the kit draft and are not
 * restored by `cancel`. */
export function useInPlaceEdit(brand: BrandDraft): InPlaceEdit {
  const [editingId, setEditingId] = useState<string | null>(null);
  const snapshot = useRef<KitShape | null>(null);
  const brandRef = useRef(brand);
  brandRef.current = brand;

  const focusItem = (id: string | null) => {
    if (!id) return;
    requestAnimationFrame(() => {
      document.querySelector<HTMLElement>(`[data-edit-item="${CSS.escape(id)}"]`)?.focus();
    });
  };

  const start = useCallback((id: string) => {
    setEditingId((current) => {
      if (current === id) return current;
      snapshot.current = brandRef.current.draft;
      return id;
    });
  }, []);

  const done = useCallback(() => {
    snapshot.current = null;
    setEditingId((current) => {
      focusItem(current);
      return null;
    });
  }, []);

  const cancel = useCallback(() => {
    const snap = snapshot.current;
    snapshot.current = null;
    setEditingId((current) => {
      focusItem(current);
      return null;
    });
    if (snap && snap !== brandRef.current.draft) brandRef.current.undo(snap);
  }, []);

  return { editingId, start, done, cancel };
}
