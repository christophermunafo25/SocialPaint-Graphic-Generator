import React from "react";
import { X } from "lucide-react";
import type { ChatDocumentKind } from "@/lib/types";
import { DocGlyph } from "./icons";

/** A photo waiting in the composer (Figma sp-attachment · D 432:56, Photo):
 * a 64px square on the well fill, the image cropped to cover it, with a
 * 15px inverse-filled remove button pinned 4px in from the top-right
 * corner. The button's hit area reaches past its drawn circle (see the CSS)
 * so the tiny control stays tappable. */
export function AttachmentThumb({ src, onRemove }: { src: string; onRemove(): void }) {
  return (
    <div className="sp-chat-attachment">
      <img src={src} alt="Attached photo" className="sp-chat-attachment__img" />
      <RemoveButton label="Remove photo" onClick={onRemove} />
    </div>
  );
}

/** A document (Figma sp-attachment · D 432:56, File): 64 tall on the
 * canvas fill, a 44px tile holding the doc glyph, then the file name over
 * its kind ("PDF", "TXT", "MD"). With `onRemove` it carries the remove
 * button (in the chat box); without it, it is the sent message's record. */
export function FileAttachment({
  name,
  kind,
  onRemove,
}: {
  name: string;
  kind: ChatDocumentKind;
  onRemove?(): void;
}) {
  return (
    <div className="sp-chat-file">
      <span className="sp-chat-file__tile" aria-hidden>
        <DocGlyph />
      </span>
      <span className="sp-chat-file__text">
        <span className="sp-chat-file__name" title={name}>
          {name}
        </span>
        <span className="sp-chat-file__kind">{kind.toUpperCase()}</span>
      </span>
      {onRemove && <RemoveButton label={`Remove ${name}`} onClick={onRemove} />}
    </div>
  );
}

function RemoveButton({ label, onClick }: { label: string; onClick(): void }) {
  return (
    <button
      type="button"
      className="sp-chat-attachment__remove"
      aria-label={label}
      onClick={onClick}
    >
      {/* The frame draws a 4px cross at stroke 1 in a 10px box. Lucide's
          x spans half its box, and an odd box centres on whole pixels
          in the 15px circle (an even one lands on a half pixel and
          snaps off-centre), so 9px: a 4.5px cross, centred as drawn. */}
      <X size={9} strokeWidth={1} absoluteStrokeWidth aria-hidden />
    </button>
  );
}
