import React, { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InlineEdit } from "./InlineEdit";

function Harness({ onSave }: { onSave(next: string): void }) {
  const [value, setValue] = useState("Logo dark");
  const [editing, setEditing] = useState(false);
  return (
    <InlineEdit
      value={value}
      label={value}
      editing={editing}
      onEditingChange={setEditing}
      onSave={(next) => {
        setValue(next);
        onSave(next);
      }}
    />
  );
}

describe("InlineEdit", () => {
  it("opens on the name, saves on Enter and hands focus back", async () => {
    const onSave = vi.fn();
    render(<Harness onSave={onSave} />);
    await userEvent.click(screen.getByRole("button", { name: "Rename Logo dark" }));
    const input = screen.getByRole("textbox", { name: "Rename Logo dark" });
    expect(document.activeElement).toBe(input);
    await userEvent.clear(input);
    await userEvent.type(input, "Logo light{Enter}");
    expect(onSave).toHaveBeenCalledWith("Logo light");
    expect(screen.getByRole("status").textContent).toBe("Renamed to Logo light");
    await new Promise((r) => requestAnimationFrame(r));
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Rename Logo light" }));
  });

  it("drops the change on Escape and on Cancel", async () => {
    const onSave = vi.fn();
    render(<Harness onSave={onSave} />);
    await userEvent.click(screen.getByRole("button", { name: "Rename Logo dark" }));
    await userEvent.type(screen.getByRole("textbox"), "x{Escape}");
    await userEvent.click(screen.getByRole("button", { name: "Rename Logo dark" }));
    await userEvent.type(screen.getByRole("textbox"), "y");
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Rename Logo dark" })).toBeTruthy();
  });

  it("keeps an unchanged or empty name without saving", async () => {
    const onSave = vi.fn();
    render(<Harness onSave={onSave} />);
    await userEvent.click(screen.getByRole("button", { name: "Rename Logo dark" }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await userEvent.click(screen.getByRole("button", { name: "Rename Logo dark" }));
    await userEvent.clear(screen.getByRole("textbox"));
    await userEvent.keyboard("{Enter}");
    expect(onSave).not.toHaveBeenCalled();
  });
});
