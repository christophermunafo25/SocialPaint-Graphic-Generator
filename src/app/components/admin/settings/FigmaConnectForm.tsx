import React, { useState } from "react";
import { stores } from "@/lib/stores";
import { useAuth } from "@/lib/auth/AuthContext";

/** The Figma personal-access-token form, lifted out of FigmaImportDialog so
 * credential entry lives in Settings → Integrations rather than inside a
 * modal about importing a frame. The token goes straight to the
 * figma-connect Edge Function and is stored server-side; it never renders
 * back into any browser again. */
export function FigmaConnectForm({ onConnected }: { onConnected(): void }) {
  const { company } = useAuth();
  const [pat, setPat] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = async () => {
    if (!company || !pat.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await stores.designImport.connect(company.id, { kind: "pat", value: pat.trim() });
      setPat("");
      onConnected();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not connect to Figma.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <p style={{ fontSize: "var(--type-caption-size)", color: "var(--text-muted)" }}>
        Paste a personal access token (Figma → Settings → Security → Personal access tokens,
        file-read scope). It is stored server-side for the whole workspace and never reaches a
        browser again.
      </p>
      <div className="flex" style={{ gap: "var(--space-2xs)" }}>
        <input
          type="password"
          value={pat}
          onChange={(e) => setPat(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void connect()}
          placeholder="figd_…"
          aria-label="Figma personal access token"
          className="sp-input flex-1"
          style={{ fontFamily: "var(--font-mono)" }}
        />
        <button
          onClick={() => void connect()}
          disabled={busy || !pat.trim()}
          className="sp-btn sp-btn-primary"
        >
          {busy ? "Connecting…" : "Connect"}
        </button>
      </div>
      {error && (
        <p
          role="alert"
          style={{ fontSize: "var(--type-caption-size)", color: "var(--state-danger)" }}
        >
          {error}
        </p>
      )}
    </div>
  );
}
