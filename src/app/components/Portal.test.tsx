import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthContext, type AuthState } from "@/lib/auth/AuthContext";
import { toCatalogTemplate } from "@/lib/templates/catalog";
import { buildShelves } from "@/lib/templates/groups";
import type { Company, Role, TemplateSchema } from "@/lib/types";

const stores = vi.hoisted(() => ({ templates: { listPublished: vi.fn() } }));
vi.mock("@/lib/stores", () => ({ stores }));
const navigate = vi.hoisted(() => vi.fn());
const router = vi.hoisted(() => ({ route: { name: "portal" } as Record<string, unknown> }));
vi.mock("../router", () => ({
  useRouter: () => ({ route: router.route, navigate }),
  routeToUrl: () => "/templates",
}));
vi.mock("./TemplateThumbnail", () => ({
  TemplateThumbnail: () => <span data-testid="thumb" />,
}));
// The test DOM has no layout, so the row's width is set here: how many
// shelf cards one row fits.
const row = vi.hoisted(() => ({ perRow: 0 }));
vi.mock("./templates/useCardsPerRow", () => ({ useCardsPerRow: () => row.perRow }));

const { Portal } = await import("./Portal");

const T0 = "2026-11-25T10:00:00.000Z";
const template = (id: string, name: string, w: number, h: number): TemplateSchema => ({
  id,
  companyId: "c1",
  name,
  description: "",
  category: "",
  tags: [],
  status: "published",
  canvasWidth: w,
  canvasHeight: h,
  backgroundUrl: "",
  fields: [],
  captionTemplate: "",
  createdAt: T0,
  updatedAt: T0,
});
const TEMPLATE = template("tpl-1", "Stat highlight", 1080, 1080);
/** Three shelves: two squares, one portrait, one landscape. */
const LIBRARY = [
  TEMPLATE,
  template("tpl-2", "Feature highlight", 1080, 1080),
  template("tpl-3", "Product launch", 1080, 1350),
  template("tpl-4", "Company milestone", 1600, 900),
];

beforeEach(() => {
  vi.clearAllMocks();
  router.route = { name: "portal" };
  row.perRow = 0;
});

/** One company for the whole run: a new object would reload the library. */
const COMPANY = { id: "c1", name: "Acme" } as Company;
function library(role: Role) {
  return (
    <AuthContext.Provider value={{ company: COMPANY, role } as unknown as AuthState}>
      <Portal />
    </AuthContext.Provider>
  );
}
const renderLibrary = (role: Role) => render(library(role));

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

  it("shows the search again once a template has loaded", async () => {
    stores.templates.listPublished.mockResolvedValue([TEMPLATE]);
    renderLibrary("member");
    // The card first: the bar also shows while the list loads.
    expect(await screen.findByRole("button", { name: /^Stat highlight,/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Search templates" })).toBeTruthy();
    expect(screen.queryByText("No templates yet")).toBeNull();
  });
});

describe("Portal, shelves or one grid", () => {
  const cardNames = () =>
    Array.from(document.querySelectorAll<HTMLElement>(".sp-tcard__title")).map(
      (el) => el.textContent,
    );

  it("shows one grid in shelf order, with no shelf headers, when every shelf fits in a row", async () => {
    stores.templates.listPublished.mockResolvedValue(LIBRARY);
    row.perRow = 3;
    renderLibrary("member");
    await screen.findByRole("button", { name: /^Stat highlight,/ });
    const grid = document.querySelector(".sp-lib-onegrid");
    expect(grid).not.toBeNull();
    expect(screen.queryAllByRole("heading", { level: 2 })).toHaveLength(0);
    const shelfOrder = buildShelves(LIBRARY.map(toCatalogTemplate)).flatMap((g) =>
      g.templates.map((t) => t.name),
    );
    expect(cardNames()).toEqual(shelfOrder);
    // Every preview is the builder's square well.
    const frames = grid!.querySelectorAll(".sp-tcard__frame");
    expect(frames).toHaveLength(LIBRARY.length);
    for (const frame of frames) expect(frame.hasAttribute("data-fit")).toBe(true);
  });

  it("keeps the shelves when a shelf holds more cards than a row fits", async () => {
    stores.templates.listPublished.mockResolvedValue(LIBRARY);
    row.perRow = 1;
    renderLibrary("member");
    await screen.findByRole("button", { name: /^Stat highlight,/ });
    expect(document.querySelector(".sp-lib-onegrid")).toBeNull();
    expect(document.querySelectorAll(".sp-lib-shelf").length).toBeGreaterThan(1);
    expect(screen.getAllByRole("heading", { level: 2 }).length).toBeGreaterThan(1);
  });

  it("keeps the result groups while searching, however wide the row", async () => {
    stores.templates.listPublished.mockResolvedValue(LIBRARY);
    router.route = { name: "portal", q: "highlight" };
    row.perRow = 3;
    renderLibrary("member");
    await screen.findByRole("button", { name: /^Stat highlight,/ });
    expect(document.querySelector(".sp-lib-onegrid")).toBeNull();
    expect(document.querySelectorAll(".sp-lib-group").length).toBeGreaterThan(0);
  });

  it("keeps focus on its card when the layout flips", async () => {
    stores.templates.listPublished.mockResolvedValue(LIBRARY);
    row.perRow = 3;
    const view = renderLibrary("member");
    const card = await screen.findByRole("button", { name: /^Product launch,/ });
    act(() => card.focus());
    expect(document.activeElement).toBe(card);
    // The window narrows: a row now fits one card, so the shelves return.
    row.perRow = 1;
    view.rerender(library("member"));
    expect(document.querySelector(".sp-lib-onegrid")).toBeNull();
    const focused = document.activeElement as HTMLElement | null;
    expect(focused?.dataset.templateId).toBe("tpl-3");
    expect(focused).not.toBe(card);
  });
});
