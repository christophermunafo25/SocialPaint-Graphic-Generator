import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Globe, Plus } from "lucide-react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { Badge, Chip, DetailTag, PlatformChip, Tag } from "./Chips";

describe("chips", () => {
  it("Chip is a button", async () => {
    const onClick = vi.fn();
    render(<Chip onClick={onClick}>Add a location</Chip>);
    await userEvent.click(screen.getByRole("button", { name: "Add a location" }));
    expect(onClick).toHaveBeenCalled();
  });

  it("a chip that toggles reflects its choice in aria-pressed; one that acts has none", () => {
    render(
      <>
        <Chip selected>Primary</Chip>
        <Chip selected={false}>Secondary</Chip>
        <Chip>Add a location</Chip>
      </>,
    );
    const primary = screen.getByRole("button", { name: "Primary" });
    expect(primary.getAttribute("aria-pressed")).toBe("true");
    expect(primary.dataset.selected).toBe("true");
    expect(screen.getByRole("button", { name: "Secondary" }).getAttribute("aria-pressed")).toBe(
      "false",
    );
    expect(
      screen.getByRole("button", { name: "Add a location" }).hasAttribute("aria-pressed"),
    ).toBe(false);
  });

  it("Chip draws a leading icon hidden from assistive tech", () => {
    const { container } = render(<Chip icon={Globe}>Website</Chip>);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    expect(svg?.getAttribute("width")).toBe("16");
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
  it("a tag is text; given something to do it is a button", async () => {
    const onClick = vi.fn();
    render(
      <>
        <Tag>Primary</Tag>
        <Tag kind="overlay">On media</Tag>
        <Tag kind="outline">Draft</Tag>
        <Tag kind="outline" icon={Plus} onClick={onClick}>
          Location
        </Tag>
      </>,
    );
    expect(screen.queryByRole("button", { name: "Primary" })).toBeNull();
    expect(screen.queryByRole("button", { name: "On media" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Draft" })).toBeNull();
    const add = screen.getByRole("button", { name: "Location" });
    expect(add.dataset.kind).toBe("outline");
    await userEvent.click(add);
    expect(onClick).toHaveBeenCalled();
  });

  it("a text tag keeps what describes it", () => {
    const { container } = render(
      <Tag kind="overlay" className="mine" aria-hidden>
        Moss
      </Tag>,
    );
    const tag = container.querySelector(".ui-tag") as HTMLElement;
    expect(tag.tagName).toBe("SPAN");
    expect(tag.classList.contains("mine")).toBe(true);
    expect(tag.getAttribute("aria-hidden")).toBe("true");
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

  it("DetailTag's value is a button only when it can be edited", async () => {
    const onEdit = vi.fn();
    const { rerender } = render(<DetailTag removeLabel="Remove Remote">Remote</DetailTag>);
    expect(screen.getAllByRole("button")).toHaveLength(1);
    rerender(
      <DetailTag removeLabel="Remove Remote" editLabel="Edit Location: Remote" onEdit={onEdit}>
        Remote
      </DetailTag>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Edit Location: Remote" }));
    expect(onEdit).toHaveBeenCalled();
  });

  it("Badge is text, in any of its tones", () => {
    const { container } = render(
      <>
        <Badge tone="positive">Connected</Badge>
        <Badge tone="error" icon={Globe}>
          Failed
        </Badge>
      </>,
    );
    expect(screen.getByText("Connected")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
    expect(container.querySelector('[data-tone="error"] svg')?.getAttribute("aria-hidden")).toBe(
      "true",
    );
  });
});
