import React from "react";

/** THE content column — every page renders inside this, and none defines its
 * own container. Horizontally centred in the region right of the sidebar:
 * the gutter off the rail equals the gutter off the window edge at every
 * viewport and in both sidebar states. The width cap and gutter are tokens
 * (--page-max / --page-pad on .sp-page) — one knob, no per-page overrides.
 * `narrow` caps the inner content (People 900) and centres it inside the
 * column. */
export function Page({ narrow, children }: { narrow?: 760 | 900; children: React.ReactNode }) {
  return (
    <div className="sp-page">
      <div style={narrow ? { maxWidth: narrow, marginInline: "auto" } : undefined}>{children}</div>
    </div>
  );
}

/** The one page-header pattern: optional eyebrow, title at a single size,
 * one-line description 8px beneath, optional primary action right-aligned on
 * the title's baseline. 32px below the block. */
export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <header
      className="flex items-start justify-between gap-4"
      style={{ marginBottom: "var(--space-lg)" }}
    >
      <div className="min-w-0">
        {eyebrow && (
          <p className="sp-eyebrow" style={{ marginBottom: 6 }}>
            {eyebrow}
          </p>
        )}
        <h1 className="sp-page-title">{title}</h1>
        {description && (
          <p
            style={{
              fontSize: "var(--type-label-size)",
              color: "var(--text-muted)",
              marginTop: "var(--space-2xs)",
            }}
          >
            {description}
          </p>
        )}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </header>
  );
}
