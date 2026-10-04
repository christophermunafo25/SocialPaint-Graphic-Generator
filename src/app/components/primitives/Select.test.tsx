import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React, { useState } from "react";
import { describe, expect, it } from "vitest";
import { CompactSelect, Select, type SelectOption } from "./Select";

const OPTIONS: Array<SelectOption<string>> = [
  { value: "moss", label: "Moss" },
  { value: "lime", label: "Lime" },
  { value: "ocean", label: "Ocean" },
];

function Controlled({ compact = false }: { compact?: boolean }) {
  const [value, setValue] = useState("moss");
  const Component = compact ? CompactSelect : Select;
  return (
    <Component ariaLabel="Look" value={value} options={OPTIONS} onSelect={(v) => setValue(v)} />
  );
}

describe("Select", () => {
  it("opens with the keyboard, moves with the arrows and commits with Enter", async () => {
    render(<Controlled />);
    const trigger = screen.getByRole("combobox", { name: "Look" });
    trigger.focus();
    await userEvent.keyboard("{ArrowDown}");
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    const listbox = screen.getByRole("listbox", { name: "Look" });
    expect(document.activeElement).toBe(listbox);
    expect(screen.getByRole("option", { name: "Moss" }).getAttribute("aria-selected")).toBe("true");
    await userEvent.keyboard("{ArrowDown}{Enter}");
    expect(trigger.textContent).toContain("Lime");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(trigger);
  });

  it("wraps at the ends and closes on Escape without changing the value", async () => {
    render(<Controlled compact />);
    const trigger = screen.getByRole("combobox", { name: "Look" });
    await userEvent.click(trigger);
    await userEvent.keyboard("{ArrowUp}");
    const listbox = screen.getByRole("listbox");
    expect(listbox.getAttribute("aria-activedescendant")).toMatch(/opt-2$/);
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(trigger.textContent).toContain("Moss");
    expect(document.activeElement).toBe(trigger);
  });
});
