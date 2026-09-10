import React, { useEffect, useMemo, useState } from "react";
import { Undo2 } from "lucide-react";
import type { BrandColor } from "@/lib/types";
import { buildBrandPreviewSchema } from "@/lib/brand/brandPreview";
import type { BrandCategory } from "../../../router";
import { SchemaRenderer } from "../../SchemaRenderer";
import type { BrandDraft } from "./kitPlumbing";
import brandPreviewPhoto from "@/assets/socialpaint/brand-preview-photo.webp";

interface BrandRailProps {
  brand: BrandDraft;
  companyName: string;
  /** Opens (and scrolls to) a section — the checklist's whole job. */
  onOpenSection(section: BrandCategory): void;
}

/** The sticky rail: what the brand looks like assembled, and whether it is
 * finished. Neither belongs on a per-category card — the preview is the one
 * thing only the whole kit can show, and the checklist is the only place
 * "what's still missing" is answerable. */
export function BrandRail({ brand, companyName, onOpenSection }: BrandRailProps) {
  const { draft, assets, savedAt, saving, canUndo, undo } = brand;

  const logoAssets = assets.filter((a) => a.kind === "logo");
  const primaryLogo =
    logoAssets.find((a) => a.id === draft.primaryLogoAssetId) ?? logoAssets[0] ?? null;

  return (
    <div className="sp-brand-rail">
      <section className="sp-card sp-card--content space-y-3.5">
        <h2 className="sp-panel-title">Live preview</h2>

        <BrandPreview
          colors={draft.colors}
          headingFamily={draft.headingFont?.family ?? "Montserrat"}
          bodyFamily={draft.bodyFont?.family ?? "Inter"}
          logoUrl={primaryLogo?.url}
          companyName={companyName}
        />

        <p style={{ fontSize: "var(--type-caption-size)", color: "var(--text-muted)" }}>
          Restyles as you edit. Saved templates keep what they were built with.
        </p>
      </section>

      <section className="sp-card sp-card--content space-y-3.5">
        <div className="flex items-center justify-between gap-3">
          <span
            className="flex items-center gap-2"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: "var(--text-secondary)",
            }}
            role="status"
            aria-live="polite"
          >
            <span
              aria-hidden
              style={{
                width: 6,
                height: 6,
                borderRadius: "var(--radius-pill)",
                background: "var(--fill-action)",
              }}
            />
            {saving ? "Saving…" : savedAt ? `Saved ${clockTime(savedAt)}` : "All changes saved"}
          </span>
          <button
            onClick={() => undo()}
            disabled={!canUndo}
            className="sp-btn sp-btn-ghost"
            style={{ height: 30, padding: "0 12px", fontSize: "var(--type-caption-size)" }}
          >
            <Undo2 style={{ width: 13, height: 13 }} />
            Undo
          </button>
        </div>

        <div style={{ height: 1, background: "var(--border)" }} />

        <Checklist brand={brand} logoCount={logoAssets.length} onOpenSection={onOpenSection} />

        <p style={{ fontSize: 11, color: "var(--text-muted)" }}>
          Changes save as you make them. Press{" "}
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10 }}>⌘Z</span> to undo.
        </p>
      </section>
    </div>
  );
}

