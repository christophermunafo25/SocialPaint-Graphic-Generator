import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { AuthContext, type AuthState } from "@/lib/auth/AuthContext";
import type { Company, IntegrationConnectionInfo } from "@/lib/types";
import { IntegrationsSection } from "./IntegrationsSection";
import { SettingsToastProvider } from "./settingsToast";

const designImport = vi.hoisted(() => ({
  isConfigured: vi.fn(() => true),
  connectionInfo: vi.fn(async () => [] as IntegrationConnectionInfo[]),
  disconnect: vi.fn(async () => undefined),
  connect: vi.fn(async () => undefined),
  canvaConnectStart: vi.fn(),
}));
vi.mock("@/lib/stores", () => ({ stores: { designImport } }));

const FIGMA: IntegrationConnectionInfo = {
  provider: "figma",
  enabled: true,
  connected: true,
  connectedByEmail: "cj@acme.com",
  connectedAt: "2026-09-14T12:00:00Z",
} as IntegrationConnectionInfo;
const CANVA: IntegrationConnectionInfo = {
  provider: "canva",
  enabled: true,
  connected: false,
} as IntegrationConnectionInfo;

function renderSection(rows: IntegrationConnectionInfo[]) {
  designImport.connectionInfo.mockResolvedValue(rows);
  const auth = { company: { id: "c1", name: "Acme" } as Company } as unknown as AuthState;
  render(
    <AuthContext.Provider value={auth}>
      <SettingsToastProvider>
        <IntegrationsSection />
      </SettingsToastProvider>
    </AuthContext.Provider>,
  );
}

describe("IntegrationsSection (PHASE-7 §9 D5, D9)", () => {
  it("draws each provider's state, as the frame does", async () => {
    renderSection([FIGMA, CANVA]);
    const figma = (await screen.findByRole("heading", { name: /Figma/ })).closest("section")!;
    expect(within(figma).getByText("Connected")).toBeTruthy();
    expect(within(figma).getByText(/Connected by cj@acme\.com on/)).toBeTruthy();
    expect(within(figma).getByRole("button", { name: "Reconnect" })).toBeTruthy();
    const canva = screen.getByRole("heading", { name: /Canva/ }).closest("section")!;
    expect(within(canva).getByText("Not connected")).toBeTruthy();
    expect(within(canva).getByRole("button", { name: "Connect" })).toBeTruthy();
    expect(within(canva).queryByRole("button", { name: "Disconnect" })).toBeNull();
  });

  it("shows a provider the server hasn't enabled as Not available, with no buttons", async () => {
    renderSection([{ ...CANVA, enabled: false }]);
    const canva = (await screen.findByRole("heading", { name: /Canva/ })).closest("section")!;
    expect(within(canva).getByText("Not available")).toBeTruthy();
    expect(within(canva).queryByRole("button")).toBeNull();
  });

  it("disconnects only after the confirm", async () => {
    renderSection([FIGMA]);
    await userEvent.click(await screen.findByRole("button", { name: "Disconnect" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog.textContent).toContain("Disconnect Figma?");
    expect(designImport.disconnect).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole("button", { name: "Disconnect" }));
    expect(designImport.disconnect).toHaveBeenCalledWith("c1", "figma");
  });

  it("opens the token form under Figma", async () => {
    renderSection([FIGMA]);
    await userEvent.click(await screen.findByRole("button", { name: "Reconnect" }));
    expect(screen.getByLabelText("Personal access token")).toBeTruthy();
    expect(screen.getByRole("button", { name: "How to get a token" })).toBeTruthy();
  });
});
