import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Link } from "lucide-react";
import React, { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Modal, Progress, ProgressBar } from "./Containers";
import { LookTile, PreviewOverlay, ResultCard } from "./Previews";

describe("PreviewOverlay and ResultCard", () => {
  it("names the Edit and Download buttons and runs them", async () => {
    const onEdit = vi.fn();
    const onDownload = vi.fn();
    render(
      <ResultCard
        title="Now hiring"
        meta="1080 × 1350"
        preview={<div />}
        onEdit={onEdit}
        editLabel="Edit Now hiring"
        onDownload={onDownload}
        downloadLabel="Download Now hiring"
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Edit Now hiring" }));
    await userEvent.click(screen.getByRole("button", { name: "Download Now hiring" }));
    expect(onEdit).toHaveBeenCalled();
    expect(onDownload).toHaveBeenCalled();
  });

  it("has no Edit button without onEdit", () => {
    render(<PreviewOverlay>preview</PreviewOverlay>);
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("LookTile", () => {
  it("takes the role and state its picker gives it", () => {
    render(
      <div role="radiogroup" aria-label="Look">
        <LookTile name="Moss" thumbnail={<div />} selected role="radio" aria-checked />
      </div>,
    );
    expect(screen.getByRole("radio", { name: "Moss" }).dataset.selected).toBe("true");
  });
});

describe("Modal", () => {
  function Harness() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button type="button" onClick={() => setOpen(true)}>
          Public links
        </button>
        <Modal open={open} onOpenChange={setOpen} title="Public links" icon={Link}>
          <p>Links</p>
        </Modal>
      </>
    );
  }

  it("opens as a named dialog and closes on Escape, returning focus", async () => {
    render(<Harness />);
    const opener = screen.getByRole("button", { name: "Public links" });
    await userEvent.click(opener);
    expect(screen.getByRole("dialog", { name: "Public links" })).toBeTruthy();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    // Radix hands focus back once the dialog has unmounted.
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });

  it("closes from its close button", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: "Public links" }));
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("Progress", () => {
  it("reports its value", () => {
    render(
      <>
        <Progress value={1 / 3} label="1 of 3 · Reading your job post" />
        <ProgressBar value={0.4} label="Importing" />
      </>,
    );
    const [steps, bar] = screen.getAllByRole("progressbar");
    expect(steps.getAttribute("aria-valuenow")).toBe("33");
    expect(steps.getAttribute("aria-valuetext")).toBe("1 of 3 · Reading your job post");
    expect(bar.getAttribute("aria-valuenow")).toBe("40");
  });
});