const clockTime = (at: number) =>
  new Date(at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

interface ChecklistItem {
  label: string;
  section: BrandCategory;
  ready: boolean;
  meta: string;
}

/** Is the brand finished? Each row is both the answer and the way to the
 * thing that answers it. */
function Checklist({
  brand,
  logoCount,
  onOpenSection,
}: {
  brand: BrandDraft;
  logoCount: number;
  onOpenSection(section: BrandCategory): void;
}) {
  const { draft } = brand;
  const items: ChecklistItem[] = [
    {
      label: "Colors",
      section: "colors",
      ready: draft.colors.length >= 4,
      meta: `${draft.colors.length} color${draft.colors.length === 1 ? "" : "s"}`,
    },
    {
      label: "Typography",
      section: "typography",
      ready: !!(draft.headingFont?.family && draft.bodyFont?.family),
      meta: "2 faces",
    },
    {
      label: "Logos",
      section: "logos",
      ready: logoCount >= 1,
      meta: `${logoCount} file${logoCount === 1 ? "" : "s"}`,
    },
    {
      label: "Type styles",
      section: "type-styles",
      ready: draft.typeStyles.length >= 1,
      meta: `${draft.typeStyles.length} style${draft.typeStyles.length === 1 ? "" : "s"}`,
    },
  ];
  const ready = items.filter((k) => k.ready).length;

  return (
    <>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          color: "var(--text-muted)",
        }}
      >
        {ready} of {items.length} sections ready
      </span>
      <div className="flex flex-col" style={{ gap: 2 }}>
        {items.map((k) => (
          <button
            key={k.section}
            onClick={() => onOpenSection(k.section)}
            className="sp-checklist-row"
          >
            <span
              aria-hidden
              className="flex items-center justify-center"
              style={{
                width: 15,
                height: 15,
                flexShrink: 0,
                borderRadius: "var(--radius-pill)",
                border: `1px solid ${k.ready ? "var(--fill-action)" : "var(--border-strong)"}`,
                background: k.ready ? "var(--fill-action)" : "transparent",
              }}
            >
              {k.ready && (
                <svg
                  width="9"
                  height="9"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--text-on-action)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              )}
            </span>
            <span className="flex-1">
              {k.label}
              <span className="sr-only">{k.ready ? ", ready" : ", not set up yet"}</span>
            </span>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                letterSpacing: "0.04em",
                color: "var(--text-muted)",
              }}
            >
              {k.meta}
            </span>
          </button>
        ))}
      </div>
    </>
  );
}

interface BrandPreviewProps {
  colors: BrandColor[];
  headingFamily: string;
  bodyFamily: string;
  logoUrl?: string;
  companyName: string;
}

/** SchemaRenderer measures glyphs once, on the first document.fonts.ready —
 * but in Brand Studio a face is usually PICKED after mount. Each completed
 * font load bumps this counter; used as the renderer's key, it remounts the
 * renderer so shrink fits re-measure with the newly landed face. */
function useFontsGeneration(): number {
  const [generation, setGeneration] = useState(0);
  useEffect(() => {
    const fonts = document.fonts;
    if (!fonts?.addEventListener) return;
    const bump = () => setGeneration((g) => g + 1);
    fonts.addEventListener("loadingdone", bump);
    return () => fonts.removeEventListener("loadingdone", bump);
  }, []);
  return generation;
}

/** The brand assembled onto a real graphic: the Product Promo artboard,
 * repainted from the draft on every keystroke. It renders through
 * SchemaRenderer — the same path, font loading, and measured text fitting as
 * every saved template — with instrumentation off and no kit, so the
 * contrast-chosen ink and label colors can never be snapped to the palette
 * by the kit's off-palette enforcement. */
function BrandPreview({
  colors,
  headingFamily,
  bodyFamily,
  logoUrl,
  companyName,
}: BrandPreviewProps) {
  const fontsGeneration = useFontsGeneration();
  const schema = useMemo(
    () =>
      buildBrandPreviewSchema({
        colors,
        headingFamily,
        bodyFamily,
        logoUrl,
        companyName,
        photoUrl: brandPreviewPhoto,
      }),
    [colors, headingFamily, bodyFamily, logoUrl, companyName],
  );

  return (
    <div
      role="img"
      aria-label={`Preview of a post in ${companyName}'s brand`}
      style={{
        width: "100%",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-control)",
        overflow: "hidden",
        background: "var(--bg-plate)",
      }}
    >
      <SchemaRenderer
        schema={schema}
        values={{}}
        brandKit={null}
        instrument={false}
        key={fontsGeneration}
      />
    </div>
  );
}
