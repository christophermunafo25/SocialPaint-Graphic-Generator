import React, { useRef, useState } from "react";
import type { BrandColor, BrandTypeStyle } from "@/lib/types";
import { stores } from "@/lib/stores";
import { parseDesignTokens } from "@/lib/brand/designSystemImport";
import { useFileDrop } from "@/lib/useFileDrop";
import { useAsync } from "@/lib/useAsync";
import { Button, Input, ProgressBar } from "../../primitives";
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

/** The Import page (13:12670): a Figma link source and a tokens-file
 * source side by side, then the import's status (13:12871) and its result
 * (13:12978). Parsing and merging are unchanged: merges only APPEND, an
 * existing key can't be redirected by an import, and imported roles never
 * displace one the admin assigned. When Figma isn't connected the Figma
 * card points to Settings › Integrations (PHASE-6 §9 D11); on a backend
 * with no Edge Functions it is left out. */
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
  const connection = useAsync(
    () =>
      figmaConfigured && company
        ? stores.designImport.isConnected(company.id)
        : Promise.resolve(false),
    [figmaConfigured, company?.id],
  );
  // Unknown while it loads, so the card doesn't flash "not connected".
  const figmaConnected = connection.status !== "ready" || connection.data;

  const beginImporting = (step: string) => {
    setError(null);
    setPhase({ state: "importing", step, visible: false });
    // The status appears only when the wait is real.
    window.clearTimeout(revealTimer.current);
    revealTimer.current = window.setTimeout(() => {
      setPhase((p) => (p.state === "importing" ? { ...p, visible: true } : p));
    }, 1000);
  };

  /** Merge and report. The snapshot from before the merge feeds "Undo
   * import"; the counts feed the result. */
  const applyImport = (colors: BrandColor[], typeStyles: BrandTypeStyle[]) => {
    window.clearTimeout(revealTimer.current);
    const snapshot = brand.draft;
    const mergedColors = mergeImportedColors(snapshot.colors, colors);
    const addedColors = mergedColors.length - snapshot.colors.length;
    const freshStyles = typeStyles
      .filter((t) => !snapshot.typeStyles.some((p) => p.key === t.key))
      // An imported style holds no font role (§9 D3).
      .map((t) => ({ ...t, useFor: null }));
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

  const settingsRoute = { name: "settings" as const, section: "integrations" as const };
  const importing = phase.state === "importing";

  return (
    <div className="sp-bs-import-page">
      <div className="sp-bs-import">
        {figmaConfigured && (
          <section className="sp-bs-import__leg" aria-labelledby="sp-bs-import-figma">
            <p id="sp-bs-import-figma" className="t-label-s">
              From a Figma file
            </p>
            {figmaConnected ? (
              <>
                <div className="sp-bs-import__row">
                  <Input
                    aria-label="Figma file link"
                    aria-invalid={figmaError ? true : undefined}
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
                  <Button
                    kind="primary"
                    size="md"
                    disabled={!figmaValid || importing}
                    onClick={() => void importFigma()}
                  >
                    Import
                  </Button>
                </div>
                {figmaError && (
                  <p className="t-caption-s sp-bs-error-line" role="alert">
                    {figmaError}
                  </p>
                )}
              </>
            ) : (
              <p className="t-body-s sp-bs-import__note">
                <a
                  href={routeToUrl(settingsRoute)}
                  onClick={linkClick(settingsRoute)}
                  className="ui-ring sp-bs-link"
                >
                  Connect Figma in Settings
                </a>{" "}
                to import its color and text styles.
              </p>
            )}
          </section>
        )}

        <section className="sp-bs-import__leg" aria-labelledby="sp-bs-import-tokens">
          <p id="sp-bs-import-tokens" className="t-label-s">
            From a tokens file
          </p>
          <label
            {...tokensDrop.bind}
            data-active={tokensDrop.active}
            className="ui-tint sp-bs-import__choose"
          >
            <span className="t-button-m">Choose tokens.json</span>
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
        <p className="t-caption-s sp-bs-error-line" role="alert">
          {error}
        </p>
      )}

      {importing && phase.visible && (
        <section className="sp-bs-import__status" role="status" aria-live="polite">
          <p className="t-body-s">{phase.step}…</p>
          {/* The request can't be aborted, so there is no Cancel; the bar is
              indeterminate, as the step count is unknown. */}
          <ProgressBar label={phase.step} />
        </section>
      )}

      {phase.state === "done" && (
        <section className="sp-bs-import__status sp-bs-import__status--done" role="status">
          <p className="t-label-s">
            Added {phase.addedColors} color{phase.addedColors === 1 ? "" : "s"} and{" "}
            {phase.addedStyles} type style{phase.addedStyles === 1 ? "" : "s"}
          </p>
          {phase.matched > 0 && (
            <p className="t-body-s sp-bs-import__matched">
              {phase.matched} matched what you already had, so those stayed as they were.
            </p>
          )}
          <div className="sp-bs-import__actions">
            <a
              href={routeToUrl({ name: "brandStudio", category: "colors" })}
              onClick={linkClick({ name: "brandStudio", category: "colors" })}
              className="ui-reset ui-tint ui-ring ui-btn"
              data-kind="neutral"
              data-size="md"
            >
              <span className="t-button-m">View colors</span>
            </a>
            <button
              type="button"
              className="ui-reset ui-ring t-label-m sp-bs-link sp-bs-link--quiet"
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
    </div>
  );
}
