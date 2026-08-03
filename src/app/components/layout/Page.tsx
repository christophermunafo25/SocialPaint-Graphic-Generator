import React from "react";

/** THE content column — every page renders inside this, and none defines its
 * own container. Left-aligned (never centered): 32px gutter off the sidebar,
 * max-width 1440px, 40px top / 64px bottom padding, 32px right padding
 * before the viewport edge. `narrow` caps the inner content (People 900,
 * Settings 760) while keeping the shared left edge. */
export function Page({
  narrow,
  children,
}: {
  narrow?: 760 | 900;
  children: React.ReactNode;
}) {
  return (
    <div className="sp-page" style={{ maxWidth: 1440 }}>
      <div style={narrow ? { maxWidth: narrow } : undefined}>{children}</div>
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
    <header className="flex items-start justify-between gap-4" style={{ marginBottom: "var(--space-lg)" }}>
      <div className="min-w-0">
        {eyebrow && (
          <p className="sp-eyebrow" style={{ marginBottom: 6 }}>
            {eyebrow}
          </p>
        )}
        <h1 className="sp-page-title">{title}</h1>
        {description && (
          <p style={{ fontSize: "var(--type-label-size)", color: "var(--text-muted)", marginTop: "var(--space-2xs)" }}>{description}</p>
        )}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </header>
  );
}
