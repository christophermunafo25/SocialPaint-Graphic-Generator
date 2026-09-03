import type { ReactNode } from "react";
import { X } from "lucide-react";
import { CanvaGlyph, FigmaGlyph } from "./StartGlyphs";

interface ImportLinkPopupProps {
  kind: "figma" | "canva";
  title: string;
  onClose(): void;
  children: ReactNode;
}

/** The "selected" state of a start card (Figma 228:203 / 228:245): the
 * card grows into a 560-wide panel with its tile and title as the header,
 * a quiet close, and whatever the path needs beneath, usually one link
 * field. Shared by the Figma and Canva imports so the two look identical. */
export function ImportLinkPopup({ kind, title, onClose, children }: ImportLinkPopupProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{ background: "color-mix(in srgb, var(--text-on-accent) 45%, transparent)" }}
      onClick={onClose}
    >
      <div className={`sp-import-pop sp-import-pop--${kind}`} onClick={(e) => e.stopPropagation()}>
        <div className="sp-import-pop__head">
          <span className="sp-start-tile">
            {kind === "figma" ? (
              <FigmaGlyph style={{ width: 15, height: 23 }} />
            ) : (
              <CanvaGlyph style={{ width: 19.5, height: 19.5 }} />
            )}
          </span>
          <h2 className="sp-import-pop__title">{title}</h2>
          <button
            type="button"
            className="sp-import-pop__close"
            onClick={onClose}
            aria-label="Close"
          >
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
