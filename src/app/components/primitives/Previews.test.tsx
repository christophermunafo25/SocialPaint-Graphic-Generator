import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Link } from "lucide-react";
import React, { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Modal, Progress, ProgressBar } from "./Containers";
import {
  LookTile,
  PreviewOverlay,
  ResultCard,
  ResultCardArt,
  ResultCardSkeleton,
} from "./Previews";

describe("ResultCard", () => {
  const sizes = [
    { id: "ig", label: "Instagram" },
    { id: "li", label: "LinkedIn" },
  ];

  it("switches between its drafts and runs Edit, Download and its own Download", async () => {
    const onSelect = vi.fn();
    const onEdit = vi.fn();
    const onDownload = vi.fn();
    const onDownloadAll = vi.fn();
    render(
      <ResultCard
        sizes={sizes}
        selectedId="ig"
        onSelect={onSelect}
        sizesLabel="Variations"
        meta="1080 × 1350"
        art={<ResultCardArt ratio={0.8}>art</ResultCardArt>}
        onEdit={onEdit}
        editLabel="Edit Now hiring"
        selected
        onDownload={onDownload}
        downloadLabel="Download Now hiring"
        caption="Come paint with us"
        downloadAll={{ label: "Download both", onClick: onDownloadAll }}
      />,
    );
    const group = screen.getByRole("radiogroup", { name: "Variations" });
    expect(group).toBeTruthy();
    await userEvent.click(screen.getByRole("radio", { name: "LinkedIn" }));
    expect(onSelect).toHaveBeenCalledWith("li");
    const edit = screen.getByRole("button", { name: "Edit Now hiring" });
    expect(edit.getAttribute("aria-current")).toBe("true");
    await userEvent.click(edit);
    await userEvent.click(screen.getByRole("button", { name: "Download Now hiring" }));
    await userEvent.click(screen.getByRole("button", { name: "Download both" }));
    expect(onEdit).toHaveBeenCalled();
    expect(onDownload).toHaveBeenCalled();
    expect(onDownloadAll).toHaveBeenCalled();
    expect(screen.getByText("1080 × 1350")).toBeTruthy();
    expect(screen.getByText("Come paint with us")).toBeTruthy();
  });

  it("shows no switch for one draft, and a busy Download takes no click", async () => {
    const onDownloadAll = vi.fn();
    render(
      <ResultCard
        sizes={[sizes[0]]}
        selectedId="ig"
        onSelect={() => {}}
        meta="1080 × 1350"
        art={null}
        downloadAll={{ label: "Download", onClick: onDownloadAll, busy: true }}
      />,
    );
    expect(screen.queryByRole("radiogroup")).toBeNull();
    expect(screen.queryByRole("button", { name: "Copy caption" })).toBeNull();
    const download = screen.getByRole("button", { name: "Download" });
    expect(download.getAttribute("aria-busy")).toBe("true");
    await userEvent.click(download);
    expect(onDownloadAll).not.toHaveBeenCalled();
  });

  it("copies the caption and says so", async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    render(<ResultCard meta="1080 × 1350" art={null} caption="Come paint with us" />);
    await user.click(screen.getByRole("button", { name: "Copy caption" }));
    expect(writeText).toHaveBeenCalledWith("Come paint with us");
    expect(screen.getByRole("status").textContent).toBe("Caption copied");
    writeText.mockRestore();
  });

  it("draws its Loading state as decoration", () => {
    const { container } = render(<ResultCardSkeleton />);
    const card = container.firstElementChild as HTMLElement;
    expect(card.getAttribute("aria-hidden")).toBe("true");
    expect(card.dataset.state).toBe("loading");
  });
});

describe("PreviewOverlay", () => {
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
