import React, { useState } from "react";
import { ArrowUpRight, Import, Star } from "lucide-react";
import type { BrandColor, BrandTypeStyle } from "@/lib/types";
import { useBrand } from "@/lib/brand/BrandContext";
import { useRouter, type BrandCategory } from "../../router";
import { styleName, toFontStyle } from "@/lib/render/fontCatalog";
import { DEFAULT_PALETTE, DEFAULT_TYPE_STYLES } from "@/lib/theme";
import { Page, PageHeader } from "../layout/Page";
import { DesignSystemImportPanel } from "./DesignSystemImportPanel";
import { ColorsDetail } from "./brand/ColorsDetail";
import { TypographyDetail } from "./brand/TypographyDetail";
import { LogosDetail } from "./brand/LogosDetail";
import { TypeStylesDetail } from "./brand/TypeStylesDetail";
import { useKitSave } from "./brand/kitPlumbing";

/** Brand Studio: an overview dashboard where each category card answers
 * "what is our brand set to," and opening a card answers "change it."
 * Categories are routes (/brand-studio/<category>) — linkable, back-button
 * correct, refresh-safe. */
export function BrandStudio({ category }: { category?: BrandCategory }) {
  switch (category) {
    case "colors":
      return <ColorsDetail />;
    case "typography":
      return <TypographyDetail />;
    case "logos":
      return <LogosDetail />;
    case "type-styles":
      return <TypeStylesDetail />;
    default:
      return <BrandOverview />;
  }
}

const OVERVIEW_SWATCH_CAP = 8;
const OVERVIEW_STYLE_CAP = 4;

