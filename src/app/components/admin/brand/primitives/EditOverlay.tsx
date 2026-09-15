import React from "react";
import { Pencil } from "lucide-react";

/** The thumbnail edit affordance (D8): a scrim with a centred pencil chip,
 * absolutely positioned over the parent. The PARENT is the interactive
 * element — it carries `.sp-has-overlay`, `position: relative`, and the
 * accessible name ("Edit Slime"); the overlay itself is decoration, shown
 * by the parent's hover (hover-capable devices only) and keyboard focus via
 * CSS. No transition, by design. `small` is for thumbnails under 80px tall. */
export function EditOverlay({ small = false }: { small?: boolean }) {
  const glyph = small ? 16 : 20;
  return (
    <span className="sp-edit-overlay" aria-hidden>
      <span className={`sp-edit-overlay__chip${small ? " sp-edit-overlay__chip--sm" : ""}`}>
        <Pencil style={{ width: glyph, height: glyph }} />
      </span>
    </span>
  );
}
