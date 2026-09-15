import React from "react";
import { routeToUrl } from "../../../router";
import { useLinkClick } from "./useLinkClick";
import type { BrandDraft } from "./kitPlumbing";

const clockTime = (at: number) =>
  new Date(at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

/** The detail page header (D5): breadcrumb line above, then the title row
 * with save status and Undo vertically centred on the title. No eyebrow,
 * no description — the breadcrumb carries the context. */
export function BrandDetailHeader({ title, brand }: { title: string; brand: BrandDraft }) {
  const linkClick = useLinkClick();
  const { saving, savedAt, canUndo, undo } = brand;

  return (
    <header style={{ marginBottom: "var(--space-lg)" }}>
      <nav
        aria-label="Breadcrumb"
        className="flex items-center"
        style={{ gap: "var(--space-2xs)", marginBottom: "var(--space-xs)" }}
      >
        <a
          href={routeToUrl({ name: "brandStudio" })}
          onClick={linkClick({ name: "brandStudio" })}
          style={{
            fontSize: "var(--type-label-size)",
            color: "var(--text-secondary)",
            textDecoration: "underline",
            textUnderlineOffset: 2,
          }}
        >
          Brand Studio
        </a>
        <span
          aria-hidden
          style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)" }}
        >
          /
        </span>
        <span
          aria-current="page"
          style={{ fontSize: "var(--type-label-size)", color: "var(--text-primary)" }}
        >
          {title}
        </span>
      </nav>

      <div className="flex items-center justify-between gap-4">
        <h1 className="sp-page-title">{title}</h1>
        <div className="flex items-center flex-shrink-0" style={{ gap: "var(--space-xs)" }}>
          <span className="sp-eyebrow" role="status" aria-live="polite">
            {saving ? "Saving…" : savedAt ? `Saved ${clockTime(savedAt)}` : "All changes saved"}
          </span>
          <button
            onClick={() => undo()}
            disabled={!canUndo}
            className="sp-btn sp-btn-ghost"
            style={{ height: 30, padding: "0 12px", fontSize: "var(--type-caption-size)" }}
          >
            Undo
          </button>
          <span
            aria-hidden
            style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)" }}
          >
            ⌘Z
          </span>
        </div>
      </div>
    </header>
  );
}
