import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import type { TemplateField } from "@/lib/types";
import { FillPicker } from "./FillPicker";

vi.mock("../../router", () => ({
  useRouter: () => ({ route: { name: "builder" }, navigate: vi.fn() }),
}));

const field = {
  id: "canvas-background",
  label: "Background",
  type: "shape",
  fieldKey: "canvas_background",
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  colorHex: "#ffffff",
} as TemplateField;

function Picker({ onClose }: { onClose(): void }) {
  const anchor = React.useRef<HTMLButtonElement>(null);
  return (
    <>
      <button ref={anchor}>Background color</button>
      <FillPicker
        anchorRef={anchor}
        field={field}
        kit={null}
        companyId={undefined}
        locked={false}
        solidOnly
        onChange={() => {}}
        onClose={onClose}
      />
    </>
  );
}

describe("FillPicker", () => {
  it("Escape in the open format menu closes the menu, not the picker", async () => {
    const onClose = vi.fn();
    render(<Picker onClose={onClose} />);
    const format = screen.getByRole("combobox", { name: "Color format" });
    await userEvent.click(format);
    expect(screen.getByRole("listbox")).toBeTruthy();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(format);
    expect(screen.getByRole("dialog", { name: "Fill picker" })).toBeTruthy();
  });

  it("Escape anywhere else closes the picker", async () => {
    const onClose = vi.fn();
    render(<Picker onClose={onClose} />);
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
