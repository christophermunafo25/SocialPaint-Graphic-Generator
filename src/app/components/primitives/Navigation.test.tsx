import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Building, Ellipsis, Image, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { IconButton } from "./IconButton";
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

describe("NavItem's icon", () => {
  it("is 18 at the navigation stroke, hidden from assistive tech", () => {
    const { container } = render(<NavItem icon={Sparkles}>Generate</NavItem>);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("width")).toBe("18");
    expect(svg?.getAttribute("stroke-width")).toBe("1.5");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
  });

  it("SettingsRailItem with an address is a real link", () => {
    render(
      <SettingsRailItem icon={Building} href="/settings/workspace" selected>
        Workspace
      </SettingsRailItem>,
    );
    const link = screen.getByRole("link", { name: "Workspace" });
    expect(link.getAttribute("href")).toBe("/settings/workspace");
    expect(link.getAttribute("aria-current")).toBe("page");
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
      <Menu trigger={<IconButton variant="ghost" size="sm" icon={Ellipsis} label="More actions" />}>
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
      <Menu trigger={<IconButton icon={Plus} label="Attach" />}>
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

  it("Tooltip's value is optional", () => {
    render(<Tooltip label="Attach" />);
    expect(screen.getByRole("tooltip").textContent).toBe("Attach");
  });

  it("Toast is a status with an optional action", async () => {
    const onAction = vi.fn();
    render(<Toast message="Added “Custom 1”" actionLabel="Undo" onAction={onAction} />);
    expect(screen.getByRole("status").textContent).toContain("Added");
    const undo = screen.getByRole("button", { name: "Undo" });
    // The action is a ghost Small button.
    expect(undo.dataset.kind).toBe("ghost");
    expect(undo.dataset.size).toBe("sm");
    await userEvent.click(undo);
    expect(onAction).toHaveBeenCalled();
  });

  it("Toast without an action is the message alone", () => {
    render(<Toast message="Link copied" />);
    expect(screen.getByRole("status").textContent).toBe("Link copied");
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("Tooltip as a control's hint", () => {
  afterEach(() => vi.useRealTimers());

  const hint = (suppressed = false) => (
    <Tooltip label="Attach" suppressed={suppressed}>
      <button type="button">+</button>
    </Tooltip>
  );
  const rest = () =>
    act(() => {
      vi.advanceTimersByTime(300);
    });

  it("is shut until the keyboard rests on the control, then closes on blur", () => {
    vi.useFakeTimers();
    render(hint());
    const button = screen.getByRole("button", { name: "+" });
    expect(screen.queryByRole("tooltip")).toBeNull();
    fireEvent.keyDown(window, { key: "Tab" });
    fireEvent.focus(button);
    // Not before the delay.
    expect(screen.queryByRole("tooltip")).toBeNull();
    rest();
    expect(screen.getByRole("tooltip").textContent).toBe("Attach");
    fireEvent.blur(button);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("does not open on focus that did not come from Tab", () => {
    vi.useFakeTimers();
    render(hint());
    const button = screen.getByRole("button", { name: "+" });
    fireEvent.pointerDown(window);
    fireEvent.focus(button);
    rest();
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("stays shut while suppressed", () => {
    vi.useFakeTimers();
    render(hint(true));
    const button = screen.getByRole("button", { name: "+" });
    fireEvent.keyDown(window, { key: "Tab" });
    fireEvent.focus(button);
    rest();
    expect(screen.queryByRole("tooltip")).toBeNull();
  });
});
