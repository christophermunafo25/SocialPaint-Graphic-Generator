import React from "react";

/** THE content column — every page renders inside this, and none defines its
 * own container. At >= 1024 (the rail shell) it is horizontally centred in
 * the region right of the sidebar, a --page-pad gutter each side (48px at
 * >= 1280, 32px at 1024-1279); below 1024 the shell is the mobile top bar
 * and the nav-to-content relationship is vertical instead — 24px under the
 * 56px header, with a 24px (16px under 768) side gutter. The width cap and
 * gutters are tokens (--page-max / --page-pad on .sp-page) — one knob, no
 * per-page overrides. The rail gutter and the window gutter stay equal in
 * both sidebar states, and both equal --page-pad exactly until the region
 * outgrows --page-max (1720px; viewport > 1984px expanded, > 1812px
 * collapsed), where margin-inline: auto grows the two together. `narrow`
 * caps the inner content (People 900) and centres it inside the column. */
export function Page({
  narrow,
  bleed,
  children,
}: {
  narrow?: 760 | 900;
  /** Mobile gutter model (2026-09): below 768 the page drops its horizontal
   *  padding so rails bleed to the screen edge, and the 16px gutter moves
   *  onto the children (see .sp-page--bleed). Brand Templates only. */
  bleed?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={bleed ? "sp-page sp-page--bleed" : "sp-page"}>
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
      className="sp-pagehead flex items-start justify-between gap-4"
      style={{ marginBottom: "var(--space-lg)" }}
    >
      <div className="min-w-0">
        {eyebrow && (
          <p className="sp-eyebrow" style={{ marginBottom: 6 }}>
            {eyebrow}
          </p>
        )}
        <h1 className="sp-page-title">{title}</h1>
        {description && <p className="sp-pagehead__desc">{description}</p>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </header>
  );
}
