import type { ReactNode } from "react";
import { AutoBuildGlyph, BlankGlyph, CanvaGlyph, FigmaGlyph } from "./StartGlyphs";

type StartKind = "blank" | "figma" | "auto" | "canva";

interface StartCardProps {
  kind: StartKind;
  title: string;
  description: string;
  glyph: ReactNode;
  disabled?: boolean;
  onClick(): void;
}

function StartCard({ kind, title, description, glyph, disabled, onClick }: StartCardProps) {
  return (
    <button
      type="button"
      className={`sp-start-card sp-start-card--${kind}`}
      onClick={onClick}
      disabled={disabled}
    >
      <span className="sp-start-tile">{glyph}</span>
      <span>
        <span className="sp-start-card__title block">{title}</span>
        <span className="sp-start-card__desc block">{description}</span>
      </span>
    </button>
  );
}

interface BuildPickerProps {
  /** Figma import and auto-build need the Supabase backend; without it the
   * two cards stay visible but inert, saying why. */
  importReady: boolean;
  /** Canva is a path only once the workspace has connected it. */
  canvaReady: boolean;
  onBlank(): void;
  onFigma(): void;
  onAuto(): void;
  onCanva(): void;
}

/** The builder's first screen: how a template starts (Figma 221:321 dark,
 * 221:439 light). Four co-equal sources, three across with Canva wrapping
 * under the first column, all ending at the same place: locked design,
 * editable fields. */
export function BuildPicker({
  importReady,
  canvaReady,
  onBlank,
  onFigma,
  onAuto,
  onCanva,
}: BuildPickerProps) {
  return (
    <section className="sp-start" aria-labelledby="build-picker-title">
      <h2 id="build-picker-title" className="sp-hero-title sp-start__title">
        How do you want to build?
      </h2>
      <div className="sp-start__grid">
        <StartCard
          kind="blank"
          title="Start blank"
          description="Build the design from scratch on an empty canvas. Drag on text, images, and fixed elements."
          glyph={<BlankGlyph style={{ width: 12.85, height: 16.63 }} />}
          onClick={onBlank}
        />
        <StartCard
          kind="figma"
          title="Import from Figma"
          description={
            importReady
              ? "Paste a frame link. Every element lands on the canvas as an editable field. Mark anything that shouldn't be as fixed."
              : "Requires the Supabase backend with the Figma connection configured (see docs/ARCHITECTURE.md)."
          }
          glyph={<FigmaGlyph style={{ width: 15, height: 23 }} />}
          disabled={!importReady}
          onClick={onFigma}
        />
        <StartCard
          kind="auto"
          title="Auto build"
          description={
            importReady
              ? `Paste a Figma${canvaReady ? " or Canva" : ""} link or upload an image. Claude decides what's editable, names every field, and writes the caption. You correct in the inspector.`
              : "Requires the Supabase backend with auto-build configured (see docs/ARCHITECTURE.md)."
          }
          glyph={<AutoBuildGlyph style={{ width: 24, height: 24 }} />}
          disabled={!importReady}
          onClick={onAuto}
        />
        {canvaReady && (
          <StartCard
            kind="canva"
            title="Import from Canva"
            description="Paste a Canva share link. Claude reads the exported design, proposes the fields, and writes the caption. You correct in the inspector."
            glyph={<CanvaGlyph style={{ width: 19.5, height: 19.5 }} />}
            onClick={onCanva}
          />
        )}
      </div>
    </section>
  );
}