function BrandOverview() {
  const { kit, assets } = useBrand();
  const { navigate } = useRouter();
  const { save } = useKitSave();
  const [importOpen, setImportOpen] = useState(false);

  const colors = kit?.colors ?? DEFAULT_PALETTE;
  const typeStyles = kit?.typeStyles?.length ? kit.typeStyles : DEFAULT_TYPE_STYLES;
  const logoAssets = assets.filter((a) => a.kind === "logo");
  const headingFamily = kit?.headingFont?.family ?? "Montserrat";
  const bodyFamily = kit?.bodyFont?.family ?? "Inter";
  const primaryLogo =
    logoAssets.find((a) => a.id === kit?.primaryLogoAssetId) ?? logoAssets[0] ?? null;

  // Design-system imports merge and save in one step: existing keys win,
  // new entries append — appends can't redirect a bound style, so this
  // needs no impact confirmation.
  const mergeColors = (incoming: BrandColor[]) =>
    void save({
      colors: [...colors, ...incoming.filter((c) => !colors.some((p) => p.key === c.key))],
    });
  const mergeTypeStyles = (incoming: BrandTypeStyle[]) =>
    void save({
      typeStyles: [
        ...typeStyles,
        ...incoming.filter((t) => !typeStyles.some((p) => p.key === t.key)),
      ],
    });

  return (
    <Page>
      <PageHeader
        title="Brand Studio"
        description="What your brand is set to, at a glance. Open a category to change it."
        action={
          <button
            onClick={() => setImportOpen((o) => !o)}
            className="sp-btn sp-btn-ghost"
            aria-expanded={importOpen}
          >
            <Import className="w-4 h-4" />
            Import design system
          </button>
        }
      />

      <div className="sp-grid-12">
        {importOpen && (
          <section className="sp-span-12 sp-card sp-card--content space-y-4">
            <div>
              <h2 className="sp-panel-title">Import design system</h2>
              <p
                style={{
                  fontSize: "var(--type-caption-size)",
                  color: "var(--text-muted)",
                  marginTop: 3,
                }}
              >
                Ingest a design-tokens JSON (colors, type scale) to populate the palette and type
                styles, or pull styles from a Figma file. Imports merge into your brand and save
                immediately; existing entries always win.
              </p>
            </div>
            <DesignSystemImportPanel
              onImportColors={mergeColors}
              onImportTypeStyles={mergeTypeStyles}
            />
          </section>
        )}

        {/* Colors */}
        <CategoryCard
          title="Colors"
          count={`${colors.length} color${colors.length === 1 ? "" : "s"}`}
          onOpen={() => navigate({ name: "brandStudio", category: "colors" })}
        >
          {colors.length === 0 ? (
            <EmptyHint>
              The sanctioned palette builders pick from — every swatch is one click away in the
              template builder. Open to add your colors.
            </EmptyHint>
          ) : (
            <span className="flex flex-wrap" style={{ gap: "var(--space-2xs)" }}>
              {colors.slice(0, OVERVIEW_SWATCH_CAP).map((c) => (
                <span key={c.key} className="flex items-center" style={{ gap: "var(--space-3xs)" }}>
                  <span
                    aria-hidden
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: "var(--radius-control)",
                      background: c.hex,
                      border: "1px solid var(--border)",
                      display: "inline-block",
                    }}
                  />
                  <span
                    style={{ fontSize: "var(--type-caption-size)", color: "var(--text-secondary)" }}
                  >
                    {c.name}
                  </span>
                </span>
              ))}
              {colors.length > OVERVIEW_SWATCH_CAP && (
                <span style={{ fontSize: "var(--type-caption-size)", color: "var(--text-muted)" }}>
                  +{colors.length - OVERVIEW_SWATCH_CAP} more
                </span>
              )}
            </span>
          )}
        </CategoryCard>

        {/* Typography */}
        <CategoryCard
          title="Typography"
          onOpen={() => navigate({ name: "brandStudio", category: "typography" })}
        >
          <span className="block space-y-2">
            <span className="block">
              <span className="sp-eyebrow block">Heading</span>
              <span
                style={{
                  fontFamily: `"${headingFamily}", sans-serif`,
                  fontSize: "var(--type-cardtitle-size)",
                  color: "var(--text-primary)",
                }}
              >
                {headingFamily}
              </span>
            </span>
            <span className="block">
              <span className="sp-eyebrow block">Body</span>
              <span
                style={{
                  fontFamily: `"${bodyFamily}", sans-serif`,
                  fontSize: "var(--type-body-size)",
                  color: "var(--text-primary)",
                }}
              >
                {bodyFamily}
              </span>
            </span>
          </span>
        </CategoryCard>

        {/* Logos */}
        <CategoryCard
          title="Logos"
          count={
            logoAssets.length > 0
              ? `${logoAssets.length} logo${logoAssets.length === 1 ? "" : "s"}`
              : undefined
          }
          onOpen={() => navigate({ name: "brandStudio", category: "logos" })}
        >
          {logoAssets.length === 0 ? (
            <EmptyHint>
              Upload your logo once and builders can drop it onto any template from the element
              palette. Open to add the first one.
            </EmptyHint>
          ) : (
            <span className="flex flex-wrap items-center" style={{ gap: "var(--space-2xs)" }}>
              {logoAssets.map((a) => (
                <span
                  key={a.id}
                  className="relative inline-flex items-center justify-center"
                  style={{
                    width: 56,
                    height: 56,
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-control)",
                    padding: "var(--space-3xs)",
                  }}
                >
                  <img src={a.url} alt={a.name} className="max-w-full max-h-full object-contain" />
                  {a.id === (kit?.primaryLogoAssetId ?? logoAssets[0]?.id) && (
                    <Star
                      aria-label="Primary logo"
                      className="absolute"
                      style={{
                        top: 2,
                        right: 2,
                        width: 11,
                        height: 11,
                        color: "var(--editor-accent)",
                      }}
                      fill="currentColor"
                    />
                  )}
                </span>
              ))}
            </span>
          )}
        </CategoryCard>

        {/* Type styles */}
        <CategoryCard
          title="Type styles"
          count={`${typeStyles.length} style${typeStyles.length === 1 ? "" : "s"}`}
          onOpen={() => navigate({ name: "brandStudio", category: "type-styles" })}
        >
          {typeStyles.length === 0 ? (
            <EmptyHint>
              A saved style locks font, weight, and color on any field it's applied to — across
              every template, always. Open to create one.
            </EmptyHint>
          ) : (
            <span className="block space-y-1.5">
              {typeStyles.slice(0, OVERVIEW_STYLE_CAP).map((s) => (
                <span key={s.key} className="flex items-baseline justify-between gap-3">
                  <span
                    style={{
                      fontSize: "var(--type-label-size)",
                      fontWeight: 500,
                      color: "var(--text-primary)",
                    }}
                  >
                    {s.name}
                  </span>
                  <span
                    className="truncate"
                    style={{ fontSize: "var(--type-caption-size)", color: "var(--text-muted)" }}
                  >
                    {styleHint(s)}
                  </span>
                </span>
              ))}
              {typeStyles.length > OVERVIEW_STYLE_CAP && (
                <span
                  className="block"
                  style={{ fontSize: "var(--type-caption-size)", color: "var(--text-muted)" }}
                >
                  +{typeStyles.length - OVERVIEW_STYLE_CAP} more
                </span>
              )}
            </span>
          )}
        </CategoryCard>

        {/* Assembled preview — the one thing a per-category card cannot show */}
        <section className="sp-span-12 sp-card sp-card--content space-y-4">
          <h2 className="sp-panel-title">Preview</h2>
          <BrandPreviewCard
            colors={colors}
            headingFamily={headingFamily}
            bodyFamily={bodyFamily}
            logoUrl={primaryLogo?.url}
          />
          <p style={{ fontSize: "var(--type-caption-size)", color: "var(--text-muted)" }}>
            How your brand looks assembled — header, headline, body, and accent together.
          </p>
        </section>
      </div>
    </Page>
  );
}

