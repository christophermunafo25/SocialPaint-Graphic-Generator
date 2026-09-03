import { useState } from "react";
import { RefreshCw } from "lucide-react";
import type { AutoBuildResult } from "@/lib/types";
import { stores } from "@/lib/stores";
import { useAuth } from "@/lib/auth/AuthContext";
import { ImportLinkPopup } from "./ImportLinkPopup";

interface CanvaImportDialogProps {
  onClose(): void;
  onBuilt(result: AutoBuildResult): void;
}

/** Paste a Canva design link → auto-built template. Canva hands over a flat
 * export rather than layers, so this rides the auto-build path: Claude
 * proposes the field boxes from the picture and the admin corrects them in
 * the inspector. The start screen only offers it once the workspace has
 * connected Canva, so there is no not-connected state to draw here. */
export function CanvaImportDialog({ onClose, onBuilt }: CanvaImportDialogProps) {
  const { company } = useAuth();
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (!company || !url.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await stores.designImport.autoBuild(company.id, {
        kind: "canva",
        url: url.trim(),
      });
      onBuilt(result);
    } catch (e) {
      setError(
        `${e instanceof Error ? e.message : "Import failed."} The blank canvas and the Figma import are unaffected.`,
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <ImportLinkPopup kind="canva" title="Import from Canva" onClose={onClose}>
      <form
        className="flex flex-col"
        style={{ gap: "var(--space-xs)" }}
        onSubmit={(e) => {
          e.preventDefault();
          void run();
        }}
      >
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Paste the design link from your browser's address bar."
          aria-label="Canva design link"
          className="sp-import-pop__input"
          autoFocus
          disabled={busy}
        />
        {(url.trim() || busy) && (
          <div className="sp-import-pop__actions">
            <button type="submit" disabled={busy} className="sp-btn sp-btn-primary">
              {busy && <RefreshCw className="w-4 h-4 animate-spin" />}
              {busy ? "Building, 15 to 40 seconds…" : "Import design"}
            </button>
          </div>
        )}
      </form>
      <p className="sp-import-pop__note">
        Canva shares a flat picture, so each editable text field gets a solid plate of the colour
        behind it. Adjust or remove a plate in the inspector where the backdrop is a photo.
      </p>
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
