import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { TemplateSchema } from "@/lib/types";

vi.mock("../TemplateThumbnail", () => ({
  TemplateThumbnail: () => <span data-testid="thumb" />,
}));

const { BuilderTemplateCard } = await import("./BuilderTemplateCard");

const T0 = "2026-11-25T10:00:00.000Z";
const schema = (status: TemplateSchema["status"]): TemplateSchema => ({
  id: `tpl-${status}`,
  companyId: "co-1",
  name: status === "draft" ? "Hiring post" : "Event promo",
  description: "",
  category: "",
  tags: [],
  status,
  canvasWidth: 1080,
  canvasHeight: 1350,
  backgroundUrl: "",
  fields: [],
  captionTemplate: "",
  createdAt: T0,
  updatedAt: T0,
});

describe("BuilderTemplateCard", () => {
  it("says Draft on a draft, beside its usage line", () => {
    const { container } = render(
      <BuilderTemplateCard
        template={schema("draft")}
        usage="Edited 2 days ago"
        menu={[]}
        onOpen={() => {}}
      />,
    );
    expect(screen.getByText("Draft")).toBeTruthy();
    expect(container.querySelectorAll(".ui-badge")).toHaveLength(1);
    expect(screen.getByText("Edited 2 days ago")).toBeTruthy();
  });

  it("shows no Badge on a published template, only its usage line", () => {
    const { container } = render(
      <BuilderTemplateCard
        template={schema("published")}
        usage="56 downloads"
        menu={[]}
        onOpen={() => {}}
      />,
    );
    expect(container.querySelector(".ui-badge")).toBeNull();
    expect(screen.queryByText("Published")).toBeNull();
    expect(screen.getByText("56 downloads")).toBeTruthy();
  });
});