/** One overview card: read plus a way in. Nothing on it is editable — the
 * whole card opens its category's detail route. */
function CategoryCard({
  title,
  count,
  onOpen,
  children,
}: {
  title: string;
  count?: string;
  onOpen(): void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="sp-span-6 sp-card sp-card--content sp-card-link"
    >
      <span className="flex items-center justify-between mb-3">
        <span className="flex items-baseline gap-2">
          <span className="sp-panel-title">{title}</span>
          {count && (
            <span style={{ fontSize: "var(--type-caption-size)", color: "var(--text-muted)" }}>
              {count}
            </span>
          )}
        </span>
        <ArrowUpRight
          aria-hidden
          className="sp-card-link__arrow"
          style={{ width: 15, height: 15, color: "var(--text-muted)" }}
        />
      </span>
      {children}
    </button>
  );
}

/** An empty category teaches: what it's for, and the card itself is the
 * action that populates it. */
function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="block"
      style={{ fontSize: "var(--type-caption-size)", color: "var(--text-muted)", lineHeight: 1.5 }}
    >
      {children}
    </span>
  );
}

/** A style's one-line hint for the overview: face and any fixed size. */
function styleHint(s: BrandTypeStyle): string {
  const face =
    s.weight !== undefined || s.fontStyle !== undefined || s.fontStretch !== undefined
      ? styleName(toFontStyle(s.weight, s.fontStyle, s.fontStretch))
      : "";
  const parts = [
    s.font?.family ?? (face ? undefined : "Any face"),
    face || undefined,
    s.fontSizePx !== undefined ? `${s.fontSizePx}px` : undefined,
  ].filter(Boolean);
  return parts.join(" · ");
}

interface BrandPreviewCardProps {
  colors: BrandColor[];
  headingFamily: string;
  bodyFamily: string;
  logoUrl?: string;
}

function BrandPreviewCard({ colors, headingFamily, bodyFamily, logoUrl }: BrandPreviewCardProps) {
  const hex = (key: string, fallback: string) => colors.find((c) => c.key === key)?.hex ?? fallback;
  return (
    <div
      className="overflow-hidden"
      style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-card-sm)" }}
    >
      <div
        className="px-5 py-4 flex items-center gap-3"
        style={{ background: hex("primary", "#2F3B4C") }}
      >
        {logoUrl && <img src={logoUrl} alt="" className="h-6 w-auto" />}
        <span
          className="text-white font-extrabold uppercase text-sm"
          style={{ fontFamily: `"${headingFamily}", sans-serif` }}
        >
          Sample Header
        </span>
      </div>
      <div className="p-5" style={{ background: hex("background", "#F6F7F9") }}>
        <p
          className="text-lg mb-1"
          style={{ color: hex("text", "#1A1F26"), fontFamily: `"${headingFamily}", sans-serif` }}
        >
          Congratulations, Jordan!
        </p>
        <p
          className="text-sm mb-3"
          style={{ color: hex("text", "#1A1F26"), fontFamily: `"${bodyFamily}", sans-serif` }}
        >
          Five incredible years — thank you for everything you do.
        </p>
        <span
          className="sp-eyebrow inline-block px-2.5 py-1 "
          data-radius-control
          style={{ background: hex("accent", "#C9A227"), color: "#fff" }}
        >
          Accent chip
        </span>
      </div>
    </div>
  );
}
