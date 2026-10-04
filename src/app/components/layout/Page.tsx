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
 * caps the inner content (People 900) and centres it inside the column.
 * `layout` is for a page that lays its children out itself (the Generate
 * chat, a flex column in each of its states): its class and data-state go
 * on the column, and the children sit directly in it rather than in the
 * inner wrapper, so the column's own layout reaches them. The gutters,
 * cap and top padding are unchanged. */
export function Page({
  narrow,
  bleed,
  layout,
  children,
}: {
  narrow?: 760 | 900;
  /** Mobile gutter model (2026-09): below 768 the page drops its horizontal
   *  padding so rails bleed to the screen edge, and the 16px gutter moves
   *  onto the children (see .sp-page--bleed). Brand Templates only. */
  bleed?: boolean;
  /** The column's own layout class and state (never with `narrow`). */
  layout?: { className: string; state?: string };
  children: React.ReactNode;
}) {
  const className = ["sp-page", bleed && "sp-page--bleed", layout?.className]
    .filter(Boolean)
    .join(" ");
  if (layout) {
    return (
      <div className={className} data-state={layout.state}>
        {children}
      </div>
    );
  }
  return (
    <div className={className}>
      <div style={narrow ? { maxWidth: narrow, marginInline: "auto" } : undefined}>{children}</div>
    </div>
  );
}

/** The page header (new look): the title alone, with the page's actions on
 * the right (RULES §9: no eyebrow, no helper line). 36 tall, 24 above the
 * page's first content, as every screen draws it. */
export function PageHeader({
  title,
  actions,
}: {
  title: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <header className="sp-shell-pagehead">
      <h1 className="t-title-page">{title}</h1>
      {actions && <div className="sp-shell-pagehead__actions">{actions}</div>}
    </header>
  );
}
