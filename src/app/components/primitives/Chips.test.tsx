import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Globe } from "lucide-react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { Chip, ChoiceChip, DetailTag, PlatformChip, Status, Tag } from "./Chips";

describe("chips", () => {
  it("Chip is a button", async () => {
    const onClick = vi.fn();
    render(<Chip onClick={onClick}>Add a location</Chip>);
    await userEvent.click(screen.getByRole("button", { name: "Add a location" }));
    expect(onClick).toHaveBeenCalled();
  });

  it("ChoiceChip reflects its choice in aria-pressed", () => {
    render(
      <>
        <ChoiceChip selected>Primary</ChoiceChip>
        <ChoiceChip selected={false}>Secondary</ChoiceChip>
      </>,
    );
    expect(screen.getByRole("button", { name: "Primary" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(screen.getByRole("button", { name: "Secondary" }).getAttribute("aria-pressed")).toBe(
      "false",
    );
  });

  it("PlatformChip takes the role and state its group gives it", () => {
    render(
      <PlatformChip platform="instagram" selected role="radio" aria-checked>
        Instagram
      </PlatformChip>,
    );
    const chip = screen.getByRole("radio", { name: "Instagram" });
    expect(chip.getAttribute("aria-checked")).toBe("true");
    expect(chip.dataset.selected).toBe("true");
  });
});

describe("tags", () => {
  it("Default and Overlay are text, Filter and Missing are buttons", () => {
    render(
      <>
        <Tag>Primary</Tag>
        <Tag kind="overlay">On media</Tag>
        <Tag kind="filter">Hiring</Tag>
        <Tag kind="missing">Location</Tag>
      </>,
    );
    expect(screen.queryByRole("button", { name: "Primary" })).toBeNull();
    expect(screen.queryByRole("button", { name: "On media" })).toBeNull();
    expect(screen.getByRole("button", { name: "Hiring" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Location" })).toBeTruthy();
  });

  it("DetailTag's remove button is named and removes; Sent has none", async () => {
    const onRemove = vi.fn();
    render(
      <>
        <DetailTag icon={Globe} onRemove={onRemove} removeLabel="Remove socialpaint.ai/careers">
          socialpaint.ai/careers
        </DetailTag>
        <DetailTag state="sent">Remote</DetailTag>
      </>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Remove socialpaint.ai/careers" }));
    expect(onRemove).toHaveBeenCalled();
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("Status is text", () => {
    render(<Status tone="positive">Connected</Status>);
    expect(screen.getByText("Connected")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
