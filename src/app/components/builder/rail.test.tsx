import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import type { BrandAsset, TemplateField } from "@/lib/types";
import { ElementPalette } from "./ElementPalette";
import { FieldListPanel } from "./FieldListPanel";
import { LayersPanel } from "./LayersPanel";

const field = (over: Partial<TemplateField> & Pick<TemplateField, "id" | "label">) =>
  ({
    type: "text",
    fieldKey: over.id,
    x: 0,
    y: 0,
    width: 400,
    height: 80,
    ...over,
  }) as TemplateField;

const logo = (id: string, name: string) =>
  ({ id, name, kind: "logo", url: `https://cdn.test/${id}.png` }) as BrandAsset;

describe("ElementPalette", () => {
  const props = () => ({ onAdd: vi.fn(), onAddIcon: vi.fn(), onOpenLogos: vi.fn() });

  it("lays the tiles out as drawn, the frame's nine first", () => {
    render(<ElementPalette {...props()} />);
    const add = screen.getByRole("region", { name: "Add" });
    const names = within(add)
      .getAllByRole("button")
      .map((b) => b.textContent);
    expect(names).toEqual([
      "Text",
      "Paragraph",
      "Dropdown",
      "Image",
      "Logo",
      "Pill",
      "Rectangle",
      "Ellipse",
      "Line",
      "Triangle",
      "Star",
      "Icon",
    ]);
  });

  it("adds an element at the centre on a click", async () => {
    const p = props();
    render(<ElementPalette {...p} />);
    await userEvent.click(screen.getByRole("button", { name: "Paragraph" }));
    expect(p.onAdd).toHaveBeenCalledWith("multiline");
  });

  it("adds the brand's one logo straight from its tile", async () => {
    const p = props();
    render(<ElementPalette {...p} logos={[logo("a1", "Wordmark.svg")]} />);
    await userEvent.click(screen.getByRole("button", { name: "Logo" }));
    expect(p.onAdd).toHaveBeenCalledWith("logo:a1");
  });

  it("offers Brand Studio when the brand has no logos", async () => {
    const p = props();
    render(<ElementPalette {...p} />);
    await userEvent.click(screen.getByRole("button", { name: "Logo" }));
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Add a logo in Brand Studio" }),
    );
    expect(p.onOpenLogos).toHaveBeenCalled();
    expect(p.onAdd).not.toHaveBeenCalled();
  });

  it("shows Import only when the workspace can import", async () => {
    const { rerender } = render(<ElementPalette {...props()} />);
    expect(screen.queryByRole("region", { name: "Import" })).toBeNull();
    const onImportFigma = vi.fn();
    rerender(<ElementPalette {...props()} onImportFigma={onImportFigma} onAutoBuild={vi.fn()} />);
    const imports = screen.getByRole("region", { name: "Import" });
    await userEvent.click(within(imports).getByRole("button", { name: "Import from Figma" }));
    expect(onImportFigma).toHaveBeenCalled();
    expect(within(imports).getByRole("button", { name: "Auto build" })).toBeTruthy();
  });
});

describe("LayersPanel", () => {
  const fields = [
    field({ id: "bg", label: "Background", type: "shape", static: true, zIndex: 0 }),
    field({ id: "role", label: "Role", zIndex: 1 }),
  ];
  const props = () => ({
    fields,
    groups: [],
    selectedIds: [] as string[],
    onSelect: vi.fn(),
    onPaintOrder: vi.fn(),
    onRename: vi.fn(),
    lockedIds: new Set<string>(),
    hiddenIds: new Set<string>(),
    onToggleLocked: vi.fn(),
    onToggleHidden: vi.fn(),
    onContextMenu: vi.fn(),
  });

  it("lists frontmost first and names a fixed element as fixed", () => {
    render(<LayersPanel {...props()} />);
    const rows = screen.getAllByRole("listitem");
    expect(within(rows[0]).getAllByRole("button")[0].textContent).toBe("Role");
    expect(within(rows[1]).getByRole("button", { name: "Background, fixed" })).toBeTruthy();
  });

  it("renders nothing on an empty canvas", () => {
    const { container } = render(<LayersPanel {...props()} fields={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("selects a row, and adds to the selection with Shift", async () => {
    const p = props();
    render(<LayersPanel {...p} selectedIds={["role"]} />);
    await userEvent.click(screen.getByRole("button", { name: "Background, fixed" }));
    expect(p.onSelect).toHaveBeenLastCalledWith(["bg"]);
    const user = userEvent.setup();
    await user.keyboard("{Shift>}");
    await user.click(screen.getByRole("button", { name: "Background, fixed" }));
    expect(p.onSelect).toHaveBeenLastCalledWith(["role", "bg"]);
  });

  it("toggles Hide and Pin as pressed buttons", async () => {
    const p = props();
    render(<LayersPanel {...p} hiddenIds={new Set(["role"])} />);
    const hide = screen.getByRole("button", { name: "Hide Role" });
    expect(hide.getAttribute("aria-pressed")).toBe("true");
    await userEvent.click(screen.getByRole("button", { name: "Pin Role" }));
    expect(p.onToggleLocked).toHaveBeenCalledWith("role");
    expect(p.onSelect).not.toHaveBeenCalled();
  });

  it("hands focus back to the row when a rename ends on Escape", async () => {
    const p = props();
    render(<LayersPanel {...p} />);
    screen.getByRole("button", { name: "Role" }).focus();
    await userEvent.keyboard("{F2}");
    await userEvent.keyboard("{Escape}");
    expect(p.onRename).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Role" }));
  });

  it("renames with F2 and Enter", async () => {
    const p = props();
    render(<LayersPanel {...p} />);
    screen.getByRole("button", { name: "Role" }).focus();
    await userEvent.keyboard("{F2}");
    const input = screen.getByRole("textbox", { name: "Name" });
    await userEvent.clear(input);
    await userEvent.type(input, "Job title{Enter}");
    expect(p.onRename).toHaveBeenCalledWith("role", "Job title");
  });
});

describe("FieldListPanel", () => {
  const props = () => ({
    groups: [],
    selectedIds: [] as string[],
    onSelect: vi.fn(),
    onReorder: vi.fn(),
    onReorderChildren: vi.fn(),
    onContextMenu: vi.fn(),
  });

  it("numbers what your team fills in and marks what may stay empty", () => {
    render(
      <FieldListPanel
        {...props()}
        fields={[
          field({ id: "bg", label: "Background", type: "shape", static: true }),
          field({ id: "role", label: "Role" }),
          field({ id: "link", label: "Apply link", optional: true }),
        ]}
      />,
    );
    const rows = screen.getAllByRole("listitem").map((r) => r.textContent);
    expect(rows).toEqual(["01Role", "02Apply linkOptional"]);
  });

  it("says when there is nothing to fill in", () => {
    render(
      <FieldListPanel
        {...props()}
        fields={[field({ id: "bg", label: "Background", type: "shape", static: true })]}
      />,
    );
    expect(screen.getByText("Your team has nothing to fill in yet.")).toBeTruthy();
  });
});
