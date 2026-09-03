import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import type { DesignImportResult } from "@/lib/types";
import { stores } from "@/lib/stores";
import { useAuth } from "@/lib/auth/AuthContext";
import { useRouter } from "../../router";
import { ImportLinkPopup } from "./ImportLinkPopup";

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

  useEffect(() => {
    if (!company) return;
    stores.designImport
      .isConnected(company.id)
      .then(setConnected)
      .catch(() => setConnected(false));
  }, [company]);

  const runImport = async () => {
    if (!company || !url.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await stores.designImport.importFromUrl(company.id, url.trim());
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
    <ImportLinkPopup kind="figma" title="Import from Figma" onClose={onClose}>
      {connected === null ? (
        <p className="sp-import-pop__note">Checking connection…</p>
      ) : !connected ? (
        // Credential entry lives in Settings → Integrations, not inside a
        // popup about importing a frame — this keeps the short path only.
        <>
          <p className="sp-import-pop__note">
            Figma isn't connected for this workspace. An admin connects it once, in Settings, and
            imports work for everyone from then on.
          </p>
          <div className="sp-import-pop__actions">
            <button
              type="button"
              onClick={() => {
                onClose();
                navigate({ name: "settings", section: "integrations" });
              }}
              className="sp-btn sp-btn-primary"
            >
              Open integration settings
            </button>
          </div>
        </>
      ) : (
        <form
          className="flex flex-col"
          style={{ gap: "var(--space-xs)" }}
          onSubmit={(e) => {
            e.preventDefault();
            void runImport();
          }}
        >
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste the design link from Figma frame"
            aria-label="Figma frame link"
            className="sp-import-pop__input"
            autoFocus
            disabled={busy}
          />
          {(url.trim() || busy) && (
            <div className="sp-import-pop__actions">
              <button type="submit" disabled={busy} className="sp-btn sp-btn-primary">
                {busy && <RefreshCw className="w-4 h-4 animate-spin" />}
                {busy ? "Importing…" : "Import frame"}
              </button>
            </div>
          )}
        </form>
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
    </ImportLinkPopup>
  );
}
