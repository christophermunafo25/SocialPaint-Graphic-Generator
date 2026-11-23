import React from "react";
import { FileText, X } from "lucide-react";
import type { ChatDocumentKind } from "@/lib/types";
import { IconButton } from "../primitives";

/** The round x on the photo (13:2384): 16 on surface/inverse in Light and
 * the page's ink in Dark, 4 in from the photo's top right. Its hit area
 * reaches 24. */
function RemoveButton({ label, onClick }: { label: string; onClick(): void }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="ui-reset ui-ring sp-chat-tile__remove"
    >
      <X size={10} className="ui-icon" aria-hidden />
    </button>
  );
}

/** The photo waiting in the composer (new brand, 13:2301): 56 square at
 * radius/md, cropped to cover, with its remove button. */
export function PhotoTile({ src, onRemove }: { src: string; onRemove?(): void }) {
  return (
    <span className="sp-chat-tile sp-chat-tile--photo">
      <img src={src} alt="Attached photo" className="sp-chat-tile__photo" />
      {onRemove && <RemoveButton label="Remove photo" onClick={onRemove} />}
    </span>
  );
}

/** A file's name without its extension: the tile says the type below. */
export function fileTitle(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(0, dot) : name;
}

/** A document in the composer or on a sent message (new brand, 13:2454):
 * 256 wide on surface/raised with a border/subtle hairline at radius/md, a
 * 40 type well, the file's name without its extension in Label/S over its
 * type (PDF, TXT or MD) in Caption/S (CJ, 2026-10-04: the type, until
 * connectors bring a source), then Remove (Ghost Small) in the composer.
 * Its text was read in the browser; only the name and type are kept. */
export function FileTile({
  name,
  kind,
  onRemove,
}: {
  name: string;
  kind: ChatDocumentKind;
  onRemove?(): void;
}) {
  return (
    <span className="sp-chat-tile sp-chat-tile--file">
      <span className="sp-chat-tile__type" aria-hidden>
        <FileText size={16} className="ui-icon" />
      </span>
      <span className="sp-chat-tile__text">
        <span className="t-label-s sp-chat-tile__name" title={name}>
          {fileTitle(name)}
        </span>
        <span className="t-caption-s sp-chat-tile__kind">{kind.toUpperCase()}</span>
      </span>
      {onRemove && (
        <IconButton
          variant="ghost"
          size="sm"
          icon={X}
          label={`Remove ${name}`}
          onClick={onRemove}
        />
      )}
    </span>
  );
}
