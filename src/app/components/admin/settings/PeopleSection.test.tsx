import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { AuthContext, type AuthState } from "@/lib/auth/AuthContext";
import type { Company } from "@/lib/types";
import type { Member } from "@/lib/stores/interfaces";
import { PeopleSection, memberInitials, peopleMeta, sortMembers } from "./PeopleSection";
import { SettingsToastProvider } from "./settingsToast";

const member = (userId: string, name: string | undefined, role: Member["role"]): Member => ({
  userId,
  email: `${(name ?? userId).split(" ")[0].toLowerCase()}@acme.com`,
  name,
  role,
});

const TEAM: Member[] = [
  member("u3", "Marcus Lee", "admin"),
  member("u1", "CJ Munafo", "admin"),
  member("u4", "Ana Ruiz", "member"),
  member("u2", "Priya Shah", "admin"),
  member("u5", "Ben Carter", "member"),
  member("u6", "Chloe Park", "member"),
  member("u7", "Dana Ortiz", "member"),
  member("u8", "Eli Brooks", "member"),
  member("u9", undefined, "member"),
  member("u10", "Zoe Quinn", "member"),
];

const people = vi.hoisted(() => ({
  list: vi.fn(async () => [] as Member[]),
  invite: vi.fn(async () => undefined),
  setRole: vi.fn(async () => undefined),
  remove: vi.fn(async () => undefined),
}));
vi.mock("@/lib/stores", () => ({ stores: { people } }));

function renderSection() {
  people.list.mockResolvedValue(TEAM);
  const auth = {
    company: { id: "c1", name: "Acme Health" } as Company,
    user: { id: "u1" },
    isDevAuth: false,
  } as unknown as AuthState;
  render(
    <AuthContext.Provider value={auth}>
      <SettingsToastProvider>
        <PeopleSection />
      </SettingsToastProvider>
    </AuthContext.Provider>,
  );
}

describe("PeopleSection (PHASE-7 §9 D2, D8)", () => {
  it("lists you, then admins, then members, eight at a time", async () => {
    renderSection();
    expect(await screen.findByText("10 people · 3 admins")).toBeTruthy();
    const rows = screen.getAllByRole("listitem");
    expect(rows).toHaveLength(8);
    expect(rows[0].textContent).toContain("CJ Munafo(you)");
    expect(rows[1].textContent).toContain("Marcus Lee");
    expect(rows[2].textContent).toContain("Priya Shah");
    expect(rows[3].textContent).toContain("Ana Ruiz");
    await userEvent.click(screen.getByRole("button", { name: "Show all 10 people" }));
    expect(screen.getAllByRole("listitem")).toHaveLength(10);
    // Someone with no name yet shows their email alone.
    expect(screen.getByText("u9@acme.com")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Show fewer" })).toBeTruthy();
  });

  it("can't change or remove your own row", async () => {
    renderSection();
    const you = (await screen.findAllByRole("listitem"))[0];
    expect(
      (within(you).getByRole("combobox", { name: "Role for CJ Munafo" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (within(you).getByRole("button", { name: "More actions for CJ Munafo" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("removes a member after the confirm", async () => {
    renderSection();
    await userEvent.click(await screen.findByRole("button", { name: "More actions for Ana Ruiz" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Remove from workspace" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog.textContent).toContain("Remove Ana Ruiz from Acme Health?");
    await userEvent.click(within(dialog).getByRole("button", { name: "Remove member" }));
    expect(people.remove).toHaveBeenCalledWith("c1", "u4");
  });

  it("invites, then says so in a toast", async () => {
    renderSection();
    const field = await screen.findByRole("textbox", { name: "Invite email" });
    const invite = screen.getByRole("button", { name: "Invite" }) as HTMLButtonElement;
    expect(invite.disabled).toBe(true);
    await userEvent.type(field, "New@Acme.com{Enter}");
    expect(people.invite).toHaveBeenCalledWith("c1", "new@acme.com", "member");
    expect(await screen.findByText("Invite sent to new@acme.com.")).toBeTruthy();
  });

  it("helpers", () => {
    expect(peopleMeta([member("a", "A", "admin")])).toBe("1 person · 1 admin");
    expect(memberInitials(member("x", "Priya Shah", "member"))).toBe("PS");
    expect(memberInitials(member("x.y", undefined, "member"))).toBe("XY");
    expect(sortMembers(TEAM, "u1")[0].userId).toBe("u1");
  });
});
