import React, { useId } from "react";
import { ChevronDown } from "lucide-react";

interface DisclosureProps {
  /** Anchor for the checklist's "take me to it". */
  id?: string;
  /** "Palette · 6 colors" — the count line above the title. */
  eyebrow: React.ReactNode;
  title: string;
  /** What this category is currently set to, readable with the card shut.
   * The whole point of opening in place: you shouldn't have to. */
  glance?: React.ReactNode;
  open: boolean;
  onToggle(): void;
  children: React.ReactNode;
}

/** One brand category as a card that opens in place. Replaces the old
 * detail route: no navigation, no save button, no way back to lose. */
export function Disclosure({
  id,
  eyebrow,
  title,
  glance,
  open,
  onToggle,
  children,
}: DisclosureProps) {
  const panelId = useId();
  return (
    <section id={id} className="sp-card sp-card--disclosure" data-open={open}>
      <button
        type="button"
        className="sp-disclosure__toggle"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
      >
        <span className="sp-disclosure__heading">
          <span className="sp-eyebrow">{eyebrow}</span>
          <span
            className="sp-section-title"
            style={{ fontFamily: "var(--font-ui)", fontWeight: 500 }}
          >
            {title}
          </span>
        </span>
        {glance && <span className="sp-disclosure__glance">{glance}</span>}
        <ChevronDown
          aria-hidden
          className="sp-disclosure__chevron"
          style={{ width: 16, height: 16 }}
        />
      </button>
      <div className="sp-disclosure__panel" id={panelId} role="region" aria-label={title}>
        {/* The body stays mounted — see .sp-disclosure__clip, which is what
            takes a shut panel out of tab order and off the AT tree. */}
        <div className="sp-disclosure__clip">
          <div className="sp-disclosure__body">{children}</div>
        </div>
      </div>
    </section>
  );
}
