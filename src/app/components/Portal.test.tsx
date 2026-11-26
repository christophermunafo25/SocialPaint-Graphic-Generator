import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthContext, type AuthState } from "@/lib/auth/AuthContext";
import type { Company, Role, TemplateSchema } from "@/lib/types";

const stores = vi.hoisted(() => ({ templates: { listPublished: vi.fn() } }));
vi.mock("@/lib/stores", () => ({ stores }));
const navigate = vi.hoisted(() => vi.fn());
vi.mock("../router", () => ({
  useRouter: () => ({ route: { name: "portal" }, navigate }),
  routeToUrl: () => "/templates",
}));
vi.mock("./TemplateThumbnail", () => ({
  TemplateThumbnail: () => <span data-testid="thumb" />,
}));

const { Portal } = await import("./Portal");

const T0 = "2026-11-25T10:00:00.000Z";
const TEMPLATE: TemplateSchema = {
  id: "tpl-1",
  companyId: "c1",
  name: "Stat highlight",
  description: "",
  category: "",
  tags: [],
  status: "published",
  canvasWidth: 1080,
  canvasHeight: 1080,
  backgroundUrl: "",
  fields: [],
  captionTemplate: "",
  createdAt: T0,
  updatedAt: T0,
};

beforeEach(() => {
  vi.clearAllMocks();
});

function renderLibrary(role: Role) {
  render(
    <AuthContext.Provider
      value={{ company: { id: "c1", name: "Acme" } as Company, role } as unknown as AuthState}
    >
      <Portal />
    </AuthContext.Provider>,
  );
}

describe("Portal, the empty library", () => {
  it("gives an admin a way into Template Builder, and no search", async () => {
    stores.templates.listPublished.mockResolvedValue([]);
    renderLibrary("admin");
    expect(await screen.findByText("Publish your first template")).toBeTruthy();
    expect(
      screen.getByText("Published templates appear here for everyone on your team."),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Search templates" })).toBeNull();
    const open = screen.getByRole("button", { name: "Open Template Builder" });
    expect(open.getAttribute("data-kind")).toBe("primary");
    await userEvent.click(open);
    expect(navigate).toHaveBeenCalledWith({ name: "adminTemplates" });
  });

  it("tells a member the team hasn't published yet, with no button and no search", async () => {
    stores.templates.listPublished.mockResolvedValue([]);
    renderLibrary("member");
    expect(await screen.findByText("No templates yet")).toBeTruthy();
    expect(screen.getByText("Templates show up here once your team publishes them.")).toBeTruthy();
    expect(screen.queryByText("Publish your first template")).toBeNull();
    expect(screen.queryByRole("button", { name: "Open Template Builder" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Search templates" })).toBeNull();
  });

  it("shows the search again once there is a template", async () => {
    stores.templates.listPublished.mockResolvedValue([TEMPLATE]);
    renderLibrary("member");
    expect(await screen.findByRole("button", { name: "Search templates" })).toBeTruthy();
    expect(screen.queryByText("No templates yet")).toBeNull();
  });
});
