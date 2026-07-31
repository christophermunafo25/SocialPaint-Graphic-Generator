import React, { useEffect, useState } from "react";
import { Figma, RefreshCw, X } from "lucide-react";
import type { DesignImportResult } from "@/lib/types";
import { stores } from "@/lib/stores";
import { useAuth } from "@/lib/auth/AuthContext";

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
  const [connected, setConnected] = useState<boolean | null>(null);
  const [pat, setPat] = useState("");
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

  const connect = async () => {
    if (!company || !pat.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await stores.designImport.connect(company.id, { kind: "pat", value: pat.trim() });
      setConnected(true);
      setPat("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not connect to Figma.");
    } finally {
      setBusy(false);
    }
  };

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-lg p-6 space-y-4" style={{ background: "var(--bg-surface)", borderRadius: "var(--radius-card)", boxShadow: "var(--shadow-md)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2" style={{ fontFamily: "var(--font-head-sm)", fontWeight: 700, fontSize: 17, letterSpacing: "-0.3px", color: "var(--text-primary)" }}>
            <Figma className="w-5 h-5" />
            Import from Figma
          </h2>
          <button onClick={onClose} aria-label="Close">
            <X className="w-5 h-5" style={{ color: "var(--muted-foreground)" }} />
          </button>
        </div>

        {connected === null ? (
          <p className="text-sm py-6 text-center" style={{ color: "var(--muted-foreground)" }}>Checking connection…</p>
        ) : !connected ? (
          <div className="space-y-3">
            <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
              Connect your company's Figma account with a personal access token (Figma → Settings →
              Security → Personal access tokens, file-read scope). The token is stored server-side and
              never reaches this browser again.
            </p>
            <input
              type="password"
              value={pat}
              onChange={(e) => setPat(e.target.value)}
              placeholder="figd_…"
              className="sp-input" style={{ fontFamily: "var(--font-mono)" }}
            />
            <button
              onClick={() => void connect()}
              disabled={busy || !pat.trim()}
              className="sp-btn sp-btn-primary w-full"
            >
              {busy ? "Connecting…" : "Connect Figma"}
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
          <p className="text-sm rounded-xl px-4 py-3" style={{ background: "var(--danger-wash)", color: "var(--destructive)" }}>
            {error}
          </p>
        )}
        {warnings.map((w) => (
          <p key={w} className="rounded-lg px-3 py-2" style={{ fontSize: 12, background: "var(--bg-hover)", color: "var(--text-secondary)" }}>
            {w}
          </p>
        ))}
      </div>
    </div>
  );
}
