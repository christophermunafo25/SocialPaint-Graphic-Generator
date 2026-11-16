import { render } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

// The route's address, as the page sees it.
let url = "/insights";
vi.mock("../../router", () => ({
  useRouter: () => ({ route: { name: "dashboard" }, navigate: () => {} }),
  routeToUrl: () => url,
}));

import { Page } from "./Page";

const content = (container: HTMLElement) =>
  container.querySelector<HTMLElement>("[data-frame-scroll]")!;

describe("Page", () => {
  it("puts the header in the header row, above the scrolling content", () => {
    const { container } = render(
      <Page header={<h1>Insights</h1>}>
        <p>Body</p>
      </Page>,
    );
    const frame = container.querySelector(".sp-frame")!;
    expect(frame.getAttribute("data-kind")).toBe("scroll");
    expect(frame.hasAttribute("data-head")).toBe(true);
    expect(frame.querySelector(".sp-frame__head h1")?.textContent).toBe("Insights");
    expect(content(container).classList.contains("sp-page")).toBe(true);
    expect(content(container).textContent).toBe("Body");
    expect(frame.querySelector(".sp-frame__fade")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("keeps the page's own class, state and narrow gutters on the content", () => {
    const { container } = render(
      <Page bleed layout={{ className: "sp-chat-page", state: "start" }}>
        <p>Body</p>
      </Page>,
    );
    const el = content(container);
    expect(el.className).toBe("sp-page sp-page--bleed sp-chat-page");
    expect(el.getAttribute("data-state")).toBe("start");
    expect(container.querySelector(".sp-frame")?.hasAttribute("data-head")).toBe(false);
  });

  it("leaves the fade out of a page that scrolls itself", () => {
    const { container } = render(
      <Page kind="self" header={<h1>Generate</h1>}>
        <p>Thread</p>
      </Page>,
    );
    expect(container.querySelector(".sp-frame")?.getAttribute("data-kind")).toBe("self");
    expect(container.querySelector(".sp-frame__head")).not.toBeNull();
    expect(container.querySelector(".sp-frame__fade")).toBeNull();
  });

  it("gives a bare page no header row and no fade", () => {
    const { container } = render(
      <Page kind="bare" header={<h1>Ignored</h1>}>
        <p>Editor</p>
      </Page>,
    );
    expect(container.querySelector(".sp-frame__head")).toBeNull();
    expect(container.querySelector(".sp-frame__fade")).toBeNull();
    expect(container.querySelector(".sp-frame")?.hasAttribute("data-head")).toBe(false);
  });

  it("returns to the top for a new path, and keeps the scroll for a filter", () => {
    url = "/templates?platform=instagram";
    const { container, rerender } = render(
      <Page>
        <p>Body</p>
      </Page>,
    );
    const el = content(container);
    el.scrollTop = 300;
    url = "/templates?platform=linkedin";
    rerender(
      <Page>
        <p>Body</p>
      </Page>,
    );
    expect(el.scrollTop).toBe(300);
    url = "/settings/people";
    rerender(
      <Page>
        <p>Body</p>
      </Page>,
    );
    expect(el.scrollTop).toBe(0);
  });
});
