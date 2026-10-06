import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { AuthContext, type AuthState } from "@/lib/auth/AuthContext";
import type { Company, CompanyTemplateLink } from "@/lib/types";
import { SharingSection } from "./SharingSection";
import { SettingsToastProvider } from "./settingsToast";

const link = (id: string, name: string, extra: Partial<CompanyTemplateLink> = {}) =>
  ({
    id,
    name,
    templateId: "t1",
    templateName: "Now hiring",
    createdAt: "2026-09-01T00:00:00Z",
    lastUsedAt: "2026-09-30T12:00:00Z",
    expiresAt: null,
    revokedAt: null,
    useCap: null,
    useCount: 37,
    ...extra,
  }) as CompanyTemplateLink;

const LINKS = [
  link("l1", "Recruiting partners"),
  link("l2", "Career fair", { useCap: 200, useCount: 112, expiresAt: "2099-10-15T12:00:00Z" }),
  link("l3", "Old campaign", { revokedAt: "2026-09-02T12:00:00Z" }),
];

const stores = vi.hoisted(() => ({
  publicLinks: {
    isAvailable: () => true,
    listAll: vi.fn(async () => [] as CompanyTemplateLink[]),
    revoke: vi.fn(async () => undefined),
    regenerate: vi.fn(async () => ({ token: "tok" })),
  },
  templates: { get: vi.fn() },
  companies: { update: vi.fn() },
}));
vi.mock("@/lib/stores", () => ({ stores }));

function renderSection() {
  stores.publicLinks.listAll.mockResolvedValue(LINKS);
  const auth = {
    company: { id: "c1", name: "Acme Health" } as Company,
    refresh: async () => {},
  } as unknown as AuthState;
  render(
    <AuthContext.Provider value={auth}>
      <SettingsToastProvider>
        <SharingSection />
      </SettingsToastProvider>
    </AuthContext.Provider>,
  );
}

describe("SharingSection (PHASE-7 §9 D4, D5)", () => {
  it("lists active links, with the revoked ones behind the filter", async () => {
    renderSection();
    expect(await screen.findByText("Recruiting partners")).toBeTruthy();
    expect(screen.getByText("112 of 200")).toBeTruthy();
    expect(screen.queryByText("Old campaign")).toBeNull();
    // No Copy on a row: an address is shown once (D4).
    expect(screen.queryByRole("button", { name: /^Copy/ })).toBeNull();
    await userEvent.click(screen.getByRole("switch", { name: "Show revoked and expired links" }));
    const row = screen.getByText("Old campaign").closest("tr")!;
    expect(within(row).getByText(/^Revoked /)).toBeTruthy();
    expect(within(row).queryByRole("button", { name: /^Revoke / })).toBeNull();
  });

  it("revokes one link after its confirm", async () => {
    renderSection();
    await userEvent.click(await screen.findByRole("button", { name: "Revoke Career fair" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Revoke link" }));
    expect(stores.publicLinks.revoke).toHaveBeenCalledWith("c1", "l2");
  });

  it("offers Manage and New address in the row menu", async () => {
    renderSection();
    await userEvent.click(
      await screen.findByRole("button", { name: "More actions for Recruiting partners" }),
    );
    expect(await screen.findByRole("menuitem", { name: "Manage" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "New address" })).toBeTruthy();
  });

  it("revokes every active link only once the workspace name is typed", async () => {
    stores.publicLinks.revoke.mockClear();
    renderSection();
    await userEvent.click(await screen.findByRole("button", { name: "Revoke all 2 active links" }));
    const dialog = await screen.findByRole("dialog");
    const go = within(dialog).getByRole("button", { name: "Revoke 2 links" }) as HTMLButtonElement;
    expect(go.disabled).toBe(true);
    await userEvent.type(
      within(dialog).getByLabelText("Type Acme Health to confirm"),
      "Acme Health",
    );
    await userEvent.click(go);
    expect(stores.publicLinks.revoke).toHaveBeenCalledTimes(2);
  });
});
