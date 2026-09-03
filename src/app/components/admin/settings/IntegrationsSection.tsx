import React, { useState } from "react";
import type { IntegrationConnectionInfo } from "@/lib/types";
import { stores } from "@/lib/stores";
import { useAsync } from "@/lib/useAsync";
import { useAuth } from "@/lib/auth/AuthContext";
import { ConfirmDialog } from "../../ConfirmDialog";
import { ErrorState } from "../../ErrorState";
import { FigmaConnectForm } from "./FigmaConnectForm";
import { DevBackendNotice, SettingsCard } from "./settingsShared";
import { markCanvaConnectStarted } from "@/lib/canvaReturn";

const PROVIDER_LABELS: Record<IntegrationConnectionInfo["provider"], string> = {
  figma: "Figma",
  canva: "Canva",
};

const shortDate = (iso: string): string =>
  new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

/** Third-party connections: what is connected, whose credential it is, and
 * the way to sever it. The highest-value fact on this page is the
 * disconnect button — before it existed, a departed admin's token kept
 * working forever. */
export function IntegrationsSection() {
  const { company } = useAuth();
  const configured = stores.designImport.isConfigured();
  const [version, setVersion] = useState(0);
  const reload = () => setVersion((v) => v + 1);
  const [error, setError] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState<IntegrationConnectionInfo | null>(null);
  /** Which provider's connect form is open. */
  const [connecting, setConnecting] = useState<IntegrationConnectionInfo["provider"] | null>(null);
  const [busy, setBusy] = useState(false);

  const state = useAsync<IntegrationConnectionInfo[]>(
    () =>
      company && configured ? stores.designImport.connectionInfo(company.id) : Promise.resolve([]),
    [company, configured, version],
  );

  if (!configured) {
    return (
      <DevBackendNotice>
        Integrations need the Supabase backend — this dev backend has no Edge Functions to hold a
        token.
      </DevBackendNotice>
    );
  }

  const confirmDisconnect = () => {
    const row = disconnecting;
    setDisconnecting(null);
    if (!company || !row) return;
    setBusy(true);
    setError(null);
    void stores.designImport
      .disconnect(company.id, row.provider)
      .then(reload)
      .catch((e) => setError(e instanceof Error ? e.message : "Disconnect failed."))
      .finally(() => setBusy(false));
  };

  const startCanva = () => {
    if (!company) return;
    setBusy(true);
    setError(null);
    void stores.designImport
      .canvaConnectStart(company.id, `${window.location.origin}/?canva_oauth=1`)
      .then(({ authorizeUrl }) => {
        // Lets the return be recognised even if Canva drops our query.
        markCanvaConnectStarted();
        window.location.assign(authorizeUrl);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Could not start the Canva connection.");
        setBusy(false);
      });
  };

  return (
    <div className="space-y-6">
      <ConfirmDialog
        open={disconnecting !== null}
        title={`Disconnect ${disconnecting ? PROVIDER_LABELS[disconnecting.provider] : ""}?`}
        description="Imports and auto-build from it stop working for everyone until someone reconnects. The stored token is deleted immediately."
        confirmLabel="Disconnect"
        onCancel={() => setDisconnecting(null)}
        onConfirm={confirmDisconnect}
      />

      {error && (
        <p
          role="alert"
          className="px-4 py-3"
          data-radius-card
          style={{ background: "var(--danger-wash)", color: "var(--destructive)" }}
        >
          {error}
        </p>
      )}

      {state.status === "loading" ? (
        <p style={{ fontSize: "var(--type-label-size)", color: "var(--text-muted)" }}>Loading…</p>
      ) : state.status === "error" ? (
        <ErrorState
          title="We couldn't load your integrations."
          detail="Check your connection and try again."
          onRetry={state.retry}
        />
      ) : (
        state.data.map((row) => (
          <SettingsCard key={row.provider} title={PROVIDER_LABELS[row.provider]}>
            {!row.enabled ? (
              <p style={{ fontSize: "var(--type-label-size)", color: "var(--text-muted)" }}>
                Not enabled on this server.
              </p>
            ) : (
              <>
                <div
                  className="flex items-start justify-between"
                  style={{ gap: "var(--space-sm)" }}
                >
                  <div className="min-w-0">
                    <span
                      className="sp-eyebrow"
                      style={{
                        color: row.connected ? "var(--state-primary)" : "var(--text-muted)",
                      }}
                    >
                      {row.connected ? "Connected" : "Not connected"}
                    </span>
                    {row.connected && (
                      <p
                        style={{
                          fontSize: "var(--type-caption-size)",
                          color: "var(--text-secondary)",
                          marginTop: 2,
                        }}
                      >
                        {row.connectedByEmail
                          ? `Connected by ${row.connectedByEmail}`
                          : "Connected before we started recording who"}
                        {row.connectedAt ? ` on ${shortDate(row.connectedAt)}` : ""}
                        {row.provider === "canva" && row.expiresAt
                          ? ` · token refreshes; current one lapses ${shortDate(row.expiresAt)}`
                          : ""}
                      </p>
                    )}
                  </div>
                  <div
                    className="flex items-center"
                    style={{ gap: "var(--space-3xs)", flexShrink: 0 }}
                  >
                    {row.provider === "canva" ? (
                      <button onClick={startCanva} disabled={busy} className="sp-btn sp-btn-ghost">
                        {row.connected ? "Reconnect" : "Connect"}
                      </button>
                    ) : (
                      <button
                        onClick={() =>
                          setConnecting(connecting === row.provider ? null : row.provider)
                        }
                        disabled={busy}
                        className="sp-btn sp-btn-ghost"
                      >
                        {row.connected ? "Reconnect" : "Connect"}
                      </button>
                    )}
                    {row.connected && (
                      <button
                        onClick={() => setDisconnecting(row)}
                        disabled={busy}
                        className="sp-btn sp-btn-ghost"
                        style={{ color: "var(--state-danger)" }}
                      >
                        Disconnect
                      </button>
                    )}
                  </div>
                </div>
                {row.provider === "figma" && connecting === "figma" && (
                  <FigmaConnectForm
                    onConnected={() => {
                      setConnecting(null);
                      reload();
                    }}
                  />
                )}
              </>
            )}
          </SettingsCard>
        ))
      )}

      <p style={{ fontSize: "var(--type-caption-size)", color: "var(--text-muted)" }}>
        Tokens are stored server-side and are never shown here — status and who connected, nothing
        more.
      </p>
    </div>
  );
}
