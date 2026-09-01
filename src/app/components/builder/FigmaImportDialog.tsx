import React, { useEffect, useState } from "react";
import { Figma, RefreshCw, X } from "lucide-react";
import type { DesignImportResult } from "@/lib/types";
import { stores } from "@/lib/stores";
import { useAuth } from "@/lib/auth/AuthContext";
import { useRouter } from "../../router";

interface FigmaImportDialogProps {
  onClose(): void;
  onImported(result: DesignImportResult): void;
}

/** Paste a Figma frame link → rendered background + suggested fields.
 * Additive convenience only: any failure leaves the manual PNG path intact.
 * All Figma API traffic goes through Supabase Edge Functions — no tokens in
 * the client. */
export function FigmaImportDialog({ onClose, onImported }: FigmaImportDialogProps) {
  const { company } = useAuth();
  const { navigate } = useRouter();
  const [connected, setConnected] = useState<boolean | null>(null);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  useEffect(() => {
    if (!company) return;
    stores.designImport
      .isConnected(company.id)
      .then(setConnected)
      .catch(() => setConnected(false));
  }, [company]);

  const runImport = async () => {
    if (!company || !url.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const result = await stores.designImport.importFromUrl(company.id, url.trim());
      setWarnings(result.warnings);
      onImported(result);
    } catch (e) {
      setError(
        (e instanceof Error ? e.message : "Import failed.") +
          " You can always upload a PNG and map fields manually.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg p-6 space-y-4"
        style={{ background: "var(--bg-surface)", borderRadius: "var(--radius-card)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2
            className="flex items-center gap-2"
            style={{
              fontFamily: "var(--font-head)",
              fontWeight: "var(--weight-head)",
              fontSize: 21,
              letterSpacing: "var(--track-head)",
              color: "var(--text-primary)",
            }}
          >
            <Figma className="w-5 h-5" />
            Import from Figma
          </h2>
          <button onClick={onClose} aria-label="Close">
            <X className="w-5 h-5" style={{ color: "var(--muted-foreground)" }} />
          </button>
        </div>

        {connected === null ? (
          <p className="text-sm py-6 text-center" style={{ color: "var(--muted-foreground)" }}>
            Checking connection…
          </p>
        ) : !connected ? (
          // Credential entry lives in Settings → Integrations, not inside a
          // modal about importing a frame — this keeps the short path only.
          <div className="space-y-3">
            <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
              Figma isn't connected for this workspace. An admin connects it once, in Settings, and
              imports work for everyone from then on.
            </p>
            <button
              onClick={() => {
                onClose();
                navigate({ name: "settings", section: "integrations" });
              }}
              className="sp-btn sp-btn-primary w-full"
            >
              Open integration settings
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
              Paste a link to a Figma frame (right-click the frame → Copy link). Its rendered image
              becomes the background, and text/image layers become suggested fields you can adjust.
            </p>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.figma.com/design/…?node-id=…"
              className="sp-input"
            />
            <button
              onClick={() => void runImport()}
              disabled={busy || !url.trim()}
              className="sp-btn sp-btn-primary w-full"
            >
              {busy && <RefreshCw className="w-4 h-4 animate-spin" />}
              {busy ? "Importing…" : "Import frame"}
            </button>
          </div>
        )}

        {error && (
          <p
            className="text-sm px-4 py-3"
            data-radius-card
            style={{ background: "var(--danger-wash)", color: "var(--destructive)" }}
          >
            {error}
          </p>
        )}
        {warnings.map((w) => (
          <p
            key={w}
            className="px-3 py-2"
            data-radius-control
            style={{
              fontSize: "var(--type-caption-size)",
              background: "var(--bg-hover)",
              color: "var(--text-secondary)",
            }}
          >
            {w}
          </p>
        ))}
      </div>
    </div>
  );
}
