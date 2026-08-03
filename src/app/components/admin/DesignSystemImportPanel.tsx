import React, { useState } from "react";
import { Check, FileJson, FileText, Figma, RefreshCw, Upload } from "lucide-react";
import type { BrandColor, BrandTypeStyle } from "@/lib/types";
import { parseDesignTokens, parseGuidelines } from "@/lib/brand/designSystemImport";
import { stores } from "@/lib/stores";
import { useAuth } from "@/lib/auth/AuthContext";
import { useFileDrop } from "@/lib/useFileDrop";

interface DesignSystemImportPanelProps {
  onImportColors(colors: BrandColor[]): void;
  onImportTypeStyles(styles: BrandTypeStyle[]): void;
  onImportGuidelines(rules: string[]): void;
}

/** Design-system import: tokens.json (e.g. a Claude Design export) →
 * palette + type styles; guidelines.md → suggested brand rules the admin
 * accepts; or styles pulled from a connected Figma file. File/import-based —
 * merges into the current kit, admin saves to apply. */
export function DesignSystemImportPanel(props: DesignSystemImportPanelProps) {
  const { company } = useAuth();
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [accepted, setAccepted] = useState<Set<number>>(new Set());
  const [figmaUrl, setFigmaUrl] = useState("");
  const [figmaBusy, setFigmaBusy] = useState(false);

  const handleTokens = async (file: File) => {
    setError(null);
    setStatus(null);
    try {
      const json: unknown = JSON.parse(await file.text());
      const result = parseDesignTokens(json);
      if (!result.colors.length && !result.typeStyles.length) {
        setError("No color or typography tokens found in that file.");
        return;
      }
      if (result.colors.length) props.onImportColors(result.colors);
      if (result.typeStyles.length) props.onImportTypeStyles(result.typeStyles);
      setStatus(
        `Imported ${result.colors.length} colors and ${result.typeStyles.length} type styles` +
          (result.skipped.length ? ` (skipped: ${result.skipped.join(", ")})` : "") +
          ". Review below, then save.",
      );
    } catch {
      setError("Could not parse that file as JSON.");
    }
  };

  const handleGuidelines = async (file: File) => {
    setError(null);
    const found = parseGuidelines(await file.text());
    if (!found.length) {
      setError("No rule-like lines (always / never / avoid …) found in that file.");
      return;
    }
    setSuggestions(found);
    setAccepted(new Set(found.map((_, i) => i)));
  };

  const acceptSuggestions = () => {
    props.onImportGuidelines(suggestions.filter((_, i) => accepted.has(i)));
    setStatus(`Added ${accepted.size} brand rules. Review below, then save.`);
    setSuggestions([]);
  };

  const importFigmaStyles = async () => {
    if (!company || !figmaUrl.trim()) return;
    setFigmaBusy(true);
    setError(null);
    try {
      const result = await stores.designImport.importStylesFromUrl(company.id, figmaUrl.trim());
      if (result.colors.length) props.onImportColors(result.colors);
      if (result.typeStyles.length) props.onImportTypeStyles(result.typeStyles);
      setStatus(
        `Imported ${result.colors.length} colors and ${result.typeStyles.length} type styles from Figma. Review below, then save.`,
      );
      setFigmaUrl("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Figma style import failed.");
    } finally {
      setFigmaBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2.5">
        <UploadTile
          label="Design tokens (.json)"
          icon={<FileJson style={{ width: 16, height: 16, color: "var(--state-primary)" }} />}
          accept=".json,application/json"
          onFile={(f) => void handleTokens(f)}
        />
        <UploadTile
          label="Guidelines (.md)"
          icon={<FileText style={{ width: 16, height: 16, color: "var(--state-primary)" }} />}
          accept=".md,.txt,text/markdown,text/plain"
          onFile={(f) => void handleGuidelines(f)}
        />
      </div>

      {stores.designImport.isConfigured() && (
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Figma style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", width: 13, height: 13, color: "var(--text-muted)" }} />
            <input
              className="sp-input"
              style={{ paddingLeft: 30 }}
              value={figmaUrl}
              onChange={(e) => setFigmaUrl(e.target.value)}
              placeholder="Figma file link — pull its color + text styles"
            />
          </div>
          <button
            className="sp-btn sp-btn-ghost"
            disabled={figmaBusy || !figmaUrl.trim()}
            onClick={() => void importFigmaStyles()}
          >
            {figmaBusy ? <RefreshCw className="animate-spin" style={{ width: 13, height: 13 }} /> : <Upload style={{ width: 13, height: 13 }} />}
            Pull styles
          </button>
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="space-y-2 rounded-lg p-3" style={{ background: "var(--bg-raised)", border: "1px solid var(--border)" }}>
          <p style={{ fontSize: "var(--type-caption-size)", color: "var(--text-secondary)" }}>
            Found {suggestions.length} rule-like lines — keep the ones that are real brand rules:
          </p>
          <div className="max-h-48 overflow-auto space-y-1">
            {suggestions.map((sug, i) => (
              <label key={i} className="flex items-start gap-2" style={{ fontSize: "var(--type-caption-size)", color: "var(--text-primary)" }}>
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={accepted.has(i)}
                  onChange={(e) => {
                    const next = new Set(accepted);
                    if (e.target.checked) next.add(i);
                    else next.delete(i);
                    setAccepted(next);
                  }}
                />
                {sug}
              </label>
            ))}
          </div>
          <div className="flex gap-2">
            <button className="sp-btn sp-btn-primary" style={{ padding: "6px 12px", fontSize: "var(--type-caption-size)" }} onClick={acceptSuggestions}>
              <Check style={{ width: 12, height: 12 }} />
              Add {accepted.size} rules
            </button>
            <button className="sp-btn sp-btn-ghost" style={{ padding: "6px 12px", fontSize: "var(--type-caption-size)" }} onClick={() => setSuggestions([])}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {status && <p style={{ fontSize: "var(--type-caption-size)", color: "var(--state-primary)" }}>{status}</p>}
      {error && <p style={{ fontSize: "var(--type-caption-size)", color: "var(--state-danger)" }}>{error}</p>}
    </div>
  );
}

/** A file-pick tile that also accepts a dragged file (.sp-dropzone motion). */
function UploadTile({
  label,
  icon,
  accept,
  onFile,
}: {
  label: string;
  icon: React.ReactNode;
  accept: string;
  onFile: (f: File) => void;
}) {
  const drop = useFileDrop((files) => {
    if (files[0]) onFile(files[0]);
  });
  return (
    <label
      {...drop.bind}
      data-active={drop.active}
      className="sp-dropzone flex flex-col items-center justify-center gap-1.5 py-4 cursor-pointer text-center"
      style={{ border: "1.5px dashed var(--border-strong)", borderRadius: "var(--radius-control)", fontSize: "var(--type-caption-size)", color: "var(--text-secondary)" }}
    >
      <span className="sp-dropzone__icon flex">{icon}</span>
      {label}
      <input
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
    </label>
  );
}
