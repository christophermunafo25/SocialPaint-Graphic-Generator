import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { NewTemplateDialog } from "./NewTemplateDialog";

function renderDialog(props: { importReady: boolean; canvaEnabled: boolean }) {
  const onChoose = vi.fn();
  render(<NewTemplateDialog open onOpenChange={() => {}} onChoose={onChoose} {...props} />);
  return onChoose;
}

const pathNames = () =>
  screen
    .getAllByRole("button")
    .map((b) => b.querySelector(".t-label-m")?.textContent)
    .filter(Boolean);

describe("New template (329:2660)", () => {
  it("offers the four ways to start, and says which one was chosen", async () => {
    const onChoose = renderDialog({ importReady: true, canvaEnabled: true });
    expect(screen.getByRole("dialog", { name: "New template" })).toBeTruthy();
    expect(pathNames()).toEqual([
      "Start blank",
      "Import from Figma",
      "Auto build",
      "Import from Canva",
    ]);
    await userEvent.click(screen.getByRole("button", { name: /^Auto build/ }));
    expect(onChoose).toHaveBeenCalledWith("build");
    await userEvent.click(screen.getByRole("button", { name: /^Start blank/ }));
    expect(onChoose).toHaveBeenLastCalledWith("blank");
  });

  it("leaves out Import from Canva when the plan has no Canva", () => {
    renderDialog({ importReady: true, canvaEnabled: false });
    expect(pathNames()).toEqual(["Start blank", "Import from Figma", "Auto build"]);
  });

  it("offers Start blank alone without the import backend, rather than inert tiles", () => {
    renderDialog({ importReady: false, canvaEnabled: true });
    expect(pathNames()).toEqual(["Start blank"]);
    expect(screen.queryByRole("button", { name: /^Import from Figma/ })).toBeNull();
  });
});
