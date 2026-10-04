import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { AuthContext, type AuthState } from "@/lib/auth/AuthContext";
import type { Company } from "@/lib/types";
import { RouterProvider } from "../../../router";
import { WorkspacesCard, workspaceInitials } from "./WorkspacesCard";

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
  it("marks the current workspace and shows each role, with no count", () => {
    renderCard();
    expect(screen.getByText("Current")).toBeTruthy();
    expect(screen.getByText("Admin")).toBeTruthy();
    expect(screen.getByText("Member")).toBeTruthy();
    expect(screen.queryByText(/people/)).toBeNull();
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
