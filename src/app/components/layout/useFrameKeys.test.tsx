import { fireEvent, render } from "@testing-library/react";
import React, { useRef } from "react";
import { describe, expect, it } from "vitest";
import { useFrameKeys } from "./useFrameKeys";

/** The app shell in miniature: a sidebar button and a nav, then Main's
 * content (a scroller 500 tall holding 2000) with a field, a button, a list
 * that can scroll on its own and a line of text inside. */
function Shell({ active = true }: { active?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useFrameKeys(ref, active);
  return (
    <div className="sp-appshell">
      <button type="button">Brand Templates</button>
      <nav data-testid="nav" style={{ overflowY: "auto" }}>
        <button type="button">Insights</button>
      </nav>
      <main>
        <div ref={ref} data-testid="content" style={{ overflowY: "auto" }}>
          <input aria-label="Search" />
          <button type="button">Inside</button>
          <div data-testid="list" style={{ overflowY: "auto" }}>
            <p data-testid="row">Row</p>
          </div>
          <p data-testid="text">Text</p>
        </div>
      </main>
    </div>
  );
}

/** Gives an element room to scroll, as a real layout would. */
function overflow(el: HTMLElement) {
  Object.defineProperty(el, "clientHeight", { configurable: true, value: 100 });
  Object.defineProperty(el, "scrollHeight", { configurable: true, value: 300 });
}

function setup(active = true) {
  const view = render(<Shell active={active} />);
  const content = view.getByTestId("content");
  Object.defineProperty(content, "clientHeight", { configurable: true, value: 500 });
  Object.defineProperty(content, "scrollHeight", { configurable: true, value: 2000 });
  content.scrollTop = 0;
  return { ...view, content };
}

describe("useFrameKeys", () => {
  it("scrolls the content a page for Page Down on the page itself", () => {
    const { content } = setup();
    fireEvent.keyDown(document.body, { key: "PageDown" });
    expect(content.scrollTop).toBe(460);
  });

  it("scrolls the content for Page Down and the arrows from the sidebar", () => {
    const { content, getByRole } = setup();
    const nav = getByRole("button", { name: "Brand Templates" });
    fireEvent.keyDown(nav, { key: "PageDown" });
    expect(content.scrollTop).toBe(460);
    fireEvent.keyDown(nav, { key: "ArrowUp" });
    expect(content.scrollTop).toBe(420);
  });

  it("takes Space only from the page itself, where it presses nothing", () => {
    const { content, getByRole } = setup();
    fireEvent.keyDown(getByRole("button", { name: "Brand Templates" }), { key: " " });
    expect(content.scrollTop).toBe(0);
    fireEvent.keyDown(document.body, { key: " " });
    expect(content.scrollTop).toBe(460);
  });

  it("leaves keys inside the content, in a field or already handled to the browser", () => {
    const { content, getByRole } = setup();
    fireEvent.keyDown(getByRole("button", { name: "Inside" }), { key: "PageDown" });
    fireEvent.keyDown(getByRole("textbox", { name: "Search" }), { key: "PageDown" });
    const handled = new KeyboardEvent("keydown", {
      key: "PageDown",
      cancelable: true,
      bubbles: true,
    });
    handled.preventDefault();
    document.body.dispatchEvent(handled);
    fireEvent.keyDown(document.body, { key: "PageDown", metaKey: true });
    expect(content.scrollTop).toBe(0);
  });

  it("leaves a key to a region of the shell that scrolls on its own", () => {
    const { content, getByRole, getByTestId } = setup();
    fireEvent.keyDown(getByRole("button", { name: "Insights" }), { key: "PageDown" });
    expect(content.scrollTop).toBe(460);
    overflow(getByTestId("nav"));
    fireEvent.keyDown(getByRole("button", { name: "Insights" }), { key: "PageDown" });
    expect(content.scrollTop).toBe(460);
  });

  it("with nothing focused, starts from where the pointer last went down", () => {
    const { content, getByTestId } = setup();
    overflow(getByTestId("list"));
    fireEvent.pointerDown(getByTestId("row"));
    fireEvent.keyDown(document.body, { key: "PageDown" });
    expect(content.scrollTop).toBe(0);
    fireEvent.pointerDown(getByTestId("text"));
    fireEvent.keyDown(document.body, { key: "PageDown" });
    expect(content.scrollTop).toBe(460);
  });

  it("leaves a dialog outside the shell alone", () => {
    const { content } = setup();
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    const close = document.createElement("button");
    dialog.append(close);
    document.body.append(dialog);
    fireEvent.keyDown(close, { key: "PageDown" });
    expect(content.scrollTop).toBe(0);
    dialog.remove();
  });

  it("does nothing while inactive or when the content does not scroll", () => {
    const off = setup(false);
    fireEvent.keyDown(document.body, { key: "PageDown" });
    expect(off.content.scrollTop).toBe(0);
    off.unmount();

    const { content } = setup();
    Object.defineProperty(content, "scrollHeight", { configurable: true, value: 500 });
    fireEvent.keyDown(document.body, { key: "End" });
    expect(content.scrollTop).toBe(0);
  });
});
