import React, { useRef, useState } from "react";
import type { BrandColor, BrandTypeStyle } from "@/lib/types";
import { stores } from "@/lib/stores";
import { parseDesignTokens } from "@/lib/brand/designSystemImport";
import { useFileDrop } from "@/lib/useFileDrop";
import { routeToUrl } from "../../../router";
import { mergeImportedColors } from "./kitOps";
import type { BrandDraft, KitShape } from "./kitPlumbing";
import { useLinkClick } from "./useLinkClick";

const FIGMA_RE = /^(https?:\/\/)?(www\.)?figma\.com\/(design|file)\//i;

type Phase =
  | { state: "idle" }
  | { state: "importing"; step: string; visible: boolean }
  | {
      state: "done";
      addedColors: number;
      addedStyles: number;
      matched: number;
      snapshot: KitShape;
    };

/** The Import page: a Figma link source and a tokens-file source, side by
 * side. Parsing and merging are the accordion's — merges only APPEND, an
 * existing key can't be redirected by an import, and imported roles never
 * displace one the admin assigned. */
export function ImportDetail({ brand }: { brand: BrandDraft }) {
  const { company, commit, undo } = brand;
  const linkClick = useLinkClick();
  const [figmaUrl, setFigmaUrl] = useState("");
  const [figmaError, setFigmaError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>({ state: "idle" });
  const revealTimer = useRef<number | undefined>(undefined);

  const figmaValid = FIGMA_RE.test(figmaUrl.trim());
  const figmaConfigured = stores.designImport.isConfigured();

  const beginImporting = (step: string) => {
    setError(null);
    setPhase({ state: "importing", step, visible: false });
    // The panel appears only when the wait is real.
    window.clearTimeout(revealTimer.current);
    revealTimer.current = window.setTimeout(() => {
      setPhase((p) => (p.state === "importing" ? { ...p, visible: true } : p));
    }, 1000);
  };

  /** Merge and report. The snapshot from before the merge feeds "Undo
   * import"; the counts feed the done panel. */
  const applyImport = (colors: BrandColor[], typeStyles: BrandTypeStyle[]) => {
    window.clearTimeout(revealTimer.current);
    const snapshot = brand.draft;
    const mergedColors = mergeImportedColors(snapshot.colors, colors);
    const addedColors = mergedColors.length - snapshot.colors.length;
    const freshStyles = typeStyles.filter((t) => !snapshot.typeStyles.some((p) => p.key === t.key));
    const matched = colors.length - addedColors + (typeStyles.length - freshStyles.length);
    if (addedColors || freshStyles.length) {
      commit({
        ...(addedColors ? { colors: mergedColors } : {}),
        ...(freshStyles.length ? { typeStyles: [...snapshot.typeStyles, ...freshStyles] } : {}),
      });
    }
    setPhase({ state: "done", addedColors, addedStyles: freshStyles.length, matched, snapshot });
  };

  const handleTokens = async (file: File) => {
    beginImporting("Reading the tokens file");
    try {
      const json: unknown = JSON.parse(await file.text());
      const result = parseDesignTokens(json);
      if (!result.colors.length && !result.typeStyles.length) {
        setPhase({ state: "idle" });
        setError("No color or typography tokens found in that file.");
        return;
      }
      applyImport(result.colors, result.typeStyles);
    } catch {
      window.clearTimeout(revealTimer.current);
      setPhase({ state: "idle" });
      setError("Could not parse that file as JSON.");
    }
  };

  const importFigma = async () => {
    if (!company || !figmaValid) return;
    beginImporting("Pulling color and text styles from Figma");
    try {
      const result = await stores.designImport.importStylesFromUrl(company.id, figmaUrl.trim());
      applyImport(result.colors, result.typeStyles);
      setFigmaUrl("");
    } catch (e) {
      window.clearTimeout(revealTimer.current);
      setPhase({ state: "idle" });
      setError(e instanceof Error ? e.message : "Figma style import failed.");
    }
  };

  const tokensDrop = useFileDrop((files) => {
    if (files[0]) void handleTokens(files[0]);
  });

  const labelStyle: React.CSSProperties = {
    fontFamily: "var(--font-ui)",
    fontWeight: "var(--weight-ui)" as React.CSSProperties["fontWeight"],
    fontSize: "var(--type-label-size)",
    color: "var(--text-primary)",
  };
  const detailStyle: React.CSSProperties = {
    fontSize: "var(--type-caption-size)",
    color: "var(--text-muted)",
  };

  return (
    <>
      <div className="sp-import-grid">
        {figmaConfigured && (
          <section className="sp-card sp-import-leg">
            <p style={labelStyle}>From a Figma file</p>
            <p style={detailStyle}>
              Paste a link to a file your workspace can read. Color and text styles come in.
            </p>
            <div className="flex gap-2">
              <input
                className="sp-input flex-1"
                aria-label="Figma file link"
                placeholder="figma.com/design/…"
                value={figmaUrl}
                onChange={(e) => {
                  setFigmaUrl(e.target.value);
                  if (figmaError && FIGMA_RE.test(e.target.value.trim())) setFigmaError(null);
                }}
                onBlur={() => {
                  if (figmaUrl.trim() && !figmaValid) {
                    setFigmaError("Paste a link that starts with figma.com/design/");
                  }
                }}
                onKeyDown={(e) => e.key === "Enter" && figmaValid && void importFigma()}
              />
              <button
                className="sp-btn sp-btn-ghost"
                disabled={!figmaValid || phase.state === "importing"}
                onClick={() => void importFigma()}
              >
                Import
              </button>
            </div>
            {figmaError && (
              <p style={{ fontSize: "var(--type-caption-size)", color: "var(--state-danger)" }}>
                {figmaError}
              </p>
            )}
          </section>
        )}

        <section className="sp-card sp-import-leg">
          <p style={labelStyle}>From a tokens file</p>
          <p style={detailStyle}>Drop a design-tokens JSON file, or browse for one.</p>
          <label
            {...tokensDrop.bind}
            data-active={tokensDrop.active}
            className="sp-btn sp-btn-ghost"
            style={{ alignSelf: "flex-start", cursor: "pointer" }}
          >
            Choose tokens.json
            <input
              type="file"
              accept=".json,application/json"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleTokens(f);
                e.target.value = "";
              }}
            />
          </label>
        </section>
      </div>

      {error && (
        <p
          role="alert"
          style={{
            marginTop: "var(--space-sm)",
            fontSize: "var(--type-caption-size)",
            color: "var(--state-danger)",
          }}
        >
          {error}
        </p>
      )}

      {phase.state === "importing" && phase.visible && (
        <section className="sp-card sp-import-status" role="status" aria-live="polite">
          <p style={labelStyle}>{phase.step}…</p>
          {/* The request is not abortable (no signal on the store call), so
              there is no Cancel here. Indeterminate: the step count is
              unknown. */}
          <span className="sp-upload-track block">
            <span className="sp-upload-bar" />
          </span>
        </section>
      )}

      {phase.state === "done" && (
        <section className="sp-card sp-import-status" role="status">
          <p style={labelStyle}>
            Added {phase.addedColors} color{phase.addedColors === 1 ? "" : "s"} and{" "}
            {phase.addedStyles} type style{phase.addedStyles === 1 ? "" : "s"}
          </p>
          {phase.matched > 0 && (
            <p style={detailStyle}>
              {phase.matched} matched what you already had, so those stayed as they were.
            </p>
          )}
          <div className="flex items-center" style={{ gap: "var(--space-2xs)" }}>
            <a
              href={routeToUrl({ name: "brandStudio", category: "colors" })}
              onClick={linkClick({ name: "brandStudio", category: "colors" })}
              className="sp-btn sp-btn-ghost"
            >
              View colors
            </a>
            <button
              className="sp-btn sp-btn-tertiary"
              onClick={() => {
                undo(phase.snapshot);
                setPhase({ state: "idle" });
              }}
            >
              Undo import
            </button>
          </div>
        </section>
      )}
    </>
  );
}
