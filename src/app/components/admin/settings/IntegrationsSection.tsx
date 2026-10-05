import React, { useState } from "react";
import type { IntegrationConnectionInfo } from "@/lib/types";
import { stores } from "@/lib/stores";
import { useAsync } from "@/lib/useAsync";
import { useAuth } from "@/lib/auth/AuthContext";
import { ErrorState } from "../../ErrorState";
import { SkeletonLines } from "../../Skeleton";
import { Button, SettingsCard, Status } from "../../primitives";
import { FigmaConnectForm } from "./FigmaConnectForm";
import { ConfirmModal } from "./SettingsConfirm";
import { DevBackendNotice } from "./settingsShared";
import { useSettingsToast } from "./settingsToast";
import { markCanvaConnectStarted } from "@/lib/canvaReturn";

const PROVIDER_LABELS: Record<IntegrationConnectionInfo["provider"], string> = {
  figma: "Figma",
  canva: "Canva",
};

const shortDate = (iso: string): string =>
  new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

/** Settings › Integrations (13:15051): one card per provider, its status
 * pill, who connected it and when, then Connect, or Reconnect and
 * Disconnect. Disconnect keeps its confirm, where the red lives (PHASE-7
 * §9 D5, D9). Before Disconnect existed, a departed admin's token kept
 * working forever. */
export function IntegrationsSection() {
  const { company } = useAuth();
  const toast = useSettingsToast();
  const configured = stores.designImport.isConfigured();
  const [version, setVersion] = useState(0);
  const reload = () => setVersion((v) => v + 1);
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
      <div className="sp-st-section">
        <DevBackendNotice>
          Integrations need the Supabase backend. This dev backend has no Edge Functions to hold a
          token.
        </DevBackendNotice>
      </div>
    );
  }

  const confirmDisconnect = () => {
    const row = disconnecting;
    setDisconnecting(null);
    if (!company || !row) return;
    setBusy(true);
    void stores.designImport
      .disconnect(company.id, row.provider)
      .then(reload)
      .catch((e) => toast(e instanceof Error ? e.message : "Disconnect failed."))
      .finally(() => setBusy(false));
  };

  const startCanva = () => {
    if (!company) return;
    setBusy(true);
    void stores.designImport
      .canvaConnectStart(company.id, `${window.location.origin}/?canva_oauth=1`)
      .then(({ authorizeUrl }) => {
        // Lets the return be recognised even if Canva drops our query.
        markCanvaConnectStarted();
        window.location.assign(authorizeUrl);
      })
      .catch((e) => {
        toast(e instanceof Error ? e.message : "Could not start the Canva connection.");
        setBusy(false);
      });
  };

  return (
    <div className="sp-st-section">
      <ConfirmModal
        open={disconnecting !== null}
        title={`Disconnect ${disconnecting ? PROVIDER_LABELS[disconnecting.provider] : ""}?`}
        body="Imports and auto-build from it stop working for everyone until someone reconnects. The stored token is deleted immediately."
        confirmLabel="Disconnect"
        onCancel={() => setDisconnecting(null)}
        onConfirm={confirmDisconnect}
      />

      {state.status === "loading" ? (
        <SkeletonLines lines={3} label="Loading integrations" />
      ) : state.status === "error" ? (
        <ErrorState
          title="We couldn't load your integrations."
          detail="Check your connection and try again."
          onRetry={state.retry}
        />
      ) : (
        state.data.map((row) => {
          const name = PROVIDER_LABELS[row.provider];
          const status = !row.enabled ? (
            <Status tone="neutral">Not available</Status>
          ) : row.connected ? (
            <Status tone="positive">Connected</Status>
          ) : (
            <Status tone="neutral">Not connected</Status>
          );
          const connect = () =>
            row.provider === "canva"
              ? startCanva()
              : setConnecting(connecting === row.provider ? null : row.provider);
          return (
            <SettingsCard
              key={row.provider}
              className="sp-st-gap-12 sp-st-integration"
              title={
                <>
                  {name}
                  {status}
                </>
              }
              action={
                row.enabled && (
                  <span className="sp-st-actions">
                    <Button
                      kind="neutral"
                      disabled={busy}
                      onClick={connect}
                      aria-expanded={row.provider === "figma" ? connecting === "figma" : undefined}
                    >
                      {row.connected ? "Reconnect" : "Connect"}
                    </Button>
                    {row.connected && (
                      <Button kind="neutral" disabled={busy} onClick={() => setDisconnecting(row)}>
                        Disconnect
                      </Button>
                    )}
                  </span>
                )
              }
            >
              {row.enabled && row.connected && (
                <p className="t-caption-m sp-st-meta sp-st-wrap">
                  {row.connectedByEmail
                    ? `Connected by ${row.connectedByEmail}`
                    : "Connected before we started recording who"}
                  {row.connectedAt ? ` on ${shortDate(row.connectedAt)}` : ""}
                  {row.provider === "canva" && row.expiresAt
                    ? ` · token refreshes; current one lapses ${shortDate(row.expiresAt)}`
                    : ""}
                </p>
              )}
              {row.provider === "figma" && connecting === "figma" && (
                <FigmaConnectForm
                  onConnected={() => {
                    setConnecting(null);
                    reload();
                  }}
                />
              )}
            </SettingsCard>
          );
        })
      )}
    </div>
  );
}
