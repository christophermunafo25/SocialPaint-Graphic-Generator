import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Ellipsis, Moon, Plus, Settings, Sun, X } from "lucide-react";
import React, { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IconButton, Stepper } from "./IconButton";

describe("IconButton", () => {
  it("exposes its label as the accessible name", async () => {
    const onClick = vi.fn();
    render(<IconButton icon={X} label="Close" onClick={onClick} />);
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("is Filled at Medium unless told otherwise, with a 16 glyph", () => {
    const { container } = render(<IconButton icon={X} label="Close" />);
    const button = screen.getByRole("button", { name: "Close" });
    expect(button.dataset.variant).toBe("filled");
    expect(button.dataset.size).toBe("md");
    expect(container.querySelector("svg")?.getAttribute("width")).toBe("16");
  });

  it("marks a selected ghost button and passes aria-pressed through", () => {
    render(<IconButton variant="ghost" icon={Settings} label="Settings" selected aria-pressed />);
    const button = screen.getByRole("button", { name: "Settings" });
    expect(button.dataset.selected).toBe("true");
    expect(button.getAttribute("aria-pressed")).toBe("true");
  });

  it("is a row's menu trigger and the composer's plus through its props", () => {
    render(
      <>
        <IconButton
          variant="ghost"
          size="sm"
          icon={Ellipsis}
          label="More actions"
          aria-haspopup="menu"
          aria-expanded
        />
        <IconButton icon={Plus} label="Attach" aria-haspopup="menu" aria-expanded={false} />
      </>,
    );
    const more = screen.getByRole("button", { name: "More actions" });
    expect(more.getAttribute("aria-expanded")).toBe("true");
    expect(more.dataset.size).toBe("sm");
    expect(screen.getByRole("button", { name: "Attach" }).getAttribute("aria-expanded")).toBe(
      "false",
    );
  });

  it("draws both glyphs of a themed pair, for CSS to choose between", () => {
    const { container } = render(
      <IconButton icon={{ light: Sun, dark: Moon }} label="Switch to dark mode" />,
    );
    expect(screen.getByRole("button", { name: "Switch to dark mode" })).toBeTruthy();
    expect(container.querySelector(".ui-iconbtn__light")).toBeTruthy();
    expect(container.querySelector(".ui-iconbtn__dark")).toBeTruthy();
  });

  it("ignores clicks while disabled", async () => {
    const onClick = vi.fn();
    render(<IconButton icon={X} label="Close" disabled onClick={onClick} />);
    const button = screen.getByRole("button", { name: "Close" });
    expect(button.hasAttribute("disabled")).toBe(true);
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("stays focusable while disabled when asked to, and still ignores clicks", async () => {
    const onClick = vi.fn();
    render(
      <IconButton icon={X} label="Decrease" focusableWhenDisabled disabled onClick={onClick} />,
    );
    const button = screen.getByRole("button", { name: "Decrease" });
    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect(button.hasAttribute("disabled")).toBe(false);
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
    button.focus();
    expect(document.activeElement).toBe(button);
  });
});

describe("Stepper", () => {
  // The number rolls on Web Animations, which happy-dom never finishes;
  // under reduced motion it swaps at once, which is what this checks.
  beforeEach(() => {
    vi.stubGlobal(
      "matchMedia",
      (query: string) => ({ matches: query.includes("reduce"), media: query }) as MediaQueryList,
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  function Controlled() {
    const [value, setValue] = useState(1);
    return <Stepper label="Variations" value={value} min={1} max={3} onChange={setValue} />;
  }

  it("steps within its range and announces the value", async () => {
    render(<Controlled />);
    const group = screen.getByRole("group", { name: "Variations" });
    const decrease = screen.getByRole("button", { name: "Decrease" });
    const increase = screen.getByRole("button", { name: "Increase" });
    expect(decrease.getAttribute("aria-disabled")).toBe("true");
    await userEvent.click(increase);
    await userEvent.click(increase);
    await userEvent.click(increase);
    expect(group.textContent).toContain("3");
    expect(increase.getAttribute("aria-disabled")).toBe("true");
    expect(group.querySelector("[aria-live=polite]")?.textContent).toBe("3");
  });

  it("names the group without drawing the word", () => {
    render(<Controlled />);
    const group = screen.getByRole("group", { name: "Variations" });
    expect(group.textContent).not.toContain("Variations");
  });
});
