import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { AuthContext, type AuthState } from "@/lib/auth/AuthContext";
import type { Company } from "@/lib/types";
import { AdvancedSection } from "./AdvancedSection";
import { SettingsToastProvider } from "./settingsToast";

const stores = vi.hoisted(() => ({
  people: {
    list: vi.fn(async () => [
      { userId: "u1", email: "cj@acme.com", name: "CJ Munafo", role: "admin" },
      { userId: "u2", email: "priya@acme.com", name: "Priya Shah", role: "member" },
    ]),
    setRole: vi.fn(async () => undefined),
  },
  templates: { listAll: vi.fn(async () => []) },
  brandAssets: { list: vi.fn(async () => []) },
  publicLinks: { isAvailable: () => false },
}));
vi.mock("@/lib/stores", () => ({ stores }));

describe("AdvancedSection (PHASE-7 §9 D5)", () => {
  it("transfers ownership after its confirm: promote first, then step down", async () => {
    const auth = {
      company: { id: "c1", name: "Acme Health" } as Company,
      user: { id: "u1" },
      isDevAuth: false,
      refresh: async () => {},
    } as unknown as AuthState;
    render(
      <AuthContext.Provider value={auth}>
        <SettingsToastProvider>
          <AdvancedSection />
        </SettingsToastProvider>
      </AuthContext.Provider>,
    );
    const transfer = screen.getByRole("button", { name: "Transfer" }) as HTMLButtonElement;
    expect(transfer.disabled).toBe(true);
    await userEvent.click(await screen.findByRole("combobox", { name: "Transfer ownership to" }));
    await userEvent.click(
      await screen.findByRole("option", { name: "Priya Shah (priya@acme.com)" }),
    );
    await userEvent.click(transfer);
    const dialog = await screen.findByRole("dialog");
    expect(dialog.textContent).toContain("Hand admin to Priya Shah?");
    await userEvent.click(within(dialog).getByRole("button", { name: "Transfer" }));
    expect(stores.people.setRole.mock.calls).toEqual([
      ["c1", "u2", "admin"],
      ["c1", "u1", "member"],
    ]);
  });
});
