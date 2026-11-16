import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import type { TemplateSchema } from "@/lib/types";
import { PublishDialog } from "./PublishDialog";

vi.mock("../TemplateThumbnail", () => ({ TemplateThumbnail: () => null }));

const details = (name: string) => ({
  name,
  captionTemplate: "",
  category: "",
  tags: [],
  description: "",
});

const props = (name: string) => ({
  schema: { fields: [], canvasWidth: 1080, canvasHeight: 1350 } as unknown as TemplateSchema,
  details: details(name),
  fields: [],
  onDetails: vi.fn(),
  overflows: [],
  onShowField: vi.fn(),
  busy: false,
  republish: false,
  onPublish: vi.fn(),
  onClose: vi.fn(),
});

describe("PublishDialog", () => {
  it("asks for a real name before it publishes", async () => {
    const p = props("Untitled template");
    render(<PublishDialog {...p} />);
    await userEvent.click(screen.getByRole("button", { name: "Publish" }));
    expect(p.onPublish).not.toHaveBeenCalled();
    expect(screen.getByText("Name the template before you publish.")).toBeTruthy();
  });

  it("publishes a named template", async () => {
    const p = props("Now hiring");
    render(<PublishDialog {...p} />);
    await userEvent.click(screen.getByRole("button", { name: "Publish" }));
    expect(p.onPublish).toHaveBeenCalled();
  });

  it("names a field whose limit runs past its box, with Show", async () => {
    const p = {
      ...props("Now hiring"),
      overflows: [{ fieldId: "f1", label: "Apply link", maxLength: 40 }],
    };
    render(<PublishDialog {...p} />);
    expect(screen.getByText("Apply link runs past its box at 40 characters")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Show Apply link" }));
    expect(p.onShowField).toHaveBeenCalledWith("f1");
  });
});
