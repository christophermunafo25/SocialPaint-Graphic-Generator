import React from "react";
import { X } from "lucide-react";

/** A photo waiting in the composer (Figma "Generate · Chat", sp-attachment
 * 328:845): a 64px square on the well fill, the image cropped to cover it,
 * with a 15px inverse-filled remove button pinned 4px in from the top-right
 * corner. The button's hit area reaches past its drawn circle (see the CSS)
 * so the tiny control stays tappable. */
export function AttachmentThumb({ src, onRemove }: { src: string; onRemove(): void }) {
  return (
    <div className="sp-chat-attachment">
      <img src={src} alt="Attached photo" className="sp-chat-attachment__img" />
      <button
        type="button"
        className="sp-chat-attachment__remove"
        aria-label="Remove photo"
        onClick={onRemove}
      >
        {/* The frame draws a 4px cross at stroke 1 in a 10px box. Lucide's
            x spans half its box, and an odd box centres on whole pixels
            in the 15px circle (an even one lands on a half pixel and
            snaps off-centre), so 9px: a 4.5px cross, centred as drawn. */}
        <X size={9} strokeWidth={1} absoluteStrokeWidth aria-hidden />
      </button>
    </div>
  );
}
