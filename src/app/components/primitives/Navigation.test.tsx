import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Building, Image, Pencil, Sparkles, Trash2 } from "lucide-react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { RowMenuTrigger } from "./IconButton";
import { Menu, MenuDivider, MenuItem, MenuLabel } from "./Menu";
import { Avatar, NavItem, SettingsRailItem } from "./Navigation";
import { Toast, Tooltip } from "./Overlays";

describe("NavItem and SettingsRailItem", () => {
  it("mark the page showing with aria-current", () => {
    render(
      <>
        <NavItem icon={Sparkles} selected>
          Generate
        </NavItem>
        <SettingsRailItem icon={Building}>Workspace</SettingsRailItem>
      </>,
    );
    expect(screen.getByRole("button", { name: "Generate" }).getAttribute("aria-current")).toBe(
      "page",
    );
    expect(screen.getByRole("button", { name: "Workspace" }).hasAttribute("aria-current")).toBe(
      false,
    );
  });
});

describe("NavItem without its label", () => {
  it("is named by its label and shows the icon alone", () => {
    render(
      <NavItem icon={Sparkles} showLabel={false}>
        Generate
      </NavItem>,
    );
    const item = screen.getByRole("button", { name: "Generate" });
    expect(item.textContent).toBe("");
    expect(item.dataset.iconOnly).toBe("true");
  });
});

describe("Avatar", () => {
  it("is decorative unless it carries a label", () => {
    const { container } = render(<Avatar initials="AS" />);
    expect(container.firstElementChild?.getAttribute("aria-hidden")).toBe("true");
    render(<Avatar initials="AS" label="Acme Studios" />);
    expect(screen.getByRole("img", { name: "Acme Studios" })).toBeTruthy();
  });
});

describe("Menu", () => {
  it("opens on Enter, moves with the arrows and selects", async () => {
    const onRename = vi.fn();
    const onDelete = vi.fn();
    render(
      <Menu trigger={<RowMenuTrigger label="More actions" />}>
        <MenuLabel>Template</MenuLabel>
        <MenuItem icon={Pencil} onSelect={onRename}>
          Rename
        </MenuItem>
        <MenuDivider />
        <MenuItem icon={Trash2} onSelect={onDelete}>
          Delete
        </MenuItem>
      </Menu>,
    );
    const trigger = screen.getByRole("button", { name: "More actions" });
    trigger.focus();
    await userEvent.keyboard("{Enter}");
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    const items = screen.getAllByRole("menuitem");
    expect(items.map((i) => i.textContent)).toEqual(["Rename", "Delete"]);
    await userEvent.keyboard("{ArrowDown}");
    expect(document.activeElement?.textContent).toBe("Delete");
    await userEvent.keyboard("{Enter}");
    expect(onDelete).toHaveBeenCalled();
    expect(onRename).not.toHaveBeenCalled();
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("marks the selected item", async () => {
    render(
      <Menu trigger={<RowMenuTrigger label="Attach" />}>
        <MenuItem icon={Image} selected>
          Photo
        </MenuItem>
      </Menu>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Attach" }));
    expect(screen.getByRole("menuitem", { name: "Photo" }).dataset.selected).toBe("true");
  });
});

describe("Tooltip and Toast", () => {
  it("Tooltip reads its label and value", () => {
    render(<Tooltip label="Tue, Sep 8" value="56 exports" />);
    expect(screen.getByRole("tooltip").textContent).toBe("Tue, Sep 856 exports");
  });

  it("Toast is a status with an optional action", async () => {
    const onAction = vi.fn();
    render(<Toast message="Added “Custom 1”" actionLabel="Undo" onAction={onAction} />);
    expect(screen.getByRole("status").textContent).toContain("Added");
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(onAction).toHaveBeenCalled();
  });
});
