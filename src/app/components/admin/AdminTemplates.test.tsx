import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext, type AuthState } from "@/lib/auth/AuthContext";
import { SIZE_CATALOG } from "@/lib/templates/platforms";
import type { Company } from "@/lib/types";
import { clearStart, peekStart, requestNewTemplate } from "../builder/startHandoff";
import { AdminTemplates } from "./AdminTemplates";

const stores = vi.hoisted(() => ({
  templates: { listAll: vi.fn() },
  usage: { getUsageSummary: vi.fn() },
  companies: { listCanvasSizes: vi.fn() },
  designImport: {
    isConfigured: vi.fn(() => true),
    canvaStatus: vi.fn(),
    isConnected: vi.fn(),
  },
}));
vi.mock("@/lib/stores", () => ({ stores }));
vi.mock("@/lib/brand/BrandContext", () => ({ useBrand: () => ({ kit: null, assets: [] }) }));
const navigate = vi.hoisted(() => vi.fn());
vi.mock("../../router", () => ({
  useRouter: () => ({ route: { name: "adminTemplates" }, navigate }),
  routeToUrl: () => "/template-builder",
}));

/** The window's width for the builder's 1024 minimum. */
let wide = true;

beforeEach(() => {
  vi.clearAllMocks();
  wide = true;
  stores.templates.listAll.mockResolvedValue([]);
  stores.usage.getUsageSummary.mockResolvedValue(null);
  stores.companies.listCanvasSizes.mockResolvedValue(SIZE_CATALOG);
  stores.designImport.canvaStatus.mockResolvedValue({ enabled: true, connected: true });
  stores.designImport.isConnected.mockResolvedValue(true);
  window.matchMedia = ((query: string) => ({
    matches: wide,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
});
afterEach(() => clearStart());

function renderList() {
  render(
    <AuthContext.Provider
      value={{ company: { id: "c1", name: "Acme" } as Company } as unknown as AuthState}
    >
      <AdminTemplates />
    </AuthContext.Provider>,
  );
}

describe("Starting a template on the list (329:2660)", () => {
  it("hands a blank start's size to the builder and opens it", async () => {
    renderList();
    await userEvent.click(await screen.findByRole("button", { name: "New template" }));
    await userEvent.click(await screen.findByRole("button", { name: /^Start blank/ }));
    expect(await screen.findByRole("dialog", { name: "Choose a size" })).toBeTruthy();
    await userEvent.click(await screen.findByRole("button", { name: /^Portrait post for/ }));
    expect(peekStart()).toEqual({ kind: "blank", size: { width: 1080, height: 1350 } });
    expect(navigate).toHaveBeenCalledWith({ name: "builder", templateId: null });
  });

  it("hands focus back to New template when Choose a size closes", async () => {
    renderList();
    const newTemplate = await screen.findByRole("button", { name: "New template" });
    await userEvent.click(newTemplate);
    await userEvent.click(await screen.findByRole("button", { name: /^Start blank/ }));
    await screen.findByRole("dialog", { name: "Choose a size" });
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(document.activeElement).toBe(newTemplate));
    expect(navigate).not.toHaveBeenCalled();
  });

  it("opens New template when the builder sends it back", async () => {
    requestNewTemplate();
    renderList();
    expect(await screen.findByRole("dialog", { name: "New template" })).toBeTruthy();
  });

  it("goes straight to the builder below its minimum width", async () => {
    wide = false;
    renderList();
    await userEvent.click(await screen.findByRole("button", { name: "New template" }));
    expect(navigate).toHaveBeenCalledWith({ name: "builder", templateId: null });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
