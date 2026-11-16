import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React, { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Type } from "lucide-react";
import { InspectorHeader } from "./InspectorHeader";

describe("InspectorHeader", () => {
  it("renames on Enter and hands focus back to the name", async () => {
    const onRename = vi.fn();
    render(<InspectorHeader icon={Type} name="Role" onRename={onRename} />);
    await userEvent.click(screen.getByRole("button", { name: "Role, rename" }));
    const input = screen.getByRole("textbox", { name: "Name" });
    await userEvent.clear(input);
    await userEvent.type(input, "Job title{Enter}");
    expect(onRename).toHaveBeenCalledWith("Job title");
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole("button", { name: "Role, rename" })),
    );
  });

  it("keeps the name on Escape", async () => {
    const onRename = vi.fn();
    render(<InspectorHeader icon={Type} name="Role" onRename={onRename} />);
    await userEvent.click(screen.getByRole("button", { name: "Role, rename" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Name" }), "zzz{Escape}");
    expect(onRename).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Role, rename" })).toBeTruthy();
  });

  it("opens the rename when the builder asks", () => {
    render(<InspectorHeader icon={Type} name="Text" onRename={vi.fn()} renameRequest="f1" />);
    expect(screen.getByRole("textbox", { name: "Name" })).toBeTruthy();
  });

  it("keeps an open rename for the element it began on when the selection moves", async () => {
    const renamed: Array<[string, string]> = [];
    function Inspector() {
      const [selected, setSelected] = useState("a");
      const names: Record<string, string> = { a: "Text", b: "Headline" };
      return (
        <>
          <button type="button" onClick={() => setSelected("b")}>
            Select b
          </button>
          <InspectorHeader
            key={selected}
            icon={Type}
            name={names[selected]}
            onRename={(next) => renamed.push([selected, next])}
            renameRequest={selected === "a" ? "a" : null}
          />
        </>
      );
    }
    render(<Inspector />);
    const input = screen.getByRole("textbox", { name: "Name" });
    await userEvent.clear(input);
    await userEvent.type(input, "Eyebrow");
    // The canvas selects on pointerdown, before the input loses focus.
    await userEvent.click(screen.getByRole("button", { name: "Select b" }));
    expect(renamed).toEqual([["a", "Eyebrow"]]);
    expect(screen.getByRole("button", { name: "Headline, rename" })).toBeTruthy();
  });
});
