import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { BrandDraft } from "./kitPlumbing";
import { ImportDetail } from "./ImportDetail";

const designImport = vi.hoisted(() => ({
  isConfigured: () => true,
  isConnected: vi.fn(async () => true),
  importStylesFromUrl: vi.fn(),
}));
vi.mock("@/lib/stores", () => ({ stores: { designImport } }));
vi.mock("../../../router", () => ({
  routeToUrl: (r: { name: string; section?: string }) => `/${r.name}/${r.section ?? ""}`,
  useRouter: () => ({ navigate: () => {} }),
}));

const brand = {
  company: { id: "co-1" },
  draft: { colors: [], typeStyles: [] },
  commit: () => {},
  undo: () => {},
} as unknown as BrandDraft;

describe("ImportDetail Figma card (PHASE-6 §9 D11)", () => {
  it("connected: Import waits for a figma.com/design link", async () => {
    designImport.isConnected.mockResolvedValueOnce(true);
    render(<ImportDetail brand={brand} />);
    const field = await screen.findByRole("textbox", { name: "Figma file link" });
    const button = screen.getByRole("button", { name: "Import" });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(field, { target: { value: "figma.com/design/abc/Kit" } });
    expect((button as HTMLButtonElement).disabled).toBe(false);
  });

  it("not connected: points to Settings › Integrations instead", async () => {
    designImport.isConnected.mockResolvedValueOnce(false);
    render(<ImportDetail brand={brand} />);
    const link = await screen.findByRole("link", { name: "Connect Figma in Settings" });
    expect(link.getAttribute("href")).toBe("/settings/integrations");
    expect(screen.queryByRole("textbox", { name: "Figma file link" })).toBeNull();
    expect(screen.getByText("Choose tokens.json")).toBeTruthy();
  });
});
