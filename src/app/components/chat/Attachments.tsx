import React from "react";
import { FileText, Globe, X } from "lucide-react";
import type { ChatDocumentKind } from "@/lib/types";
import { PLATFORMS, type PlatformId } from "@/lib/templates/platforms";
import { CompactSelect, type SelectOption } from "../primitives";

/** The round x on an attachment tile (13:2384): 16 on surface/inverse in
 * Light and the page's ink in Dark, 4 in from the tile's top right. Its
 * hit area reaches 24. */
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

/** A photo on a message (13:2383, 13:2739): 64 square, radius 9, cropped
 * to cover. In the composer it carries its remove button. */
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

/** A document on a message (13:2540): a 50 type tile, the file's name
 * without its extension, and its type (PDF, TXT or MD) under it (CJ,
 * 2026-10-04: the type, until connectors bring a source). Its text was
 * read in the browser; only the name and type are kept. */
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
    <span className="sp-chat-tile sp-chat-tile--file" data-removable={onRemove ? true : undefined}>
      <span className="sp-chat-tile__type" aria-hidden>
        <FileText size={20} className="ui-icon" />
      </span>
      <span className="sp-chat-tile__text">
        <span className="t-label-xs t-trim sp-chat-tile__name" title={name}>
          {fileTitle(name)}
        </span>
        <span className="t-caption-xxs t-trim sp-chat-tile__kind">{kind.toUpperCase()}</span>
      </span>
      {onRemove && <RemoveButton label={`Remove ${name}`} onClick={onRemove} />}
    </span>
  );
}

/** The composer's platform hint on the Compact select (99:568): "Any
 * platform" with the globe, then every platform with its mark. Platforms
 * the published library does not cover stay pickable but dim, and the
 * menu says why (the hint is a preference). */
export function PlatformSelect({
  value,
  onChange,
  covered,
  dimUncovered,
}: {
  value: PlatformId | null;
  onChange(next: PlatformId | null): void;
  covered: ReadonlySet<PlatformId> | null;
  dimUncovered: boolean;
}) {
  const options: Array<SelectOption<string>> = [
    { value: "", label: "Any platform", icon: <Globe size={16} className="ui-icon" aria-hidden /> },
    ...PLATFORMS.map((p) => ({
      value: p.id as string,
      label: p.label,
      icon: <p.Icon width={16} height={16} className="ui-icon" aria-hidden />,
      dimmed: dimUncovered && covered !== null && !covered.has(p.id),
    })),
  ];
  return (
    <CompactSelect
      ariaLabel="Platform"
      value={value ?? ""}
      options={options}
      onSelect={(v) => onChange((v || null) as PlatformId | null)}
      menuMinWidth={220}
      menuCaption={
        options.some((o) => o.dimmed)
          ? "Dimmed platforms have no published templates yet. Picking one is a preference, and the whole library is still considered."
          : undefined
      }
    />
  );
}
