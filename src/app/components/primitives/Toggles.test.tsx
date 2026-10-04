import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React, { useState } from "react";
import { describe, expect, it } from "vitest";
import { SegmentedControl, Switch, Tabs, type TabItem } from "./Toggles";

describe("Switch", () => {
  function Controlled({ disabled = false }: { disabled?: boolean }) {
    const [on, setOn] = useState(false);
    return <Switch checked={on} onChange={setOn} ariaLabel="Allow uploads" disabled={disabled} />;
  }

  it("toggles on Space and reflects aria-checked", async () => {
    render(<Controlled />);
    const toggle = screen.getByRole("switch", { name: "Allow uploads" });
    toggle.focus();
    await userEvent.keyboard(" ");
    expect((toggle as HTMLInputElement).checked).toBe(true);
    await userEvent.click(toggle);
    expect((toggle as HTMLInputElement).checked).toBe(false);
  });

  it("ignores input while disabled", async () => {
    render(<Controlled disabled />);
    const toggle = screen.getByRole("switch", { name: "Allow uploads" });
    await userEvent.click(toggle);
    expect((toggle as HTMLInputElement).checked).toBe(false);
  });
});

const OPTIONS = [
  { id: "instagram", label: "Instagram" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "facebook", label: "Facebook" },
];

describe("SegmentedControl", () => {
  function Controlled() {
    const [id, setId] = useState("instagram");
    return (
      <SegmentedControl aria-label="Platform" options={OPTIONS} selectedId={id} onSelect={setId} />
    );
  }

  it("is one tab stop whose arrows select, wrap and move focus", async () => {
    render(<Controlled />);
    const group = screen.getByRole("radiogroup", { name: "Platform" });
    const radios = screen.getAllByRole("radio");
    expect(radios.map((r) => r.tabIndex)).toEqual([0, -1, -1]);
    await userEvent.tab();
    expect(document.activeElement).toBe(radios[0]);
    await userEvent.keyboard("{ArrowLeft}");
    expect(radios[2].getAttribute("aria-checked")).toBe("true");
    expect(document.activeElement).toBe(radios[2]);
    await userEvent.keyboard("{Home}");
    expect(radios[0].getAttribute("aria-checked")).toBe("true");
    expect(group.querySelectorAll("[data-selected]")).toHaveLength(1);
  });
});

describe("Tabs", () => {
  function Controlled({ items }: { items: TabItem[] }) {
    const [id, setId] = useState(items[0].id);
    return <Tabs aria-label="Metric" items={items} selectedId={id} onSelect={setId} />;
  }

  it("is a radio group when it filters in place", async () => {
    render(
      <Controlled
        items={[
          { id: "exports", label: "Exports", dot: "green" },
          { id: "opens", label: "Opens", dot: "blue" },
        ]}
      />,
    );
    const radios = screen.getAllByRole("radio");
    radios[0].focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(radios[1].getAttribute("aria-checked")).toBe("true");
  });

  it("is a tablist with aria-selected when it switches panels", async () => {
    render(
      <Controlled
        items={[
          { id: "exports", label: "Exports", panelId: "p1" },
          { id: "opens", label: "Opens", panelId: "p2" },
        ]}
      />,
    );
    expect(screen.getByRole("tablist", { name: "Metric" })).toBeTruthy();
    const tabs = screen.getAllByRole("tab");
    expect(tabs[0].getAttribute("aria-controls")).toBe("p1");
    tabs[0].focus();
    await userEvent.keyboard("{End}");
    expect(tabs[1].getAttribute("aria-selected")).toBe("true");
  });
});
