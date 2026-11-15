import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React, { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Checkbox, Radio, SegmentedControl, Switch, Tabs, type TabItem } from "./Toggles";

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

describe("Checkbox", () => {
  function Controlled({ disabled = false }: { disabled?: boolean }) {
    const [on, setOn] = useState<boolean | "mixed">(false);
    return <Checkbox checked={on} onChange={setOn} label="Include drafts" disabled={disabled} />;
  }

  it("is a checkbox named by its label that Space and a label click toggle", async () => {
    render(<Controlled />);
    const box = screen.getByRole("checkbox", { name: "Include drafts" }) as HTMLInputElement;
    box.focus();
    await userEvent.keyboard(" ");
    expect(box.checked).toBe(true);
    await userEvent.click(screen.getByText("Include drafts"));
    expect(box.checked).toBe(false);
  });

  it("shows Mixed as the native indeterminate state, and turns on from it", async () => {
    const onChange = vi.fn();
    render(<Checkbox checked="mixed" onChange={onChange} ariaLabel="All rows" />);
    const box = screen.getByRole("checkbox", { name: "All rows" }) as HTMLInputElement;
    expect(box.indeterminate).toBe(true);
    expect(box.checked).toBe(false);
    await userEvent.click(box);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("ignores input while disabled", async () => {
    render(<Controlled disabled />);
    const box = screen.getByRole("checkbox", { name: "Include drafts" }) as HTMLInputElement;
    await userEvent.click(box);
    expect(box.checked).toBe(false);
  });
});

describe("Radio", () => {
  function Group() {
    const [value, setValue] = useState("all");
    return (
      <div role="radiogroup" aria-label="Rows">
        {["all", "problems"].map((v) => (
          <Radio
            key={v}
            name="rows"
            value={v}
            checked={value === v}
            onChange={() => setValue(v)}
            label={v === "all" ? "All rows" : "Rows with problems"}
          />
        ))}
      </div>
    );
  }

  it("is a native radio group: one choice, moved by a click or the arrows", async () => {
    render(<Group />);
    const all = screen.getByRole("radio", { name: "All rows" }) as HTMLInputElement;
    const problems = screen.getByRole("radio", { name: "Rows with problems" }) as HTMLInputElement;
    expect(all.checked).toBe(true);
    await userEvent.click(problems);
    expect(problems.checked).toBe(true);
    expect(all.checked).toBe(false);
    problems.focus();
    await userEvent.keyboard("{ArrowUp}");
    expect(all.checked).toBe(true);
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

  it("draws a segment's dot, hidden from assistive tech", () => {
    render(
      <SegmentedControl
        aria-label="Metric"
        options={[
          { id: "exports", label: "Exports", dot: "green" },
          { id: "opens", label: "Opens" },
        ]}
        selectedId="exports"
        onSelect={() => {}}
      />,
    );
    const exports = screen.getByRole("radio", { name: "Exports" });
    const dot = exports.querySelector(".ui-segment__dot") as HTMLElement;
    expect(dot.dataset.dot).toBe("green");
    expect(dot.getAttribute("aria-hidden")).toBe("true");
    expect(
      screen.getByRole("radio", { name: "Opens" }).querySelector(".ui-segment__dot"),
    ).toBeNull();
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
          { id: "exports", label: "Exports" },
          { id: "opens", label: "Opens" },
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
