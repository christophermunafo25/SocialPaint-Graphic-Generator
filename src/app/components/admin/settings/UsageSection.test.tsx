import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { AuthContext, type AuthState } from "@/lib/auth/AuthContext";
import type { Company } from "@/lib/types";
import { UsageSection, adminCount } from "./UsageSection";

const stores = vi.hoisted(() => ({
  usage: {
    getMonthlyUsage: vi.fn(async () => ({
      opens: 2318,
      downloads: 1046,
      bulkExports: 4,
      publicOpens: 286,
      templatesUsed: 12,
      membersActive: 21,
    })),
    getAiUsage: vi.fn(async () => ({
      requests: 412,
      inputTokens: 1_210_000,
      outputTokens: 318_400,
    })),
  },
  people: {
    list: vi.fn(async () => [
      { userId: "a", email: "a@x.com", role: "admin" },
      { userId: "b", email: "b@x.com", role: "admin" },
      { userId: "c", email: "c@x.com", role: "member" },
    ]),
  },
}));
vi.mock("@/lib/stores", () => ({ stores }));

describe("UsageSection (PHASE-7 §9 D1, D12)", () => {
  it("shows Early access, the month's figures and AI usage", async () => {
    const auth = {
      company: { id: "c1", name: "Acme", timezone: "UTC" } as Company,
      role: "admin",
    } as unknown as AuthState;
    render(
      <AuthContext.Provider value={auth}>
        <UsageSection />
      </AuthContext.Provider>,
    );
    expect(screen.getByRole("heading", { name: "Early access" })).toBeTruthy();
    expect(await screen.findByText("1,046")).toBeTruthy();
    expect(screen.getByText("286 via public links")).toBeTruthy();
    expect(await screen.findByText("1.2M")).toBeTruthy();
    expect(screen.getByText("318.4K")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy(); // admins
    expect(screen.queryByRole("button")).toBeNull(); // no plan buttons until 7b
  });

  it("never counts fewer than one admin", () => {
    expect(adminCount([])).toBe(1);
  });
});
