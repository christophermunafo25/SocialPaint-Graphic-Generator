import React, { useState } from "react";
import { stores } from "@/lib/stores";
import { useAuth } from "@/lib/auth/AuthContext";
import { Button, Field, Input } from "../../primitives";

/** Figma's own page on personal access tokens (file-read scope). */
const TOKEN_HELP_URL =
  "https://help.figma.com/hc/en-us/articles/8085703771159-Manage-personal-access-tokens";

/** The Figma personal-access-token form, under the Figma card in Settings ›
 * Integrations: the token field with one "How to get a token" link in place
 * of the old helper paragraph (PHASE-7 §9 D9), and Connect. The token goes straight to the
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
    <div className="sp-st-token">
      <Field
        label="Personal access token"
        error={error}
        action={{
          label: "How to get a token",
          onClick: () => window.open(TOKEN_HELP_URL, "_blank", "noopener,noreferrer"),
        }}
      >
        <Input
          type="password"
          value={pat}
          onChange={(e) => setPat(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void connect()}
          placeholder="figd_…"
          autoComplete="off"
        />
      </Field>
      <Button kind="primary" disabled={busy || !pat.trim()} onClick={() => void connect()}>
        {busy ? "Connecting…" : "Connect"}
      </Button>
    </div>
  );
}
