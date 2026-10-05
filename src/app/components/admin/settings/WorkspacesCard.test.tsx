import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { AuthContext, type AuthState } from "@/lib/auth/AuthContext";
import type { Company } from "@/lib/types";
import { RouterProvider } from "../../../router";
import { WorkspacesCard, workspaceInitials, workspaceMeta } from "./WorkspacesCard";

const people = vi.hoisted(() => ({ list: vi.fn(async () => [] as unknown[]) }));
vi.mock("@/lib/stores", () => ({ stores: { people } }));

const company = (id: string, name: string) => ({ id, name }) as Company;
const ACME = company("c1", "Acme Health");
const FOUNDATION = company("c2", "Acme Health Foundation");

function renderCard(over: Partial<AuthState> = {}) {
  const setCompany = vi.fn(async () => undefined);
  const auth = {
    company: ACME,
    companies: [ACME, FOUNDATION],
    roleFor: (id: string) => (id === "c1" ? "admin" : "member"),
    setCompany,
    ...over,
  } as unknown as AuthState;
  render(
    <AuthContext.Provider value={auth}>
      <RouterProvider>
        <WorkspacesCard />
      </RouterProvider>
    </AuthContext.Provider>,
  );
  return { setCompany };
}

describe("WorkspacesCard", () => {
  it("marks the current workspace and counts people only where the viewer is admin (D2)", async () => {
    people.list.mockResolvedValueOnce([{}, {}, {}]);
    renderCard();
    expect(screen.getByText("Current")).toBeTruthy();
    expect(await screen.findByText("Admin · 3 people")).toBeTruthy();
    expect(screen.getByText("Member")).toBeTruthy();
    expect(people.list).toHaveBeenCalledTimes(1);
    expect(people.list).toHaveBeenCalledWith("c1");
  });

  it("writes the meta line", () => {
    expect(workspaceMeta("Admin", 26)).toBe("Admin · 26 people");
    expect(workspaceMeta("Admin", 1)).toBe("Admin · 1 person");
    expect(workspaceMeta("Member", undefined)).toBe("Member");
    expect(workspaceMeta("Admin", 0)).toBe("Admin");
  });

  it("switches to another workspace", async () => {
    const { setCompany } = renderCard();
    await userEvent.click(screen.getByRole("button", { name: "Switch to Acme Health Foundation" }));
    expect(setCompany).toHaveBeenCalledWith("c2");
  });

  it("opens the Create company flow from Add workspace", async () => {
    renderCard();
    await userEvent.click(screen.getByRole("button", { name: "Add workspace" }));
    expect(window.location.pathname).toBe("/onboarding");
  });

  it("makes two-letter initials", () => {
    expect(workspaceInitials("Acme Health Foundation")).toBe("AH");
    expect(workspaceInitials("Acme")).toBe("AC");
  });
});
