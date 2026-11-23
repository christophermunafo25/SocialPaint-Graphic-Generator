import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChartColumn } from "lucide-react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { PRIVACY_URL, TERMS_URL } from "@/lib/legalLinks";
import { Breadcrumb, FooterLinks, PageHeader } from "./PageHeader";

describe("Breadcrumb", () => {
  it("links the earlier crumbs and makes the last one the page's heading", async () => {
    const onHome = vi.fn();
    render(
      <Breadcrumb
        currentId="page-title"
        crumbs={[{ label: "Brand Studio", onClick: onHome }, { label: "Colors" }]}
      />,
    );
    expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toBeTruthy();
    const heading = screen.getByRole("heading", { level: 1, name: "Colors" });
    expect(heading.id).toBe("page-title");
    expect(heading.getAttribute("aria-current")).toBe("page");
    await userEvent.click(screen.getByRole("button", { name: "Brand Studio" }));
    expect(onHome).toHaveBeenCalledTimes(1);
  });

  it("leaves the heading to the page when the last crumb is not it", () => {
    render(
      <Breadcrumb
        currentIsHeading={false}
        crumbs={[{ label: "Generate", onClick: () => {} }, { label: "History" }]}
      />,
    );
    expect(screen.queryByRole("heading")).toBeNull();
    expect(screen.getByText("History").getAttribute("aria-current")).toBe("page");
  });

  it("a crumb with an address is a real link whose plain click stays in the app", async () => {
    const onClick = vi.fn();
    render(
      <Breadcrumb
        crumbs={[{ label: "Generate", href: "/generate", onClick }, { label: "Hiring post" }]}
      />,
    );
    const link = screen.getByRole("link", { name: "Generate" });
    expect(link.getAttribute("href")).toBe("/generate");
    await userEvent.click(link);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe("PageHeader", () => {
  it("Title kind: the title is the heading, with the actions beside it", () => {
    render(<PageHeader title="Insights & Analytics" actions={<button>Export CSV</button>} />);
    expect(screen.getByRole("heading", { level: 1, name: "Insights & Analytics" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Export CSV" })).toBeTruthy();
    expect(screen.queryByRole("navigation")).toBeNull();
  });

  it("Breadcrumb kind: the trail takes the title's place, and a status line can sit before the actions", () => {
    render(
      <PageHeader
        crumbs={[{ label: "Brand Studio", onClick: () => {} }, { label: "Colors" }]}
        status="All changes saved"
        actions={<button>Undo</button>}
      />,
    );
    expect(screen.getByRole("heading", { level: 1, name: "Colors" })).toBeTruthy();
    // The save status is read out as it changes.
    const status = screen.getByRole("status");
    expect(status.textContent).toBe("All changes saved");
    const undo = screen.getByRole("button", { name: "Undo" });
    // The status comes before the actions.
    expect(status.compareDocumentPosition(undo) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("leads with the area's icon, hidden from assistive tech, and sets the title in Label/M", () => {
    const { container } = render(<PageHeader icon={ChartColumn} title="Insights & Analytics" />);
    const lead = container.querySelector(".ui-page-header__lead")!;
    const icon = lead.firstElementChild!;
    expect(icon.tagName.toLowerCase()).toBe("svg");
    expect(icon.getAttribute("aria-hidden")).toBe("true");
    expect(icon.getAttribute("width")).toBe("18");
    const heading = screen.getByRole("heading", { level: 1, name: "Insights & Analytics" });
    expect(heading.classList.contains("t-label-m")).toBe(true);
    expect(icon.nextElementSibling).toBe(heading);
  });

  it("puts the icon before the trail too", () => {
    const { container } = render(
      <PageHeader
        icon={ChartColumn}
        crumbs={[{ label: "Brand Studio", onClick: () => {} }, { label: "Colors" }]}
      />,
    );
    const lead = container.querySelector(".ui-page-header__lead")!;
    expect(lead.firstElementChild?.tagName.toLowerCase()).toBe("svg");
    expect(lead.querySelector("nav[aria-label='Breadcrumb']")).not.toBeNull();
  });

  it("leaves the heading to the page when the title is not it", () => {
    render(<PageHeader icon={ChartColumn} title="Generate" titleIsHeading={false} />);
    expect(screen.queryByRole("heading")).toBeNull();
    expect(screen.getByText("Generate").tagName.toLowerCase()).toBe("p");
  });

  it("has no trailing group when there is nothing to put in it", () => {
    const { container } = render(<PageHeader title="Settings" />);
    expect(container.querySelector(".ui-page-header__end")).toBeNull();
  });
});

describe("FooterLinks", () => {
  it("opens the terms and the privacy policy in a new tab, with the opener cut", () => {
    render(<FooterLinks />);
    const terms = screen.getByRole("link", { name: "Terms of Service" });
    const privacy = screen.getByRole("link", { name: "Privacy Policy" });
    expect(terms.getAttribute("href")).toBe(TERMS_URL);
    expect(privacy.getAttribute("href")).toBe(PRIVACY_URL);
    for (const link of [terms, privacy]) {
      expect(link.getAttribute("target")).toBe("_blank");
      expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    }
  });
});
