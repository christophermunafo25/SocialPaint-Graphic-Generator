import React, { useState } from "react";
import { Bookmark, Heart, MessageCircle, MoreHorizontal, Send, Undo2 } from "lucide-react";
import type { BrandColor } from "@/lib/types";
import { readableOn } from "@/lib/color";
import type { BrandCategory } from "../../../router";
import { SignedImg } from "../../SignedImg";
import type { BrandDraft } from "./kitPlumbing";

type PreviewFormat = "post" | "story";

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
  const [format, setFormat] = useState<PreviewFormat>("post");
  const { draft, assets, savedAt, saving, canUndo, undo } = brand;

  const logoAssets = assets.filter((a) => a.kind === "logo");
  const primaryLogo =
    logoAssets.find((a) => a.id === draft.primaryLogoAssetId) ?? logoAssets[0] ?? null;

  return (
    <div className="sp-brand-rail">
      <section className="sp-card sp-card--content space-y-3.5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="sp-panel-title">Live preview</h2>
          <div className="sp-seg" data-stretch role="group" aria-label="Preview format">
            {(["post", "story"] as const).map((f) => (
              <button
                key={f}
                type="button"
                data-active={format === f}
                onClick={() => setFormat(f)}
                style={{ textTransform: "capitalize" }}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <BrandPreview
          colors={draft.colors}
          headingFamily={draft.headingFont?.family ?? "Montserrat"}
          bodyFamily={draft.bodyFont?.family ?? "Inter"}
          logoUrl={primaryLogo?.url}
          companyName={companyName}
          format={format}
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
  format: PreviewFormat;
}

/** The brand assembled: header, headline, body, and accent chip, inside the
 * chrome of the thing it eventually becomes. Tenant colors are arbitrary — a
 * pale primary or accent needs ink, not white — so every glyph sitting on a
 * tenant color picks the legible option. */
function BrandPreview({
  colors,
  headingFamily,
  bodyFamily,
  logoUrl,
  companyName,
  format,
}: BrandPreviewProps) {
  const hex = (key: string, fallback: string) => colors.find((c) => c.key === key)?.hex ?? fallback;
  const primary = hex("primary", "#2F3B4C");
  const accent = hex("accent", "#C9A227");
  const background = hex("background", "#F6F7F9");
  const text = hex("text", "#1A1F26");
  const onPrimary = readableOn(primary);
  const isPost = format === "post";

  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-control)",
        overflow: "hidden",
        background: "var(--bg-plate)",
        width: isPost ? "100%" : "72%",
        marginInline: "auto",
      }}
    >
      {isPost && (
        <div className="flex items-center gap-2.5" style={{ padding: "10px 12px" }}>
          <span
            className="flex items-center justify-center flex-shrink-0"
            style={{
              width: 28,
              height: 28,
              borderRadius: "var(--radius-pill)",
              background: primary,
            }}
          >
            {logoUrl && (
              <SignedImg
                src={logoUrl}
                alt=""
                style={{ maxHeight: 12, maxWidth: 18, objectFit: "contain" }}
              />
            )}
          </span>
          <span className="truncate" style={{ fontSize: 12, fontWeight: 500, color: "#272727" }}>
            {companyName}
          </span>
          <MoreHorizontal
            aria-hidden
            style={{ width: 16, height: 16, color: "#8A8A8A", marginLeft: "auto", flexShrink: 0 }}
          />
        </div>
      )}

      <div
        className="relative flex flex-col"
        style={{ background, aspectRatio: isPost ? "auto" : "9 / 16" }}
      >
        <div
          className="flex items-center gap-2"
          style={{ padding: "12px 14px", background: primary }}
        >
          {logoUrl && (
            <SignedImg
              src={logoUrl}
              alt=""
              style={{ height: 12, width: "auto", objectFit: "contain" }}
            />
          )}
          <span
            className="truncate"
            style={{
              fontFamily: `"${headingFamily}", sans-serif`,
              fontWeight: 600,
              fontSize: 11,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: onPrimary,
            }}
          >
            {companyName}
          </span>
        </div>
        <div className="flex flex-col" style={{ gap: 10, padding: "14px 14px 20px" }}>
          <span
            style={{
              fontFamily: `"${headingFamily}", sans-serif`,
              fontWeight: 600,
              fontSize: 20,
              lineHeight: 1.15,
              color: text,
              textWrap: "pretty",
            }}
          >
            Congratulations, Jordan!
          </span>
          <span
            style={{
              fontFamily: `"${bodyFamily}", sans-serif`,
              fontSize: 12,
              lineHeight: 1.5,
              color: text,
              opacity: 0.82,
            }}
          >
            Five incredible years. Thank you for everything you do.
          </span>
          <span
            className="self-start"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 9,
              letterSpacing: "0.06em",
              padding: "4px 9px",
              borderRadius: "var(--radius-control)",
              background: accent,
              color: readableOn(accent),
            }}
          >
            5 YEARS
          </span>
        </div>
      </div>

      {isPost && (
        <div className="flex flex-col" style={{ gap: 7, padding: "10px 12px 14px" }}>
          <div className="flex items-center gap-3.5" style={{ color: "#272727" }} aria-hidden>
            <Heart style={{ width: 18, height: 18 }} />
            <MessageCircle style={{ width: 18, height: 18 }} />
            <Send style={{ width: 18, height: 18 }} />
            <Bookmark style={{ width: 18, height: 18, marginLeft: "auto" }} />
          </div>
          <span style={{ fontSize: 12, color: "#272727", lineHeight: 1.45 }}>
            <span style={{ fontWeight: 500 }}>{companyName}</span> Care that shows up: celebrating
            five years of Jordan.
          </span>
        </div>
      )}
    </div>
  );
}
