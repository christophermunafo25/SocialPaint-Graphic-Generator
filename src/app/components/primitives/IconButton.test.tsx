import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Settings, X } from "lucide-react";
import React, { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { IconButton, RowMenuTrigger, Stepper, StepperButton, ThemeToggle } from "./IconButton";

describe("IconButton", () => {
  it("exposes its label as the accessible name", async () => {
    const onClick = vi.fn();
    render(<IconButton icon={X} label="Close" onClick={onClick} />);
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("marks a selected ghost button and passes aria-pressed through", () => {
    render(<IconButton variant="ghost" icon={Settings} label="Settings" selected aria-pressed />);
    const button = screen.getByRole("button", { name: "Settings" });
    expect(button.dataset.selected).toBe("true");
    expect(button.getAttribute("aria-pressed")).toBe("true");
  });

  it("names the row menu trigger and theme toggle", () => {
    render(
      <>
        <RowMenuTrigger label="More actions" aria-haspopup="menu" aria-expanded />
        <ThemeToggle label="Switch to dark mode" />
      </>,
    );
    expect(screen.getByRole("button", { name: "More actions" }).getAttribute("aria-expanded")).toBe(
      "true",
    );
    expect(screen.getByRole("button", { name: "Switch to dark mode" })).toBeTruthy();
  });
});

describe("StepperButton", () => {
  it("stays focusable while disabled and ignores clicks", async () => {
    const onClick = vi.fn();
    render(<StepperButton icon={X} label="Decrease" disabled onClick={onClick} />);
    const button = screen.getByRole("button", { name: "Decrease" });
    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect(button.hasAttribute("disabled")).toBe(false);
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe("Stepper", () => {
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
});
