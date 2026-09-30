import React, { forwardRef } from "react";
import { X } from "lucide-react";
import { CardGlyph } from "./icons";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement>;

/** The editor panel's close control (Figma "Generate · Chat", sp-icon-btn /
 * Close 328:835): a transparent 32px circle with a 16px x in the secondary
 * ink and a --bg-hover wash on hover. Named "Close editor" unless the caller
 * passes its own `aria-label`. */
export const CloseButton = forwardRef<HTMLButtonElement, ButtonProps>(function CloseButton(
  { type = "button", className, "aria-label": ariaLabel = "Close editor", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={className ? `sp-chat-icon-btn ${className}` : "sp-chat-icon-btn"}
      data-preset="close"
      aria-label={ariaLabel}
      {...rest}
    >
      <X size={16} strokeWidth={1.5} absoluteStrokeWidth aria-hidden />
    </button>
  );
});

/** A draft card's download control (Figma "Generate · Chat", sp-icon-btn /
 * Download 328:827 on regular cards, 34px; the compact card carries the
 * sp-card-action Download at 28px with a 14px box). Sunken fill, primary
 * ink, lucide's arrow-down-to-line at the Figma's footprint (CardGlyph).
 * While an export runs, `busy` sets aria-busy, dims the glyph to 40% (no
 * spinner in the frame) and swallows clicks so one draft never exports
 * twice at once. */
export function DownloadButton({
  size,
  templateName,
  busy = false,
  blocked = false,
  type = "button",
  className,
  onClick,
  ...rest
}: {
  size: "regular" | "compact";
  templateName: string;
  busy?: boolean;
  /** Not ready to export (template-chat §12.5): 40%, aria-disabled, and
   * the click still reaches `onClick`, which explains why. */
  blocked?: boolean;
} & ButtonProps) {
  return (
    <button
      type={type}
      className={className ? `sp-chat-icon-btn ${className}` : "sp-chat-icon-btn"}
      data-preset="download"
      data-size={size}
      data-busy={busy || undefined}
      data-blocked={blocked || undefined}
      aria-disabled={blocked || undefined}
      aria-label={`Download "${templateName}" PNG`}
      aria-busy={busy || undefined}
      onClick={busy ? undefined : onClick}
      {...rest}
    >
      <CardGlyph
        glyph="download"
        compact={size === "compact"}
        className="sp-chat-icon-btn__glyph"
      />
    </button>
  );
}
