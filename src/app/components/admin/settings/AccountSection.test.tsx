import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { AuthContext, type AuthState } from "@/lib/auth/AuthContext";
import type { Company } from "@/lib/types";
import { ColorSchemeProvider } from "@/lib/colorScheme";
import { AccountSection } from "./AccountSection";
import { SettingsToastProvider } from "./settingsToast";

const account = vi.hoisted(() => ({
  isAvailable: () => true,
  getDisplayName: vi.fn(async () => "CJ Munafo"),
  setDisplayName: vi.fn(async () => undefined),
  getNotificationPrefs: vi.fn(async () => ({
    inviteAccepted: true,
    weeklyDigest: true,
    linkExpiring: false,
  })),
  setNotificationPrefs: vi.fn(async () => undefined),
}));
vi.mock("@/lib/stores", () => ({ stores: { account } }));

function renderSection(role: "admin" | "member") {
  const auth = {
    company: { id: "c1", name: "Acme Health" } as Company,
    role,
    user: { id: "u1", email: "cj@acme.com" },
    backend: "supabase",
    signOut: async () => {},
  } as unknown as AuthState;
  render(
    <AuthContext.Provider value={auth}>
      <ColorSchemeProvider>
        <SettingsToastProvider>
          <AccountSection />
        </SettingsToastProvider>
      </ColorSchemeProvider>
    </AuthContext.Provider>,
  );
}

describe("AccountSection (PHASE-7 §9 D10, D11, D13)", () => {
  it("edits the display name in place", async () => {
    renderSection("admin");
    expect(await screen.findByText("CJ Munafo")).toBeTruthy();
    expect(screen.queryByText("Backend")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Edit display name" }));
    const field = screen.getByRole("textbox", { name: "Display name" });
    await userEvent.clear(field);
    await userEvent.type(field, "C. J.{Enter}");
    expect(account.setDisplayName).toHaveBeenCalledWith("u1", "C. J.");
  });

  it("shows admins all three switches, members two", async () => {
    renderSection("admin");
    expect(await screen.findByRole("switch", { name: "Invited members accepted" })).toBeTruthy();
    document.body.innerHTML = "";
    renderSection("member");
    expect(await screen.findByRole("switch", { name: "Weekly usage digest" })).toBeTruthy();
    expect(screen.queryByRole("switch", { name: "Invited members accepted" })).toBeNull();
    expect(screen.getByText("Member")).toBeTruthy();
  });

  it("picks the appearance on a segmented control", () => {
    renderSection("admin");
    expect(screen.getByRole("radiogroup", { name: "Appearance" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Dark" })).toBeTruthy();
  });
});
